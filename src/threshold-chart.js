// Shared numeric axes: each series is a count over the entire synthetic sample.
export function chartPoints(ranges,key){
 return ranges.flatMap(range=>[{threshold:range.from,value:range[key]},{threshold:range.to,value:range[key]}]);
}
export function thresholdChart(ranges,threshold){
 const max=Math.max(1,...ranges.map(row=>Math.max(row.reviewed,row.fp,row.fn)));
 const x=n=>48+(n-1)*660/99,y=n=>220-n*176/max;
 const series=[['reviewed','Проверки','#89b8f2',''],['fp','Ложные тревоги','#e6ba77','8 4'],['fn','Пропуски','#db93a2','2 5']];
 const current=ranges.find(row=>threshold>=row.from&&threshold<=row.to);
 return `<figure class="threshold-figure"><figcaption><h2>Как порог меняет нагрузку и ошибки</h2><p>Количество операций · весь набор, до ограничения ёмкости команды</p></figcaption><div class="chart-scroll"><svg viewBox="0 0 740 265" role="img" aria-labelledby="chart-title chart-desc"><title id="chart-title">Проверки и ошибки при порогах от 1 до 100</title><desc id="chart-desc">При пороге ${threshold}: проверок ${current.reviewed}, ложных тревог ${current.fp}, пропусков ${current.fn}. Точные значения доступны в таблице всех порогов ниже.</desc>${[0,.5,1].map(f=>`<line x1="48" y1="${y(max*f)}" x2="708" y2="${y(max*f)}" stroke="#34414e"/><text x="38" y="${y(max*f)+4}" text-anchor="end">${Math.round(max*f)}</text>`).join('')}${series.map(([key,label,color,dash])=>`<polyline data-series="${key}" points="${chartPoints(ranges,key).map(point=>`${x(point.threshold)},${y(point.value)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="3" stroke-dasharray="${dash}"/>`).join('')}<line x1="${x(threshold)}" x2="${x(threshold)}" y1="36" y2="220" stroke="#b7cfb4" stroke-dasharray="4 4"/><text x="${Math.min(635,Math.max(60,x(threshold)))}" y="25">Порог ${threshold}</text>${[1,25,50,75,100].map(n=>`<text x="${x(n)}" y="245" text-anchor="middle">${n}</text>`).join('')}</svg></div><div class="chart-legend">${series.map(([key,label,color])=>`<span><i style="background:${color}"></i>${label}: <b>${current[key]}</b></span>`).join('')}</div></figure>`;
}
