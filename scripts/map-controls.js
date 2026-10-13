import {ensure} from './core.js';
export const VENDING_CONTROL='vending-machines';
export function vendingControl(actions,{isGM=game.user.isGM,showMarkers=true,order=0}={}) {
  const run=task=>async()=>{try{return await task();}catch(error){console.error('Máquina de Lanches:',error);ui.notifications.error(error.message||'Não foi possível abrir a máquina.');}};
  return {
    name:VENDING_CONTROL,title:'Máquinas de vendas',icon:'fa-solid fa-store',order,activeTool:'select',visible:true,
    onChange:(_event,active)=>{if(active){actions.cancelDrawing();canvas[VENDING_CONTROL]?.activate();}},
    onToolChange:()=>{},
    tools:{
      select:{name:'select',title:'Interagir com máquinas no mapa',icon:'fa-solid fa-arrow-pointer',order:0,onChange:()=>{}},
      use:{name:'use',title:'Usar máquina de vendas',icon:'fa-solid fa-basket-shopping',order:1,button:true,onChange:run(actions.openStore)},
      manage:{name:'manage',title:'Gerenciar máquinas de vendas (mestre)',icon:'fa-solid fa-sliders',order:2,button:true,visible:isGM,onChange:run(actions.openManager)},
      polygon:{name:'polygon',title:'Demarcar máquina por pontos',icon:'fa-solid fa-draw-polygon',order:3,button:true,visible:isGM,onChange:run(()=>actions.draw('polygon'))},
      rectangle:{name:'rectangle',title:'Demarcar máquina por retângulo',icon:'fa-regular fa-square',order:4,button:true,visible:isGM,onChange:run(()=>actions.draw('rectangle'))},
      markers:{name:'markers',title:'Mostrar máquinas no mapa',icon:'fa-solid fa-location-dot',order:5,toggle:true,active:showMarkers,onChange:(_event,active)=>actions.setMarkers(active)}
    }
  };
}
export function registerVendingLayer(prepareControls) {
  ensure(foundry.canvas?.layers?.InteractionLayer,'A camada de interação do Foundry 13 não está disponível.');
  class VendingLayer extends foundry.canvas.layers.InteractionLayer {
    static get layerOptions(){return {...super.layerOptions,name:VENDING_CONTROL};}
    static prepareSceneControls(){return prepareControls();}
  }
  CONFIG.Canvas.layers[VENDING_CONTROL]={layerClass:VendingLayer,group:'interface'};
}
