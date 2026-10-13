// Contract simulation, not a licensed Foundry runtime. Imports the unmodified ES module entrypoint.
import {ID,starterMachine} from '../scripts/core.js';
class Collection extends Map {[Symbol.iterator](){return this.values();}}
const handlers=new Map();
globalThis.Hooks={
 on(name,fn){const list=handlers.get(name)||[];list.push(fn);handlers.set(name,list);},
 once(name,fn){this.on(name,(...args)=>{if(fn){const run=fn;fn=null;return run(...args);}});},
 async callAll(name,...args){await Promise.all((handlers.get(name)||[]).map(fn=>fn(...args)));}
};
const applications=[];
class ApplicationV2 {
 #state=0;#element=null;
 get state(){return this.#state;}get rendered(){return this.#state===2;}get element(){return this.#element;}
 constructor(){applications.push(this);}
 async render(){
  this._canRender?.();const first=!this.rendered;this.#state=1;
  if(!this.#element){this.#element=document.createElement('section');this.#element.className='application hv-app';const content=document.createElement('div');content.className='window-content';this.#element.append(content);document.body.append(this.#element);}
  this.#element.hidden=false;this._replaceHTML(await this._renderHTML(),this.#element.querySelector('.window-content'));this.#state=2;
  if(first)this._onFirstRender?.();this._onRender?.();return this;
 }
 async close(){this._onClose?.();this.#state=0;if(this.#element)this.#element.hidden=true;return this;}
 bringToFront(){for(const app of applications)if(app!==this&&app.element)app.element.hidden=true;}
}
function activateLayer(layer,tool){
 for(const entry of [canvas.tokens,canvas.regions,canvas['vending-machines']])entry.active=entry===layer;
 if(tool)layer.tool=tool;void Hooks.callAll('activate'+layer.hookName,layer);void Hooks.callAll('renderSceneControls');return layer;
}
class InteractionLayer {
 static get layerOptions(){return {name:'',zIndex:0};}
 activate({tool}={}){this.hookName=this.constructor.name;return activateLayer(this,tool);}
}
let holoCalls=0;
globalThis.HoloSuite={registerApp(){holoCalls++;throw Error('HoloSuite must not be used');}};
globalThis.CONFIG={Canvas:{layers:{}}};
globalThis.foundry={canvas:{layers:{InteractionLayer}},applications:{api:{ApplicationV2,DialogV2:{confirm:async()=>true}}},utils:{randomID:()=>crypto.randomUUID()}};
globalThis.CONST={DOCUMENT_OWNERSHIP_LEVELS:{OWNER:3}};
const gm={id:'gm',isGM:true,active:true,viewedScene:'scene'},player={id:'player',isGM:false,active:true,viewedScene:'scene'};
const users=new Collection([[gm.id,gm],[player.id,player]]);users.activeGM=gm;
const settings=new Map(),definitions=new Map(),modules=new Map([[ID,{}],['holosuite-core',{api:HoloSuite}]]);
globalThis.game={user:gm,users,modules,scenes:new Collection(),paused:false,settings:{register(id,key,config){definitions.set(key,config);settings.set(key,config.default);},get(id,key){return settings.get(key);},async set(id,key,value){settings.set(key,value);definitions.get(key)?.onChange?.(value);return value;}}};
const errors=[];
globalThis.ui={notifications:{error:message=>errors.push(message),warn:message=>errors.push(message),info:()=>{}}};
const scene={id:'scene',grid:{size:100},regions:new Collection(),tokens:new Collection()};game.scenes.set(scene.id,scene);
let inside=true;
const token={id:'token',name:'Piloto',x:150,y:150,width:1,height:1,elevation:0,parent:scene,actor:{id:'actor',uuid:'Actor.actor',testUserPermission:user=>user.id===player.id||user.isGM}};scene.tokens.set(token.id,token);
function region(id,m=starterMachine(),shapes=[{type:'rectangle',x:100,y:100,width:200,height:200,rotation:0,hole:false}]){
 const r={id,name:m?.name||'Área',parent:scene,shapes,elevation:{bottom:null,top:null},getFlag:(scope,key)=>key==='machine'?m:undefined,testPoint:()=>inside,
 toObject(){return {shapes:structuredClone(this.shapes),elevation:structuredClone(this.elevation)};},
 async update(data){m=data[`flags.${ID}.machine`]||m;if(data.shapes)this.shapes=data.shapes;if(data.elevation)this.elevation=data.elevation;if(data.name)this.name=data.name;await Hooks.callAll('updateRegion',this,data,{},game.user.id);return this;},
 async delete(){scene.regions.delete(id);await Hooks.callAll('deleteRegion',this,{},game.user.id);},sheet:{render:()=>{}}};
 r.object={control(){canvas.regions.controlled=[{document:r}];}};return r;
}
scene.regions.set('snacks',region('snacks'));
scene.createEmbeddedDocuments=async(type,items)=>{const result=[];for(const item of items){const r=region(crypto.randomUUID(),item.flags?.[ID]?.machine||null,item.shapes);scene.regions.set(r.id,r);await Hooks.callAll('createRegion',r,{},game.user.id);result.push(r);}return result;};
const board=document.querySelector('#board'),transform={scale:1,x:80,y:80};
globalThis.canvas={scene,ready:true,app:{view:board,renderer:{screen:{width:1200,height:800}}},stage:{worldTransform:{apply:p=>({x:p.x*transform.scale+transform.x,y:p.y*transform.scale+transform.y})}},
 tokens:{active:true,controlled:[{document:token}],activate(){return activateLayer(this);},hookName:'TokenLayer'},
 regions:{active:false,controlled:[],releaseAll(){this.controlled=[];},activate({tool}={}){return activateLayer(this,tool);},hookName:'RegionLayer'},animatePan:async()=>{}};
globalThis.ChatMessage={async create(data){const id=crypto.randomUUID(),flags=data.flags[ID];const message={id,getFlag:(scope,key)=>flags[key],async update(change){if(change[`flags.${ID}.result`])flags.result=change[`flags.${ID}.result`];await Hooks.callAll('updateChatMessage',message,change,{},game.user.id);}};await Hooks.callAll('createChatMessage',message,{},game.user.id);return message;}};
await import('../scripts/main.js');await Hooks.callAll('init');
canvas['vending-machines']=new CONFIG.Canvas.layers['vending-machines'].layerClass();
const nativeControls={tokens:{name:'tokens',title:'Tokens',order:0,tools:{select:{name:'select'}}},regions:{name:'regions',title:'Regiões',order:5,tools:{polygon:{name:'polygon'}}}};
function controls(){const record=structuredClone(nativeControls);Hooks.callAll('getSceneControlButtons',record);return record;}
let currentControls;
async function renderControls(){
 currentControls=controls();const nav=document.querySelector('nav');nav.replaceChildren();
 const group=currentControls['vending-machines'];const button=document.createElement('button');button.textContent=group.title;button.dataset.control=group.name;button.onclick=e=>group.onChange(e,true);nav.append(button);
 for(const tool of Object.values(group.tools)){if(tool.visible===false)continue;const b=document.createElement('button');b.textContent=tool.title;b.dataset.tool=tool.name;b.onclick=async e=>{if(tool.toggle)tool.active=!tool.active;await tool.onChange?.(e,tool.toggle?tool.active:true);};nav.append(b);}
 await Hooks.callAll('renderSceneControls');
}
await Hooks.callAll('ready');await renderControls();
globalThis.nativeTest={applications,errors,settings,definitions,nativeControls,controls,renderControls,region,scene,gm,player,transform,get holoCalls(){return holoCalls;},api:modules.get(ID).api,inside(value){inside=value;return Hooks.callAll('updateToken',token);},async role(isGM){game.user=isGM?gm:player;await renderControls();},async close(){for(const app of applications)await app.close();}};
