import test from 'node:test';
import assert from 'node:assert/strict';
import {createAutosave,parseAutosave,encodeAutosave,AUTOSAVE_KEY} from '../src/autosave.js';
const snapshot=()=>({session:{datasetSize:16,threshold:50,minutesPerReview:5,capacity:5,entries:[]},drafts:new Map([['TX-0002','Черновик проверки']]),selected:'TX-0002'});
function storage(){const map=new Map();return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};}
test('local snapshot restores drafts, selection and validated session',()=>{const result=parseAutosave(encodeAutosave(snapshot()));assert.equal(result.drafts[0][1],'Черновик проверки');assert.equal(result.selected,'TX-0002');assert.equal(result.session.threshold,50);});
test('invalid local data is rejected, including unknown IDs and duplicate drafts',()=>{
 assert.throws(()=>parseAutosave('{broken'),/повреждена/);
 const data=JSON.parse(encodeAutosave(snapshot()));for(const drafts of [[['UNKNOWN','test']],[['TX-0002','a'],['TX-0002','b']],[['TX-0002','a'.repeat(241)]]])assert.throws(()=>parseAutosave(JSON.stringify({...data,drafts})),/черновик/);
});
test('two tabs cannot silently overwrite or delete each other',()=>{const store=storage(),a=createAutosave(store),b=createAutosave(store);a.read();b.read();a.write(snapshot());assert.throws(()=>b.write(snapshot()),/другой вкладке/);assert.throws(()=>b.clear(),/другой вкладке/);assert.ok(store.getItem(AUTOSAVE_KEY));});
test('failed storage write does not claim a saved copy',()=>{const store=storage(),a=createAutosave(store);a.read();store.setItem=()=>{throw new Error('QuotaExceededError');};assert.throws(()=>a.write(snapshot()),/Quota/);assert.equal(store.getItem(AUTOSAVE_KEY),null);});
test('clear removes only BankGuard snapshot',()=>{const store=storage();store.setItem('other','keep');const a=createAutosave(store);a.read();a.write(snapshot());a.clear();assert.equal(store.getItem(AUTOSAVE_KEY),null);assert.equal(store.getItem('other'),'keep');});
