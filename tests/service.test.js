import test from "node:test";
import assert from "node:assert/strict";
import {ID,starterMachine} from "../scripts/core.js";
import {VendingService,validateUser,tokenInside,getMachine} from "../scripts/service.js";
import {geometryOf,geometrySignature} from "../scripts/area.js";
class Collection extends Map { [Symbol.iterator](){return this.values();} }
function environment(){
  const listeners=new Map();
  globalThis.Hooks={on(name,fn){const callbacks=listeners.get(name)||[];callbacks.push(fn);listeners.set(name,callbacks);},emit(name,...args){for(const fn of listeners.get(name)||[])fn(...args);}};
  globalThis.CONST={DOCUMENT_OWNERSHIP_LEVELS:{OWNER:3}};
  const gm={id:"gm",active:true,isGM:true},gm2={id:"gm2",active:true,isGM:true};
  const alice={id:"alice",active:true,isGM:false,viewedScene:"scene"},bob={id:"bob",active:true,isGM:false,viewedScene:"scene"};
  const users=new Collection([gm,gm2,alice,bob].map(u=>[u.id,u]));users.activeGM=gm;
  let m=starterMachine(),writes=0,failWrites=false;
  const scene={id:"scene",grid:{size:100},tokens:new Collection(),regions:new Collection()};
  const region={id:"region",parent:scene,shapes:[{type:"rectangle",x:100,y:100,width:200,height:200,rotation:0,hole:false}],elevation:{bottom:null,top:null},getFlag:()=>m,testPoint:p=>p.x>=100 && p.x<=300 && p.y>=100 && p.y<=300,
    async update(data){if(failWrites)throw Error("storage-failure");await Promise.resolve();if(data[`flags.${ID}.machine`])m=structuredClone(data[`flags.${ID}.machine`]);if(data.shapes)this.shapes=structuredClone(data.shapes);if(data.elevation)this.elevation=structuredClone(data.elevation);writes++;Hooks.emit("updateRegion",this);}};
  scene.regions.set(region.id,region);
  const actor={id:"actor",uuid:"Actor.actor",testUserPermission:user=>user.isGM || user.id==="alice"};
  const token={id:"token",name:"Piloto",parent:scene,actor,x:100,y:100,width:1,height:1,elevation:0};scene.tokens.set(token.id,token);
  globalThis.game={user:gm,users,scenes:new Collection([[scene.id,scene]]),paused:false};
  globalThis.canvas={scene};
  const service=new VendingService();service.install();let msgId=0;
  function message({request,result,failMessage=false}={}){
    const flags={request,result};const msg={id:`msg${++msgId}`,user:{id:"forged-user"},getFlag:(id,key)=>flags[key],
      async update(data){if(failMessage)throw Error("chat-failure");if(data[`flags.${ID}.result`])flags.result=data[`flags.${ID}.result`];if(data.content)msg.content=data.content;Hooks.emit("updateChatMessage",msg,data,{},"gm");}};
    return msg;
  }
  const req=extra=>({version:1,authorityId:"gm",sceneId:"scene",regionId:"region",action:"dispense",tokenId:"token",mode:"direct",productId:"chips",quantity:1,...extra});
  return {service,region,scene,token,gm,gm2,alice,bob,message,req,get state(){return m;},get writes(){return writes;},failStorage(){failWrites=true;}};
}
test("permissões, posição, cena, token oculto e pausa são verificadas",()=>{
  const env=environment();assert(tokenInside(env.region,env.token));validateUser(env.region,env.alice,env.token);
  assert.throws(()=>validateUser(env.region,env.bob,env.token));env.token.x=600;assert.throws(()=>validateUser(env.region,env.alice,env.token));
  env.token.x=100;env.token.hidden=true;assert.throws(()=>validateUser(env.region,env.alice,env.token));
  env.token.hidden=false;env.alice.viewedScene="other";assert.throws(()=>validateUser(env.region,env.alice,env.token));
  env.alice.viewedScene="scene";game.paused=true;assert.throws(()=>validateUser(env.region,env.alice,env.token));
});
test("identidade vem da operação, não de campos enviados pelo jogador",async()=>{
  const env=environment(),request=env.req({userId:"alice"}),msg=env.message({request});
  const result=await env.service.process(msg,request,"bob");assert.equal(result.ok,false);assert.equal(env.writes,0);
  const msg2=env.message({request});await env.service.process(msg2,request,"alice");assert.equal(env.state.history[0].userId,"alice");assert.equal(env.writes,1);
});
test("jogador não consegue editar, repor ou arquivar pela API",async()=>{
  for(const action of ["save","restock","restockAll","archive","area","unknown"]){
    const env=environment(),request=env.req({action,machine:starterMachine(),revision:0,productId:"chips",amount:"full"});
    const result=await env.service.process(env.message({request}),request,"alice");assert.equal(result.ok,false);assert.equal(env.writes,0);
  }
});
test("estoque e recibo são salvos em uma única operação",async()=>{
  const env=environment(),req=env.req(),msg=env.message({request:req});await env.service.process(msg,req,"alice");
  assert.equal(env.writes,1);assert.equal(env.state.products[0].stock,11);assert.equal(env.state.history.length,1);assert.equal(msg.getFlag(ID,"result").ok,true);
  await env.service.process(msg,req,"alice");assert.equal(env.writes,1);assert.equal(env.state.products[0].stock,11);
});
test("falha na persistência não libera recibo nem altera o estoque",async()=>{
  const env=environment();env.failStorage();const req=env.req();const out=await env.service.process(env.message({request:req}),req,"alice");
  assert.equal(out.ok,false);assert.equal(env.writes,0);assert.equal(env.state.products[0].stock,12);assert.equal(env.state.history.length,0);
});
test("falha na mensagem após commit mantém recibo e estoque consistentes",async()=>{
  const env=environment(),req=env.req(),msg=env.message({request:req,failMessage:true});
  const warn=console.warn;console.warn=()=>{};try{await env.service.process(msg,req,"alice");}finally{console.warn=warn;}
  assert.equal(env.writes,1);assert.equal(env.state.products[0].stock,11);assert.equal(env.state.history[0].id,msg.id);
});
test("apenas a autoridade escolhida processa hook de criação",async()=>{
  const env=environment(),req=env.req(),msg=env.message({request:req});game.user=env.gm2;Hooks.emit("createChatMessage",msg,{},"alice");
  await new Promise(resolve=>setImmediate(resolve));assert.equal(env.writes,0);
  game.user=env.gm;Hooks.emit("createChatMessage",msg,{},"alice");await new Promise(resolve=>setImmediate(resolve));assert.equal(env.writes,1);
});
test("100 solicitações concorrentes passam pela fila real do serviço",async()=>{
  const env=environment();env.state.products[0].stock=1;
  const messages=Array.from({length:100},()=>env.message({request:env.req()}));
  for(const msg of messages)Hooks.emit("createChatMessage",msg,{},"alice");
  await env.service.queue.run("scene/region",()=>{});
  assert.equal(env.state.products[0].stock,0);assert.equal(env.writes,1);
  assert.equal(messages.filter(msg=>msg.getFlag(ID,"result")?.ok).length,1);
});
test("mestre secundário pode editar via autoridade, sem sobrescrever revisão",async()=>{
  const env=environment();let req=env.req({action:"save",machine:{...starterMachine(),name:"Nova"},revision:0});
  let result=await env.service.process(env.message({request:req}),req,"gm2");assert.equal(result.ok,true);assert.equal(env.state.name,"Nova");
  result=await env.service.process(env.message({request:req}),req,"gm2");assert.equal(result.ok,false);assert.equal(env.writes,1);
});
test("criação de área e vinculação são exclusivas do mestre",async()=>{
  const env=environment();game.user=env.alice;
  await assert.rejects(env.service.createArea(env.scene,{x:0,y:0,width:200,height:200}));await assert.rejects(env.service.attach(env.region));
  game.user=env.gm;await assert.rejects(env.service.createArea(env.scene,{x:0,y:0,width:0,height:200}));
});
test("confirmações administrativas de outro mestre resolvem a solicitação",async()=>{
  const env=environment();let result;
  const msg=env.message({result:{ok:true,value:{revision:7}}});
  const timer=setTimeout(()=>{},10000);
  env.service.pending.set(msg.id,{authorityId:"gm",action:"save",resolve:v=>{result=v;},reject:assert.fail,timer});
  Hooks.emit("updateChatMessage",msg,{}, {},"alice");assert.equal(result,undefined);
  Hooks.emit("updateChatMessage",msg,{}, {},"gm");assert.deepEqual(result,{revision:7});
});

test("editar área exige mestre, guarda assinatura e preserva catálogo e estoque",async()=>{
  const e=environment(),before=structuredClone(e.state),geometry=geometryOf(e.region),signature=geometrySignature(geometry);
  const req=e.req({action:"area",signature,shapes:[{...geometry.shapes[0],x:200}],elevation:{bottom:0,top:5}});
  assert.equal((await e.service.process(e.message({request:req}),req,"alice")).ok,false);
  assert.equal((await e.service.process(e.message({request:req}),req,"gm2")).ok,true);assert.deepEqual(e.state,before);assert.equal(e.region.shapes[0].x,200);assert.equal(e.writes,1);
  assert.equal((await e.service.process(e.message({request:req}),req,"gm")).ok,false);assert.equal(e.writes,1);
});
test("salvar catálogo e área é atômico e revisão obsoleta não muda geometria",async()=>{
  const e=environment(),geometry=geometryOf(e.region),area={...geometry,signature:geometrySignature(geometry),shapes:[{...geometry.shapes[0],x:250}]};
  let req=e.req({action:"save",machine:{...starterMachine(),name:"Com área"},revision:0,area});
  assert.equal((await e.service.process(e.message({request:req}),req,"gm")).ok,true);assert.equal(e.writes,1);assert.equal(e.state.name,"Com área");assert.equal(e.region.shapes[0].x,250);
  const now=geometryOf(e.region);req=e.req({action:"save",machine:starterMachine(),revision:0,area:{...now,signature:geometrySignature(now),shapes:[{...now.shapes[0],x:999}]}});
  assert.equal((await e.service.process(e.message({request:req}),req,"gm")).ok,false);assert.equal(e.region.shapes[0].x,250);assert.equal(e.writes,1);
});

test("serviço autoritativo respeita a categoria enviada pelo jogador",async()=>{
  const e=environment();for(let i=0;i<5;i++){const req=e.req({action:"dispense",mode:"random",category:"Doces",productId:"chips"});await e.service.process(e.message({request:req}),req,"alice");}
  assert.equal(e.state.history.length,5);assert(e.state.history.every(r=>r.category==="Doces"));assert.equal(e.state.products[0].stock,12);
  e.state.products.filter(p=>p.category==="Doces").forEach(p=>p.stock=0);const req=e.req({mode:"random",category:"Doces"});assert.equal((await e.service.process(e.message({request:req}),req,"alice")).ok,false);assert.equal(e.state.history.length,5);
});
test("máquina antiga exibe mana e persiste o nome na próxima transação",async()=>{
  const e=environment();e.state.priceLabel="cr";assert.equal(getMachine(e.region).priceLabel,"mana");assert.equal(e.state.priceLabel,"cr");const req=e.req();await e.service.process(e.message({request:req}),req,"alice");assert.equal(e.state.priceLabel,"mana");assert.equal(e.state.products[0].stock,11);
});
