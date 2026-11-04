import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
import * as D from '../app/domain.mjs';import * as C from '../app/catalog.mjs';import {ui} from './ui-harness.mjs';
const legacy=()=>JSON.parse(fs.readFileSync(new URL('./fixtures/legacy-v4-checkin.json',import.meta.url),'utf8'));
const cereal=()=>D.makeFood({name:'Synthetic Cereal',quantity:40,unit:'g',calories:160,protein:4,carbs:30,fat:2});
test('only Completed and Untracked are offered; Completed is the default without assuming zero intake',()=>{
 const s=D.emptyStore(),{api}=ui(s,'2026-11-03'),html=api.statusControl();assert.equal(D.dayStatus(s,'2026-11-03'),'Complete');assert.match(html,/<option value="Complete" selected>Completed<\/option>/);assert.match(html,/>Untracked<\/option>/);assert.doesNotMatch(html,/Unfinished/);assert.equal((html.match(/<option /g)||[]).length,2);assert.match(api.nutritionScreen(),/hero-number number">—/);
 const review=D.diaryReview(s,'2026-10-25','2026-10-31');assert.deepEqual(review.counts,{Complete:7,Untracked:0});assert.equal(review.denominator,0);assert.equal(review.emptyCompletedDays,7);assert.equal(review.average,null);assert.ok(review.days.every(d=>d.totals.calories===null));
});
test('default completion includes recorded food only; Untracked never deletes food or changes weight eligibility',()=>{
 const s=D.emptyStore(),f=cereal();s.foods.push(f);s.entries.push(D.makeEntry(f,40,'g','2026-10-25','08:00'));s.weights.push({...D.stamp(),date:'2026-10-25',lb:132});let r=D.diaryReview(s,'2026-10-25','2026-10-31');assert.equal(r.denominator,1);assert.equal(r.average.calories,160);assert.equal(r.emptyCompletedDays,6);
 s.statuses.push({...D.stamp(),date:'2026-10-25',status:'Untracked'});r=D.diaryReview(s,'2026-10-25','2026-10-31');assert.deepEqual(r.counts,{Complete:6,Untracked:1});assert.equal(r.denominator,0);assert.equal(s.entries.length,1);assert.equal(D.medianWindow(s.weights,'2026-10-25').count,1);D.validate(s);
});
test('zero intake requires its own explicit confirmation and has a transparent average denominator',()=>{
 const s=D.emptyStore();s.statuses.push({...D.stamp(),date:'2026-10-25',status:'Complete',zeroIntakeConfirmed:true});const r=D.diaryReview(s,'2026-10-25','2026-10-31');assert.equal(r.denominator,1);assert.equal(r.average.calories,0);assert.equal(r.emptyCompletedDays,6);
 const c=D.buildCheckin(s,'2026-11-01');s.checkins.push(c);assert.match(D.checkinText(c),/6 empty Completed days excluded/);assert.match(D.checkinText(c),/Average on 1 Completed days with recorded intake/);assert.doesNotMatch(D.checkinText(c),/Unfinished/);D.validate(s);
 const bad=D.clone(s);bad.checkins[0].review.denominator=7;assert.throws(()=>D.validate(bad),/denominator/);
});
test('v4 migration maps live Unfinished labels, preserves explicit empty-day confirmations, and never rewrites saved check-ins',()=>{
 const old=legacy(),before=D.clone(old),next=D.migrateStore(old);assert.equal(next.schemaVersion,5);assert.equal(next.statuses.find(r=>r.status==='Unfinished'),undefined);assert.equal(next.statuses.find(r=>r.date==='2026-10-26').status,'Complete');assert.equal(next.statuses.find(r=>r.date==='2026-10-28').zeroIntakeConfirmed,true);
 for(const key of D.TABLES)if(key!=='statuses')assert.deepEqual(next[key],before[key],key);assert.deepEqual(next.settings,before.settings);assert.deepEqual(old,before);assert.deepEqual(next.checkins,before.checkins);assert.deepEqual(next.exportedSnapshots,before.exportedSnapshots);assert.equal(D.checkinText(next.checkins[0]),before.exportedSnapshots[0].text);
 const live=D.diaryReview(next,'2026-10-25','2026-10-31');assert.equal(live.denominator,3);assert.equal(live.average.calories,320/3);assert.equal(next.checkins[0].review.average.calories,80);
 assert.deepEqual(D.parseBackup(JSON.stringify(next)),next);assert.deepEqual(D.mergeStores(next,next),next);
});
test('catalogue upgrade uses 2026 for new selection while retaining 2015 diary snapshots, references and favourite identities',()=>{
 const old=legacy(),s=D.migrateStore(old),catalog=JSON.parse(fs.readFileSync(new URL('../app/data/cnf-2026.json',import.meta.url),'utf8')).foods;
 const before=D.clone(s),pool=C.foodPool(s.foods,catalog);assert.equal(pool.filter(f=>f.provenance?.foodCode==='2241').length,1);const fresh=pool.find(f=>f.id==='cnf-2026-2241');assert.ok(fresh);D.keepFoodReference(s,fresh);s.entries.push(D.makeEntry(fresh,60,'g','2026-11-04','12:00'));
 assert.equal(s.entries.at(-1).snapshot.provenance.version,'2026');assert.equal(s.entries.find(e=>e.foodId==='cnf-2015-2241').snapshot.provenance.version,'2015');assert.deepEqual(s.favourites,before.favourites);assert.deepEqual(s.checkins,before.checkins);assert.deepEqual(s.exportedSnapshots,before.exportedSnapshots);D.validate(s);
});
test('actual v4 IndexedDB upgrade retains legacy snapshots and restores both CNF editions into a clean store',{concurrency:false},async()=>{
 const require=createRequire(import.meta.url),{IDBFactory}=require('fake-indexeddb');globalThis.indexedDB=new IDBFactory();globalThis.location={reload(){}};const old=legacy();await new Promise((resolve,reject)=>{const r=indexedDB.open('chris-logbook',4);r.onupgradeneeded=()=>r.result.createObjectStore('records').put(old,'state');r.onsuccess=()=>{r.result.close();resolve();};r.onerror=()=>reject(r.error);});const S=await import('../app/storage.mjs?status-v5');const s=await S.readStore();assert.deepEqual(s,D.migrateStore(old));assert.equal((await S.openStore()).version,5);
 const f=JSON.parse(fs.readFileSync(new URL('../app/data/cnf-2026.json',import.meta.url),'utf8')).foods.find(f=>f.id==='cnf-2026-2241');await S.updateStore(s=>{D.keepFoodReference(s,f);s.entries.push(D.makeEntry(f,60,'g','2026-11-04','12:00'));});const backup=JSON.stringify(await S.readStore());await S.updateStore(()=>D.emptyStore());await S.updateStore(()=>D.parseBackup(backup));const restored=await S.readStore();assert.deepEqual(restored.checkins,old.checkins);assert.equal(restored.foods.filter(f=>f.source==='Canadian Nutrient File').length,2);assert.equal(restored.entries.find(e=>e.foodId==='cnf-2015-2241').nutrition.calories,54);assert.equal(restored.entries.find(e=>e.foodId==='cnf-2026-2241').nutrition.calories,54);(await S.openStore()).close();
});
