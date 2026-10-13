import {ensure,imageSource,imageFit} from "./core.js";

// The preview can register locally dropped files. Production paths remain ordinary Foundry URLs.
export const imagePreviewRegistry=new Map();
export function mediaURL(source) {return imagePreviewRegistry.get(source)||source;}
export function resolveImageLink(value) {
  let source=imageSource(value);
  if(!/^https?:\/\//i.test(source))return source;
  for(let i=0;i<4;i++){
    const u=new URL(source);let nested;
    for(const key of ["imgurl","mediaurl","image_url","original","src"]){const candidate=u.searchParams.get(key);if(candidate && /^https?:\/\//i.test(candidate)){nested=candidate;break;}}
    if(!nested && /(^|\.)google\.[a-z.]+$/.test(u.hostname))nested=u.searchParams.get("url")||u.searchParams.get("q");
    if(!nested || !/^https?:\/\//i.test(nested))break;
    source=imageSource(nested);
  }
  return source;
}
export function zoomFit(fit,delta,anchor={x:0,y:0}) {
  const next=imageFit(fit),old=next.zoom;
  next.zoom=Math.max(.25,Math.min(6,old*Math.exp(-Math.max(-200,Math.min(200,delta))*.0025)));
  const ratio=next.zoom/old;
  next.x=Math.max(-100,Math.min(100,anchor.x+(next.x-anchor.x)*ratio));
  next.y=Math.max(-100,Math.min(100,anchor.y+(next.y-anchor.y)*ratio));
  return next;
}
export function fitTransform(fit={}) {const f=imageFit(fit);return `translate(${f.x}%,${f.y}%) rotate(${f.rotation}deg) scale(${f.zoom})`;}
export function loadImage(source,{timeout=8000,signal}={}) {
  return new Promise((resolve,reject)=>{
    const img=new Image();let finished=false;
    const done=(error)=>{if(finished)return;finished=true;clearTimeout(timer);signal?.removeEventListener("abort",abort);img.onload=null;img.onerror=null;error?reject(error):resolve({source,width:img.naturalWidth,height:img.naturalHeight});};
    const abort=()=>{img.src="";done(new Error("Carregamento cancelado."));};
    const timer=setTimeout(()=>{img.src="";done(new Error("A imagem demorou para responder. Tente outro link ou escolha um arquivo."));},timeout);
    img.referrerPolicy="no-referrer";img.onload=()=>img.naturalWidth?done():done(new Error("Imagem vazia."));img.onerror=()=>done(new Error("Este endereço não carregou uma imagem."));
    if(signal?.aborted){abort();return;}signal?.addEventListener("abort",abort,{once:true});img.src=mediaURL(source);
  });
}
export function metadataImage(html,pageURL) {
  const doc=new DOMParser().parseFromString(html,"text/html");
  const value=doc.querySelector('meta[property="og:image"],meta[name="twitter:image"],meta[property="twitter:image"]')?.getAttribute("content")||doc.querySelector('link[rel="image_src"]')?.getAttribute("href");
  ensure(value,"A página não informa um arquivo de imagem. Abra a imagem e copie o endereço dela.");
  return imageSource(new URL(value,pageURL).href);
}
export async function importImageLink(value,{signal}={}) {
  const source=resolveImageLink(value);ensure(source,"Cole um link ou escolha um arquivo de imagem.");
  try{return await loadImage(source,{signal});}catch(error){if(signal?.aborted)throw error;}
  if(!/^https?:\/\//i.test(source))throw new Error("Imagem não encontrada nesse caminho do Foundry.");
  const url=new URL(source);
  if(/(^|\.)discord\.com$/.test(url.hostname) && url.pathname.startsWith("/channels/"))throw new Error("Esse é um link de mensagem do Discord. Abra o anexo e copie o link da imagem, ou envie o arquivo.");
  let response;
  try{response=await fetch(source,{mode:"cors",credentials:"omit",signal});}catch{throw new Error("O site não permite ler a imagem por esse link de página. Use o link direto da imagem ou envie o arquivo.");}
  ensure(response.ok,"O site recusou esse link. Use a imagem direta ou um arquivo.");
  const reader=response.body?.getReader();ensure(reader,"O site não retornou uma imagem legível.");let length=0,parts=[];
  try{while(true){const chunk=await reader.read();if(chunk.done)break;length+=chunk.value.byteLength;if(length>1000000){await reader.cancel();throw new Error("A página é grande demais. Use o link direto da imagem.");}parts.push(chunk.value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(length);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
  const html=new TextDecoder().decode(bytes);
  return loadImage(metadataImage(html,response.url||source),{signal});
}
export async function uploadProductImage(file) {
  ensure(file?.size>0 && file.size<=20*1024*1024,"Use uma imagem com até 20 MB.");
  const extensions={"image/png":"png","image/jpeg":"jpg","image/webp":"webp","image/gif":"gif","image/avif":"avif","image/svg+xml":"svg"};
  const extension=extensions[file.type] || (/\.(png|jpe?g|webp|gif|avif|svg)$/i.exec(file.name)?.[1]);ensure(extension,"Arquivo de imagem não reconhecido.");
  const Picker=foundry.applications.apps.FilePicker.implementation;
  for(const directory of ["holosuite-vending","holosuite-vending/images"]){try{await Picker.browse("data",directory);}catch{await Picker.createDirectory("data",directory);}}
  const upload=new File([file],`produto-${foundry.utils.randomID()}.${extension}`,{type:file.type});
  const result=await Picker.upload("data","holosuite-vending/images",upload,{}, {notify:false});
  ensure(result?.path,"O Foundry não confirmou o envio da imagem.");return imageSource(result.path);
}
