import test from 'node:test';
import assert from 'node:assert/strict';
import {chartPoints,thresholdChart} from '../src/threshold-chart.js';
import {thresholdSweep} from '../src/threshold-sweep.js';
import {scenarios} from '../src/data.js';
test('chart endpoints retain counts at every threshold boundary',()=>{const rows=thresholdSweep(scenarios);for(const key of ['reviewed','fp','fn']){const points=chartPoints(rows,key);assert.equal(points[0].threshold,1);assert.equal(points.at(-1).threshold,100);rows.forEach((row,i)=>{assert.deepEqual(points[i*2],{threshold:row.from,value:row[key]});assert.deepEqual(points[i*2+1],{threshold:row.to,value:row[key]});});}});
test('chart announces current results and has distinct non-color-only series',()=>{const html=thresholdChart(thresholdSweep(scenarios),50);assert.match(html,/проверок 6, ложных тревог 1, пропусков 2/);assert.equal((html.match(/data-series=/g)||[]).length,3);assert.match(html,/stroke-dasharray="8 4"/);});
