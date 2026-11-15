import {createAutosave} from './autosave.js';
import {userMessage,UserFacingError} from './errors.js';
import {$,fmt,money,esc,card} from './ui.js';
import {createLabView} from './lab-view.js';
import {createNavigation} from './navigation.js';
import {paginate} from './pagination.js';
import {parseRequiredNumber} from './numeric-input.js';
import {thresholdSweep} from './threshold-sweep.js';
import {createSimulator} from './simulator.js';
import {casePacket} from './case-packet.js';
import {errorCases} from './diagnostics.js';
import {createImportController,hasLocalWork} from './import-controller.js';
import {decision,evaluate,csv,VERSION,pendingQueue,compareThresholds,workload,capacityEvaluation} from './engine.js';
import {scenarios as storyScenarios} from './data.js';
import {generateStress} from './stress.js';
import {parseSession,serializeSession,appendSessionEntry,MAX_SESSION_BYTES} from './session.js';
const imports=createImportController(), simulator=createSimulator();
let scenarios=storyScenarios,datasetLabel='16 сюжетных сценариев';
let threshold=50,selected=scenarios[1].id,log=[],resolutions=new Map(),commentDrafts=new Map();
let page=1;
let autosave, savedLocal=null, recoveryPending=false, autosaveReady=false, autosaveHealthy=false;
let lastValidSettings={minutesPerReview:5,capacity:5}, toastTimer;
function notify(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,7000);}
function persist(){
 if(!autosaveReady||recoveryPending||!$('#autosave-enabled').checked)return;
 try{
  try{lastValidSettings.minutesPerReview=workload(scenarios,threshold,parseRequiredNumber($('#review-minutes').value,'Минут на проверку')).minutesPerReview;}catch{}
  try{lastValidSettings.capacity=capacityEvaluation(scenarios,threshold,parseRequiredNumber($('#capacity').value,'Ёмкость аналитиков')).capacity;}catch{}
  autosave.write({session:{datasetSize:scenarios.length,threshold,...lastValidSettings,entries:log},drafts:commentDrafts,selected});
  autosaveHealthy=true;
  const message='Сохранено на этом устройстве · '+new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
  $('#autosave-status').textContent=message;$('#autosave-note').textContent=message+'. При пустых или некорректных полях лаборатории сохраняются последние корректные настройки.';
 }catch(error){autosaveHealthy=false;$('#autosave-status').textContent='Автосохранение недоступно';$('#autosave-note').textContent=error instanceof UserFacingError?error.message:'Не удалось сохранить демо в браузере. Скачайте сессию в файл; черновики в файл не входят.';}
}

const laboratory=createLabView({getState:()=>({scenarios,threshold}),inspect:id=>{selected=id;$('#search').value=id;$('#filter').value='all';page=1;renderMonitor();navigation.go('monitor');$('#detail').focus();}});
const navigation=createNavigation(()=>laboratory.render());
const status=t=>resolutions.get(t.id)?.action || (decision(t,threshold).review?'На проверку':'Низкий балл');
function reasons(r){return r.reasons.length?r.reasons.map(x=>`<div class="reason"><span>${x.label}</span><b>+${x.points}</b></div>`).join(''):'<p>Ни одно демо-правило не сработало. Это не гарантия безопасности.</p>';}
function resultHtml(t){const r=decision(t,threshold);return `<span class="eyebrow">${esc(t.id||'ТЕСТОВАЯ ОПЕРАЦИЯ')}</span><h2>${esc(t.title||'Результат симуляции')}</h2><p>${money(t.amount)} · обычная сумма ${money(t.usualAmount)}</p><div class="scoreline"><div class="scorebox">${r.score}<small> / 100</small></div><span class="pill ${r.review?'warning':'safe'}">${r.review?'Ручная проверка':'Низкий балл'}</span></div><div class="bar"><span style="width:${r.score}%"></span></div><h3>Почему такой балл</h3>${reasons(r)}<p class="recommend">${r.review?'Рекомендация: передать аналитику для независимой проверки через официальный канал банка. Не полагаться на звонящего.':'По выбранному порогу проверка не требуется. Слабые или скрытые признаки могут быть пропущены.'}</p><p>Порог ${threshold} · ${VERSION} · решение человека обязательно для реального применения.</p>`;}
function packetHtml(t){
 const packet=casePacket(t,threshold),facts=packet.facts.values,yesNo=value=>value?'Да':'Нет';
 return `<details><summary>Пакет разбора: факты, сигналы, вопросы</summary><p>Только синтетические входные поля, не проверенные сведения банка. Учебная метка и название сценария в пакет не включаются.</p><h3>Исходные поля сценария</h3><dl><dt>Сумма / обычная сумма</dt><dd>${money(facts.amount)} / ${money(facts.usualAmount)}</dd><dt>Переводов за час</dt><dd>${facts.transfersHour}</dd><dt>Новый получатель / новое устройство</dt><dd>${yesNo(facts.newRecipient)} / ${yesNo(facts.newDevice)}</dd><dt>Синтетический флаг сообщения о давлении</dt><dd>${yesNo(facts.callerPressure)}</dd></dl><h3>Сигналы правил</h3><p>Балл ${packet.signals.risk}, порог ${threshold}. Причины перечислены выше; это не заключение о клиенте.</p><h3>Вопросы для ручной проверки</h3><ol>${packet.questions.map(q=>`<li><p>${esc(q.question)}</p><small>Гипотеза/оговорка: ${esc(q.hypothesis)} Ответ не собран.</small></li>`).join('')}</ol><button id="export-case" class="secondary">↓ Пакет разбора JSON</button><p>Выгрузка не выполняет проверку и не содержит решения. Пакет не подписан.</p></details>`;
}
function renderDetail(){
 const t=scenarios.find(row=>row.id===selected);
 const r=decision(t,threshold);
 $('#detail').innerHTML=`<div class="case-heading"><span class="eyebrow">КАРТОЧКА · ${esc(t.id)}</span><span class="pill ${resolutions.has(t.id)||!r.review?'safe':'warning'}">${esc(status(t))}</span></div><h2>${esc(t.title)}</h2><div class="case-overview"><div><small>Сумма перевода</small><strong>${money(t.amount)}</strong><small>Обычно ${money(t.usualAmount)}</small></div><div class="case-risk"><small>Балл риска</small><strong>${r.score}<small> / 100</small></strong><small>Порог ${threshold}</small></div></div><h3>Почему такой балл</h3>${reasons(r)}<section class="decision-form"><h3>Решение аналитика</h3><label for="reason">Комментарий к решению</label><textarea id="reason" rows="3" placeholder="Укажите результат проверки — только вымышленные сведения" maxlength="240">${esc(commentDrafts.get(t.id)||'')}</textarea><div class="actions"><button id="approve" class="secondary">Снять с проверки</button><button id="escalate" class="primary">Эскалировать</button></div><div class="next-decision"><label for="decision-action">Решение и переход дальше</label><select id="decision-action"><option value="escalate">Эскалировать</option><option value="approve">Снять с проверки</option></select><button id="save-next" class="primary">Сохранить и открыть следующий →</button></div><p id="decision-note" role="status">${resolutions.has(t.id)?'Последнее решение: '+esc(status(t)):'Комментарий обязателен. Реальных действий со счётом нет.'}</p></section>`+packetHtml(t);
 $('#export-case').onclick=()=>download('bankguard-case-'+t.id+'.json',JSON.stringify(casePacket(t,threshold),null,2),'application/json');
 $('#reason').oninput=e=>{commentDrafts.set(t.id,e.target.value);renderSessionContext();persist();};
 function save(action,next=false){
  const note=$('#reason').value.trim();
  if(!note){$('#decision-note').textContent='Добавьте комментарий, чтобы сохранить решение.';$('#reason').focus();return;}
  const entry={id:t.id,action,note,risk:r.score,reasons:r.reasons,threshold,version:VERSION,time:new Date().toISOString()};
  try{appendSessionEntry({datasetSize:scenarios.length,entries:log},entry);}catch(error){$('#decision-note').textContent='Решение не добавлено: '+userMessage(error);return;}
  imports.invalidate();log.unshift(entry);resolutions.set(t.id,entry);commentDrafts.delete(t.id);
  const queue=pendingQueue(scenarios,threshold,new Set(resolutions.keys()));
  if(next){$('#search').value='';$('#filter').value='pending';page=1;if(queue.length)selected=queue[0].id;}
  render();persist();
  notify(`Решение по ${t.id} сохранено.${next?(queue.length?' Открыта следующая операция.':' Очередь обработана — ожидающих операций нет.'):''}`);
  if(next){$('#detail').focus();$('#detail').scrollIntoView({block:'nearest'});}
 }
 $('#approve').onclick=()=>save('Снято с проверки');$('#escalate').onclick=()=>save('Эскалировано');
 $('#save-next').onclick=()=>save($('#decision-action').value==='approve'?'Снято с проверки':'Эскалировано',true);
}
function renderMonitor(){const review=scenarios.filter(t=>decision(t,threshold).review);$('#stats').innerHTML=card('Операций в выборке',scenarios.length,'Синтетические сценарии')+card('По правилам на проверку',review.length,`Порог ≥ ${threshold}`,true)+card('Сумма на проверку',money(review.reduce((s,t)=>s+t.amount,0)),'Не предотвращённый ущерб')+card('Решений аналитика',log.length,'В текущей вкладке');const query=$('#search').value.toLowerCase(),filter=$('#filter').value;const queue=pendingQueue(scenarios,threshold,new Set(resolutions.keys()));$('#pending-count').textContent=queue.length;$('#resolved-count').textContent=resolutions.size;$('#all-count').textContent=scenarios.length;document.querySelectorAll('[data-queue]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.queue===filter)));$('#queue-count').textContent=`Ожидают решения: ${queue.length} · по убыванию риска`;$('#next-case').disabled=!queue.length;$('#next-case').onclick=()=>{selected=queue[0].id;$('#search').value='';$('#filter').value='pending';page=1;renderMonitor();$('#detail').focus();$('#detail').scrollIntoView({block:'nearest'});};const rows=scenarios.filter(t=>(t.id+' '+t.title).toLowerCase().includes(query)).filter(t=>filter==='all'||(filter==='pending'?queue.some(q=>q.id===t.id):filter==='resolved'?resolutions.has(t.id):decision(t,threshold).review===(filter==='review'))).sort((a,b)=>filter==='pending'?decision(b,threshold).score-decision(a,threshold).score||a.id.localeCompare(b.id):0);const slice=paginate(rows,page);page=slice.page;$('#page-status').textContent=`${slice.total? slice.start+1:0}–${slice.end} из ${slice.total} · страница ${page} / ${slice.pages}`;$('#prev-page').disabled=page===1;$('#next-page').disabled=page===slice.pages;$('#transactions').innerHTML=rows.length?slice.items.map(t=>{const r=decision(t,threshold);return `<tr class="${selected===t.id?'selected':''}"><td><button class="row-button" data-id="${t.id}" aria-pressed="${selected===t.id}" aria-label="Открыть ${t.id}: ${esc(t.title)}">${t.id}<small>${t.title}</small></button></td><td>${money(t.amount)}</td><td><b>${r.score}</b><small>/ 100</small></td><td><span class="pill ${r.review?'warning':'safe'}">${status(t)}</span></td></tr>`;}).join(''):`<tr><td colspan="4" class="empty">${query?'Ничего не найдено. Попробуйте изменить поиск.':filter==='pending'?'Очередь обработана. Ожидающих операций нет.':filter==='resolved'?'Обработанных операций пока нет.':'Операций не найдено'}</td></tr>`;document.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>{selected=b.dataset.id;renderMonitor();$('#detail').focus();});renderDetail();}
function resetState(){page=1;imports.invalidate();threshold=50;selected=scenarios[Math.min(1,scenarios.length-1)].id;log=[];resolutions.clear();commentDrafts.clear();selected=pendingQueue(scenarios,threshold,new Set())[0]?.id||scenarios[0].id;$('#threshold').value=50;$('#review-minutes').value=5;$('#capacity').value=5;$('#form-error').textContent='';$('#search').value='';$('#filter').value='pending';simulator.invalidate();$('#sim-form').reset();$('#sim-result').innerHTML='<h2>Прозрачное решение</h2><p>Запустите расчёт.</p>';render();}
function loadDataset(count){scenarios=count===16?storyScenarios:generateStress(count,2026);datasetLabel=count===16?'16 сюжетных сценариев':`${count} стресс-операций · начальное значение 2026`;$('#dataset-count').textContent=scenarios.length;$('#dataset-note').textContent=count===16?'16 авторских сценариев. Метки предназначены только для лаборатории.':'Искусственные пересекающиеся распределения с условной долей мошеннических сценариев 15%. Не банковские данные и не независимая оценка качества.';resetState();}
$('#load-dataset').onclick=()=>{if(hasLocalWork(log,commentDrafts)&&!confirm('Сбросить решения и черновики? Решения можно сохранить в демо-сессию; черновики не экспортируются.'))return;loadDataset(Number($('#dataset').value));persist();};
$('#capacity').oninput=()=>{laboratory.renderCapacity();laboratory.renderComparison();};
function render(){renderMonitor();laboratory.render();renderAudit();$('#context-dataset').textContent=datasetLabel;$('#context-threshold').textContent=`Порог ${threshold} / 100`;renderSessionContext();}
function renderSessionContext(){$('#context-decisions').textContent=`Решений: ${log.length}${[...commentDrafts.values()].some(note=>note.trim())?' · есть черновик':''}`;}
function renderAudit(){$('#audit-list').innerHTML=log.length?log.map(e=>`<div class="audit-item"><b>${e.id} · ${esc(e.action)}</b><p>${esc(e.note)}</p><small>${new Date(e.time).toLocaleString('ru-RU')} · риск ${e.risk} · порог ${e.threshold} · ${e.version}</small></div>`).join(''):'<div class="empty">Пока нет решений. Откройте операцию в мониторинге и добавьте комментарий.</div>';}
function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

$('#review-minutes').oninput=()=>laboratory.renderComparison();$('#export-report').onclick=()=>download('bankguard-experiment.json',JSON.stringify({synthetic:true,version:VERSION,createdAt:new Date().toISOString(),dataset:datasetLabel,sampleSize:scenarios.length,thresholdSweep:thresholdSweep(scenarios),errorCases:errorCases(scenarios,threshold),comparison:compareThresholds(scenarios,threshold),workload:workload(scenarios,threshold,parseRequiredNumber($('#review-minutes').value,'Минут на проверку')),capacity:capacityEvaluation(scenarios,threshold,parseRequiredNumber($('#capacity').value,'Ёмкость аналитиков')),assumptions:{thresholdSweepScope:'all alerts before capacity limits; descriptive synthetic metrics, not a recommendation',perfectAnalyst:true,capacityScope:'entire dataset, no arrival times or SLA',queueOrder:'risk descending, transaction ID ascending',seed:scenarios.length===16?null:2026},warning:'Synthetic fixture, not bank validation. Risk score is not a probability. Capacity recall assumes perfect identification of fraud among reviewed cases; it is not measured analyst performance.'},null,2),'application/json');
$('#search').oninput=()=>{page=1;renderMonitor();};$('#filter').onchange=()=>{page=1;renderMonitor();};$('#prev-page').onclick=()=>{page--;renderMonitor();};$('#next-page').onclick=()=>{page++;renderMonitor();};$('#threshold').oninput=e=>{threshold=Number(e.target.value);render();if(simulator.current())$('#sim-result').innerHTML=resultHtml(simulator.current());};
$('#sim-form').onsubmit=e=>{e.preventDefault();const data=new FormData(e.target),t={},labels={amount:'Сумма перевода',usualAmount:'Обычная сумма',transfersHour:'Переводов за час'};try{for(const k of ['amount','usualAmount','transfersHour'])t[k]=parseRequiredNumber(data.get(k),labels[k]);for(const k of ['newRecipient','newDevice','callerPressure'])t[k]=data.has(k);simulator.calculate(t,threshold);$('#sim-result').innerHTML=resultHtml(simulator.current());$('#form-error').textContent='';}catch(err){simulator.invalidate();$('#sim-result').textContent='Расчёт не выполнен. Исправьте входные данные.';$('#form-error').textContent=userMessage(err);}};
$('#export').onclick=()=>download('bankguard-transactions.csv',csv(scenarios.map(t=>({id:t.id,amount:t.amount,risk:decision(t,threshold).score,status:status(t),reason:decision(t,threshold).reasons.map(r=>r.label).join('; ')}))),'text/csv;charset=utf-8');
$('#export-audit').onclick=()=>download('bankguard-audit.json',JSON.stringify({synthetic:true,version:VERSION,exportedAt:new Date().toISOString(),entries:log},null,2),'application/json');
$('#reset').onclick=()=>{if(!hasLocalWork(log,commentDrafts)||confirm('Сбросить решения, черновики и настройки этой вкладки?')){resetState();persist();}};
$('#save-session').onclick=()=>{try{download('bankguard-session.json',serializeSession({datasetSize:scenarios.length,threshold,minutesPerReview:parseRequiredNumber($('#review-minutes').value,'Минут на проверку'),capacity:parseRequiredNumber($('#capacity').value,'Ёмкость аналитиков'),entries:log}),'application/json');$('#session-note').textContent='Скачивание демо-сессии начато. Проверьте файл в загрузках. Файл редактируемый, не банковский аудит.';}catch(e){$('#session-note').textContent=userMessage(e);}};
// Do not let a slow import overwrite edits made after file selection.
document.addEventListener('input',e=>{if(e.target.id!=='restore-session'){imports.invalidate();if(['threshold','capacity','review-minutes'].includes(e.target.id))persist();}});
window.addEventListener('beforeunload',e=>{if(hasLocalWork(log,commentDrafts)&&!autosaveHealthy){e.preventDefault();e.returnValue='';}});
$('#restore-session').onchange=async e=>{
 const input=e.target,file=input.files[0];if(!file)return;
 input.value=''; // Allow selecting the same file again; an old read must not clear a new selection.
 try{
  const result=await imports.restore(async()=>{
   if(file.size>MAX_SESSION_BYTES)throw new UserFacingError('Файл слишком большой. Выберите демо-сессию размером не более 2 МБ.');try{return await file.text();}catch{throw new UserFacingError('Не удалось прочитать файл. Проверьте, что он доступен, и выберите его ещё раз.');}
  },parseSession,()=>!hasLocalWork(log,commentDrafts)||confirm('Заменить текущие решения и черновики загруженной демо-сессией?'),state=>{
   loadDataset(state.datasetSize);$('#dataset').value=state.datasetSize;threshold=state.threshold;$('#threshold').value=threshold;
   $('#review-minutes').value=state.minutesPerReview;$('#capacity').value=state.capacity;log=state.entries;resolutions=new Map();
   for(const entry of [...log].reverse())resolutions.set(entry.id,entry);render();
  });
  if(result==='applied'){$('#session-note').textContent='Сессия восстановлена. Оценки пересчитаны; подлинность комментариев не проверяется.';persist();}
  else if(result==='cancelled')$('#session-note').textContent='Восстановление отменено. Текущие данные сохранены.';
  // Stale operations must not overwrite status from a newer import.
 }catch(err){$('#session-note').textContent='Не удалось восстановить: '+userMessage(err);}
};
$('#open-session').onclick=()=>navigation.go('audit');
render();

$('#sim-form').oninput=()=>{simulator.invalidate();$('#sim-result').textContent='Данные изменены. Рассчитайте риск заново.';$('#form-error').textContent='';};

// Queue shortcuts have the same semantics as the accessible filter select.
document.querySelectorAll('[data-queue]').forEach(button=>button.onclick=()=>{$('#filter').value=button.dataset.queue;$('#search').value='';page=1;renderMonitor();});
function applyLocal(saved){
 const state=saved.session;loadDataset(state.datasetSize);$('#dataset').value=state.datasetSize;
 threshold=state.threshold;$('#threshold').value=threshold;
 $('#review-minutes').value=state.minutesPerReview;$('#capacity').value=state.capacity;
 lastValidSettings={minutesPerReview:state.minutesPerReview,capacity:state.capacity};
 log=state.entries;resolutions=new Map();for(const entry of [...log].reverse())resolutions.set(entry.id,entry);
 commentDrafts=new Map(saved.drafts);selected=saved.selected;render();
}
try{
 autosave=createAutosave(localStorage);savedLocal=autosave.read();autosaveReady=true;
 if(savedLocal){recoveryPending=true;$('#recovery').hidden=false;$('#recovery-note').textContent=`Решений: ${savedLocal.session.entries.length}, черновиков: ${savedLocal.drafts.filter(([,note])=>note.trim()).length}. Восстановите работу или начните новую сессию.`;$('#autosave-status').textContent='Ожидается выбор восстановления';}
}catch(error){autosaveReady=Boolean(autosave);recoveryPending=true;$('#recovery').hidden=false;$('#recover-local').disabled=true;$('#recovery-note').textContent=error instanceof UserFacingError?error.message:'Хранилище браузера недоступно. Продолжайте работу и сохраняйте сессию в файл.';$('#autosave-status').textContent='Автосохранение недоступно';}
let recoveryConfirmed=false;
$('#recover-local').onclick=()=>{if(!savedLocal)return;if(hasLocalWork(log,commentDrafts)&&!recoveryConfirmed){recoveryConfirmed=true;$('#recovery-note').textContent='В этой вкладке уже есть новая работа. Повторное нажатие заменит её сохранённой сессией и черновиками.';$('#recover-local').textContent='Заменить текущую работу';return;}applyLocal(savedLocal);recoveryPending=false;$('#recovery').hidden=true;persist();notify('Демо-сессия и черновики восстановлены.');};
$('#discard-local').onclick=()=>{try{autosave?.clear();}catch(error){$('#recovery-note').textContent=userMessage(error);return;}recoveryPending=false;$('#recovery').hidden=true;persist();};
$('#autosave-enabled').onchange=()=>{autosaveHealthy=false;if($('#autosave-enabled').checked)persist();else{$('#autosave-status').textContent='Автосохранение выключено';$('#autosave-note').textContent='Ранее сохранённая копия остаётся на устройстве. Её можно удалить кнопкой ниже.';}};
$('#clear-local').onclick=()=>$('#clear-local-confirm').hidden=false;
$('#cancel-clear-local').onclick=()=>$('#clear-local-confirm').hidden=true;
$('#confirm-clear-local').onclick=()=>{try{autosave?.clear();recoveryPending=false;savedLocal=null;$('#recovery').hidden=true;$('#autosave-enabled').checked=false;autosaveHealthy=false;$('#clear-local-confirm').hidden=true;$('#autosave-status').textContent='Локальная копия удалена';$('#autosave-note').textContent='Автосохранение выключено. Текущая работа осталась во вкладке.';notify('Локальная копия удалена.');}catch(error){$('#autosave-note').textContent=userMessage(error);}};
