import {ID,ensure,dispense} from './core.js';
import {getMachine,validateUser,activeGM} from './service.js';
export function bankApi(){return game.modules.get('holosuite-mana')?.api;}
export function registerBank(service){
 const api=bankApi();if(!api?.registerPurchaseProvider)return false;
 api.registerPurchaseProvider(ID,{
  withLock:(data,task)=>service.queue.run(`${data.sceneId}/${data.regionId}`,task),
  async prepare(request,user){
   const region=game.scenes.get(request.sceneId)?.regions.get(request.regionId),current=getMachine(region);ensure(current,'Máquina não encontrada.');validateUser(region,user);
   const cost=request.mode==='random'?current.randomPrice:(current.products.find(p=>p.id===request.productId)?.price??NaN)*Number(request.quantity);
   ensure(Number.isSafeInteger(cost)&&cost>=0,'Configure preços inteiros em mana.');ensure(request.quote===cost,'O preço mudou. Confira o valor atualizado antes de comprar.');
   const output=dispense(current,{...request,id:request.id},{userId:user.id,actorId:'',actorUuid:'',tokenName:user.name||'Jogador'});
   return {cost,data:{sceneId:request.sceneId,regionId:request.regionId,revision:current.revision,receipt:{...output.receipt,paidMana:cost}}};
  },
  findReceipt(data,id){return getMachine(game.scenes.get(data.sceneId)?.regions.get(data.regionId))?.history.find(r=>r.id===id)||null;},
  async apply(data,id){
   ensure(game.user.isGM&&activeGM()?.id===game.user.id,'Mestre responsável mudou.');
   const region=game.scenes.get(data.sceneId)?.regions.get(data.regionId),current=getMachine(region);
   const previous=current?.history.find(r=>r.id===id);if(previous)return previous;
   try{ensure(current&&current.revision===data.revision,'A máquina mudou antes da entrega.');const product=current.products.find(p=>p.id===data.receipt.productId);ensure(product?.stock>=data.receipt.quantity,'Produto esgotado antes da entrega.');}
   catch(error){error.safeToRefund=true;throw error;}
   const next=structuredClone(current);next.products.find(p=>p.id===data.receipt.productId).stock-=data.receipt.quantity;next.history.push(data.receipt);next.revision++;
   await region.update({[`flags.${ID}.machine`]:next});return data.receipt;
  }
 });return true;
}
