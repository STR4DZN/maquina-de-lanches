import {ID} from "./core.js";
import {VendingService, getMachine, machinesIn, usableTokens, assertGM} from "./service.js";
import {VendingApp,VendingManager} from "./ui.js";
import {uploadProductImage} from "./image.js";
import {AreaPlacement} from "./placement.js";

const service=new VendingService();
const placement=new AreaPlacement(service,region=>openManager({regionId:region.id}));
service.drawArea=tool=>placement.begin(tool);
service.redrawArea=(region,tool)=>placement.begin(tool,region);
service.uploadImage=uploadProductImage;
service.openManager=options=>openManager(options);
service.openStore=options=>open(options);
let app,manager,markers,markerTimer;
const registered=new Set();
export async function open({regionId,edit=false}={}) {
  if(edit)return openManager({regionId});
  if(!app) app=new VendingApp(service);
  if(regionId && regionId!==app.state.regionId) {
    if(!await app.canLeave())return app;
    app.switchMachine(regionId);
  }
  if(edit){if(!app.region)app.state.regionId=machinesIn()[0]?.id??null;if(getMachine(app.region))app.beginEditing();}
  await app.render({force:true});app.bringToFront();return app;
}
export async function openManager({regionId}={}) {
  assertGM();if(!manager)manager=new VendingManager(service);
  if(regionId&&regionId!==manager.state.regionId){if(!await manager.canLeave())return manager;manager.switchMachine(regionId);}
  await manager.render({force:true});manager.bringToFront();return manager;
}
function registerHoloSuite(provided) {
  const holo=provided ?? game.modules.get("holosuite-core")?.api ?? game.holosuite;
  if(typeof holo?.registerApp!=="function")return;
  const entries=[{id:ID,title:"Máquinas de Vendas",icon:"fa-solid fa-store",playerVisible:true,description:"Lanches, bebidas e pequenas surpresas no mapa.",open:()=>open()},
    {id:`${ID}-editor`,title:"Máquinas / Mestre",icon:"fa-solid fa-boxes-stacked",playerVisible:false,description:"Configure áreas, produtos e estoque.",open:()=>open({edit:true})}];
  for(const entry of entries) {
    if(registered.has(entry.id))continue;
    if(holo.registerApp({...entry,featureId:ID,premium:false}))registered.add(entry.id);
  }
}
function clearMarkers() {clearTimeout(markerTimer);if(markers){markers.parent?.removeChild(markers);markers.destroy({children:true});markers=null;}}
function drawMarkers() {
  clearMarkers();if(!canvas.ready || !canvas.scene)return;
  markers=new PIXI.Container();markers.eventMode="passive";canvas.stage.addChild(markers);
  for(const region of machinesIn()) {
    const m=getMachine(region);if(!game.user.isGM && (!m.enabled || !usableTokens(region).length))continue;
    const bounds=region.object?.bounds;
    if(!bounds || !Number.isFinite(bounds.x) || !bounds.width)continue;
    const node=new PIXI.Container(),r=Math.max(14,Math.min(40,canvas.scene.grid.size*.22));
    node.position.set(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
    const graphic=new PIXI.Graphics();graphic.lineStyle(2,0xf5e9cd,1).beginFill(Number.parseInt(m.color.slice(1),16),.98).drawRoundedRect(-r,-r,r*2,r*2,5).endFill();
    graphic.lineStyle(0).beginFill(0xf4e9cf).drawRoundedRect(-r*.72,-r*.7,r*.93,r*.95,2).endFill();
    graphic.beginFill(0x626959).drawRoundedRect(-r*.72,r*.43,r*1.4,r*.23,2).endFill();
    graphic.beginFill(0xc6cba3).drawRect(r*.4,-r*.65,r*.3,r*.3).endFill();
    node.addChild(graphic);node.eventMode="static";node.cursor="pointer";node.accessible=true;node.accessibleTitle=`Abrir ${m.name}`;
    node.on("pointertap",event=>{event.stopPropagation();open({regionId:region.id}).catch(error=>ui.notifications.warn(error.message));});
    markers.addChild(node);
  }
}
function scheduleMarkers() {clearTimeout(markerTimer);markerTimer=setTimeout(drawMarkers,100);}
Hooks.once("init",()=> {
  game.settings.register(ID,"theme",{name:"Máquinas: tema",hint:"Escolha o tema da sua interface de máquinas de vendas.",scope:"client",config:true,type:String,choices:{dark:"Escuro",light:"Claro"},default:"dark",onChange:()=>{app?.refresh();manager?.refresh();}});
    const api=Object.freeze({open,openEditor:options=>openManager(options),getMachine:region=>structuredClone(getMachine(region)),drawArea:tool=>placement.begin(tool),redrawArea:(region,tool)=>placement.begin(tool,region),createArea:(...args)=>service.createArea(...args),attach:region=>service.attach(region)});
  game.modules.get(ID).api=api;
  Hooks.on("holosuite-core.apiReady",registerHoloSuite);
  Hooks.on("getSceneControlButtons",controls=> {
    if(!controls.tokens?.tools)return;
    controls.tokens.tools[ID]={name:ID,title:"Máquinas de Vendas",icon:"fa-solid fa-store",order:Object.keys(controls.tokens.tools).length,button:true,visible:true,onChange:()=>open()};
    const draw={name:`${ID}-draw`,title:"Demarcar máquina de vendas",icon:"fa-solid fa-draw-polygon",order:Object.keys(controls.tokens.tools).length,button:true,visible:game.user.isGM,onChange:()=>placement.begin()};
    controls.tokens.tools[draw.name]=draw;
    if(controls.regions?.tools)controls.regions.tools[draw.name]={...draw,order:Object.keys(controls.regions.tools).length};
  });
});
Hooks.once("ready",()=> {
  service.install();placement.install();registerHoloSuite();service.subscribe(scheduleMarkers);scheduleMarkers();
  Hooks.on("canvasTearDown",clearMarkers);
});
