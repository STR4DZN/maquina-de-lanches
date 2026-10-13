import {ensure} from './core.js';
export const PAGE_SIZE=9;
export function slotCode(index) {
  ensure(Number.isInteger(index)&&index>=0,'Índice de produto inválido.');
  let row=Math.floor(index/3)+1,letters='';
  while(row>0){row--;letters=String.fromCharCode(65+row%26)+letters;row=Math.floor(row/26);}
  return `${letters}${index%3+1}`;
}
export function catalogPage(machine,{search='',category='all',page=0}={}) {
  const query=String(search).trim().toLocaleLowerCase('pt-BR');
  const indexed=machine.products.map((product,index)=>({product,index,code:slotCode(index)}));
  const visible=indexed.filter(({product:p,code})=>p.enabled&&(category==='all'||p.category===category)&&`${p.name} ${p.category} ${code}`.toLocaleLowerCase('pt-BR').includes(query));
  const pages=Math.max(1,Math.ceil(visible.length/PAGE_SIZE)),current=Math.max(0,Math.min(pages-1,Number.isFinite(Number(page))?Math.trunc(Number(page)):0));
  return {visible,pages,page:current,items:visible.slice(current*PAGE_SIZE,(current+1)*PAGE_SIZE)};
}
export function quantityState(machine,product,value) {
  const limit=Math.max(0,Math.min(product?.stock??0,machine.maxPerRequest)),quantity=Number(value);
  const valid=value!==''&&value!=null&&typeof value!=='boolean'&&Number.isInteger(quantity)&&quantity>=1&&quantity<=limit;
  return {limit,quantity,valid,reason:!product?'Escolha um produto.':limit===0?'Produto esgotado.':valid?'':`Informe de 1 a ${limit} unidades inteiras.`};
}
export function deliveryCount(quantity) {return Math.max(1,Math.min(4,Math.trunc(Number(quantity))||1));}
