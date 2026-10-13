import {ID, ensure, machine, starterMachine, dispense, editMachine, restock, SerialQueue, escapeHTML, text,currencyLabel} from "./core.js";
import {geometryOf,geometrySignature,cleanShapes,cleanElevation} from "./area.js";

export function getMachine(region) {
  const current=region?.getFlag(ID,"machine");if(!current)return null;
  const priceLabel=currencyLabel(current.priceLabel);return current.priceLabel===priceLabel?current:{...current,priceLabel};
}
export function activeGM() { return game.users.activeGM ?? [...game.users].filter(u=>u.active && u.isGM).sort((a,b)=>a.id.localeCompare(b.id))[0]; }
export function assertGM(user=game.user) { ensure(user?.isGM, "Somente o mestre pode editar as máquinas."); }
export function machinesIn(scene=canvas.scene) { return [...(scene?.regions ?? [])].filter(r=>getMachine(r)); }
export function tokenInside(region,token) {
  if (!region || !token || region.parent.id !== token.parent.id) return false;
  const size = token.parent.grid.size;
  return region.testPoint({x:token.x + token.width*size/2,y:token.y + token.height*size/2,elevation:token.elevation ?? 0});
}
export function usableTokens(region,user=game.user) {
  return [...(region?.parent.tokens ?? [])].filter(t => t.actor && (!t.hidden || user.isGM)
    && t.actor.testUserPermission(user,CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) && tokenInside(region,t));
}
export function validateUser(region,user,token) {
  ensure(user?.active, "Jogador não está conectado.");
  ensure(user.isGM || !game.paused, "A sessão está pausada.");
  ensure(user.isGM || user.viewedScene === region.parent.id, "Abra a cena da máquina antes de utilizá-la.");
  ensure(token?.actor && (!token.hidden || user.isGM), "Token indisponível.");
  ensure(token.actor.testUserPermission(user,CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER), "Você não controla esse personagem.");
  ensure(tokenInside(region,token), "Seu token precisa estar dentro da área da máquina.");
}
function receiptHTML(m,r) {
  return `<div class="hv-receipt"><strong>${escapeHTML(m.name)}</strong><p>${escapeHTML(r.tokenName)} retirou <b>${r.quantity} × ${escapeHTML(r.name)}</b>${r.mode==="random"?" pelo sorteio":""}.</p></div>`;
}

export class VendingService {
  constructor() { this.queue = new SerialQueue(); this.pending=new Map(); this.observers=new Set(); }
  subscribe(callback) { this.observers.add(callback); return ()=>this.observers.delete(callback); }
  changed() { for(const callback of this.observers) callback(); }
  install() {
    // userId comes from Foundry's completed document operation, never from a client-supplied field.
    Hooks.on("createChatMessage", (message,options,userId) => {
      const request=message.getFlag(ID,"request");
      if(!request || request.version!==1 || request.authorityId!==game.user.id || !game.user.isGM) return;
      const snapshot=structuredClone(request);
      this.queue.run(`${snapshot.sceneId}/${snapshot.regionId}`,()=>this.process(message,snapshot,userId)).catch(error=>console.error(ID,error));
    });
    Hooks.on("updateChatMessage",(message,changed,options,userId)=> {
      const pending=this.pending.get(message.id);
      if(!pending || userId!==pending.authorityId) return;
      const result=message.getFlag(ID,"result");
      if(result?.ok===false) this.finish(message.id,new Error(text(result.error,250)));
      else if(result?.ok && pending.action!=="dispense") this.finish(message.id,null,result.value);
      else this.checkReceipts();
    });
    for(const hook of ["createRegion","updateRegion","deleteRegion","updateToken","createToken","deleteToken","canvasReady","pauseGame","userConnected"]) {
      Hooks.on(hook,()=>{ this.checkReceipts(); this.changed(); });
    }
  }
  checkReceipts() {
    for(const [id,p] of this.pending) {
      const region=game.scenes.get(p.sceneId)?.regions.get(p.regionId);
      const receipt=getMachine(region)?.history.find(h=>h.id===id && h.userId===game.user.id);
      if(receipt) this.finish(id,null,receipt);
    }
  }
  finish(id,error,result) {
    const p=this.pending.get(id); if(!p) return;
    clearTimeout(p.timer); this.pending.delete(id);
    error ? p.reject(error) : p.resolve(result);
  }
  async request(region,payload) {
    const gm=activeGM(); ensure(gm?.active, "É necessário um mestre conectado para usar a máquina.");
    ensure(region?.parent && getMachine(region), "Máquina não encontrada.");
    const request={...payload,version:1,sceneId:region.parent.id,regionId:region.id,authorityId:gm.id};
    // Whispered chat documents provide a server-attributed sender without a socket dependency.
    const message=await ChatMessage.create({user:game.user.id,whisper:[...new Set([game.user.id,gm.id])],
      content:`<p>Solicitação à máquina ${escapeHTML(getMachine(region).name)}…</p>`,flags:{[ID]:{request}}});
    ensure(message, "Não foi possível enviar a solicitação. Confira a permissão de chat.");
    return new Promise((resolve,reject)=> {
      const timer=setTimeout(()=>this.finish(message.id,new Error("A confirmação não chegou. Confira o histórico antes de tentar novamente; a retirada pode ter sido concluída.")),20000);
      this.pending.set(message.id,{resolve,reject,timer,action:payload.action,authorityId:gm.id,sceneId:region.parent.id,regionId:region.id});
      const result=message.getFlag(ID,"result");
      if(result) this.finish(message.id,result.ok ? null : new Error(result.error),result.value);
      this.checkReceipts();
    });
  }
  async process(message,request,userId) {
    let result;
    try {
      ensure(activeGM()?.id===game.user.id, "O mestre responsável mudou. Envie novamente quando a conexão estabilizar.");
      const user=game.users.get(userId);
      ensure(user?.active,"Jogador não está conectado.");
      const scene=game.scenes.get(request.sceneId),region=scene?.regions.get(request.regionId);
      let current=getMachine(region);
      ensure(current?.schema===1,"Máquina inexistente ou versão de dados incompatível.");
      ensure(JSON.stringify(request).length <= 1000000,"Solicitação muito grande.");
      if(request.action==="dispense") {
        const token=scene.tokens.get(request.tokenId);
        validateUser(region,user,token);
        const output=dispense(current,{...request,id:message.id},{userId,actorId:token.actor.id,actorUuid:token.actor.uuid,tokenName:token.name});
        if(!output.duplicate) await region.update({[`flags.${ID}.machine`]:output.state});
        current=output.state;
        result={ok:true,value:output.receipt};
        try { await message.update({content:receiptHTML(current,output.receipt),[`flags.${ID}.result`]:result}); }
        catch(error) { console.warn(`${ID}: estoque e recibo salvos; mensagem não atualizada.`,error); }
        return output.receipt;
      }
      assertGM(user);
      if(request.action==="area") {
        ensure(request.signature===geometrySignature(geometryOf(region)),"A área mudou enquanto você editava. Confira o desenho atual antes de aplicar.");
        const shapes=cleanShapes(request.shapes),elevation=cleanElevation(request.elevation);
        await region.update({shapes,elevation});
        result={ok:true,value:{areaUpdated:true}};
        await message.update({content:"<p>Área atualizada.</p>",[`flags.${ID}.result`]:result});
        const pending=this.pending.get(message.id);if(pending)this.finish(message.id,null,result.value);
        return result;
      }
      let next;
      if(request.action==="save") next=editMachine(current,request.machine,request.revision);
      else if(request.action==="restock") next=restock(current,request.productId,request.amount);
      else if(request.action==="restockAll") {
        next=structuredClone(current); next.products.forEach(p=>p.stock=p.capacity); next.revision++;
      } else if(request.action==="archive") {
        ensure(request.revision===current.revision,"A máquina mudou. Exporte novamente antes de arquivar.");
        next=structuredClone(current); next.history=[];next.revision++;
      } else throw new Error("Ação desconhecida.");
      const areaUpdate={};
      if(request.action==="save"&&request.area){ensure(request.area.signature===geometrySignature(geometryOf(region)),"A área mudou. Recarregue seu desenho antes de salvar.");areaUpdate.shapes=cleanShapes(request.area.shapes);areaUpdate.elevation=cleanElevation(request.area.elevation);}
      await region.update({...areaUpdate,name:next.name,color:next.color,[`flags.${ID}.machine`]:next});
      result={ok:true,value:{revision:next.revision}};
    } catch(error) { result={ok:false,error:error.message || "Não foi possível concluir a solicitação."}; }
    try { await message.update({content:`<p>${result.ok ? "Máquina atualizada." : escapeHTML(result.error)}</p>`,[`flags.${ID}.result`]:result}); }
    catch(error) { console.warn(`${ID}: falha ao confirmar solicitação.`,error); }
    // GM edit requests have no stock receipt; updateChatMessage resolves these separately.
    const p=this.pending.get(message.id);
    if(p) this.finish(message.id,result.ok?null:new Error(result.error),result.value);
    return result;
  }
  async createArea(scene,bounds,config=starterMachine()) {
    assertGM(); ensure(scene,"Abra uma cena antes de criar a máquina.");
    const m=machine(config);
    ensure([bounds.x,bounds.y,bounds.width,bounds.height].every(Number.isFinite) && bounds.width>=20 && bounds.height>=20,"A área precisa ter pelo menos 20 × 20 pixels.");
    const [region]=await scene.createEmbeddedDocuments("Region",[{name:m.name,color:m.color,
      shapes:[{type:"rectangle",x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height,rotation:0}],
      flags:{[ID]:{machine:m}}}]);
    return region;
  }
  async attach(region) {
    assertGM();ensure(region,"Selecione uma região no mapa.");ensure(!getMachine(region),"Essa região já possui uma máquina.");
    const m=starterMachine();m.name=region.name || m.name;
    await region.update({[`flags.${ID}.machine`]:m});return region;
  }
}
