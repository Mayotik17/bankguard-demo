import test from 'node:test';
import assert from 'node:assert/strict';
import {userMessage,UserFacingError} from '../src/errors.js';
import {parseSession} from '../src/session.js';
import {decision} from '../src/engine.js';
import {scenarios} from '../src/data.js';
test('malformed JSON has an actionable Russian message rather than engine syntax',()=>{
 for(const input of ['{invalid','', '<html>', '{"schema":']){
  assert.throws(()=>parseSession(input),error=>error instanceof UserFacingError&&/Файл повреждён/.test(error.message)&&!/Unexpected|Expected|position|SyntaxError/.test(error.message));
 }
});
test('unknown exceptions never expose English or arbitrary technical content',()=>{
 for(const error of [new Error('Failed to fetch'),new SyntaxError('Unexpected token'),null,{message:'secret'},'Error']){
  assert.match(userMessage(error),/^Не удалось выполнить действие/);
 }
 assert.equal(userMessage(new UserFacingError('Заполните поле «Сумма»')),'Заполните поле «Сумма»');
});
test('domain errors use Russian field labels',()=>{
 assert.throws(()=>decision({...scenarios[0],amount:-1},50),/Некорректное поле: Сумма перевода/);
 assert.throws(()=>decision({...scenarios[0],newDevice:'yes'},50),/Новое устройство/);
});
