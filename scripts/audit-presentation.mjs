// Optional real-browser audit. Start scripts/serve.mjs first, then run this with
// Playwright installed, or set PLAYWRIGHT_MODULE to an existing Playwright path.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {presentationStore} from '../tests/fixtures/presentation-store.mjs';

const require=createRequire(import.meta.url);
const engines=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.BROWSER_ENGINE||'chromium';
const output=path.resolve(process.env.AUDIT_OUTPUT||'audit-output');
const url=process.env.AUDIT_URL||'http://127.0.0.1:4173';
const browser=await engines[engine].launch({headless:true,...(engine==='chromium'?{channel:process.env.BROWSER_CHANNEL||'msedge'}:{})});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,timezoneId:'America/Toronto',serviceWorkers:'block'});
const page=await context.newPage(),results=[],errors=[];
page.on('pageerror',error=>errors.push(error.message));
await mkdir(output,{recursive:true});
await page.clock.setFixedTime(new Date('2026-11-04T17:00:00Z'));
const wait=()=>page.waitForTimeout(300);
const store=()=>page.evaluate(async()=>JSON.parse(JSON.stringify(await(await import('/storage.mjs')).readStore())));
async function reset(){
 await page.goto(url+'/#nutrition');await page.waitForSelector('.hourly-timeline');
 await page.evaluate(async s=>{await(await import('/storage.mjs')).updateStore(()=>s);},presentationStore());
 await page.reload();await page.waitForSelector('.hourly-timeline');await wait();
}
async function tab(name){await page.locator(`[data-tab="${name}"]`).click();await page.waitForFunction(name=>document.querySelector('#screen').dataset.view===name,name);await wait();}
async function check(name,fn){
 try{await fn();results.push({name,passed:true});console.log('PASS '+name);}
 catch(error){
  if(engine==='webkit'&&name.startsWith('Offline reload')&&error.message.includes('WebKit encountered an internal error')){
   results.push({name,passed:null,blocked:'Windows WebKit fails offline navigation internally before the document loads. Verify offline launch in Safari on an iPhone.'});
   console.log('BLOCKED '+name+': Windows WebKit offline navigation failed internally.');
  }else{results.push({name,passed:false,error:error.message});console.log('FAIL '+name+': '+error.message);await page.screenshot({path:path.join(output,'failure-'+results.length+'.png')}).catch(()=>{});}
 }
}
async function noOverflow(label){
 const size=await page.evaluate(()=>({content:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));
 assert.ok(size.content<=size.viewport+1,`${label}: ${size.content}px content in ${size.viewport}px viewport`);
}
try{
 await reset();
 await check('Navigation is read-only and all three phone previews render',async()=>{
  const before=await store();
  for(const name of ['nutrition','training','checkin']){await tab(name);await page.screenshot({path:path.join(output,name+'.png')});}
  assert.deepEqual(await store(),before);
 });
 await check('Layouts fit 320, 390, 430, 768 and 1440 pixel widths',async()=>{
  for(const width of [320,390,430,768,1440]){
   await page.setViewportSize({width,height:900});
   for(const name of ['nutrition','training','checkin']){
    await tab(name);await noOverflow(`${width}/${name}`);
    if(name==='checkin'){
     await page.locator('.checkin-review>summary').click();await noOverflow(`${width}/weekly review`);
     await page.locator('.checkin-review>summary').click();
    }
   }
   if(width===1440)await page.screenshot({path:path.join(output,'desktop.png'),fullPage:true});
  }
  await page.setViewportSize({width:390,height:844});
 });
 await check('200% text fits the narrow layout, including expanded weekly review',async()=>{
  await page.setViewportSize({width:320,height:844});
  const style=await page.addStyleTag({content:'html{font-size:200%}'});
  for(const name of ['nutrition','training','checkin']){await tab(name);await noOverflow('200%/'+name);}
  await page.locator('.checkin-review>summary').click();await noOverflow('200%/weekly review');
  await page.screenshot({path:path.join(output,'large-text.png'),fullPage:true});
  await style.evaluate(el=>el.remove());await page.setViewportSize({width:390,height:844});await reset();
 });
 await check('Each tab remembers its independent scroll position',async()=>{
  await tab('nutrition');await page.evaluate(()=>scrollTo(0,1100));const nutritionY=await page.evaluate(()=>scrollY);
  await tab('training');await page.evaluate(()=>scrollTo(0,350));const trainingY=await page.evaluate(()=>scrollY);
  await tab('nutrition');assert.ok(Math.abs(await page.evaluate(()=>scrollY)-nutritionY)<2);
  await tab('training');assert.ok(Math.abs(await page.evaluate(()=>scrollY)-trainingY)<2);
 });
 await check('Keyboard workout completion preserves open exercises and checkbox focus',async()=>{
  await reset();await tab('training');
  await page.locator('.workout-reference>summary').first().click();
  const input=page.locator('[data-training]').first(),key=await input.getAttribute('data-training');
  await input.press('Space');await page.waitForFunction(key=>document.querySelector(`[data-training="${key}"]`)?.checked,key);
  await wait();assert.equal(await page.locator('.workout-reference').first().getAttribute('open'),'');
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.training),key);
 });
 await check('Date arrows change only the day and do not focus a native calendar',async()=>{
  await reset();const before=await store();
  await page.getByRole('button',{name:'Previous day',exact:true}).click();
  assert.equal(await page.locator('[data-day-date]').inputValue(),'2026-11-03');
  assert.notEqual(await page.evaluate(()=>document.activeElement.type),'date');
  await page.getByRole('button',{name:'Next day',exact:true}).click();assert.deepEqual(await store(),before);
 });
 await check('Progress continues smoothly through save and storage-broadcast redraws',async()=>{
  await reset();await tab('training');await page.locator('[data-training]').first().press('Space');
  await page.waitForFunction(()=>document.querySelector('[data-training]').checked);
  await page.waitForTimeout(80);
  const progress=await page.locator('[data-progress="training"]').evaluate(el=>({running:el.getAnimations().some(a=>a.playState==='running'),scale:Number(getComputedStyle(el).transform.match(/^matrix(?:3d)?\(([^,]+)/)?.[1])}));
  assert.equal(progress.running,true);assert.ok(progress.scale>0&&progress.scale<.25);
 });
 await check('Hour-to-search-to-amount logging keeps its time and updates totals',async()=>{
  await reset();await page.getByRole('button',{name:'Add food at 8 AM',exact:true}).click();
  await page.locator('#food-search').fill('Greek');await page.locator('.food-choice').filter({hasText:'Greek yogurt'}).click();
  await page.locator('[name="quantity"]').fill('340');await page.locator('#sheet-footer [type="submit"]').click();
  await page.waitForFunction(()=>!document.querySelector('#sheet').open);
  const s=await store();assert.equal(s.entries.length,5);assert.equal(s.entries.at(-1).nutrition.calories,340);assert.equal(s.entries.at(-1).time,'08:00');
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.value),'08:00');
  assert.match(await page.locator('.hero-number').textContent(),/1,406/);
 });
 await check('Deleting a food and using Undo restores its original record',async()=>{
  const before=await store();await page.locator('.food .entry-more>summary').first().click();
  await page.locator('.food [data-action="delete-entry"]').first().click();
  assert.equal((await store()).entries.length,before.entries.length-1);
  await page.locator('#toast [data-action="undo"]').click();
  const sort=rows=>rows.sort((a,b)=>a.id.localeCompare(b.id));assert.deepEqual(sort((await store()).entries),sort(before.entries));
 });
 await check('Cardio edits and Undo preserve values and return focus to the day',async()=>{
  await reset();await tab('training');const before=await store();
  await page.locator('[data-action="cardio-day"][data-value="2026-11-04"]').click();
  await page.locator('[name="minutes"]').fill('45');await page.locator('#sheet-footer [type="submit"]').click();
  await page.waitForFunction(()=>!document.querySelector('#sheet').open);await page.locator('#toast [data-action="undo"]').click();
  assert.deepEqual((await store()).cardioSessions,before.cardioSessions);
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.value),'2026-11-04');
 });
 await check('Split sheet has one scroll area, visible footer and a working keyboard loop',async()=>{
  await reset();await tab('training');await page.setViewportSize({width:320,height:568});
  await page.getByRole('button',{name:'Edit Split',exact:true}).click();await page.locator('.split-row>summary').first().click();
  await page.locator('#sheet-content').evaluate(el=>el.scrollTop=500);
  const footer=await page.locator('#sheet-footer').boundingBox();assert.ok(footer.y>=0&&footer.y+footer.height<=568);
  assert.equal(await page.locator('#sheet').evaluate(el=>el.scrollTop),0);
  await page.locator('#sheet-footer [type="submit"]').focus();await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'close-sheet');
  await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.type),'submit');
  await noOverflow('split sheet');await page.screenshot({path:path.join(output,'split-sheet.png')});
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#sheet').open);
  assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('sheet-open')),false);
  await page.setViewportSize({width:390,height:844});
 });
 await check('Cancelling the exercise picker retains the unsaved split draft',async()=>{
  await page.getByRole('button',{name:'Edit Split',exact:true}).click();await page.locator('.split-row>summary').first().click();
  await page.locator('.split-row [name="title"]').first().fill('Unsaved upper draft');
  await page.getByRole('button',{name:'Choose Exercises',exact:true}).first().click();
  await page.locator('#split-exercise-search').fill('Squat');await page.locator('#close-sheet').click();
  assert.equal(await page.locator('.split-row [name="title"]').first().inputValue(),'Unsaved upper draft');
  assert.equal(await page.locator('#sheet').evaluate(el=>el.open),true);
  await page.keyboard.press('Escape');
 });
 await check('Reduced motion suppresses page, progress, sheet and toast animations',async()=>{
  await reset();await page.emulateMedia({reducedMotion:'reduce'});await tab('training');
  assert.equal(await page.evaluate(()=>document.getAnimations().length),0);
  await page.getByRole('button',{name:'Edit Split',exact:true}).click();
  assert.equal(await page.evaluate(()=>document.getAnimations().length),0);await page.keyboard.press('Escape');
  await page.emulateMedia({reducedMotion:'no-preference'});
 });
 await check('Editable controls retain 16px text to avoid iPhone focus zoom',async()=>{
  await reset();await page.getByRole('button',{name:'Add Food',exact:true}).click();
  await page.locator('.food-choice').first().click();
  const small=await page.evaluate(()=>[...document.querySelectorAll('input:not([type="checkbox"]):not([type="hidden"]),select,textarea')].filter(el=>el.getClientRects().length&&parseFloat(getComputedStyle(el).fontSize)<16).map(el=>el.outerHTML));
  assert.deepEqual(small,[]);await page.keyboard.press('Escape');
 });
 await check('An empty logbook renders without inventing zero intake or records',async()=>{
  await page.goto(url+'/#nutrition');
  await page.evaluate(async()=>{const D=await import('/domain.mjs'),S=await import('/storage.mjs');await S.updateStore(()=>D.emptyStore());});
  await page.reload();await page.waitForSelector('.hourly-timeline');const before=await store();
  assert.match(await page.locator('.hero-number').textContent(),/—/);
  for(const name of ['nutrition','training','checkin']){await tab(name);await noOverflow('empty/'+name);}
  assert.deepEqual(await store(),before);await reset();
 });
 await check('Offline reload retains screens, data, local font and food catalogue',async()=>{
  const offline=await browser.newContext({viewport:{width:390,height:844},timezoneId:'America/Toronto'}),p=await offline.newPage();
  try{
   await p.goto(url);await p.evaluate(()=>navigator.serviceWorker.ready);
   await p.waitForFunction(()=>navigator.serviceWorker.controller);
   await p.evaluate(async s=>{await(await import('/storage.mjs')).updateStore(()=>s);},presentationStore());
   await offline.setOffline(true);await p.reload();await p.waitForSelector('.hourly-timeline');
   assert.match(await p.locator('.hero-number').textContent(),/1,066/);
   assert.equal(await p.evaluate(async()=>{await document.fonts.ready;return document.fonts.check('700 italic 24px "Barlow Condensed"');}),true);
   await p.getByRole('button',{name:'Add Food',exact:true}).click();await p.locator('#food-search').fill('apple');
   await p.waitForFunction(()=>document.querySelector('#catalog-status').textContent.includes('3,620'));
   assert.ok(await p.locator('.food-choice').count()>0);
  }finally{await offline.close();}
 });
 await check('No uncaught browser errors occur throughout the audit',async()=>assert.deepEqual(errors,[]));
 const timings=[];
 await reset();
 for(let i=0;i<18;i++)timings.push(await page.evaluate(async name=>{
  const start=performance.now();await new Promise(resolve=>{addEventListener('hashchange',()=>requestAnimationFrame(resolve),{once:true});location.hash='#'+name;});return performance.now()-start;
 },['training','checkin','nutrition'][i%3]));
 const sorted=timings.toSorted((a,b)=>a-b);
 const report={browser:engine+(engine==='chromium'?' / '+(process.env.BROWSER_CHANNEL||'msedge'):''),date:'2026-11-04',results,routeToNextFrameMs:{median:sorted[9],max:sorted.at(-1),samples:timings},errors};
 await writeFile(path.join(output,'audit-results.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:results.filter(r=>r.passed).length,blocked:results.filter(r=>r.passed===null).length,total:results.length,timing:report.routeToNextFrameMs}));
 process.exitCode=results.some(r=>r.passed===false)?1:0;
}finally{await browser.close();}
