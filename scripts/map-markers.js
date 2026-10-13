import {ID} from './core.js';
import {machinesIn,getMachine,usableTokens} from './service.js';
import {geometryOf,shapeBounds} from './area.js';
export const vendingMarkerIcon='<svg viewBox="0 0 32 36" aria-hidden="true"><rect x="3" y="2" width="26" height="31" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><rect x="6" y="6" width="13" height="17" rx="1" fill="currentColor" opacity=".12"/><path d="M7 12h11M7 18h11M12 7v15M22 8h4M22 12h4M22 16h4M8 28h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M7 34h3m12 0h3" stroke="currentColor" stroke-width="2"/></svg>';
export function mapScreenPoint(x,y,stage,board,screen) {
  const point=stage.worldTransform.apply({x,y}),rect=board.getBoundingClientRect();
  const width=screen?.width||rect.width,height=screen?.height||rect.height;
  return {x:rect.left+point.x*rect.width/width,y:rect.top+point.y*rect.height/height,rect};
}
export class VendingMarkers {
  constructor({openStore,openManager,isDrawing=()=>false}) {Object.assign(this,{openStore,openManager,isDrawing});this.entries=[];this.frame=null;this.timer=null;}
  get visible(){return game.settings.get(ID,'showMarkers')!==false;}
  clear(){clearTimeout(this.timer);cancelAnimationFrame(this.frame);this.root?.remove();this.root=null;this.entries=[];}
  schedule(){clearTimeout(this.timer);this.timer=setTimeout(()=>this.draw(),60);}
  draw(){
    this.clear();if(!canvas.ready||!canvas.scene||!this.visible)return;
    const board=canvas.app?.view||document.getElementById('board');if(!board||!canvas.stage?.worldTransform)return;
    this.root=document.createElement('div');this.root.className='vm-map-markers';this.root.setAttribute('aria-label','Máquinas de vendas no mapa');
    for(const region of machinesIn()){
      const machine=getMachine(region);if(!game.user.isGM&&(!machine.enabled||!usableTokens(region).length))continue;
      let bounds;try{bounds=shapeBounds(geometryOf(region).shapes);}catch(error){console.warn('Área da máquina inválida:',region.id,error);continue;}
      const button=document.createElement('button');button.type='button';button.className='vm-map-marker';button.dataset.regionId=region.id;
      if(!machine.enabled)button.classList.add('is-offline');
      button.innerHTML=vendingMarkerIcon;const name=document.createElement('span');name.textContent=machine.name;button.append(name);
      button.style.setProperty('--vm-marker-color',/^#[a-f\d]{6}$/i.test(machine.color)?machine.color:'#a13a30');
      button.setAttribute('aria-label',`Usar ${machine.name}`);button.title=`${machine.name} · Clique para usar${game.user.isGM?' · Botão direito para gerenciar':''}`;
      const invoke=(callback)=>Promise.resolve().then(()=>callback({regionId:region.id})).catch(error=>ui.notifications.error(error.message));
      button.addEventListener('pointerdown',event=>event.stopPropagation());
      button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();invoke(this.openStore);});
      button.addEventListener('contextmenu',event=>{event.preventDefault();event.stopPropagation();if(game.user.isGM)invoke(this.openManager);});
      this.root.append(button);this.entries.push({button,region,x:bounds.cx,y:bounds.cy});
    }
    document.body.append(this.root);this.position();
  }
  reposition(){cancelAnimationFrame(this.frame);this.frame=requestAnimationFrame(()=>this.position());}
  position(){
    if(!this.root)return;
    const board=canvas.app?.view||document.getElementById('board');if(!board)return;
    this.root.hidden=!this.visible||this.isDrawing()||!!canvas.regions?.active;
    for(const entry of this.entries){
      const p=mapScreenPoint(entry.x,entry.y,canvas.stage,board,canvas.app?.renderer?.screen);
      const outside=!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<p.rect.left||p.x>p.rect.right||p.y<p.rect.top||p.y>p.rect.bottom;
      entry.button.hidden=outside;entry.button.style.left=`${p.x}px`;entry.button.style.top=`${p.y}px`;
    }
  }
}
