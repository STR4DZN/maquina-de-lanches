// Local preview only: simulated Foundry documents, real module UI and stock engine.
const appHost=document.getElementById("preview-app");
const hooks=new Map();
globalThis.Hooks={on(name,fn){const list=hooks.get(name)||[];list.push(fn);hooks.set(name,list);},callAll(name,...args){for(const fn of hooks.get(name)||[])fn(...args);}};
class PreviewCollection extends Map { [Symbol.iterator](){return this.values();} }
class PreviewApplication {
  rendered=false;
  get state(){return this.rendered?2:0;}
  constructor(){this.element=appHost;}
  async render(){const first=!this.rendered;this.rendered=true;this._replaceHTML(await this._renderHTML(),this.element);if(first)this._onFirstRender?.();return this;}
  async _preClose(){}
  async close(){try{await this._preClose({});}catch{return;}this._onClose?.();this.rendered=false;this.element.innerHTML='<div class="preview-closed">Prévia fechada. Use “Abrir máquina” para voltar.</div>';}
  bringToFront(){}
}
function previewDialog(config,confirm=false){
  return new Promise(resolve=>{
    const dialog=document.createElement("dialog");dialog.className="preview-dialog";
    dialog.innerHTML=`<form><h2>${escapeHTML(config.window?.title||"Confirmar")}</h2>${config.content||""}<footer><button type="button" data-cancel>Cancelar</button><button type="submit">${confirm?"Confirmar":escapeHTML(config.ok?.label||"Confirmar")}</button></footer></form>`;
    const finish=value=>{dialog.close();dialog.remove();resolve(value);};
    dialog.querySelector("[data-cancel]").onclick=()=>finish(false);dialog.oncancel=e=>{e.preventDefault();finish(false);};
    dialog.querySelector("form").onsubmit=e=>{e.preventDefault();const button=dialog.querySelector('[type="submit"]');finish(confirm?true:config.ok?.callback?.(e,button,{element:dialog}));};
    document.body.appendChild(dialog);dialog.showModal();
  });
}
globalThis.foundry={applications:{api:{ApplicationV2:PreviewApplication,DialogV2:{confirm:c=>previewDialog(c,true),prompt:c=>previewDialog(c)}},apps:{FilePicker:{implementation:class {constructor(o){this.options=o;}render(){const value=prompt("URL ou caminho da imagem",this.options.current);if(value)this.options.callback(value);}}}}},utils:{randomID:()=>crypto.randomUUID().replaceAll("-","").slice(0,16)}};
globalThis.CONST={DOCUMENT_OWNERSHIP_LEVELS:{OWNER:3}};
const gm={id:"gm",isGM:true,active:true,viewedScene:"scene"},player={id:"player",isGM:false,active:true,viewedScene:"scene"};
const users=new PreviewCollection([["gm",gm],["player",player]]);users.activeGM=gm;
const actor={id:"pilot",uuid:"Actor.pilot",testUserPermission:user=>user.isGM || user.id==="player"};
const scene={id:"scene",grid:{size:100},dimensions:{sceneRect:{x:0,y:0,width:1200,height:900}},regions:new PreviewCollection(),tokens:new PreviewCollection()};
const token={id:"token",name:"Piloto / Exemplo",actor,x:100,y:100,width:1,height:1,elevation:0,parent:scene};scene.tokens.set(token.id,token);
function previewRegion(id,m,geometry={shapes:[{type:'rectangle',x:100,y:100,width:200,height:200,rotation:0,hole:false}],elevation:{bottom:null,top:null}}){
  const region={id,name:m?.name||'Área da máquina',parent:scene,state:m,shapes:structuredClone(geometry.shapes),elevation:structuredClone(geometry.elevation||{bottom:null,top:null}),getFlag:(id,key)=>key==='machine'?m:undefined,
    toObject(){return {shapes:structuredClone(this.shapes),elevation:structuredClone(this.elevation)};},
    async update(data){if(data[`flags.${ID}.machine`]){m=structuredClone(data[`flags.${ID}.machine`]);this.state=m;}if(data.name)this.name=data.name;if(data.shapes)this.shapes=structuredClone(data.shapes);if(data.elevation)this.elevation=structuredClone(data.elevation);persist();previewService.changed();},
    async delete(){scene.regions.delete(this.id);persist();previewService.changed();},
    testPoint:()=>true,sheet:{render:()=>alert('No Foundry, este botão abre o editor nativo da região no mapa.')}};
  region.object={control(){canvas.regions.controlled=[{document:region}];}};return region;
}
let initial;
try{initial=JSON.parse(localStorage.getItem("vm-preview-machines-v2")||"null");}catch{}
if(!initial)initial=[{id:"orbit",m:starterMachine()},{id:"dock",m:{...starterMachine(),name:"Lanches do corredor",subtitle:"Uma pausa a qualquer hora.",color:"#658369"}}];
for(const item of initial)scene.regions.set(item.id,previewRegion(item.id,item.m,item.geometry));
function persist(){try{localStorage.setItem("vm-preview-machines-v2",JSON.stringify([...scene.regions].map(r=>({id:r.id,m:r.getFlag(ID,"machine"),geometry:r.toObject()}))));}catch{}}
scene.createEmbeddedDocuments=async(type,items)=>items.map(item=>{const region=previewRegion(crypto.randomUUID(),item.flags[ID].machine,{shapes:item.shapes,elevation:item.elevation});scene.regions.set(region.id,region);persist();return region;});
let previewBalance=1000000;
globalThis.game={user:gm,users,scenes:new PreviewCollection([[scene.id,scene]]),paused:false,modules:new Map([['holosuite-mana',{api:{purchase:()=>{},getBalance:()=>previewBalance}}]]),settings:{get:()=>localStorage.getItem("vm-preview-theme-v2")||"light",set:async(id,key,value)=>{localStorage.setItem("vm-preview-theme-v2",value);}}};
globalThis.canvas={scene,animatePan:async view=>{globalThis.lastPreviewPan=view;ui.notifications.info("Área localizada no mapa de exemplo.");},tokens:{controlled:[{document:token}]},regions:{controlled:[],releaseAll(){this.controlled=[];},activate(options){if(options?.tool)showMapDrawing(options.tool);}},ready:true};
globalThis.ui={notifications:{warn:message=>{document.getElementById("preview-notice").textContent=message;},info:message=>{document.getElementById("preview-notice").textContent=message;}}};
const previewService=new VendingService();
previewService.request=(region,payload)=>{
  const user=game.user;
  return previewService.queue.run(region.id,async()=>{
    ensure(document.getElementById("preview-online").checked,"É necessário um mestre conectado para usar a máquina.");
    const current=getMachine(region);let next,result,areaChange={},cost=0;
    if(payload.action==="dispense"){
      validateUser(region,user);
      cost=payload.mode==='random'?current.randomPrice:(current.products.find(p=>p.id===payload.productId)?.price??NaN)*Number(payload.quantity);ensure(Number.isSafeInteger(cost)&&cost>=0,"Configure preços inteiros em mana.");ensure(cost<=previewBalance,"Saldo de mana insuficiente.");
      const output=dispense(current,{...payload,id:crypto.randomUUID()},{userId:user.id,actorId:actor.id,actorUuid:actor.uuid,tokenName:token.name});next=output.state;result=output.receipt;
    }else{
      assertGM(user);
      if(payload.action==='area'){
        ensure(payload.signature===geometrySignature(geometryOf(region)),'A área mudou. Recarregue antes de aplicar.');
        await region.update({shapes:cleanShapes(payload.shapes),elevation:cleanElevation(payload.elevation)});return {areaUpdated:true};
      }
      if(payload.action==='save'){
        next=editMachine(current,payload.machine,payload.revision);
        if(payload.area){ensure(payload.area.signature===geometrySignature(geometryOf(region)),'A área mudou.');areaChange={shapes:cleanShapes(payload.area.shapes),elevation:cleanElevation(payload.area.elevation)};}
      }
      else if(payload.action==="restockAll"){next=structuredClone(current);next.products.forEach(p=>p.stock=p.capacity);next.revision++;}
      else if(payload.action==="archive"){ensure(payload.revision===current.revision,"A máquina mudou.");next=structuredClone(current);next.history=[];next.revision++;}
      result={revision:next.revision};
    }
    await region.update({...areaChange,[`flags.${ID}.machine`]:next});previewBalance-=cost;previewService.changed();return result;
  });
};
const previewStore=new VendingApp(previewService),previewManager=new VendingManager(previewService);let previewApp=PREVIEW_MANAGER?previewManager:previewStore;
async function activatePreview(kind,{regionId}={}){
  const target=kind==='manager'?previewManager:previewStore;
  if(kind==='manager')assertGM();
  if(regionId&&regionId!==target.vmState.regionId){if(!await target.canLeave())return;target.switchMachine(regionId);}
  if(previewApp!==target){previewApp._onClose();previewApp.rendered=false;previewApp.deliveryAnimation?.cancel();previewApp=target;}
  appHost.classList.toggle('is-manager',kind==='manager');await previewApp.render();return previewApp;
}
previewService.openManager=options=>activatePreview('manager',options);
previewService.openStore=options=>activatePreview('store',options);
previewService.uploadImage=async file=>{
  const source='preview-images/'+crypto.randomUUID()+'.'+(file.name.split('.').at(-1)||'png');
  const data=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(file);});
  imagePreviewRegistry.set(source,data);try{localStorage.setItem('vm-preview-image-files',JSON.stringify([...imagePreviewRegistry]));}catch{}
  return source;
};
try{for(const [key,value] of JSON.parse(localStorage.getItem('vm-preview-image-files')||'[]'))imagePreviewRegistry.set(key,value);}catch{}
appHost.classList.toggle('is-manager',PREVIEW_MANAGER);
const previewPlacement=new AreaPlacement(previewService,async region=>{await activatePreview("manager",{regionId:region.id});});
previewPlacement.install();previewService.drawArea=tool=>previewPlacement.begin(tool);previewService.redrawArea=(region,tool)=>previewPlacement.begin(tool,region);
function showMapDrawing(initialTool='polygon'){
  document.getElementById('preview-map')?.remove();
  const overlay=document.createElement('div');overlay.id='preview-map';overlay.className='preview-map-overlay';
  overlay.innerHTML=`<section class="preview-map-panel"><header class="preview-map-head"><div><h2>Demarque a área da máquina</h2><p>Clique para marcar os pontos. Duplo clique finaliza. Você também pode arrastar um retângulo.</p></div><button data-map-action="cancel">Cancelar</button></header><svg class="preview-map-svg" viewBox="0 0 800 430" role="application" aria-label="Mapa de exemplo para demarcar"><defs><pattern id="map-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#d3cab9" stroke-width="1"/></pattern></defs><rect width="800" height="430" fill="url(#map-grid)"/><path d="M40 40H760V390H40ZM280 40V160M280 280V390M550 40V120" fill="none" stroke="#8d8a7d" stroke-width="10"/><rect x="665" y="50" width="62" height="83" rx="4" fill="#9e4e3d"/><rect x="674" y="60" width="36" height="43" rx="2" fill="#dcdbb7"/><text x="693" y="155" text-anchor="middle" font-size="11" fill="#866f59">Máquina no mapa</text><text x="100" y="350" font-size="22" font-family="Georgia" fill="#b4a997">Mapa de exemplo</text><polygon id="map-area" fill="#a2493933" stroke="#a24939" stroke-width="2"/><g id="map-points"></g></svg><div class="preview-map-actions"><button data-map-action="polygon">Marcar por pontos</button><button data-map-action="rectangle">Arrastar retângulo</button><button class="primary" data-map-action="finish">Concluir área</button><button data-map-action="clear">Limpar pontos</button></div><p class="preview-map-tip">Esta é uma simulação do mapa. No Foundry, o desenho usa as ferramentas nativas de Regiões.</p></section>`;
  document.body.append(overlay);const svg=overlay.querySelector('svg'),shape=overlay.querySelector('#map-area'),dots=overlay.querySelector('#map-points');let points=[],tool=initialTool,dragStart=null;
  const point=event=>{const r=svg.getBoundingClientRect();return {x:(event.clientX-r.left)*800/r.width,y:(event.clientY-r.top)*430/r.height};};
  const redraw=()=>{shape.setAttribute('points',points.map(p=>`${p.x},${p.y}`).join(' '));dots.innerHTML=points.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="4" fill="#a24939"/>`).join('');};
  const cancel=()=>{previewPlacement.cancel();overlay.remove();document.removeEventListener('keydown',escape);previewApp.render();};
  const escape=event=>{if(event.key==='Escape')cancel();};document.addEventListener('keydown',escape);
  const finish=async()=>{if(points.length<3){ui.notifications.warn('Marque pelo menos três pontos ou arraste um retângulo.');return;}
    const id=crypto.randomUUID(),region=previewRegion(id,null);region.shapes=[{type:'polygon',hole:false,points:points.flatMap(p=>[p.x,p.y])}];scene.regions.set(id,region);
    overlay.remove();document.removeEventListener('keydown',escape);await previewPlacement.capture(region,game.user.id);persist();
  };
  svg.addEventListener('click',event=>{if(tool==='polygon'){const p=point(event),last=points.at(-1);if(!last||Math.hypot(last.x-p.x,last.y-p.y)>2)points.push(p);redraw();}});
  svg.addEventListener('dblclick',event=>{event.preventDefault();finish();});
  svg.addEventListener('contextmenu',event=>{event.preventDefault();points.pop();redraw();});
  svg.addEventListener('pointerdown',event=>{if(tool==='rectangle'){dragStart=point(event);svg.setPointerCapture(event.pointerId);}});
  svg.addEventListener('pointermove',event=>{if(!dragStart)return;const p=point(event);points=[dragStart,{x:p.x,y:dragStart.y},p,{x:dragStart.x,y:p.y}];redraw();});
  svg.addEventListener('pointerup',()=>{if(dragStart){dragStart=null;}});
  overlay.addEventListener('click',event=>{const action=event.target.dataset.mapAction;if(action==='cancel')cancel();else if(action==='finish')finish();else if(action==='clear'){points=[];redraw();}else if(['rectangle','polygon'].includes(action)){tool=action;points=[];redraw();}});
}
await previewApp.render();
document.getElementById("preview-role").onchange=async event=>{if(!await previewApp.canLeave()){event.target.value=game.user.isGM?"gm":"player";return;}game.user=event.target.value==="gm"?gm:player;document.getElementById("preview-scale").disabled=!game.user.isGM;if(!game.user.isGM){previewManager.vmState.dirty=false;previewManager.vmState.areaDirty=false;await activatePreview("store");}else await previewApp.render();};
document.getElementById("preview-online").onchange=event=>{gm.active=event.target.checked;previewApp.refresh();};
document.getElementById("preview-open").onclick=()=>previewApp.render();
document.getElementById("preview-close").onclick=()=>previewApp.close();
document.getElementById("preview-scale").onclick=async()=>{try{
  assertGM();if(!await previewApp.canLeave())return;const region=previewApp.region;ensure(region,"Crie uma máquina primeiro.");
  const sample=starterMachine(),current=getMachine(region),large={...sample,name:"Máquina / 200 produtos",maxPerRequest:100,revision:current.revision+1,products:Array.from({length:200},(_,i)=>({...sample.products[i%9],id:"sample"+i,name:sample.products[i%9].name+" / "+String(i+1).padStart(3,"0"),stock:1000,capacity:1000}))};
  previewApp.switchMachine(region.id);await region.update({[`flags.${ID}.machine`]:large});await previewApp.render();ui.notifications.info("Catálogo de teste: 200 produtos, 1.000 unidades de cada e limite de 100 por retirada.");
}catch(error){ui.notifications.warn(error.message);}};
document.getElementById("preview-reset").onclick=()=>{localStorage.removeItem("vm-preview-machines-v2");localStorage.removeItem("vm-preview-image-files");location.reload();};
globalThis.hvPreview={get app(){return previewApp;},manager:previewManager,store:previewStore,service:previewService,scene,token,gm,player,placement:previewPlacement,images:imagePreviewRegistry,activate:activatePreview};
