import {parseSession,serializeSession} from './session.js';
import {scenarios} from './data.js';
import {generateStress} from './stress.js';
import {UserFacingError} from './errors.js';
export const AUTOSAVE_KEY='bankguard-demo-autosave-v1';
const MAX_BYTES=3_000_000;
export function parseAutosave(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES)throw new UserFacingError('Локальная копия слишком большая. Восстановите демо-сессию из файла.');
 let value;try{value=JSON.parse(text);}catch{throw new UserFacingError('Локальная копия повреждена. Можно удалить её и начать заново.');}
 if(value?.schema!=='bankguard-local-1'||typeof value.session!=='string')throw new UserFacingError('Неизвестный формат локальной копии.');
 const session=parseSession(value.session);
 const rows=session.datasetSize===16?scenarios:generateStress(session.datasetSize,2026),ids=new Set(rows.map(row=>row.id));
 if(!Array.isArray(value.drafts)||value.drafts.length>rows.length)throw new UserFacingError('Некорректные черновики в локальной копии.');
 const seen=new Set();
 for(const draft of value.drafts){
  if(!Array.isArray(draft)||draft.length!==2||!ids.has(draft[0])||seen.has(draft[0])||typeof draft[1]!=='string'||draft[1].length>240)throw new UserFacingError('Некорректный черновик в локальной копии.');
  seen.add(draft[0]);
 }
 return {session,drafts:value.drafts,selected:ids.has(value.selected)?value.selected:rows[0].id,savedAt:typeof value.savedAt==='string'?value.savedAt:''};
}
export function encodeAutosave({session,drafts,selected}){
 const text=JSON.stringify({schema:'bankguard-local-1',session:serializeSession(session),drafts:[...drafts],selected,savedAt:new Date().toISOString()});
 parseAutosave(text);return text;
}
// Compare the saved value before writing: another tab must never be silently overwritten.
export function createAutosave(storage){
 let baseline;
 function read(){baseline=storage.getItem(AUTOSAVE_KEY);return baseline===null?null:parseAutosave(baseline);}
 function write(snapshot){
  if(storage.getItem(AUTOSAVE_KEY)!==baseline)throw new UserFacingError('Демо-сессия изменена в другой вкладке. Автосохранение остановлено. Скачайте текущую сессию перед перезагрузкой.');
  const text=encodeAutosave(snapshot);storage.setItem(AUTOSAVE_KEY,text);baseline=text;
 }
 function clear(){
  if(storage.getItem(AUTOSAVE_KEY)!==baseline)throw new UserFacingError('Локальная копия изменена в другой вкладке. Перезагрузите страницу перед удалением.');
  storage.removeItem(AUTOSAVE_KEY);baseline=null;
 }
 return {read,write,clear};
}
