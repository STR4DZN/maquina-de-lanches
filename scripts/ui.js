import {catalogPage,quantityState} from "./catalog.js";
import {ID, ensure, product, machine,appearance,imageFit} from "./core.js";
import {renderView} from "./view.js";
import {getMachine, machinesIn, usableTokens, activeGM, assertGM} from "./service.js";
import {slotCode,paintVariables} from "./cabinet.js";
import {renderManager,MACHINE_PALETTES} from "./manager-view.js";
import {ProductImageEditor} from "./image-editor.js";
import {geometryOf,geometrySignature,moveShapes,scaleShapes,cleanElevation,shapeBounds} from "./area.js";

function downloadJSON(value,name) {
  const blob=new Blob([JSON.stringify(value,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export class VendingApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS={id:"holosuite-vending-app",classes:["hv-app"],window:{title:"Máquina de lanches",icon:"fa-solid fa-store",resizable:true},position:{width:900,height:875}};
  constructor(service,options={}) {
    super(options);this.service=service;
    this.state={regionId:null,selectedId:null,category:"all",search:"",quantity:1,tokenId:"",viewTab:"store",editing:false,editorTab:"products",editProductId:null,dirty:false,busy:false,status:"",confirm:null,page:0,codeEntry:"",delivered:null};
    this.unsubscribe=null;this.refreshTimer=null;
  }
  get region() { return canvas.scene?.regions.get(this.state.regionId); }
  async _renderHTML() {
    const regions=machinesIn();
    if(!regions.some(r=>r.id===this.state.regionId)) {
      this.state.regionId=regions[0]?.id ?? null;this.state.editing=false;this.state.draft=null;this.state.dirty=false;
    }
    const m=getMachine(this.region),tokens=usableTokens(this.region);
    if(this.manager){assertGM();if(m&&!this.state.editing)this.beginEditing();if(m&&this.state.areaRegionId!==this.region.id)this.resetArea();}
    if(!tokens.some(t=>t.id===this.state.tokenId)) this.state.tokenId=tokens[0]?.id ?? "";
    if(m&&!this.manager){this.state.page=catalogPage(m,this.state).page;}
    if(m && !m.products.some(p=>p.id===this.state.selectedId && p.enabled)) this.state.selectedId=null;
    const context={...this.state,isGM:game.user.isGM,userId:game.user.id,theme:game.settings.get(ID,"theme"),gridSize:this.region?.parent.grid.size,
      gmOnline:!!activeGM()?.active,tokens,liveMachine:m,stale:this.state.editing && this.state.draft.revision!==m?.revision,
      machines:regions.map(r=>({id:r.id,machine:getMachine(r)}))};
    return this.manager?renderManager(context):renderView(context);
  }
  _replaceHTML(result,content) {
    const oldScroll=[...content.querySelectorAll(".vm-stage,.vm-manager-product-form,.vm-manager-list-scroll,.vm-manager-settings,.vm-manager-area,.hv-editor-content,.hv-settings,.hv-history-table,.hv-editor-list")].map(el=>[el.className,el.scrollTop]);
    const active=document.activeElement;
    const focus=content.contains(active) && active?.matches("input,textarea,select")?{name:active.name,type:active.type,filter:active.dataset.filter,start:active.selectionStart,end:active.selectionEnd}:null;
    content.innerHTML=result;
    if(this.state.busy)content.querySelectorAll("input,select,textarea").forEach(input=>{input.disabled=true;});
    content.addEventListener("click",e=>this.onClick(e).catch(error=>this.showError(error)),{signal:this.listenersSignal()});
    content.addEventListener("input",e=>this.onInput(e),{signal:this.eventController.signal});
    content.addEventListener("change",e=>this.onChange(e).catch(error=>this.showError(error)),{signal:this.eventController.signal});
    content.addEventListener("submit",e=>e.preventDefault(),{signal:this.eventController.signal});
    content.addEventListener("keydown",e=>{
      if(!this.state.confirm)return;
      if(e.key==="Escape"){e.stopPropagation();this.state.confirm=null;this.refresh();}
      if(e.key==="Tab"){
        const buttons=[...content.querySelectorAll(".hv-confirm button")],first=buttons[0],last=buttons.at(-1);
        if(e.shiftKey && document.activeElement===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();}
      }
    },{signal:this.eventController.signal});
    content.querySelectorAll("img").forEach(img=>img.addEventListener("error",()=>{const note=document.createElement("span");note.className="hv-image-missing";note.textContent="Imagem indisponível";img.replaceWith(note);},{once:true}));
    for(const [cls,scroll] of oldScroll) { const el=[...content.querySelectorAll(".vm-stage,.vm-manager-product-form,.vm-manager-list-scroll,.vm-manager-settings,.vm-manager-area,.hv-editor-content,.hv-settings,.hv-history-table,.hv-editor-list")].find(el=>el.className===cls);if(el) el.scrollTop=scroll; }
    if(focus) {
      const target=[...content.querySelectorAll("input,textarea,select")].find(el=>focus.filter?el.dataset.filter===focus.filter:el.name===focus.name&&el.type===focus.type);
      target?.focus();if(target && typeof focus.start==="number") {try{target.setSelectionRange(focus.start,focus.end);}catch{}}
    }
    if(this.state.confirm) content.querySelector('[data-hv="cancel-confirm"]')?.focus();
  }
  listenersSignal() {this.eventController?.abort();this.eventController=new AbortController();return this.eventController.signal;}
  _onFirstRender() { if(!this.unsubscribe)this.unsubscribe=this.service.subscribe(()=>this.refresh()); }
  _onRender() {if(!this.unsubscribe)this.unsubscribe=this.service.subscribe(()=>this.refresh());}
  async close(options={}) {
    if((this.state.dirty||this.state.areaDirty) && !await this.confirmDiscard())return this;
    this.imageEditor?.close();

    this.state.dirty=false;this.state.editing=false;this.state.draft=null;this.state.confirm=null;
    this.state.areaDirty=false;this.state.areaDraft=null;this.state.areaRegionId=null;
    return super.close(options);
  }
  _onClose() {this.unsubscribe?.();this.unsubscribe=null;clearTimeout(this.refreshTimer);this.eventController?.abort();this.imageEditor?.close();}
  refresh() {if(!this.rendered)return;clearTimeout(this.refreshTimer);this.refreshTimer=setTimeout(()=>this.render().catch(error=>this.showError(error)),60);}
  showError(error) {this.state.status=error.message;ui.notifications.warn(error.message);this.refresh();}
  async confirmDiscard() {return foundry.applications.api.DialogV2.confirm({window:{title:"Descartar rascunho?"},content:"<p>As alterações ainda não salvas serão descartadas.</p>",rejectClose:false});}
  async canLeave() { return !(this.state.dirty||this.state.areaDirty) || await this.confirmDiscard(); }
  beginEditing() {
    assertGM();this.state.draft=structuredClone(getMachine(this.region));this.state.editing=true;this.state.dirty=false;
    this.state.draft.appearance=appearance(this.state.draft.appearance);
    this.state.viewTab="store";
    this.state.editProductId=this.state.draft.products[0]?.id ?? null;this.state.editorTab="products";this.state.confirm=null;
  }
  onInput(event) {
    if(this.state.busy)return;
    const input=event.target,form=input.closest("[data-form]");
    if(form?.dataset.form==="area") {this.state.areaDraft.elevation[input.name]=input.value===""?null:Number(input.value);this.state.areaDirty=true;this.element.querySelector('[data-hv="area-apply"]').disabled=false;return;}
    if(form && this.state.editing) {
      const target=form.dataset.form==="machine"?this.state.draft:this.state.draft.products.find(p=>p.id===this.state.editProductId);
      if(target && input.name) {const value=input.type==="checkbox"?input.checked:input.type==="number"?input.value===""?"":Number(input.value):input.value;if(input.name.startsWith("appearance."))target.appearance[input.name.split('.')[1]]=value;else target[input.name]=value;this.state.dirty=true;}
      const footer=this.element.querySelector(".hv-editor-footer span");if(footer)footer.textContent="Alterações ainda não salvas";
      const badge=this.element.querySelector(".vm-manager-save-state");if(badge)badge.textContent="Alterações pendentes";
      if(input.type==="color" || input.name.startsWith("appearance.") || input.name==="color")this.updateLiveAppearance(input);
      return;
    }
    if(input.dataset.filter==="search") {this.state.search=input.value;this.state.page=0;this.refresh();}
    if(input.dataset.filter==="quantity") {this.state.quantity=input.value===""?"":Number(input.value);this.refresh();}
    if(input.dataset.filter==="code") {this.selectCode(input.value);this.refresh();}
    if(input.dataset.filter==="product-search") {this.state.productSearch=input.value;this.refresh();}
  }
  async onChange(event) {
    if(this.state.busy)return;
    const input=event.target;
    if(input.dataset.filter==="token") {this.state.tokenId=input.value;this.refresh();}
    if(input.dataset.filter==="page"){this.state.page=Number(input.value);this.refresh();}
    if(input.dataset.filter==="category") {this.state.category=input.value;this.state.page=0;const selected=getMachine(this.region)?.products.find(p=>p.id===this.state.selectedId);if(input.value!=="all"&&selected?.category!==input.value){this.state.selectedId=null;this.state.codeEntry="";this.state.quantity=1;}this.refresh();}
    if(input.dataset.filter==="machine") {if(!await this.canLeave()){this.refresh();return;}this.switchMachine(input.value);this.refresh();}
    if(input.dataset.filter==="area-step")this.state.areaStep=Number(input.value);
    if(input.dataset.import==="catalog") {
      assertGM();const file=input.files[0];if(!file)return;
      ensure(file.size<=1000000,"O catálogo deve ter até 1 MB.");
      const imported=machine(JSON.parse(await file.text()));
      const revision=this.state.draft.revision,history=this.state.draft.history;
      this.state.draft={...imported,revision,history};this.state.editProductId=imported.products[0]?.id;this.state.dirty=true;this.refresh();
    }
    if(input.closest("[data-form]") && (input.type==="checkbox" || input.tagName==="SELECT")) this.onInput(event);
  }
  async onClick(event) {
    const button=event.target.closest("[data-hv]");if(!button || button.disabled)return;
    const action=button.dataset.hv,id=button.dataset.id;
    if(this.state.busy)return;
    if(action==="machine") {
      if(!await this.canLeave())return;
      this.switchMachine(id);
    } else if(action==="theme") await game.settings.set(ID,"theme",game.settings.get(ID,"theme")==="dark"?"light":"dark");
    else if(action==="product") {this.state.selectedId=id;this.state.quantity=1;this.state.codeEntry="";this.state.status="Produto selecionado. Clique em Retirar lanche.";}
    else if(action==="category") this.state.category=id;
    else if(action==="page-next") {const c=catalogPage(getMachine(this.region),this.state);this.state.page=Math.min(c.pages-1,c.page+1);}
    else if(action==="page-prev") this.state.page=Math.max(0,catalogPage(getMachine(this.region),this.state).page-1);
    else if(action==="key") {this.selectCode((/^[A-Z]+[123]$/.test(this.state.codeEntry)?"":this.state.codeEntry)+id);}
    else if(action==="key-clear") {this.state.codeEntry="";this.state.selectedId=null;this.state.quantity=1;}
    else if(action==="quantity-minus") this.state.quantity=Math.max(1,this.state.quantity-1);
    else if(action==="quantity-plus") {const p=getMachine(this.region).products.find(p=>p.id===this.state.selectedId);this.state.quantity=Math.min(p.stock,getMachine(this.region).maxPerRequest,this.state.quantity+1);}
    else if(action==="collect") await this.collectDelivery();
    else if(action==="view-tab") {if(!await this.canLeave())return;this.state.viewTab=id;this.state.editing=false;this.state.dirty=false;this.state.confirm=null;}
    else if(action==="edit") {if(this.service.openManager&&!this.manager){await this.service.openManager({regionId:this.state.regionId});return;}if(this.state.editing){if(!await this.canLeave())return;this.state.editing=false;this.state.dirty=false;}else this.beginEditing();}
    else if(action==="editor-tab") this.state.editorTab=id;
    else if(action==="edit-product") this.state.editProductId=id;
    else if(action==="add-product") {
      assertGM();ensure(this.state.draft.products.length<200,"Limite de 200 produtos por máquina.");
      const p=product({id:foundry.utils.randomID(),name:"Novo produto",category:"Outros",stock:0,capacity:10,price:0,weight:1});
      this.state.draft.products.push(p);this.state.editProductId=p.id;this.state.dirty=true;
    } else if(action==="remove-product") {
      assertGM();if(!await foundry.applications.api.DialogV2.confirm({window:{title:"Excluir produto?"},content:"<p>O produto será removido quando você salvar. O histórico de retiradas será preservado.</p>",rejectClose:false}))return;
      this.state.draft.products=this.state.draft.products.filter(p=>p.id!==this.state.editProductId);this.state.editProductId=this.state.draft.products[0]?.id;this.state.dirty=true;
    } else if(action==="image-editor") {this.openImageEditor();return;}
    else if(action==="remove-image") {const p=this.state.draft.products.find(p=>p.id===this.state.editProductId);p.img="";p.imageFit=imageFit();this.state.dirty=true;}
    else if(action==="stock-minus"||action==="stock-plus"||action==="stock-full") {const p=this.state.draft.products.find(p=>p.id===this.state.editProductId);p.stock=action==="stock-full"?p.capacity:Math.max(0,Math.min(p.capacity,Number(p.stock)+(action==="stock-plus"?1:-1)));this.state.dirty=true;}
    else if(action==="draft-restock-all") {this.state.draft.products.forEach(p=>p.stock=p.capacity);this.state.dirty=true;}
    else if(action==="duplicate-product") {ensure(this.state.draft.products.length<200,"Limite de 200 produtos.");const original=this.state.draft.products.find(p=>p.id===this.state.editProductId);const copied={...structuredClone(original),id:foundry.utils.randomID(),name:`${original.name} (cópia)`};this.state.draft.products.push(copied);this.state.editProductId=copied.id;this.state.dirty=true;}
    else if(action==="product-up"||action==="product-down") {const list=this.state.draft.products,index=list.findIndex(p=>p.id===this.state.editProductId),to=index+(action==="product-up"?-1:1);if(to>=0&&to<list.length){[list[index],list[to]]=[list[to],list[index]];this.state.dirty=true;}}
    else if(action==="palette") {const palette=MACHINE_PALETTES[Number(id)];ensure(palette,"Paleta inválida.");this.state.draft.color=palette.body;this.state.draft.appearance={panel:palette.panel,marquee:palette.marquee,detail:palette.detail};this.state.dirty=true;}
    else if(action==="open-store") {await this.service.openStore?.({regionId:this.state.regionId});return;}
    else if(action==="area-focus") {await this.focusArea();return;}
    else if(action==="area-move") {const size=this.region.parent.grid.size*(this.state.areaStep||1);const [dx,dy]=({up:[0,-size],down:[0,size],left:[-size,0],right:[size,0]})[id];this.state.areaDraft.shapes=moveShapes(this.state.areaDraft.shapes,dx,dy);this.state.areaDirty=true;}
    else if(action==="area-scale") {this.state.areaDraft.shapes=scaleShapes(this.state.areaDraft.shapes,Number(id));this.state.areaDirty=true;}
    else if(action==="area-reset")this.resetArea();
    else if(action==="area-apply") {cleanElevation(this.state.areaDraft.elevation);await this.runBusy(()=>this.service.request(this.region,{action:"area",...this.state.areaDraft,signature:this.state.areaSignature}));this.resetArea();this.state.status="Área atualizada sem alterar produtos ou estoque.";}
    else if(action==="area-redraw") {if(!await this.canLeave())return;const region=this.region;this.state.dirty=false;this.state.areaDirty=false;await this.close();this.service.redrawArea(region,id);return;}
    else if(action==="pick-image") {
      assertGM();const p=this.state.draft.products.find(p=>p.id===this.state.editProductId);const productId=p.id;
      const Picker=foundry.applications.apps.FilePicker.implementation;
      new Picker({type:"image",current:p.img,callback:path=>{const target=this.state.draft?.products.find(p=>p.id===productId);if(!this.state.editing||!target)return;target.img=path;this.state.dirty=true;this.refresh();}}).render(true);
    } else if(action==="reload") {
      if(!await this.canLeave())return;this.beginEditing();
    } else if(action==="cancel-edit") {
      if(!await this.canLeave())return;if(this.manager){this.beginEditing();this.resetArea();}else{this.state.editing=false;this.state.dirty=false;this.state.draft=null;}
    } else if(action==="save") {
      assertGM();machine(this.state.draft);const tab=this.state.editorTab,productId=this.state.editProductId;
      const {history,revision,...config}=this.state.draft;
      const area=this.manager&&this.state.areaDirty?{...this.state.areaDraft,signature:this.state.areaSignature}:undefined;
      await this.runBusy(()=>this.service.request(this.region,{action:"save",machine:config,revision,area}));
      this.state.dirty=false;this.beginEditing();this.state.editorTab=tab;this.state.editProductId=this.state.draft.products.some(p=>p.id===productId)?productId:this.state.draft.products[0]?.id;this.state.status="Alterações salvas para todos os jogadores.";
      if(this.manager&&area)this.resetArea();
    } else if(action==="restock-all") {
      assertGM();ensure(!this.state.dirty,"Salve ou cancele seu rascunho antes de repor o estoque.");
      await this.runBusy(()=>this.service.request(this.region,{action:"restockAll"}));this.beginEditing();this.state.status="Todos os produtos foram repostos até a capacidade máxima.";
    } else if(action==="archive") {
      assertGM();ensure(!this.state.dirty,"Salve ou cancele o rascunho antes de arquivar.");const m=structuredClone(getMachine(this.region));
      if(!await foundry.applications.api.DialogV2.confirm({window:{title:"Exportar e arquivar histórico?"},content:"<p>O histórico será baixado em JSON e removido da máquina. Guarde o arquivo antes de continuar.</p>",rejectClose:false}))return;
      downloadJSON({machine:m.name,history:m.history},`vending-historico-${this.region.id}.json`);
      await this.runBusy(()=>this.service.request(this.region,{action:"archive",revision:m.revision}));this.beginEditing();this.state.editorTab="history";
    } else if(action==="export-catalog") {assertGM();const {history,revision,...catalog}=this.state.draft;downloadJSON(catalog,`vending-catalogo-${this.region.id}.json`);}
    else if(action==="region-sheet") {assertGM();canvas.regions.activate();this.region.sheet.render({force:true});}
    else if(action==="create") {if(!await this.canLeave())return;await this.createArea();}
    else if(action==="attach") {
      assertGM();if(!await this.canLeave())return;
      const region=canvas.regions.controlled[0]?.document;const attached=await this.service.attach(region);this.state.regionId=attached.id;this.beginEditing();
    } else if(action==="buy" || action==="random") await this.release(action==="random"?"random":"direct");
    this.refresh();
  }
  async runBusy(task) {this.state.busy=true;this.refresh();try{return await task();}finally{this.state.busy=false;this.refresh();}}
  updateLiveAppearance(input) {
    if(!/^#[a-f\d]{6}$/i.test(input.value))return;
    for(const element of this.element.querySelectorAll('[name]'))if(element.name===input.name&&element!==input)element.value=input.value;
    const cabinet=this.element.querySelector(".vm-manager-preview .vm-cabinet");if(cabinet)cabinet.style.cssText=paintVariables(this.state.draft);
  }
  resetArea() {this.state.areaDraft=geometryOf(this.region);this.state.areaSignature=geometrySignature(this.state.areaDraft);this.state.areaRegionId=this.region.id;this.state.areaDirty=false;}
  async focusArea() {assertGM();const bounds=this.region.bounds||shapeBounds(geometryOf(this.region).shapes);canvas.regions.activate();this.region.object?.control({releaseOthers:true});await canvas.animatePan({x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2,duration:500});}
  openImageEditor() {
    assertGM();this.imageEditor?.close();const regionId=this.state.regionId,productId=this.state.editProductId,p=this.state.draft.products.find(p=>p.id===productId);
    this.imageEditor=new ProductImageEditor({product:p,upload:this.service.uploadImage,onApply:({source,fit})=>{ensure(this.state.regionId===regionId&&this.state.draft,"A máquina mudou enquanto você editava a imagem.");const target=this.state.draft.products.find(p=>p.id===productId);ensure(target,"O produto foi removido.");target.img=source;target.imageFit=fit;this.state.dirty=true;this.state.status="Enquadramento pronto. Salve as alterações para aplicar aos jogadores.";this.refresh();},onClose:()=>{this.imageEditor=null;}});
    this.imageEditor.open().catch(error=>this.showError(error));
  }
  switchMachine(id) {
    this.imageEditor?.close();

    Object.assign(this.state,{regionId:id,editing:false,draft:null,dirty:false,areaDirty:false,selectedId:null,category:"all",search:"",confirm:null,status:"",page:0,codeEntry:"",delivered:null});
    this.state.areaRegionId=null;
  }
  selectCode(value) {
    const code=String(value).toUpperCase().replace(/[^A-Z1-3]/g,"").slice(0,4);
    this.state.codeEntry=code;const m=getMachine(this.region);
    const p=m.products.find((p,i)=>p.enabled && slotCode(i)===code);
    this.state.selectedId=p?.id??null;this.state.quantity=1;
    if(p){this.state.search="";this.state.category="all";this.state.page=Math.floor(m.products.filter(p=>p.enabled).findIndex(item=>item.id===p.id)/9);this.state.status=`${code}: ${p.name} selecionado.`;}
    else if(/[123]$/.test(code))this.state.status="Esse código não tem um produto disponível.";
  }
  async release(mode) {
    ensure(!this.state.delivered,"Pegue o lanche no compartimento antes de retirar outro.");
    ensure(this.state.tokenId,"Entre na área da máquina com seu token.");
    const region=this.region,quantity=mode==="random"?1:this.state.quantity,productId=this.state.selectedId,category=this.state.category;
    const chosen=getMachine(region).products.find(p=>p.id===productId);if(mode==="direct"){const check=quantityState(getMachine(region),chosen,quantity);ensure(check.valid,check.reason);}
    this.state.busy=true;this.state.status=mode==="random"?"Escolhendo uma surpresa para você…":"Preparando seu lanche…";this.refresh();
    try {
      const receipt=await this.service.request(region,{action:"dispense",mode,productId,quantity,category,tokenId:this.state.tokenId});
      if(this.state.regionId===region.id){
        this.state.selectedId=receipt.productId;this.state.codeEntry="";this.state.search="";
        const catalog=catalogPage(getMachine(region),{category:this.state.category});
        const index=catalog.visible.findIndex(item=>item.product.id===receipt.productId);
        this.state.page=index>=0?Math.floor(index/9):0;
        this.state.delivered=receipt;this.state.quantity=1;this.state.status=`${receipt.quantity} × ${receipt.name} está no compartimento. Clique em Pegar.`;
      }
    } finally {this.state.busy=false;this.refresh();}
  }
  async collectDelivery() {
    if(!this.state.delivered)return;
    this.state.delivered=null;this.state.status="Lanche retirado. Aproveite!";this.refresh();
  }
  async createArea() {
    assertGM();ensure(canvas.scene,"Abra um mapa antes de demarcar.");ensure(this.service.drawArea,"A ferramenta de demarcação não está disponível.");
    this.state.dirty=false;this.state.areaDirty=false;await this.close();this.service.drawArea("polygon");
  }
}
export class VendingManager extends VendingApp {
  static DEFAULT_OPTIONS={id:"holosuite-vending-manager",classes:["hv-app","vm-manager-app"],window:{title:"Gerenciar máquinas de lanches",icon:"fa-solid fa-sliders",resizable:true},position:{width:1140,height:800}};
  constructor(service,options={}){assertGM();super(service,options);this.manager=true;this.state.areaStep=1;}
  _canRender(){assertGM();}
}
