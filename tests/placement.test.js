import test from "node:test";
import assert from "node:assert/strict";
import {AreaPlacement} from "../scripts/placement.js";
function environment(){
  const listeners=new Map(),keys=new Map();
  globalThis.Hooks={on(name,fn){listeners.set(name,fn);}};
  globalThis.document={addEventListener(name,fn){keys.set(name,fn);}};
  globalThis.game={user:{id:"gm",isGM:true}};
  const calls=[];globalThis.canvas={ready:true,scene:{id:"s"},regions:{releaseAll(){calls.push("release");},activate(options){calls.push(options.tool);}}};
  globalThis.ui={notifications:{info(){},warn(){}}};
  const attached=[],opened=[];
  const service={async attach(region){attached.push(region.id);return region;}};
  const placement=new AreaPlacement(service,region=>opened.push(region.id));placement.install();
  const region=(id="r",scene="s",machine=null)=>({id,parent:{id:scene},getFlag:()=>machine});
  return {placement,attached,opened,calls,region,listeners,keys};
}
test("demarcação usa polígono nativo e desmarca regiões anteriores",()=>{
  const e=environment();e.placement.begin();assert.deepEqual(e.calls,["release","polygon"]);assert.deepEqual(e.placement.pending,{sceneId:"s",userId:"gm"});
});
test("região recém desenhada é vinculada e abre configuração uma vez",async()=>{
  const e=environment();e.placement.begin();await e.placement.capture(e.region(),"gm");await e.placement.capture(e.region(),"gm");
  assert.deepEqual(e.attached,["r"]);assert.deepEqual(e.opened,["r"]);assert.equal(e.placement.pending,null);
});
test("ignora outra cena, outro usuário e região que já é máquina",async()=>{
  const e=environment();e.placement.begin();await e.placement.capture(e.region("other","other"),"gm");await e.placement.capture(e.region(),"player");await e.placement.capture(e.region("used","s",{}),"gm");
  assert.equal(e.attached.length,0);assert(e.placement.pending);
});
test("Escape e troca de camada cancelam sem criar máquina",async()=>{
  const e=environment();e.placement.begin();e.keys.get("keydown")({key:"Escape"});await e.placement.capture(e.region(),"gm");assert.equal(e.attached.length,0);
  e.placement.begin();e.listeners.get("activateTokensLayer")();assert.equal(e.placement.pending,null);
  e.placement.begin();e.listeners.get("canvasTearDown")();assert.equal(e.placement.pending,null);
});
test("jogador não pode demarcar; instalação de eventos é única",()=>{
  const e=environment();game.user.isGM=false;assert.throws(()=>e.placement.begin());assert.equal(e.calls.length,0);
  e.placement.install();assert.equal(e.listeners.size,3);
});
test('redesenho mantém região original, preserva elevação e remove desenho temporário',async()=>{
  const e=environment(),shapes=[{type:'rectangle',x:10,y:10,width:80,height:100,rotation:0,hole:false}],old={...e.region('old','s',{}),shapes,elevation:{bottom:0,top:5}},temporary={...e.region('new'),shapes:[{...shapes[0],width:200}],elevation:{bottom:null,top:null}};
  let deleted=0,payload;temporary.delete=async()=>deleted++;canvas.scene.regions=new Map([['old',old]]);e.placement.service.request=async(region,request)=>{assert.equal(region,old);payload=request;};
  e.placement.begin('rectangle',old);await e.placement.capture(temporary,'gm');assert.equal(payload.action,'area');assert.equal(payload.shapes[0].width,200);assert.deepEqual(payload.elevation,old.elevation);assert.deepEqual(e.attached,[]);assert.deepEqual(e.opened,['old']);assert.equal(deleted,1);
});
test('falha de redesenho remove região temporária sem criar máquina',async()=>{
  const e=environment(),shapes=[{type:'rectangle',x:0,y:0,width:100,height:100,rotation:0,hole:false}],old={...e.region('old','s',{}),shapes,elevation:{bottom:null,top:null}},temporary={...e.region('new'),shapes,elevation:{bottom:null,top:null}};
  let deleted=0;temporary.delete=async()=>deleted++;canvas.scene.regions=new Map([['old',old]]);e.placement.service.request=async()=>{throw Error('area-stale');};e.placement.begin('polygon',old);
  await assert.rejects(e.placement.capture(temporary,'gm'),/area-stale/);assert.equal(deleted,1);assert.deepEqual(e.attached,[]);assert.deepEqual(e.opened,[]);
});
