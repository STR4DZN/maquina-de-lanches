import {ensure} from "./core.js";
import {assertGM,getMachine} from "./service.js";
import {geometryOf,geometrySignature} from "./area.js";

// Use Foundry's real rectangle/polygon drawing tools. No coordinate form and no custom hit-testing.
export class AreaPlacement {
  constructor(service,onCreated) {this.service=service;this.onCreated=onCreated;this.pending=null;this.installed=false;}
  install() {
    if(this.installed)return;this.installed=true;
    Hooks.on("createRegion",(region,options,userId)=>this.capture(region,userId).catch(error=>{this.cancel();ui.notifications.warn(error.message);}));
    Hooks.on("canvasTearDown",()=>this.cancel());
    Hooks.on("activateTokensLayer",()=>this.cancel());
    document.addEventListener("keydown",event=>{if(event.key==="Escape")this.cancel();});
  }
  begin(tool="polygon",replaceRegion=null) {
    assertGM();ensure(canvas.ready && canvas.scene,"Abra um mapa antes de demarcar.");
    ensure(["polygon","rectangle"].includes(tool),"Ferramenta de área inválida.");
    this.cancel();this.pending={sceneId:canvas.scene.id,userId:game.user.id};
    if(replaceRegion){ensure(replaceRegion.parent.id===canvas.scene.id&&getMachine(replaceRegion),"Máquina não encontrada neste mapa.");this.pending.replaceRegionId=replaceRegion.id;this.pending.signature=geometrySignature(geometryOf(replaceRegion));}
    try{canvas.regions.releaseAll();canvas.regions.activate({tool});}catch(error){this.cancel();throw error;}
    ui.notifications.info("Marque a área da máquina com a ferramenta de região. Conclua o desenho para configurar os produtos. Esc cancela.");
  }
  cancel() {this.pending=null;}
  async capture(region,userId) {
    const pending=this.pending;
    if(!pending || userId!==pending.userId || region.parent.id!==pending.sceneId || getMachine(region))return;
    this.cancel();
    if(pending.replaceRegionId){
      const previous=canvas.scene.regions.get(pending.replaceRegionId);
      try{ensure(previous,"A máquina foi removida durante o desenho.");const geometry=geometryOf(region);await this.service.request(previous,{action:"area",shapes:geometry.shapes,elevation:geometryOf(previous).elevation,signature:pending.signature});}
      finally{await region.delete();}
      await this.onCreated(previous);return;
    }
    const attached=await this.service.attach(region);
    await this.onCreated(attached);
  }
}
