// These are tools inside Foundry's existing Regions control, never a new group/layer.
export function addRegionTools(controls,{draw,manage}){
 if(!game.user.isGM||!controls.regions?.tools)return;
 const tools=controls.regions.tools,run=task=>async()=>{try{await task();}catch(error){ui.notifications.error(error.message);}};
 const order=Math.max(0,...Object.values(tools).map(t=>Number(t.order)||0))+1;
 Object.assign(tools,{
  vendingRectangle:{name:'vendingRectangle',title:'Criar máquina de vendas (retângulo)',icon:'fa-solid fa-store',order,button:true,onChange:run(()=>draw('rectangle'))},
  vendingPolygon:{name:'vendingPolygon',title:'Criar máquina de vendas (polígono)',icon:'fa-solid fa-draw-polygon',order:order+1,button:true,onChange:run(()=>draw('polygon'))},
  vendingEdit:{name:'vendingEdit',title:'Configurar máquina da região selecionada',icon:'fa-solid fa-gear',order:order+2,button:true,onChange:run(()=>{const region=canvas.regions.controlled[0]?.document;return manage(region);})}
 });
}
