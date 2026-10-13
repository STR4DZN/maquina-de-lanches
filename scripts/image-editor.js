import {escapeHTML,imageFit,ensure} from "./core.js";
import {importImageLink,loadImage,mediaURL,fitTransform,zoomFit,uploadProductImage} from "./image.js";

export class ProductImageEditor {
  constructor({product,upload=uploadProductImage,onApply,onClose}) {this.product=product;this.source=product.img||"";this.fit=imageFit(product.imageFit);this.upload=upload;this.onApply=onApply;this.onClose=onClose;this.events=new AbortController();this.file=null;this.tempURL=null;this.loaded=false;this.closed=false;this.generation=0;}
  async open() {
    this.overlay=document.createElement("div");this.overlay.className="vm-image-overlay";
    this.overlay.innerHTML=`<section class="vm-image-dialog" role="dialog" aria-modal="true" aria-labelledby="vm-image-title"><header><div><small>IMAGEM DO PRODUTO</small><h2 id="vm-image-title">${escapeHTML(this.product.name)}</h2></div><button data-image-action="cancel" aria-label="Fechar editor de imagem">×</button></header><div class="vm-image-dialog-body"><div><div class="vm-crop-viewport" tabindex="0" aria-label="Enquadramento: arraste para mover e use a roda do mouse para ampliar"><img class="vm-crop-image" alt="Prévia do enquadramento" draggable="false"><div class="vm-crop-grid"></div><span class="vm-crop-placeholder">Cole um link ou arraste uma imagem</span></div><p class="vm-image-gesture">Arraste para mover · Roda do mouse para zoom</p><div class="vm-crop-zoom"><button data-image-action="zoom-out" aria-label="Reduzir zoom">−</button><input data-image-control="zoom" type="range" min=".25" max="6" step=".05" value="${this.fit.zoom}" aria-label="Zoom da imagem"><button data-image-action="zoom-in" aria-label="Aumentar zoom">+</button><output data-image-zoom>${Math.round(this.fit.zoom*100)}%</output></div><div class="vm-crop-fit"><button data-image-action="contain">Imagem inteira</button><button data-image-action="cover">Preencher espaço</button><button data-image-action="rotate">Girar</button><button data-image-action="reset">Restaurar</button></div></div><aside><label>Link ou caminho da imagem<input data-image-control="url" type="text" placeholder="Cole aqui qualquer link de imagem" value="${escapeHTML(this.source)}"></label><button data-image-action="load" class="vm-image-load">Carregar imagem</button><div class="vm-image-or">ou</div><label class="vm-image-file">Enviar do computador<input data-image-control="file" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml"></label><button data-image-action="browse">Escolher no Foundry</button><div class="vm-crop-mini-label">COMO FICA NA MÁQUINA</div><div class="vm-crop-mini"><img alt="Prévia na vitrine" draggable="false"></div><p class="vm-image-info">PNG, JPG, WebP e GIF. Links de pesquisa são reconhecidos quando contêm o endereço da imagem.</p><p class="vm-image-message" role="status" aria-live="polite"></p></aside></div><footer><button data-image-action="remove" class="vm-image-remove">Remover imagem</button><span></span><button data-image-action="cancel">Cancelar</button><button data-image-action="apply" class="vm-image-apply">Aplicar enquadramento</button></footer></section>`;
    document.body.append(this.overlay);this.viewport=this.overlay.querySelector(".vm-crop-viewport");this.previousFocus=document.activeElement;
    const signal=this.events.signal;
    this.overlay.addEventListener("click",event=>{const button=event.target.closest("[data-image-action]");if(button&&!button.disabled)this.action(button.dataset.imageAction).catch(error=>this.message(error.message,true));},{signal});
    this.overlay.addEventListener("input",event=>{if(event.target.dataset.imageControl==="zoom"){this.fit.zoom=Number(event.target.value);this.paint();}},{signal});
    this.overlay.addEventListener("change",event=>{if(event.target.dataset.imageControl==="file"&&event.target.files[0])this.useFile(event.target.files[0]).catch(error=>this.message(error.message,true));},{signal});
    this.overlay.addEventListener("keydown",event=>{
      if(event.key==="Escape"){event.preventDefault();event.stopPropagation();this.close();}
      if(event.key==="Enter"&&event.target.dataset.imageControl==="url"){event.preventDefault();this.action("load").catch(error=>this.message(error.message,true));}
      if(event.key==="Tab"){const controls=[...this.overlay.querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex="0"]')],first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
    },{signal,capture:true});
    this.viewport.addEventListener("wheel",event=>{event.preventDefault();event.stopPropagation();if(!this.loaded||this.applying)return;const r=this.viewport.getBoundingClientRect();this.fit=zoomFit(this.fit,event.deltaY,{x:(event.clientX-r.left-r.width/2)/r.width*100,y:(event.clientY-r.top-r.height/2)/r.height*100});this.paint();},{signal,passive:false});
    this.viewport.addEventListener("pointerdown",event=>{if(!this.loaded||this.applying||event.button!==0)return;event.preventDefault();this.drag={x:event.clientX,y:event.clientY,fit:{...this.fit}};this.viewport.setPointerCapture(event.pointerId);this.viewport.classList.add("is-dragging");},{signal});
    this.viewport.addEventListener("pointermove",event=>{if(!this.drag)return;const r=this.viewport.getBoundingClientRect();this.fit.x=Math.max(-100,Math.min(100,this.drag.fit.x+(event.clientX-this.drag.x)/r.width*100));this.fit.y=Math.max(-100,Math.min(100,this.drag.fit.y+(event.clientY-this.drag.y)/r.height*100));this.paint();},{signal});
    const stopDrag=()=>{this.drag=null;this.viewport.classList.remove("is-dragging");};this.viewport.addEventListener("pointerup",stopDrag,{signal});this.viewport.addEventListener("pointercancel",stopDrag,{signal});
    this.overlay.addEventListener("dragover",event=>{event.preventDefault();this.viewport.classList.add("is-drag-over");},{signal});
    this.overlay.addEventListener("dragleave",()=>this.viewport.classList.remove("is-drag-over"),{signal});
    this.overlay.addEventListener("drop",event=>{event.preventDefault();this.viewport.classList.remove("is-drag-over");const file=event.dataTransfer.files[0];if(file)this.useFile(file).catch(error=>this.message(error.message,true));else {const link=event.dataTransfer.getData("text/uri-list")||event.dataTransfer.getData("text/plain");this.overlay.querySelector('[data-image-control="url"]').value=link;this.readLink(link).catch(error=>this.message(error.message,true));}},{signal});
    this.overlay.querySelector('[data-image-control="url"]').focus();this.paint();
    if(this.source)await this.readLink(this.source).catch(error=>this.message(error.message,true));return this;
  }
  message(text,error=false) {if(this.closed)return;const target=this.overlay.querySelector(".vm-image-message");target.textContent=text;target.classList.toggle("is-error",error);}
  paint() {
    if(this.closed)return;
    for(const img of this.overlay.querySelectorAll(".vm-crop-image,.vm-crop-mini img")){img.style.objectFit=this.fit.mode;img.style.transform=fitTransform(this.fit);img.style.opacity=this.loaded?1:0;}
    this.overlay.querySelector(".vm-crop-placeholder").style.display=this.loaded?"none":"";
    this.overlay.querySelector('[data-image-control="zoom"]').value=this.fit.zoom;
    this.overlay.querySelector('[data-image-zoom]').textContent=`${Math.round(this.fit.zoom*100)}%`;
    for(const mode of ["contain","cover"])this.overlay.querySelector(`[data-image-action="${mode}"]`).classList.toggle("is-active",this.fit.mode===mode);
  }
  async readLink(value) {
    if(this.applying)return;
    const generation=++this.generation;this.loading?.abort();this.loading=new AbortController();const request=this.loading;
    this.message("Carregando imagem…");this.overlay.querySelector('[data-image-action="apply"]').disabled=true;
    const timer=setTimeout(()=>request.abort(),15000);
    try{
      const image=await importImageLink(value,{signal:request.signal});if(this.closed||generation!==this.generation||request!==this.loading)return;
      this.file=null;if(this.tempURL){URL.revokeObjectURL(this.tempURL);this.tempURL=null;}this.source=image.source;this.loaded=true;
      this.overlay.querySelector('[data-image-control="url"]').value=image.source;
      this.overlay.querySelectorAll(".vm-crop-image,.vm-crop-mini img").forEach(img=>img.src=mediaURL(image.source));
      this.message(`${image.width} × ${image.height} px · Pronto para enquadrar.`);this.paint();
    }finally{clearTimeout(timer);if(!this.closed&&generation===this.generation&&request===this.loading)this.overlay.querySelector('[data-image-action="apply"]').disabled=false;}
  }
  async useFile(file) {
    if(this.applying)return;
    ensure(file.size>0&&file.size<=20*1024*1024,"Use uma imagem com até 20 MB.");ensure(file.type.startsWith("image/"),"Escolha um arquivo de imagem.");
    const generation=++this.generation;this.loading?.abort();this.loading=new AbortController();const request=this.loading,nextURL=URL.createObjectURL(file);
    this.overlay.querySelector('[data-image-action="apply"]').disabled=true;
    let image;try{image=await loadImage(nextURL,{signal:request.signal});}catch(error){URL.revokeObjectURL(nextURL);throw error;}finally{if(!this.closed&&generation===this.generation)this.overlay.querySelector('[data-image-action="apply"]').disabled=false;}
    if(this.closed||generation!==this.generation){URL.revokeObjectURL(nextURL);return;}
    if(this.tempURL)URL.revokeObjectURL(this.tempURL);this.tempURL=nextURL;
    this.file=file;this.source="";this.loaded=true;this.overlay.querySelectorAll(".vm-crop-image,.vm-crop-mini img").forEach(img=>img.src=this.tempURL);
    this.overlay.querySelector('[data-image-control="url"]').value=file.name;this.message(`${image.width} × ${image.height} px · O arquivo só será enviado ao aplicar.`);this.paint();
  }
  async action(action) {
    if(this.applying&&action!=="cancel")return;
    if(action==="cancel"){this.close();return;}
    if(action==="load"){await this.readLink(this.overlay.querySelector('[data-image-control="url"]').value);return;}
    if(action==="browse"){
      const Picker=foundry.applications.apps.FilePicker.implementation;
      const picker=new Picker({type:"image",current:this.source,callback:source=>{if(!this.closed)this.readLink(source).catch(error=>this.message(error.message,true));}});
      await picker.render({force:true});picker.bringToFront?.();if(picker.element)picker.element.style.zIndex="10021";return;
    }
    if(action==="remove"){this.generation++;this.overlay.querySelector('[data-image-action="apply"]').disabled=false;this.loading?.abort();this.file=null;this.source="";this.loaded=false;this.fit=imageFit();if(this.tempURL){URL.revokeObjectURL(this.tempURL);this.tempURL=null;}this.overlay.querySelector('[data-image-control="url"]').value="";this.message("A imagem será removida ao aplicar.");this.paint();return;}
    if(action==="apply"){
      const controls=[...this.overlay.querySelectorAll('button,input')],fit=imageFit(this.fit),file=this.file,source=this.source;this.applying=true;
      controls.forEach(control=>{if(control.dataset.imageAction!=="cancel")control.disabled=true;});
      try{let path=source;if(file){this.message("Enviando imagem ao Foundry…");path=await this.upload(file);}if(this.closed)return;await this.onApply({source:path,fit});this.close();}
      finally{this.applying=false;if(!this.closed)controls.forEach(control=>control.disabled=false);}return;
    }
    if(action==="zoom-in")this.fit=zoomFit(this.fit,-80);
    else if(action==="zoom-out")this.fit=zoomFit(this.fit,80);
    else if(action==="rotate")this.fit.rotation=(this.fit.rotation+90)%360;
    else if(action==="reset")this.fit=imageFit();
    else if(["contain","cover"].includes(action)){this.fit=imageFit({mode:action});}
    this.paint();
  }
  close() {if(this.closed)return;this.closed=true;this.generation++;this.loading?.abort();this.events.abort();if(this.tempURL)URL.revokeObjectURL(this.tempURL);this.overlay?.remove();this.onClose?.();if(this.previousFocus?.isConnected)this.previousFocus.focus();}
}
