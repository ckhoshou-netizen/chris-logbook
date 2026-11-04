import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {IDBFactory} from 'fake-indexeddb';
import * as D from '../app/domain.mjs';
import {ui} from './ui-harness.mjs';

function fixture(){
 const s=D.emptyStore();
 s.weights=D.dates('2026-10-26','2026-11-01').map((date,i)=>({...D.stamp(),date,lb:[135.6,135.8,136,135.5,136.1,135.9,135.8][i]}));
 s.plans.push({...D.stamp(),effective:'2026-11-01',...D.calculateTargets(2000,135.8),goal:{value:1,unit:'%'},referenceWindow:D.medianWindow(s.weights,'2026-11-01')});
 return s;
}
const input={effective:'2026-11-04',referenceWeight:135.8,referenceSunday:'2026-11-01',targetWeight:130,targetSunday:'2026-12-13',referenceSource:'median'};
const save=s=>D.saveWeightGoal(s,{...input,referenceWindow:D.medianWindow(s.weights,'2026-11-01')});

test('goal weight and Sunday deadline calculate exact calendar-week loss, including DST and zero-loss goals',()=>{
 const a=D.calculateWeightGoal(132,'2026-11-01',126,'2026-12-13');
 assert.equal(a.weeks,6);assert.equal(a.totalLoss,6);assert.equal(a.lossPerWeek,1);assert.equal(a.percentPerWeek,100/132);
 const b=D.calculateWeightGoal(135.8,'2026-11-01',130,'2026-12-13');assert.equal(b.lossPerWeek,(135.8-130)/6);
 assert.equal(D.calculateWeightGoal(132,'2026-10-25',130,'2026-11-08').weeks,2);
 assert.equal(D.calculateWeightGoal(132,'2027-03-07',130,'2027-03-21').lossPerWeek,1);
 assert.equal(D.calculateWeightGoal(132,'2026-11-01',132,'2026-11-08').lossPerWeek,0);
 for(const [start,date,goal,end] of [[132,'2026-11-02',130,'2026-12-13'],[132,'2026-11-01',130,'2026-11-09'],[132,'2026-11-01',130,'2026-11-01'],[132,'2026-11-01',133,'2026-12-13']])assert.throws(()=>D.calculateWeightGoal(start,date,goal,end));
 assert.throws(()=>D.calculateWeightGoal('', '2026-11-01',130,'2026-12-13'),/required/);
});
test('saving and revising a deadline goal preserve food targets, Sunday references, prior goals and saved exports',()=>{
 const s=fixture(),plans=D.clone(s.plans),g=save(s),firstGoal=D.clone(g);
 assert.equal(D.lossGoalAt(s,'2026-11-03').unit,'%');assert.deepEqual(D.lossGoalAt(s,'2026-11-04'),{unit:'lb',value:g.lossPerWeek});
 const c=D.buildCheckin(s,'2026-11-08');s.checkins.push(c);s.exportedSnapshots.push({...D.stamp(),checkinId:c.id,text:D.checkinText(c)});
 const saved=D.clone(s.checkins),exports=D.clone(s.exportedSnapshots);
 s.weights[2].lb=120;s.weights[4].lb=120;s.weights.push({...D.stamp(),date:'2026-11-04',lb:134});
 D.saveWeightGoal(s,{...input,effective:'2026-11-10',targetWeight:128,targetSunday:'2026-12-27',referenceSource:'manual',referenceWindow:null});
 assert.deepEqual(s.plans,plans);assert.deepEqual(s.weightGoals[0],firstGoal);assert.deepEqual(s.checkins,saved);assert.deepEqual(s.exportedSnapshots,exports);
 assert.equal(D.latest(s.weightGoals,'2026-11-09').id,g.id);assert.notEqual(D.latest(s.weightGoals,'2026-11-10').id,g.id);
 assert.equal(g.referenceWindow.value,135.8);assert.notEqual(D.medianWindow(s.weights,'2026-11-01').value,g.referenceWeight);
 assert.match(D.checkinText(c),/Reviewed weight goal: 130 lb by Sunday 2026-12-13; 0.97 lb\/week/);
 assert.match(D.checkinText(c),/2026-11-04: .*intended loss 0.97 lb\/week/);
 assert.match(D.checkinText(c),/Next weight goal: 130 lb by Sunday 2026-12-13/);
 D.validate(s);const roundtrip=D.parseBackup(JSON.stringify(s));assert.deepEqual(roundtrip,s);
 assert.deepEqual(D.mergeStores(D.emptyStore(),roundtrip).weightGoals,s.weightGoals);
});
test('invalid rates, reference snapshots and expired deadlines cannot be saved or restored',()=>{
 const s=fixture();save(s);assert.throws(()=>D.saveWeightGoal(s,{...input,effective:'2026-12-13'}),/upcoming/);
 for(const mutate of [g=>g.lossPerWeek=1,g=>g.weeks=5,g=>g.referenceSunday='2026-11-02',g=>g.referenceWindow.weights[0].lb=0,g=>g.referenceWindow.count=6,g=>g.referenceWindow=null]){
  const bad=D.clone(s);mutate(bad.weightGoals[0]);assert.throws(()=>D.parseBackup(JSON.stringify(bad)));
 }
 const c=D.buildCheckin(s,'2026-11-08');s.checkins.push(c);c.nextWeightGoal.lossPerWeek=999;assert.throws(()=>D.validate(s),/weight-goal calculation/);
});
test('v5 device upgrade and complete JSON restore retain all records, older saved exports, and goal history',async()=>{
 const old=D.migrateStore(JSON.parse(fs.readFileSync(new URL('./fixtures/legacy-v4-checkin.json',import.meta.url),'utf8')));delete old.weightGoals;old.schemaVersion=5;
 const before=D.clone(old),factory=new IDBFactory();globalThis.indexedDB=factory;globalThis.location={reload(){}};
 await new Promise((resolve,reject)=>{const r=indexedDB.open('chris-logbook',5);r.onupgradeneeded=()=>r.result.createObjectStore('records').put(old,'state');r.onsuccess=()=>{r.result.close();resolve();};r.onerror=()=>reject(r.error);});
 const S=await import('../app/storage.mjs?weight-goals-v6'),upgraded=await S.readStore();assert.equal((await S.openStore()).version,6);assert.deepEqual(upgraded.weightGoals,[]);
 for(const k of Object.keys(before))if(k!=='schemaVersion')assert.deepEqual(upgraded[k],before[k],k);assert.deepEqual(old,before);
 await S.updateStore(s=>{D.saveWeightGoal(s,{...input,referenceSource:'manual',referenceWindow:null});});
 const backup=JSON.stringify(await S.readStore());await S.updateStore(()=>D.emptyStore());await S.updateStore(()=>D.parseBackup(backup));const restored=await S.readStore();
 assert.equal(restored.weightGoals.length,1);assert.deepEqual(restored.checkins,before.checkins);assert.deepEqual(restored.exportedSnapshots,before.exportedSnapshots);assert.equal(D.checkinText(restored.checkins[0]),before.exportedSnapshots[0].text);assert.deepEqual(restored.plans,before.plans);
 (await S.openStore()).close();
});
test('Check-in prioritizes goal weight and deadline, keeps food targets accessible, and never writes while viewing',()=>{
 const s=fixture();save(s);const before=D.clone(s),{api}=ui(s,'2026-11-04','2026-11-04'),html=api.checkinScreen();
 assert.match(html,/Weight Goal/);assert.match(html,/130 lb/);assert.match(html,/By Sunday, Dec 13, 2026/);assert.match(html,/0.97 lb\/week/);assert.match(html,/Edit Weight Goal/);assert.match(html,/<details class="calorie-targets" >.*Calories & Macros/);assert.match(html,/2,000/);assert.deepEqual(s,before);
});
