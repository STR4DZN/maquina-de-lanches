import {ID} from './core.js';
import {VendingService,getMachine,assertGM} from './service.js';
import {VendingApp,VendingManager} from './ui.js';
import {uploadProductImage} from './image.js';
import {AreaPlacement} from './placement.js';
import {VENDING_CONTROL,vendingControl,registerVendingLayer} from './map-controls.js';
import {VendingMarkers} from './map-markers.js';

const service=new VendingService();
const placement=new AreaPlacement(service,region=>{canvas[VENDING_CONTROL]?.activate();return openManager({regionId:region.id});});
const markers=new VendingMarkers({openStore:open,openManager,isDrawing:()=>!!placement.pending});
let app,manager;
export async function open({regionId,edit=false}={}) {
  if(edit)return openManager({regionId});
  if(!app)app=new VendingApp(service);
  if(regionId&&regionId!==app.vmState.regionId){if(!await app.canLeave())return app;app.switchMachine(regionId);}
  await app.render({force:true});app.bringToFront();return app;
}
export async function openManager({regionId}={}) {
  assertGM();if(!manager)manager=new VendingManager(service);
  if(regionId&&regionId!==manager.vmState.regionId){if(!await manager.canLeave())return manager;manager.switchMachine(regionId);}
  await manager.render({force:true});manager.bringToFront();return manager;
}
async function draw(tool='polygon',region=null){
  assertGM();
  if(manager?.rendered){await manager.close();if(manager.rendered)return;}
  placement.begin(tool,region);markers.position();
}
service.drawArea=tool=>draw(tool);
service.redrawArea=(region,tool)=>draw(tool,region);
service.uploadImage=uploadProductImage;
service.openManager=openManager;
service.openStore=open;
Hooks.once('init',()=>{
  const prepareControls=()=>vendingControl({openStore:()=>open(),openManager:()=>openManager(),draw,cancelDrawing:()=>placement.cancel(),setMarkers:active=>game.settings.set(ID,'showMarkers',active)}, {showMarkers:markers.visible});
  registerVendingLayer(prepareControls);
  game.settings.register(ID,'theme',{name:'Máquinas: tema',hint:'Tema da interface das máquinas de vendas.',scope:'client',config:true,type:String,choices:{dark:'Escuro',light:'Claro'},default:'dark',onChange:()=>{app?.refresh();manager?.refresh();}});
  game.settings.register(ID,'showMarkers',{name:'Máquinas: mostrar marcadores no mapa',hint:'Exibe um botão com o nome de cada máquina acessível.',scope:'client',config:true,type:Boolean,default:true,onChange:()=>markers.schedule()});
  game.modules.get(ID).api=Object.freeze({open,openEditor:openManager,getMachine:region=>structuredClone(getMachine(region)),drawArea:tool=>draw(tool),redrawArea:(region,tool)=>draw(tool,region),createArea:(...args)=>service.createArea(...args),attach:region=>service.attach(region)});
  Hooks.on('getSceneControlButtons',controls=>{
    controls[VENDING_CONTROL]={...prepareControls(),order:Math.max(0,...Object.values(controls).map(control=>Number(control.order)||0))+1};
  });
});
Hooks.once('ready',()=>{
  service.install();placement.install();service.subscribe(()=>markers.schedule());markers.schedule();
  Hooks.on('canvasTearDown',()=>markers.clear());
  Hooks.on('canvasPan',()=>markers.reposition());
  Hooks.on('renderSceneControls',()=>markers.schedule());
  window.addEventListener('resize',()=>markers.reposition());
});
