export const $=s=>document.querySelector(s),fmt=n=>new Intl.NumberFormat('ru-RU').format(n),money=n=>fmt(n)+' ₸',esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function card(label,value,hint,accent=false){return `<div class="stat ${accent?'accent':''}"><span>${label}</span><strong>${value}</strong><span>${hint}</span></div>`;}
