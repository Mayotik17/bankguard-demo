// Navigation owns URL/history, selected section, titles and keyboard focus.
export function createNavigation(onNavigate=()=>{}) {
 const buttons=[...document.querySelectorAll('.nav')];
 const valid=new Set(buttons.map(button=>button.dataset.view));
 function show(view,focus=true) {
  if(!valid.has(view)) view='monitor';
  document.querySelectorAll('.view').forEach(section=>section.hidden=section.id!==view);
  buttons.forEach(button=>{
   const active=button.dataset.view===view;
   button.classList.toggle('active',active);
   if(active) button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
  });
  const label=buttons.find(button=>button.dataset.view===view).textContent.trim().slice(2).trim();
  document.querySelector('#page-label').textContent=label;
  document.title=`BankGuard · ${label}`;
  onNavigate(view);
  if(focus) document.querySelector(`#${view} h1`).focus();
 }
 function go(view) {if(!valid.has(view))return;history.pushState(null,'',`#${view}`);show(view);}
 buttons.forEach(button=>button.onclick=()=>go(button.dataset.view));
 document.querySelector('.brand').onclick=event=>{event.preventDefault();go('monitor');};
 window.addEventListener('popstate',()=>show(location.hash.slice(1)));
 show(location.hash.slice(1),false);
 return {go};
}
