import {ensure,number,escapeHTML} from "./core.js";
export function cleanShapes(raw) {
  ensure(Array.isArray(raw)&&raw.length>0&&raw.length<=200,"A área precisa ter entre 1 e 200 formas.");
  let points=0;
  const coordinate=v=>number(v,"Coordenada",{min:-10000000,max:10000000});
  const length=v=>number(v,"Tamanho da forma",{min:.1,max:10000000});
  const shapes=raw.map(s=>{
    const base={type:s.type,hole:!!s.hole};
    if(s.type==="polygon"){
      ensure(Array.isArray(s.points)&&s.points.length>=6&&s.points.length%2===0,"Polígono inválido.");points+=s.points.length/2;ensure(points<=5000,"Área com pontos demais.");
      return {...base,points:s.points.map(coordinate)};
    }
    ensure(["rectangle","circle","ellipse"].includes(s.type),"Forma de área inválida.");
    const shape={...base,x:coordinate(s.x),y:coordinate(s.y)};
    if(s.type==="circle")return {...shape,radius:length(s.radius)};
    const rotation=number(s.rotation??0,"Rotação",{min:-360,max:360});
    if(s.type==="rectangle")return {...shape,width:length(s.width),height:length(s.height),rotation};
    return {...shape,radiusX:length(s.radiusX),radiusY:length(s.radiusY),rotation};
  });
  ensure(shapes.some(s=>!s.hole),"A área precisa ter uma forma externa.");
  return shapes;
}
export function geometryOf(region) {
  const data=typeof region.toObject==="function"?region.toObject():region;
  return {shapes:cleanShapes(data.shapes||region.shapes||[]),elevation:cleanElevation(data.elevation||region.elevation||{})};
}
export function cleanElevation(raw) {
  const limit=v=>v==null||v===""?null:number(v,"Elevação",{min:-1000000,max:1000000});
  const bottom=limit(raw.bottom),top=limit(raw.top);ensure(bottom==null||top==null||bottom<=top,"A elevação mínima deve ser menor que a máxima.");return {bottom,top};
}
export function geometrySignature(geometry) {return JSON.stringify({shapes:cleanShapes(geometry.shapes),elevation:cleanElevation(geometry.elevation||{})});}
export function shapeBounds(shapes) {
  const boxes=cleanShapes(shapes).filter(s=>!s.hole).map(s=>{
    if(s.type==="polygon") {const xs=s.points.filter((_,i)=>i%2===0),ys=s.points.filter((_,i)=>i%2);return {x:Math.min(...xs),y:Math.min(...ys),right:Math.max(...xs),bottom:Math.max(...ys)};}
    if(s.type==="circle")return {x:s.x-s.radius,y:s.y-s.radius,right:s.x+s.radius,bottom:s.y+s.radius};
    const rad=s.rotation*Math.PI/180,c=Math.cos(rad),sn=Math.sin(rad);
    const cx=s.type==="rectangle"?s.x+s.width/2:s.x,cy=s.type==="rectangle"?s.y+s.height/2:s.y;
    const rx=s.type==="rectangle"?s.width/2:s.radiusX,ry=s.type==="rectangle"?s.height/2:s.radiusY;
    const dx=s.type==="rectangle"?Math.abs(rx*c)+Math.abs(ry*sn):Math.hypot(rx*c,ry*sn);
    const dy=s.type==="rectangle"?Math.abs(rx*sn)+Math.abs(ry*c):Math.hypot(rx*sn,ry*c);
    return {x:cx-dx,y:cy-dy,right:cx+dx,bottom:cy+dy};
  });
  ensure(boxes.length,"A área precisa ter uma forma externa.");
  const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y)),right=Math.max(...boxes.map(b=>b.right)),bottom=Math.max(...boxes.map(b=>b.bottom));
  return {x,y,width:right-x,height:bottom-y,cx:(x+right)/2,cy:(y+bottom)/2};
}
export function moveShapes(raw,dx,dy) {
  number(dx,"Movimento horizontal",{min:-10000000,max:10000000});number(dy,"Movimento vertical",{min:-10000000,max:10000000});
  return cleanShapes(raw).map(s=>s.type==="polygon"?{...s,points:s.points.map((v,i)=>v+(i%2?dy:dx))}:{...s,x:s.x+dx,y:s.y+dy});
}
export function scaleShapes(raw,factor) {
  number(factor,"Escala",{min:.1,max:10});const shapes=cleanShapes(raw),b=shapeBounds(shapes);
  return cleanShapes(shapes.map(s=>{
    if(s.type==="polygon")return {...s,points:s.points.map((v,i)=>(i%2?b.cy:b.cx)+(v-(i%2?b.cy:b.cx))*factor)};
    const next={...s,x:b.cx+(s.x-b.cx)*factor,y:b.cy+(s.y-b.cy)*factor};
    for(const key of ["width","height","radius","radiusX","radiusY"])if(key in next)next[key]*=factor;
    return next;
  }));
}
export function areaSVG(shapes,color="#a13a30") {
  const b=shapeBounds(shapes),pad=Math.max(b.width,b.height)*.12||20;
  const elements=cleanShapes(shapes).map(s=>{
    const attrs=`fill="${s.hole?'#f2eee4':escapeHTML(color)}" fill-opacity="${s.hole?1:.14}" stroke="${escapeHTML(color)}" stroke-width="${Math.max(b.width,b.height)/180}"`;
    if(s.type==="polygon")return `<polygon points="${s.points.join(' ')}" ${attrs}/>`;
    if(s.type==="circle")return `<circle cx="${s.x}" cy="${s.y}" r="${s.radius}" ${attrs}/>`;
    if(s.type==="ellipse")return `<ellipse cx="${s.x}" cy="${s.y}" rx="${s.radiusX}" ry="${s.radiusY}" transform="rotate(${s.rotation} ${s.x} ${s.y})" ${attrs}/>`;
    return `<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" transform="rotate(${s.rotation} ${s.x+s.width/2} ${s.y+s.height/2})" ${attrs}/>`;
  }).join('');
  return `<svg class="vm-area-map" viewBox="${b.x-pad} ${b.y-pad} ${b.width+pad*2} ${b.height+pad*2}" role="img" aria-label="Formato atual da área">${elements}</svg>`;
}
