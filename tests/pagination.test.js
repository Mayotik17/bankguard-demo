import test from 'node:test';
import assert from 'node:assert/strict';
import {paginate} from '../src/pagination.js';
test('all 1000 operations remain reachable once across 50 pages',()=>{
 const rows=Array.from({length:1000},(_,id)=>({id}));
 const result=Array.from({length:50},(_,i)=>paginate(rows,i+1).items).flat();
 assert.deepEqual(result,rows);assert.equal(paginate(rows,50).end,1000);
});
test('filter shrink clamps page and empty search has valid bounds',()=>{
 assert.deepEqual(paginate([],50),{items:[],page:1,pages:1,start:0,end:0,total:0});
 assert.equal(paginate([1,2],50).page,1);assert.equal(paginate([1],-1).page,1);
});
test('partial last page does not mutate source and invalid size fails',()=>{
 const rows=Array.from({length:21},(_,i)=>i);assert.deepEqual(paginate(rows,2).items,[20]);assert.equal(rows.length,21);assert.throws(()=>paginate(rows,1,0),RangeError);
});
