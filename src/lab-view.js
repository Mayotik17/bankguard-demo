import {thresholdChart} from './threshold-chart.js';
import {userMessage,UserFacingError} from './errors.js';
import {evaluate,compareThresholds,workload,capacityEvaluation} from './engine.js';
import {errorCases} from './diagnostics.js';
import {thresholdSweep} from './threshold-sweep.js';
import {parseRequiredNumber} from './numeric-input.js';
import {$,fmt,esc,card} from './ui.js';

export function createLabView({getState,inspect}) {
 let {scenarios,threshold}=getState();
 const sweepCache=new WeakMap();
 function sweepRows(){if(!sweepCache.has(scenarios))sweepCache.set(scenarios,thresholdSweep(scenarios));return sweepCache.get(scenarios);}
function renderLab(){({scenarios,threshold}=getState());const m=evaluate(scenarios,threshold),percent=x=>x===null?'—':Math.round(x*100)+'%';$('#threshold-value').textContent=threshold;$('#metrics').innerHTML=card('Точность проверок',percent(m.precision),'Доля меток мошенничества среди проверок')+card('Полнота выявления',percent(m.recall),'Найденные мошеннические сценарии',true)+card('Лишних проверок',m.fp,'Легитимные сценарии')+card('Пропущено',m.fn,'Мошеннические сценарии');$('#matrix').innerHTML=`<div class="matrix"><div><strong>${m.tp}</strong>TP · мошенничество → проверка</div><div><strong>${m.fp}</strong>FP · легитимный → проверка</div><div><strong>${m.fn}</strong>FN · мошенничество → пропуск</div><div><strong>${m.tn}</strong>TN · легитимный → пропуск</div></div>`;renderComparison();renderCapacity();renderDiagnostics();renderThresholdSweep();}
function renderDiagnostics(){
 const diagnostics=errorCases(scenarios,threshold);
 const section=(label,items)=>`<section><h3>${label}: ${items.length}</h3>${items.length?`<ol>${items.slice(0,5).map(item=>`<li><button class="secondary" data-inspect="${esc(item.id)}">${esc(item.id)} · ${esc(item.title)}</button><p>Балл ${item.risk} / 100 · порог ${item.threshold}. ${item.reasons.length?item.reasons.map(r=>esc(r.label)+' (+'+r.points+')').join('; '):'Ни одно правило не сработало.'}</p></li>`).join('')}</ol>`:'<p>Нет в выбранном синтетическом наборе при этом пороге.</p>'}${items.length>5?'<p>Показаны первые 5 по убыванию балла. Все случаи входят в JSON-отчёт эксперимента.</p>':''}</section>`;
 $('#error-cases').innerHTML=section('Ложные тревоги (FP)',diagnostics.falseAlerts)+section('Пропуски (FN)',diagnostics.misses);
 document.querySelectorAll('[data-inspect]').forEach(button=>button.onclick=()=>{
  inspect(button.dataset.inspect);
 });
}
function renderThresholdSweep(){
 $('#threshold-chart').innerHTML=thresholdChart(sweepRows(),threshold);
 const percent=value=>value===null?'—':Math.round(value*100)+'%';
 $('#threshold-sweep').innerHTML=`<div class="table-wrap"><table><caption>Результаты всех целых порогов 1–100 на текущем синтетическом наборе</caption><thead><tr><th scope="col">Порог</th><th scope="col">Проверок</th><th scope="col">Ложных тревог</th><th scope="col">Пропусков</th><th scope="col">Точность проверок</th><th scope="col">Полнота выявления</th></tr></thead><tbody>${sweepRows().map(r=>`<tr><th scope="row">${r.from===r.to?r.from:r.from+'–'+r.to}${threshold>=r.from&&threshold<=r.to?' (текущий)':''}</th><td>${r.reviewed}</td><td>${r.fp}</td><td>${r.fn}</td><td>${percent(r.precision)}</td><td>${percent(r.recall)}</td></tr>`).join('')}</tbody></table></div>`;
}
function renderComparison(){
 const c=compareThresholds(scenarios,threshold),signed=n=>(n>0?'+':'')+n;
 $('#comparison').innerHTML=`<div class="table-wrap"><table><thead><tr><th>Показатель</th><th>Порог 50</th><th>Порог ${threshold}</th><th>Изменение</th></tr></thead><tbody>${[['Ручных проверок','reviewed','reviews'],['Ложных тревог','fp','falseAlerts'],['Пропущенных мошеннических сценариев','fn','misses']].map(([label,key,delta])=>`<tr><td>${label}</td><td>${c.reference[key]}</td><td>${c.current[key]}</td><td>${signed(c.delta[delta])}</td></tr>`).join('')}</tbody></table></div>`;
 try{const w=workload(scenarios,threshold,parseRequiredNumber($('#review-minutes').value,'Минут на проверку'));$('#workload').textContent=`${w.reviews} проверок × ${w.minutesPerReview} мин = ${fmt(w.minutes)} мин на выборку. При пороге 50: ${fmt(c.reference.reviewed*w.minutesPerReview)} мин.`;capacityEvaluation(scenarios,threshold,parseRequiredNumber($('#capacity').value,'Ёмкость аналитиков'));$('#export-report').disabled=false;}catch(e){$('#workload').textContent=userMessage(e);$('#export-report').disabled=true;}
}
function renderCapacity(){
 try{const c=capacityEvaluation(scenarios,threshold,parseRequiredNumber($('#capacity').value,'Ёмкость аналитиков'));$('#capacity-result').innerHTML=`<div class="stats">${card('Проверят',c.handled,`из ${c.alerts} тревог`)}${card('Останутся в очереди',c.waiting,`${c.waitingFraud} меток мошенничества`)}${card('Мошенничество ниже порога',c.belowThresholdFraud,'Не попали в очередь')}${card('Полнота выявления с лимитом',c.recallWithCapacity===null?'—':Math.round(c.recallWithCapacity*100)+'%','При идеальной проверке, только синтетика',true)}</div>`;}catch(e){$('#capacity-result').textContent=userMessage(e);}
}

 return {render:renderLab,renderComparison,renderCapacity};
}
