import test from "node:test";
import assert from "node:assert/strict";
import {machine, product, starterMachine, dispense, drawProduct, editMachine, restock, SerialQueue, imageSource, escapeHTML,eligibleProducts,randomUnit,currencyLabel} from "../scripts/core.js";
const identity={userId:"alice",actorId:"pilot",actorUuid:"Actor.pilot",tokenName:"Piloto"};
const request=(id="r",extra={})=>({id,mode:"direct",productId:"chips",quantity:1,...extra});
test("retirada reduz estoque, registra ator e não altera entrada",()=>{
  const m=starterMachine();const {state,receipt}=dispense(m,request(),identity,{now:123});
  assert.equal(m.products[0].stock,12);assert.equal(state.products[0].stock,11);
  assert.equal(receipt.listedPrice,4);assert.equal(receipt.actorUuid,"Actor.pilot");assert.equal(receipt.time,123);assert.equal(state.revision,1);
});
test("mesma solicitação não dispensa duas vezes e outro usuário não a reutiliza",()=>{
  const first=dispense(starterMachine(),request(),identity);
  const second=dispense(first.state,request(),identity);assert.equal(second.duplicate,true);assert.equal(second.state.products[0].stock,11);
  assert.throws(()=>dispense(first.state,request(),{...identity,userId:"bob"}));
});
test("estoque, quantidade e máquina desativada são validados",()=>{
  const m=starterMachine();
  for(const q of [0,-1,1.5,NaN,Infinity,"",null,101])assert.throws(()=>dispense(m,request("bad",{quantity:q}),identity));
  m.maxPerRequest=100;assert.throws(()=>dispense(m,request("bad",{quantity:13}),identity));
  m.enabled=false;assert.throws(()=>dispense(m,request(),identity));
  m.enabled=true;m.products[0].enabled=false;assert.throws(()=>dispense(m,request(),identity));
  assert.throws(()=>dispense(m,request("bad",{mode:"hacked"}),identity));
});
test("sorteio respeita pesos, esgotados, desativados e peso zero",()=>{
  const m=starterMachine();m.randomMode="weighted";m.products=m.products.slice(0,4);m.products[0].stock=0;m.products[1].enabled=false;m.products[2].weight=0;
  for(const r of [0,.25,.5,.999999])assert.equal(drawProduct(m,()=>r).id,"water");
  m.products[3].stock=0;assert.throws(()=>drawProduct(m));
});
test("chances uniformes e proporcionais ao estoque têm limites corretos",()=>{
  const m=starterMachine();m.products=m.products.slice(0,2);m.randomMode="uniform";
  assert.equal(drawProduct(m,()=>.499).id,"chips");assert.equal(drawProduct(m,()=>.5).id,"drink");
  m.randomMode="stock";m.products[0].stock=1;m.products[1].stock=9;
  assert.equal(drawProduct(m,()=>.0999).id,"chips");assert.equal(drawProduct(m,()=>.1).id,"drink");
});
test("distribuição ponderada e estoque não negativo em 1000 sorteios",()=>{
  let m=starterMachine();m.randomMode="weighted";m.products=m.products.slice(0,2);m.products.forEach(p=>{p.stock=1000;p.capacity=1000;});
  m.products[0].weight=1;m.products[1].weight=3;const counts={chips:0,drink:0};
  for(let i=0;i<1000;i++){const out=dispense(m,request(String(i),{mode:"random"}),identity,{rng:()=>i/1000});m=out.state;counts[out.receipt.productId]++;}
  assert.deepEqual(counts,{chips:250,drink:750});assert(m.products.every(p=>p.stock>=0));
});
test("sorteio precisa estar ativo e retira somente uma unidade",()=>{
  const m=starterMachine();m.randomEnabled=false;assert.throws(()=>dispense(m,request("r",{mode:"random"}),identity));
  m.randomEnabled=true;assert.throws(()=>dispense(m,request("r",{mode:"random",quantity:2}),identity));
});
test("edição obsoleta não sobrescreve estoque; edição válida preserva recibos",()=>{
  const m=starterMachine(),draft=structuredClone(m);const live=dispense(m,request(),identity).state;
  assert.throws(()=>editMachine(live,draft,0));
  const updated=editMachine(live,{...live,name:"Nova"},live.revision);assert.equal(updated.history.length,1);assert.equal(updated.products[0].stock,11);assert.equal(updated.revision,2);
});
test("reposição respeita capacidade máxima e não apaga histórico",()=>{
  const m=dispense(starterMachine(),request(),identity).state;
  const next=restock(m,"chips",100);assert.equal(next.products[0].stock,20);assert.equal(next.history.length,1);assert.equal(m.products[0].stock,11);
  assert.throws(()=>restock(m,"missing",1));assert.throws(()=>restock(m,"chips",-1));
});
test("validação de catálogo rejeita duplicados e números inválidos",()=>{
  const m=starterMachine();assert.throws(()=>machine({...m,products:[m.products[0],m.products[0]]}));
  for(const changes of [{price:-1},{stock:21},{capacity:1.5},{name:""},{id:"../bad"},{weight:Infinity}])assert.throws(()=>product({...m.products[0],...changes}));
  assert.throws(()=>machine({...m,products:Array(201).fill(m.products[0])}));
});
test("imagens e textos bloqueiam protocolos executáveis e escapam HTML",()=>{
  for(const url of ["javascript:alert(1)","data:image/svg+xml,<svg>","file:///secret","blob:abc","https://u:p@example.com/a.png"])assert.throws(()=>imageSource(url));
  assert.equal(imageSource("worlds/test/snack.webp"),"worlds/test/snack.webp");
  assert.equal(escapeHTML('<img onerror="evil">'),"&lt;img onerror=&quot;evil&quot;&gt;");
});
test("200 solicitações simultâneas pela última unidade liberam exatamente uma",async()=>{
  const queue=new SerialQueue();let state=starterMachine();state.products[0].stock=1;
  const results=await Promise.allSettled(Array.from({length:200},(_,i)=>queue.run("machine",async()=>{
    await Promise.resolve();const result=dispense(state,request(String(i)),identity);state=result.state;return result;
  })));
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);assert.equal(state.products[0].stock,0);assert.equal(state.history.length,1);
});
test("fila continua depois de erro e máquinas independentes não bloqueiam",async()=>{
  const q=new SerialQueue();await assert.rejects(q.run("a",()=>{throw Error("fail");}));
  assert.equal(await q.run("a",()=>42),42);const out=await Promise.all([q.run("a",()=>1),q.run("b",()=>2)]);assert.deepEqual(out,[1,2]);
});

test("sorteio por categoria só usa doces, mesmo com outro produto selecionado",()=>{
  const m=starterMachine(),identity={userId:"alice",actorId:"pilot",tokenName:"Piloto"};
  for(const mode of ["uniform","weighted","stock"]){m.randomMode=mode;for(const r of [0,.3,.75,.999999]){const output=dispense(m,request("doces"+r,{mode:"random",category:"Doces",productId:"chips"}),identity,{rng:()=>r});assert.equal(output.receipt.category,"Doces");assert(["sweet","caramel"].includes(output.receipt.productId));}}
});
test("categoria esgotada ou inválida nunca recai no catálogo inteiro",()=>{
  const m=starterMachine();m.products.filter(p=>p.category==="Doces").forEach(p=>p.stock=0);assert.equal(eligibleProducts(m,"Doces").length,0);assert.throws(()=>drawProduct(m,()=>.5,"Doces"),/nesta categoria/);assert.throws(()=>drawProduct(m,()=>.5,"Não existe"));assert.throws(()=>drawProduct(m,()=>.5,{}));assert(eligibleProducts(m,"all").length>0);
});
test("fonte aleatória consulta Web Crypto novamente em cada sorteio",()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,"crypto"),values=[0,4294967295,2147483648];let calls=0;const original=Math.random;
  try{Object.defineProperty(globalThis,"crypto",{configurable:true,value:{getRandomValues(array){array[0]=values[calls++];return array;}}});Math.random=()=>0;
    const m=starterMachine();assert.equal(drawProduct(m).id,m.products[0].id);assert.equal(drawProduct(m).id,m.products.at(-1).id);assert.equal(randomUnit(),.5);assert.equal(calls,3);
  }finally{Object.defineProperty(globalThis,"crypto",descriptor);Math.random=original;}
});
test("sorteio uniforme é o padrão e mana substitui cr sem afetar estoque",()=>{
  const m=starterMachine();assert.equal(m.randomMode,"uniform");assert.equal(m.priceLabel,"mana");assert.equal(machine({...m,priceLabel:"cr"}).priceLabel,"mana");assert.equal(currencyLabel("mana"),"mana");assert.equal(machine({...m,priceLabel:"cr"}).products[0].stock,m.products[0].stock);
});
