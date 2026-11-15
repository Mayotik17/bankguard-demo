import {test,expect} from '@playwright/test';
const nav=async(page,id)=>page.locator(`[data-view="${id}"]`).click();
test.beforeEach(async({page})=>{await page.goto('/');});
test('queue, decisions, next case and completion',async({page})=>{
 await expect(page.locator('#pending-count')).toHaveText('6');await expect(page.locator('#transactions [data-id]')).toHaveCount(6);
 await page.locator('#save-next').click();await expect(page.locator('#decision-note')).toContainText('Добавьте комментарий');
 for(let i=6;i>0;i--){await page.locator('#reason').fill('Синтетический тест '+i);await page.locator('#save-next').click();await expect(page.locator('#pending-count')).toHaveText(String(i-1));}
 await expect(page.locator('#toast')).toContainText('Очередь обработана');await expect(page.locator('#transactions')).toContainText('Ожидающих операций нет');
 await page.locator('[data-queue="resolved"]').click();await expect(page.locator('#transactions [data-id]')).toHaveCount(6);
 await nav(page,'audit');await expect(page.locator('.audit-item')).toHaveCount(6);
});
test('draft and settings survive reload only after explicit restore',async({page})=>{
 await page.locator('#reason').fill('Мой учебный черновик');await nav(page,'lab');await page.locator('#capacity').fill('0');
 await page.reload();await expect(page.locator('#recovery')).toBeVisible();await page.locator('#recover-local').click();
 await expect(page.locator('#capacity')).toHaveValue('0');await nav(page,'monitor');await expect(page.locator('#reason')).toHaveValue('Мой учебный черновик');
 await nav(page,'audit');await page.locator('#clear-local').click();await page.locator('#confirm-clear-local').click();await expect(page.locator('#autosave-enabled')).not.toBeChecked();
 await nav(page,'monitor');await expect(page.locator('#reason')).toHaveValue('Мой учебный черновик');
 page.on('dialog',dialog=>dialog.accept());await page.reload();await expect(page.locator('#recovery')).toBeHidden();await expect(page.locator('#reason')).toHaveValue('');
});
test('search, pagination and filter counts on 1000 operations',async({page})=>{
 await page.locator('#dataset').selectOption('1000');await page.locator('#load-dataset').click();await expect(page.locator('#pending-count')).toHaveText('127');
 await page.locator('[data-queue="all"]').click();await expect(page.locator('#transactions [data-id]')).toHaveCount(20);await page.locator('#next-page').click();await expect(page.locator('#page-status')).toContainText('21–40');
 await page.locator('#search').fill('несуществующая');await expect(page.locator('#transactions')).toContainText('Ничего не найдено');
 await page.locator('[data-queue="pending"]').click();await expect(page.locator('#transactions [data-id]')).toHaveCount(20);
});
test('Russian errors, simulator freshness and chart updates',async({page})=>{
 await nav(page,'simulator');await page.getByRole('button',{name:'Рассчитать риск',exact:true}).click();await expect(page.locator('#sim-result')).toContainText('75');
 await page.locator('[name="amount"]').fill('');await page.getByRole('button',{name:'Рассчитать риск',exact:true}).click();await expect(page.locator('#form-error')).toContainText('Заполните поле');
 await nav(page,'lab');await expect(page.locator('#chart-desc')).toContainText('проверок 6');await page.locator('#threshold').fill('1');await expect(page.locator('#chart-desc')).toContainText('проверок 13');
 await page.locator('#capacity').fill('');await expect(page.locator('#capacity-result')).toContainText('Заполните поле');await expect(page.locator('#export-report')).toBeDisabled();
 await nav(page,'simulator');await expect(page.locator('#sim-result')).not.toContainText('75');
 await nav(page,'audit');await page.locator('#restore-session').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{invalid')});await expect(page.locator('#session-note')).toContainText('Файл повреждён');
});
test('exports and session restoration round trip',async({page})=>{
 await page.locator('#reason').fill('Учебное решение');await page.locator('#approve').click();
 for(const selector of ['#export']){const download=page.waitForEvent('download');await page.locator(selector).click();expect(await(await download).failure()).toBeNull();}
 await page.locator('#detail summary').click();let download=page.waitForEvent('download');await page.locator('#export-case').click();expect(await(await download).failure()).toBeNull();
 await nav(page,'lab');download=page.waitForEvent('download');await page.locator('#export-report').click();expect(await(await download).failure()).toBeNull();
 await nav(page,'audit');download=page.waitForEvent('download');await page.locator('#export-audit').click();expect(await(await download).failure()).toBeNull();
 download=page.waitForEvent('download');await page.locator('#save-session').click();const file=await(await download).path();
 page.on('dialog',dialog=>dialog.accept());await page.locator('#restore-session').setInputFiles(file);await expect(page.locator('#session-note')).toContainText('Сессия восстановлена');await expect(page.locator('.audit-item')).toHaveCount(1);
});
test('responsive sections, keyboard navigation and no app errors',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 for(const id of ['monitor','simulator','lab','audit']){await nav(page,id);expect(await page.locator('body').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBeTruthy();await expect(page.locator(`#${id} h1`)).toBeFocused();}
 await page.locator('[data-view="monitor"]').focus();await page.keyboard.press('Enter');await expect(page.locator('#monitor')).toBeVisible();expect(errors).toEqual([]);
});
