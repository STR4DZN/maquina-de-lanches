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
    this.vmState={regionId:null,selectedId:null,category:"all",search:"",quantity:1,tokenId:"",viewTab:"store",editing:false,editorTab:"products",editProductId:null,dirty:false,busy:false,status:"",confirm:null,page:0,codeEntry:"",delivered:null};
    this.unsubscribe=null;this.refreshTimer=null;
  }
  get region() { return canvas.scene?.regions.get(this.vmState.regionId); }
  async _renderHTML() {
    const regions=machinesIn();
    if(!regions.some(r=>r.id===this.vmState.regionId)) {
      this.vmState.regionId=regions[0]?.id ?? null;this.vmState.editing=false;this.vmState.draft=null;this.vmState.dirty=false;
    }
    const m=getMachine(this.region),tokens=usableTokens(this.region);
    if(this.manager){assertGM();if(m&&!this.vmState.editing)this.beginEditing();if(m&&this.vmState.areaRegionId!==this.region.id)this.resetArea();}
    if(!tokens.some(t=>t.id===this.vmState.tokenId)) this.vmState.tokenId=tokens[0]?.id ?? "";
    if(m&&!this.manager){this.vmState.page=catalogPage(m,this.vmState).page;}
    if(m && !m.products.some(p=>p.id===this.vmState.selectedId && p.enabled)) this.vmState.selectedId=null;
    const context={...this.vmState,isGM:game.user.isGM,userId:game.user.id,theme:game.settings.get(ID,"theme"),gridSize:this.region?.parent.grid.size,
      bankReady:!!game.modules?.get('holosuite-mana')?.api?.purchase,bankBalance:game.modules?.get('holosuite-mana')?.api?.getBalance?.()??0,canUse:true,gmOnline:!!activeGM()?.active,tokens,liveMachine:m,stale:this.vmState.editing && this.vmState.draft.revision!==m?.revision,
      machines:regions.map(r=>({id:r.id,machine:getMachine(r)}))};
    return this.manager?renderManager(context):renderView(context);
  }
  _replaceHTML(result,content) {
    const oldScroll=[...content.querySelectorAll(".vm-stage,.vm-manager-product-form,.vm-manager-list-scroll,.vm-manager-settings,.vm-manager-area,.hv-editor-content,.hv-settings,.hv-history-table,.hv-editor-list")].map(el=>[el.className,el.scrollTop]);
    const active=document.activeElement;
    const focus=content.contains(active) && active?.matches("input,textarea,select")?{name:active.name,type:active.type,filter:active.dataset.filter,start:active.selectionStart,end:active.selectionEnd}:null;
    content.innerHTML=result;
    if(this.vmState.busy)content.querySelectorAll("input,select,textarea").forEach(input=>{input.disabled=true;});
    content.addEventListener("click",e=>this.onClick(e).catch(error=>this.showError(error)),{signal:this.listenersSignal()});
    content.addEventListener("input",e=>this.onInput(e),{signal:this.eventController.signal});
    content.addEventListener("change",e=>this.onChange(e).catch(error=>this.showError(error)),{signal:this.eventController.signal});
    content.addEventListener("submit",e=>e.preventDefault(),{signal:this.eventController.signal});
    content.addEventListener("keydown",e=>{
      if(!this.vmState.confirm)return;
      if(e.key==="Escape"){e.stopPropagation();this.vmState.confirm=null;this.refresh();}
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
    if(this.vmState.confirm) content.querySelector('[data-hv="cancel-confirm"]')?.focus();
  }
  listenersSignal() {this.eventController?.abort();this.eventController=new AbortController();return this.eventController.signal;}
  _onFirstRender() { if(!this.unsubscribe)this.unsubscribe=this.service.subscribe(()=>this.refresh()); }
  _onRender() {if(!this.unsubscribe)this.unsubscribe=this.service.subscribe(()=>this.refresh());}
  async close(options={}) {
    if((this.vmState.dirty||this.vmState.areaDirty) && !await this.confirmDiscard())return this;
    this.imageEditor?.close();

    this.vmState.dirty=false;this.vmState.editing=false;this.vmState.draft=null;this.vmState.confirm=null;
    this.vmState.areaDirty=false;this.vmState.areaDraft=null;this.vmState.areaRegionId=null;
    return super.close(options);
  }
  _onClose() {this.unsubscribe?.();this.unsubscribe=null;clearTimeout(this.refreshTimer);this.eventController?.abort();this.imageEditor?.close();}
  refresh() {if(!this.rendered)return;clearTimeout(this.refreshTimer);this.refreshTimer=setTimeout(()=>this.render().catch(error=>this.showError(error)),60);}
  showError(error) {this.vmState.status=error.message;ui.notifications.warn(error.message);this.refresh();}
  async confirmDiscard() {return foundry.applications.api.DialogV2.confirm({window:{title:"Descartar rascunho?"},content:"<p>As alterações ainda não salvas serão descartadas.</p>",rejectClose:false});}
  async canLeave() { return !(this.vmState.dirty||this.vmState.areaDirty) || await this.confirmDiscard(); }
  beginEditing() {
    assertGM();this.vmState.draft=structuredClone(getMachine(this.region));this.vmState.editing=true;this.vmState.dirty=false;
    this.vmState.draft.appearance=appearance(this.vmState.draft.appearance);
    this.vmState.viewTab="store";
    this.vmState.editProductId=this.vmState.draft.products[0]?.id ?? null;this.vmState.editorTab="products";this.vmState.confirm=null;
  }
  onInput(event) {
    if(this.vmState.busy)return;
    const input=event.target,form=input.closest("[data-form]");
    if(form?.dataset.form==="area") {this.vmState.areaDraft.elevation[input.name]=input.value===""?null:Number(input.value);this.vmState.areaDirty=true;this.element.querySelector('[data-hv="area-apply"]').disabled=false;return;}
    if(form && this.vmState.editing) {
      const target=form.dataset.form==="machine"?this.vmState.draft:this.vmState.draft.products.find(p=>p.id===this.vmState.editProductId);
      if(target && input.name) {const value=input.type==="checkbox"?input.checked:input.type==="number"?input.value===""?"":Number(input.value):input.value;if(input.name.startsWith("appearance."))target.appearance[input.name.split('.')[1]]=value;else target[input.name]=value;this.vmState.dirty=true;}
      const footer=this.element.querySelector(".hv-editor-footer span");if(footer)footer.textContent="Alterações ainda não salvas";
      const badge=this.element.querySelector(".vm-manager-save-state");if(badge)badge.textContent="Alterações pendentes";
      if(input.type==="color" || input.name.startsWith("appearance.") || input.name==="color")this.updateLiveAppearance(input);
      return;
    }
    if(input.dataset.filter==="search") {this.vmState.search=input.value;this.vmState.page=0;this.refresh();}
    if(input.dataset.filter==="quantity") {this.vmState.quantity=input.value===""?"":Number(input.value);this.refresh();}
    if(input.dataset.filter==="code") {this.selectCode(input.value);this.refresh();}
    if(input.dataset.filter==="product-search") {this.vmState.productSearch=input.value;this.refresh();}
  }
  async onChange(event) {
    if(this.vmState.busy)return;
    const input=event.target;
    if(input.dataset.filter==="token") {this.vmState.tokenId=input.value;this.refresh();}
    if(input.dataset.filter==="page"){this.vmState.page=Number(input.value);this.refresh();}
    if(input.dataset.filter==="category") {this.vmState.category=input.value;this.vmState.page=0;const selected=getMachine(this.region)?.products.find(p=>p.id===this.vmState.selectedId);if(input.value!=="all"&&selected?.category!==input.value){this.vmState.selectedId=null;this.vmState.codeEntry="";this.vmState.quantity=1;}this.refresh();}
    if(input.dataset.filter==="machine") {if(!await this.canLeave()){this.refresh();return;}this.switchMachine(input.value);this.refresh();}
    if(input.dataset.filter==="area-step")this.vmState.areaStep=Number(input.value);
    if(input.dataset.import==="catalog") {
      assertGM();const file=input.files[0];if(!file)return;
      ensure(file.size<=1000000,"O catálogo deve ter até 1 MB.");
      const imported=machine(JSON.parse(await file.text()));
      const revision=this.vmState.draft.revision,history=this.vmState.draft.history;
      this.vmState.draft={...imported,revision,history};this.vmState.editProductId=imported.products[0]?.id;this.vmState.dirty=true;this.refresh();
    }
    if(input.closest("[data-form]") && (input.type==="checkbox" || input.tagName==="SELECT")) this.onInput(event);
  }
  async onClick(event) {
    const button=event.target.closest("[data-hv]");if(!button || button.disabled)return;
    const action=button.dataset.hv,id=button.dataset.id;
    if(this.vmState.busy)return;
    if(action==="machine") {
      if(!await this.canLeave())return;
      this.switchMachine(id);
    } else if(action==="theme") await game.settings.set(ID,"theme",game.settings.get(ID,"theme")==="dark"?"light":"dark");
    else if(action==="product") {this.vmState.selectedId=id;this.vmState.quantity=1;this.vmState.codeEntry="";this.vmState.status="Produto selecionado. Clique em Comprar lanche.";}
    else if(action==="category") this.vmState.category=id;
    else if(action==="page-next") {const c=catalogPage(getMachine(this.region),this.vmState);this.vmState.page=Math.min(c.pages-1,c.page+1);}
    else if(action==="page-prev") this.vmState.page=Math.max(0,catalogPage(getMachine(this.region),this.vmState).page-1);
    else if(action==="key") {this.selectCode((/^[A-Z]+[123]$/.test(this.vmState.codeEntry)?"":this.vmState.codeEntry)+id);}
    else if(action==="key-clear") {this.vmState.codeEntry="";this.vmState.selectedId=null;this.vmState.quantity=1;}
    else if(action==="quantity-minus") this.vmState.quantity=Math.max(1,this.vmState.quantity-1);
    else if(action==="quantity-plus") {const p=getMachine(this.region).products.find(p=>p.id===this.vmState.selectedId);this.vmState.quantity=Math.min(p.stock,getMachine(this.region).maxPerRequest,this.vmState.quantity+1);}
    else if(action==="collect") await this.collectDelivery();
    else if(action==="view-tab") {if(!await this.canLeave())return;this.vmState.viewTab=id;this.vmState.editing=false;this.vmState.dirty=false;this.vmState.confirm=null;}
    else if(action==="edit") {if(this.service.openManager&&!this.manager){await this.service.openManager({regionId:this.vmState.regionId});return;}if(this.vmState.editing){if(!await this.canLeave())return;this.vmState.editing=false;this.vmState.dirty=false;}else this.beginEditing();}
    else if(action==="editor-tab") this.vmState.editorTab=id;
    else if(action==="edit-product") this.vmState.editProductId=id;
    else if(action==="add-product") {
      assertGM();ensure(this.vmState.draft.products.length<200,"Limite de 200 produtos por máquina.");
      const p=product({id:foundry.utils.randomID(),name:"Novo produto",category:"Outros",stock:0,capacity:10,price:0,weight:1});
      this.vmState.draft.products.push(p);this.vmState.editProductId=p.id;this.vmState.dirty=true;
    } else if(action==="remove-product") {
      assertGM();if(!await foundry.applications.api.DialogV2.confirm({window:{title:"Excluir produto?"},content:"<p>O produto será removido quando você salvar. O histórico de retiradas será preservado.</p>",rejectClose:false}))return;
      this.vmState.draft.products=this.vmState.draft.products.filter(p=>p.id!==this.vmState.editProductId);this.vmState.editProductId=this.vmState.draft.products[0]?.id;this.vmState.dirty=true;
    } else if(action==="image-editor") {this.openImageEditor();return;}
    else if(action==="remove-image") {const p=this.vmState.draft.products.find(p=>p.id===this.vmState.editProductId);p.img="";p.imageFit=imageFit();this.vmState.dirty=true;}
    else if(action==="stock-minus"||action==="stock-plus"||action==="stock-full") {const p=this.vmState.draft.products.find(p=>p.id===this.vmState.editProductId);p.stock=action==="stock-full"?p.capacity:Math.max(0,Math.min(p.capacity,Number(p.stock)+(action==="stock-plus"?1:-1)));this.vmState.dirty=true;}
    else if(action==="draft-restock-all") {this.vmState.draft.products.forEach(p=>p.stock=p.capacity);this.vmState.dirty=true;}
    else if(action==="duplicate-product") {ensure(this.vmState.draft.products.length<200,"Limite de 200 produtos.");const original=this.vmState.draft.products.find(p=>p.id===this.vmState.editProductId);const copied={...structuredClone(original),id:foundry.utils.randomID(),name:`${original.name} (cópia)`};this.vmState.draft.products.push(copied);this.vmState.editProductId=copied.id;this.vmState.dirty=true;}
    else if(action==="product-up"||action==="product-down") {const list=this.vmState.draft.products,index=list.findIndex(p=>p.id===this.vmState.editProductId),to=index+(action==="product-up"?-1:1);if(to>=0&&to<list.length){[list[index],list[to]]=[list[to],list[index]];this.vmState.dirty=true;}}
    else if(action==="palette") {const palette=MACHINE_PALETTES[Number(id)];ensure(palette,"Paleta inválida.");this.vmState.draft.color=palette.body;this.vmState.draft.appearance={panel:palette.panel,marquee:palette.marquee,detail:palette.detail};this.vmState.dirty=true;}
    else if(action==="open-store") {await this.service.openStore?.({regionId:this.vmState.regionId});return;}
    else if(action==="area-focus") {await this.focusArea();return;}
    else if(action==="area-move") {const size=this.region.parent.grid.size*(this.vmState.areaStep||1);const [dx,dy]=({up:[0,-size],down:[0,size],left:[-size,0],right:[size,0]})[id];this.vmState.areaDraft.shapes=moveShapes(this.vmState.areaDraft.shapes,dx,dy);this.vmState.areaDirty=true;}
    else if(action==="area-scale") {this.vmState.areaDraft.shapes=scaleShapes(this.vmState.areaDraft.shapes,Number(id));this.vmState.areaDirty=true;}
    else if(action==="area-reset")this.resetArea();
    else if(action==="area-apply") {cleanElevation(this.vmState.areaDraft.elevation);await this.runBusy(()=>this.service.request(this.region,{action:"area",...this.vmState.areaDraft,signature:this.vmState.areaSignature}));this.resetArea();this.vmState.status="Área atualizada sem alterar produtos ou estoque.";}
    else if(action==="area-redraw") {if(!await this.canLeave())return;const region=this.region;this.vmState.dirty=false;this.vmState.areaDirty=false;await this.close();await this.service.redrawArea(region,id);return;}
    else if(action==="pick-image") {
      assertGM();const p=this.vmState.draft.products.find(p=>p.id===this.vmState.editProductId);const productId=p.id;
      const Picker=foundry.applications.apps.FilePicker.implementation;
      new Picker({type:"image",current:p.img,callback:path=>{const target=this.vmState.draft?.products.find(p=>p.id===productId);if(!this.vmState.editing||!target)return;target.img=path;this.vmState.dirty=true;this.refresh();}}).render(true);
    } else if(action==="reload") {
      if(!await this.canLeave())return;this.beginEditing();
    } else if(action==="cancel-edit") {
      if(!await this.canLeave())return;if(this.manager){this.beginEditing();this.resetArea();}else{this.vmState.editing=false;this.vmState.dirty=false;this.vmState.draft=null;}
    } else if(action==="save") {
      assertGM();machine(this.vmState.draft);const tab=this.vmState.editorTab,productId=this.vmState.editProductId;
      const {history,revision,...config}=this.vmState.draft;
      const area=this.manager&&this.vmState.areaDirty?{...this.vmState.areaDraft,signature:this.vmState.areaSignature}:undefined;
      await this.runBusy(()=>this.service.request(this.region,{action:"save",machine:config,revision,area}));
      this.vmState.dirty=false;this.beginEditing();this.vmState.editorTab=tab;this.vmState.editProductId=this.vmState.draft.products.some(p=>p.id===productId)?productId:this.vmState.draft.products[0]?.id;this.vmState.status="Alterações salvas para todos os jogadores.";
      if(this.manager&&area)this.resetArea();
    } else if(action==="restock-all") {
      assertGM();ensure(!this.vmState.dirty,"Salve ou cancele seu rascunho antes de repor o estoque.");
      await this.runBusy(()=>this.service.request(this.region,{action:"restockAll"}));this.beginEditing();this.vmState.status="Todos os produtos foram repostos até a capacidade máxima.";
    } else if(action==="archive") {
      assertGM();ensure(!this.vmState.dirty,"Salve ou cancele o rascunho antes de arquivar.");const m=structuredClone(getMachine(this.region));
      if(!await foundry.applications.api.DialogV2.confirm({window:{title:"Exportar e arquivar histórico?"},content:"<p>O histórico será baixado em JSON e removido da máquina. Guarde o arquivo antes de continuar.</p>",rejectClose:false}))return;
      downloadJSON({machine:m.name,history:m.history},`vending-historico-${this.region.id}.json`);
      await this.runBusy(()=>this.service.request(this.region,{action:"archive",revision:m.revision}));this.beginEditing();this.vmState.editorTab="history";
    } else if(action==="export-catalog") {assertGM();const {history,revision,...catalog}=this.vmState.draft;downloadJSON(catalog,`vending-catalogo-${this.region.id}.json`);}
    else if(action==="region-sheet") {assertGM();canvas.regions.activate();this.region.sheet.render({force:true});}
    else if(action==="create") {if(!await this.canLeave())return;await this.createArea();}
    else if(action==="attach") {
      assertGM();if(!await this.canLeave())return;
      const region=canvas.regions.controlled[0]?.document;const attached=await this.service.attach(region);this.vmState.regionId=attached.id;this.beginEditing();
    } else if(action==="buy" || action==="random") await this.release(action==="random"?"random":"direct");
    this.refresh();
  }
  async runBusy(task) {this.vmState.busy=true;this.refresh();try{return await task();}finally{this.vmState.busy=false;this.refresh();}}
  updateLiveAppearance(input) {
    if(!/^#[a-f\d]{6}$/i.test(input.value))return;
    for(const element of this.element.querySelectorAll('[name]'))if(element.name===input.name&&element!==input)element.value=input.value;
    const cabinet=this.element.querySelector(".vm-manager-preview .vm-cabinet");if(cabinet)cabinet.style.cssText=paintVariables(this.vmState.draft);
  }
  resetArea() {this.vmState.areaDraft=geometryOf(this.region);this.vmState.areaSignature=geometrySignature(this.vmState.areaDraft);this.vmState.areaRegionId=this.region.id;this.vmState.areaDirty=false;}
  async focusArea() {assertGM();const bounds=this.region.bounds||shapeBounds(geometryOf(this.region).shapes);canvas.regions.activate();this.region.object?.control({releaseOthers:true});await canvas.animatePan({x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2,duration:500});}
  openImageEditor() {
    assertGM();this.imageEditor?.close();const regionId=this.vmState.regionId,productId=this.vmState.editProductId,p=this.vmState.draft.products.find(p=>p.id===productId);
    this.imageEditor=new ProductImageEditor({product:p,upload:this.service.uploadImage,onApply:({source,fit})=>{ensure(this.vmState.regionId===regionId&&this.vmState.draft,"A máquina mudou enquanto você editava a imagem.");const target=this.vmState.draft.products.find(p=>p.id===productId);ensure(target,"O produto foi removido.");target.img=source;target.imageFit=fit;this.vmState.dirty=true;this.vmState.status="Enquadramento pronto. Salve as alterações para aplicar aos jogadores.";this.refresh();},onClose:()=>{this.imageEditor=null;}});
    this.imageEditor.open().catch(error=>this.showError(error));
  }
  switchMachine(id) {
    this.imageEditor?.close();

    Object.assign(this.vmState,{regionId:id,editing:false,draft:null,dirty:false,areaDirty:false,selectedId:null,category:"all",search:"",confirm:null,status:"",page:0,codeEntry:"",delivered:null});
    this.vmState.areaRegionId=null;
  }
  selectCode(value) {
    const code=String(value).toUpperCase().replace(/[^A-Z1-3]/g,"").slice(0,4);
    this.vmState.codeEntry=code;const m=getMachine(this.region);
    const p=m.products.find((p,i)=>p.enabled && slotCode(i)===code);
    this.vmState.selectedId=p?.id??null;this.vmState.quantity=1;
    if(p){this.vmState.search="";this.vmState.category="all";this.vmState.page=Math.floor(m.products.filter(p=>p.enabled).findIndex(item=>item.id===p.id)/9);this.vmState.status=`${code}: ${p.name} selecionado.`;}
    else if(/[123]$/.test(code))this.vmState.status="Esse código não tem um produto disponível.";
  }
  async release(mode) {
    ensure(!this.vmState.delivered,"Pegue o lanche no compartimento antes de retirar outro.");

    const region=this.region,quantity=mode==="random"?1:this.vmState.quantity,productId=this.vmState.selectedId,category=this.vmState.category;
    const chosen=getMachine(region).products.find(p=>p.id===productId);if(mode==="direct"){const check=quantityState(getMachine(region),chosen,quantity);ensure(check.valid,check.reason);}
    this.vmState.busy=true;this.vmState.status=mode==="random"?"Escolhendo uma surpresa para você…":"Preparando seu lanche…";this.refresh();
    try {
      const receipt=await this.service.request(region,{action:"dispense",mode,productId,quantity,category,tokenId:this.vmState.tokenId});
      if(this.vmState.regionId===region.id){
        this.vmState.selectedId=receipt.productId;this.vmState.codeEntry="";this.vmState.search="";
        const catalog=catalogPage(getMachine(region),{category:this.vmState.category});
        const index=catalog.visible.findIndex(item=>item.product.id===receipt.productId);
        this.vmState.page=index>=0?Math.floor(index/9):0;
        this.vmState.delivered=receipt;this.vmState.quantity=1;this.vmState.status=`${receipt.quantity} × ${receipt.name} está no compartimento. Clique em Pegar.`;
      }
    } finally {this.vmState.busy=false;this.refresh();}
  }
  async collectDelivery() {
    if(!this.vmState.delivered)return;
    this.vmState.delivered=null;this.vmState.status="Lanche retirado. Aproveite!";this.refresh();
  }
  async createArea() {
    assertGM();ensure(canvas.scene,"Abra um mapa antes de demarcar.");ensure(this.service.drawArea,"A ferramenta de demarcação não está disponível.");
    this.vmState.dirty=false;this.vmState.areaDirty=false;await this.close();await this.service.drawArea("polygon");
  }
}
export class VendingManager extends VendingApp {
  static DEFAULT_OPTIONS={id:"holosuite-vending-manager",classes:["hv-app","vm-manager-app"],window:{title:"Gerenciar máquinas de lanches",icon:"fa-solid fa-sliders",resizable:true},position:{width:1140,height:800}};
  constructor(service,options={}){assertGM();super(service,options);this.manager=true;this.vmState.areaStep=1;}
  _canRender(){assertGM();}
}
