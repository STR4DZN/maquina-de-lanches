export const ID = "holosuite-vending";
export const VERSION = 1;
export const MAX_PRODUCTS = 200;
export const MAX_HISTORY = 2000;
export class VendingError extends Error {}
export function ensure(condition, message) { if (!condition) throw new VendingError(message); }
export function text(value, max = 160) { return String(value ?? "").trim().slice(0, max); }
export function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
export function imageSource(value) {
  const source = text(value, 8192);
  if (!source) return "";
  ensure(!/[\u0000-\u001f\\]/.test(source), "Endereço de imagem inválido.");
  ensure(!/^(?:javascript|data|blob|file):/i.test(source), "Use uma imagem do Foundry ou um endereço HTTPS.");
  if (/^[a-z][a-z\d+.-]*:/i.test(source)) {
    ensure(/^https?:\/\//i.test(source), "Endereço de imagem inválido.");
    const url = new URL(source);
    ensure(!url.username && !url.password, "Endereço de imagem inválido.");
  }
  return source;
}
export function number(value, name, {min=0, max=1_000_000, integer=false}={}) {
  ensure(value !== "" && value !== null && value !== undefined && typeof value !== "boolean", `${name}: informe um número.`);
  const n = Number(value);
  ensure(Number.isFinite(n) && n >= min && n <= max && (!integer || Number.isInteger(n)), `${name}: valor inválido.`);
  return n;
}
export function imageFit(raw={}) {
  ensure(raw && typeof raw==="object","Enquadramento inválido.");
  const mode=raw.mode??"contain";ensure(["contain","cover"].includes(mode),"Modo de encaixe inválido.");
  return {mode,zoom:number(raw.zoom??1,"Zoom",{min:.25,max:6}),x:number(raw.x??0,"Posição horizontal",{min:-100,max:100}),y:number(raw.y??0,"Posição vertical",{min:-100,max:100}),rotation:number(raw.rotation??0,"Rotação",{min:0,max:270,integer:true})};
}
export function color(value,fallback="#a13a30") {const c=text(value,7)||fallback;ensure(/^#[a-f\d]{6}$/i.test(c),"Cor inválida.");return c;}
export function appearance(raw={}) {return {panel:color(raw.panel,"#e7dfcf"),marquee:color(raw.marquee,"#f4e9cf"),detail:color(raw.detail,"#e8c97b")};}
export function product(raw) {
  ensure(raw && typeof raw === "object", "Produto inválido.");
  const id = text(raw.id, 64);
  ensure(/^[a-zA-Z0-9_-]{1,64}$/.test(id), "Identificador de produto inválido.");
  const name = text(raw.name, 100);
  ensure(name, "Todo produto precisa de um nome.");
  const capacity = number(raw.capacity, "Capacidade", {integer:true});
  const stock = number(raw.stock, "Estoque", {max:capacity, integer:true});
  return {id, name, img:imageSource(raw.img), imageFit:imageFit(raw.imageFit), category:text(raw.category, 40) || "Outros", description:text(raw.description, 1200),
    price:number(raw.price, "Preço",{integer:true}), stock, capacity, weight:number(raw.weight ?? 1, "Peso do sorteio", {max:10000}), enabled:raw.enabled !== false};
}
export function currencyLabel(value) {const label=text(value,24);return !label||/^cr$/i.test(label)?"mana":label;}
export function randomUnit() {
  if(globalThis.crypto?.getRandomValues){const value=new Uint32Array(1);globalThis.crypto.getRandomValues(value);return value[0]/4294967296;}
  return Math.random();
}
export function machine(raw) {
  ensure(raw && typeof raw === "object" && Array.isArray(raw.products), "Configuração da máquina inválida.");
  ensure(raw.products.length <= MAX_PRODUCTS, `Limite de ${MAX_PRODUCTS} produtos por máquina.`);
  const products = raw.products.map(product);
  ensure(new Set(products.map(p => p.id)).size === products.length, "Existem produtos com identificadores repetidos.");
  const name = text(raw.name, 100);
  ensure(name, "Informe o nome da máquina.");
  const bodyColor = color(raw.color);
  ensure(["uniform", "weighted", "stock"].includes(raw.randomMode ?? "uniform"), "Tipo de sorteio inválido.");
  return {schema:VERSION, name, subtitle:text(raw.subtitle,160), img:imageSource(raw.img), color:bodyColor, appearance:appearance(raw.appearance), enabled:raw.enabled !== false,
    randomEnabled:raw.randomEnabled !== false, randomMode:raw.randomMode ?? "uniform", randomPrice:number(raw.randomPrice ?? 0, "Preço do sorteio",{integer:true}),
    priceLabel:currencyLabel(raw.priceLabel), maxPerRequest:number(raw.maxPerRequest ?? 5,"Limite por retirada",{min:1,max:100,integer:true}),
    products, revision:0, history:[]};
}
export function starterMachine() {
  return machine({name:"Uma pausa gostosa.", subtitle:"Escolha seu favorito. A gente entrega.", color:"#a13a30", randomMode:"uniform", randomPrice:3,
    products:[
      {id:"chips",name:"Batata crocante",category:"Salgados",description:"Batatinhas crocantes com uma pitada de sal.",price:4,stock:12,capacity:20,weight:3},
      {id:"drink",name:"Refrigerante",category:"Bebidas",description:"Uma lata gelada para acompanhar seu lanche.",price:3,stock:8,capacity:15,weight:3},
      {id:"sweet",name:"Barra de chocolate",category:"Doces",description:"Chocolate intenso em uma pequena pausa doce.",price:5,stock:6,capacity:10,weight:2},
      {id:"water",name:"Água mineral",category:"Bebidas",description:"Água purificada. Simples e essencial.",price:2,stock:10,capacity:20,weight:4},
      {id:"cookie",name:"Biscoito salgado",category:"Salgados",description:"Biscoitos dourados para uma pausa rápida.",price:3,stock:7,capacity:15,weight:2},
      {id:"juice",name:"Suco de laranja",category:"Bebidas",description:"Suco de laranja pronto para beber.",price:4,stock:6,capacity:12,weight:2},
      {id:"popcorn",name:"Pipoca temperada",category:"Salgados",description:"Pipoca com tempero leve e muito crocante.",price:4,stock:5,capacity:12,weight:2},
      {id:"caramel",name:"Chocolate e caramelo",category:"Doces",description:"Uma barra doce de chocolate e caramelo.",price:5,stock:4,capacity:10,weight:1},
      {id:"cheese",name:"Salgadinho de queijo",category:"Salgados",description:"Salgadinhos assados com sabor de queijo.",price:4,stock:9,capacity:15,weight:2}
    ]});
}
export function eligibleProducts(m,category="all") {
  ensure(typeof category==="string" && category.length<=40,"Categoria de sorteio inválida.");
  return m.products.filter(p=>p.enabled&&p.stock>0&&(category==="all"||p.category===category)&&(m.randomMode!=="weighted"||p.weight>0));
}
export function drawProduct(m, rng=randomUnit,category="all") {
  const choices = eligibleProducts(m,category);
  ensure(choices.length, category==="all"?"Nenhum produto disponível para sorteio.":"Nenhum produto disponível para sorteio nesta categoria.");
  const weights = choices.map(p => m.randomMode === "stock" ? p.stock : m.randomMode === "uniform" ? 1 : p.weight);
  const total = weights.reduce((s,w) => s+w,0);
  const r = rng();
  ensure(Number.isFinite(r) && r >= 0 && r < 1, "Falha ao sortear o produto.");
  let target = r * total;
  for (let i=0;i<choices.length;i++) { target -= weights[i]; if (target < 0) return choices[i]; }
  return choices.at(-1);
}
export function dispense(current, request, identity, {rng=randomUnit,now=Date.now()}={}) {
  const previous = current.history.find(h => h.id === request.id);
  if (previous) {
    ensure(previous.userId === identity.userId, "Solicitação pertence a outro jogador.");
    return {state:current,receipt:previous,duplicate:true};
  }
  ensure(current.enabled, "Máquina fora de serviço.");
  ensure(current.history.length < MAX_HISTORY, "Histórico cheio. O mestre precisa arquivar o histórico antes de continuar.");
  ensure(["direct","random"].includes(request.mode), "Tipo de retirada inválido.");
  const quantity = number(request.quantity, "Quantidade", {min:1,max:current.maxPerRequest,integer:true});
  ensure(request.mode !== "random" || (current.randomEnabled && quantity === 1), "O sorteio precisa estar ativo e libera uma unidade por vez.");
  const state = structuredClone(current);
  const chosen = request.mode === "random" ? drawProduct(state,rng,request.category??"all") : state.products.find(p => p.id === request.productId);
  ensure(chosen?.enabled && chosen.stock >= quantity, "Produto indisponível ou estoque insuficiente.");
  chosen.stock -= quantity;
  const receipt = {id:request.id, userId:identity.userId, actorId:identity.actorId, actorUuid:identity.actorUuid ?? "", tokenName:text(identity.tokenName,100),
    productId:chosen.id, name:chosen.name,category:chosen.category,img:chosen.img,imageFit:structuredClone(chosen.imageFit??imageFit()),quantity,mode:request.mode,time:now,
    listedPrice:request.mode === "random" ? state.randomPrice : chosen.price * quantity};
  state.history.push(receipt);
  state.revision++;
  return {state,receipt,duplicate:false};
}
export function editMachine(current, incoming, revision) {
  ensure(current.revision === revision, "A máquina mudou enquanto você editava. Recarregue os dados antes de salvar.");
  const next = machine(incoming);
  next.revision = current.revision+1;
  next.history = structuredClone(current.history);
  return next;
}
export function restock(current, productId, amount) {
  const state = structuredClone(current);
  const chosen = state.products.find(p=>p.id===productId);
  ensure(chosen, "Produto não encontrado.");
  chosen.stock = amount === "full" ? chosen.capacity : Math.min(chosen.capacity, chosen.stock + number(amount,"Reposição",{min:1,integer:true}));
  state.revision++;
  return state;
}
export class SerialQueue {
  #queues = new Map();
  run(key, task) {
    const next = (this.#queues.get(key) ?? Promise.resolve()).catch(()=>{}).then(task);
    this.#queues.set(key,next);
    return next.finally(()=> { if(this.#queues.get(key)===next) this.#queues.delete(key); });
  }
}
