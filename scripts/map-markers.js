import {machinesIn,getMachine} from './service.js';
import {geometryOf,shapeBounds} from './area.js';
export function mapScreenPoint(x,y,stage,board,screen){const p=stage.worldTransform.apply({x,y}),r=board.getBoundingClientRect();return {x:r.left+p.x*r.width/(screen?.width||r.width),y:r.top+p.y*r.height/(screen?.height||r.height),rect:r};}
export class VendingAreas{
 constructor({openStore,openManager,isDrawing=()=>false}){Object.assign(this,{openStore,openManager,isDrawing});this.frame=null;this.timer=null;this.events=null;}
 clear(){clearTimeout(this.timer);cancelAnimationFrame(this.frame);this.events?.abort();this.root?.remove();this.root=null;}
 schedule(){clearTimeout(this.timer);this.timer=setTimeout(()=>this.draw(),40);}
 draw(){
  this.clear();if(!canvas.ready||!canvas.scene)return;
  const board=canvas.app?.canvas||canvas.app?.view||document.getElementById('board');if(!board)return;
  this.events=new AbortController();
  // Capture only double-clicks whose point is actually in a machine; all other map interactions pass through.
  board.addEventListener('pointerdown',event=>{const now=performance.now(),last=this.lastDown;this.lastDown={time:now,x:event.clientX,y:event.clientY};if(last&&now-last.time<400&&Math.hypot(last.x-event.clientX,last.y-event.clientY)<8)this.interact(event);},{capture:true,signal:this.events.signal});
  board.addEventListener('dblclick',event=>{if(this.lastOpen&&performance.now()-this.lastOpen.time<500&&Math.hypot(event.clientX-this.lastOpen.x,event.clientY-this.lastOpen.y)<8){event.preventDefault();event.stopImmediatePropagation();}else this.interact(event);},{capture:true,signal:this.events.signal});
  this.root=document.createElementNS('http://www.w3.org/2000/svg','svg');this.root.classList.add('vm-map-areas');this.root.setAttribute('aria-hidden','true');document.body.append(this.root);this.position();
 }
 interact(event){
  if(this.isDrawing()||event.button!==0||event.ctrlKey||event.metaKey)return;
  if(canvas.regions?.active&&game.user.isGM&&!event.shiftKey)return; // Native region edit/draw remains available.
  const board=event.currentTarget,r=board.getBoundingClientRect(),screen=canvas.app.renderer.screen;
  const local={x:(event.clientX-r.left)*screen.width/r.width,y:(event.clientY-r.top)*screen.height/r.height};
  const point=canvas.stage.worldTransform.applyInverse(local);const elevation=canvas.tokens?.controlled?.[0]?.document?.elevation??0;
  const regions=machinesIn().filter(region=>region.testPoint({...point,elevation})).sort((a,b)=>shapeBounds(geometryOf(a).shapes).width*shapeBounds(geometryOf(a).shapes).height-shapeBounds(geometryOf(b).shapes).width*shapeBounds(geometryOf(b).shapes).height);
  const region=regions[0];if(!region)return;
  event.preventDefault();event.stopImmediatePropagation();this.lastOpen={time:performance.now(),x:event.clientX,y:event.clientY};
  Promise.resolve().then(()=>event.shiftKey&&game.user.isGM?this.openManager({regionId:region.id}):this.openStore({regionId:region.id})).catch(error=>ui.notifications.error(error.message));
 }
 reposition(){cancelAnimationFrame(this.frame);this.frame=requestAnimationFrame(()=>this.position());}
 position(){
  if(!this.root)return;const board=canvas.app?.canvas||canvas.app?.view||document.getElementById('board');if(!board)return;
  const r=board.getBoundingClientRect(),screen=canvas.app.renderer.screen;this.root.style.cssText=`left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
  this.root.setAttribute('viewBox',`0 0 ${screen.width} ${screen.height}`);this.root.replaceChildren();this.root.style.display=this.isDrawing()?'none':'';
  for(const region of machinesIn()){
   const m=getMachine(region),geo=geometryOf(region);const group=document.createElementNS(this.root.namespaceURI,'g');
   const transform=canvas.stage.worldTransform;const a=transform.apply({x:0,y:0}),b=transform.apply({x:1,y:0}),c=transform.apply({x:0,y:1});
   group.setAttribute('transform',`matrix(${b.x-a.x} ${b.y-a.y} ${c.x-a.x} ${c.y-a.y} ${a.x} ${a.y})`);
   for(const s of geo.shapes){const el=document.createElementNS(this.root.namespaceURI,s.type==='polygon'?'polygon':s.type==='rectangle'?'rect':s.type==='circle'?'circle':'ellipse');
    const attrs=s.type==='polygon'?{points:s.points.join(' ')}:s.type==='rectangle'?{x:s.x,y:s.y,width:s.width,height:s.height,transform:`rotate(${s.rotation||0} ${s.x+s.width/2} ${s.y+s.height/2})`}:s.type==='circle'?{cx:s.x,cy:s.y,r:s.radius}:{cx:s.x,cy:s.y,rx:s.radiusX,ry:s.radiusY,transform:`rotate(${s.rotation||0} ${s.x} ${s.y})`};
    for(const [key,value]of Object.entries(attrs))el.setAttribute(key,String(value));el.setAttribute('fill','none');el.setAttribute('stroke',region.color?.css||(typeof region.color==='number'?'#'+region.color.toString(16).padStart(6,'0'):region.color)||m.color);el.setAttribute('stroke-width','2');el.setAttribute('vector-effect','non-scaling-stroke');if(s.hole)el.setAttribute('stroke-dasharray','4 3');group.append(el);
   }this.root.append(group);
  }
 }
}
