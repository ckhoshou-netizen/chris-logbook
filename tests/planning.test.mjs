import test from 'node:test';import assert from 'node:assert/strict';import * as D from '../app/domain.mjs';
const food=()=>D.makeFood({name:'Cereal',quantity:40,unit:'g',calories:160,protein:4,carbs:30,fat:2});
const planned=(s,d='2026-11-04')=>{const e=D.makeEntry(food(),60,'g',d,'08:00');D.savePlannedEntry(s,e);return e;};
test('v1 migration adds empty new collections; every existing record and snapshot is unchanged',()=>{
 const old=D.emptyStore();delete old.plannedEntries;delete old.exercises;old.schemaVersion=1;const f=food();old.foods.push(f);old.entries.push(D.makeEntry(f,60,'g','2026-11-01','08:00'));old.weights.push({...D.stamp(),date:'2026-11-01',lb:132});old.plans.push({...D.stamp(),effective:'2026-11-01',...D.calculateTargets(1800,132),goal:{unit:'lb',value:1}});
 // Build a real old-style snapshot without rewriting any snapshot field in migration.
 const compatible=D.migrateStore(old);old.checkins.push(D.buildCheckin(compatible,'2026-11-01'));const before=JSON.stringify(old),upgraded=D.migrateStore(old);
 assert.equal(JSON.stringify(old),before);assert.equal(upgraded.schemaVersion,D.VERSION);assert.deepEqual(upgraded.plannedEntries,[]);assert.deepEqual(upgraded.exercises,[]);for(const k of Object.keys(old))if(k!=='schemaVersion')assert.deepEqual(upgraded[k],old[k],k);assert.deepEqual(D.migrateStore(upgraded),upgraded);assert.deepEqual(D.parseBackup(before),upgraded);
 const bad=D.clone(old);bad.entries[0].nutrition.calories=0;assert.throws(()=>D.migrateStore(bad),/snapshot/);assert.equal(bad.schemaVersion,1);assert.throws(()=>D.migrateStore({...old,plannedEntries:[]}),/Unexpected/);
});
test('planning is excluded from all actual totals, Complete-only averages, status and saved exports',()=>{
 const s=D.emptyStore(),e=planned(s,'2026-10-30');s.statuses.push({...D.stamp(),date:e.date,status:'Complete'});const a=D.makeEntry(food(),40,'g',e.date,'12:00');s.entries.push(a);const review=D.diaryReview(s,'2026-10-25','2026-10-31');assert.equal(review.average.calories,160);assert.equal(review.denominator,1);assert.equal(D.totals(s.entries).calories,160);assert.equal(D.totals(s.plannedEntries).calories,240);const c=D.buildCheckin(s,'2026-11-01'),before=JSON.stringify(c);s.checkins.push(c);D.confirmPlannedEntry(s,e.id,{},'2026-11-01');assert.equal(D.diaryReview(s,'2026-10-25','2026-10-31').average.calories,400);assert.equal(JSON.stringify(c),before);assert.equal(c.review.average.calories,160);D.validate(s);
});
test('future plans cannot be eaten early; reaching the date never changes records automatically',()=>{
 const s=D.emptyStore(),e=planned(s);const before=JSON.stringify(s);assert.throws(()=>D.confirmPlannedEntry(s,e.id,{},'2026-11-03'),/Future/);assert.equal(JSON.stringify(s),before);D.validate(s);assert.equal(s.entries.length,0);assert.equal(D.dayStatus(s,e.date),'Unfinished');
});
test('confirmation records the adjusted actual portion exactly once and retains its planned profile',()=>{
 const s=D.emptyStore(),e=planned(s);const originalSnapshot=D.clone(e.snapshot);const actual=D.confirmPlannedEntry(s,e.id,{quantity:40,unit:'g',time:'09:15'},'2026-11-04');assert.equal(actual.id,e.id);assert.equal(actual.nutrition.calories,160);assert.equal(actual.time,'09:15');assert.equal(s.plannedEntries.length,0);assert.equal(s.entries.length,1);assert.deepEqual(actual.snapshot,originalSnapshot);assert.equal(actual.plannedFor,'2026-11-04');assert.equal(D.dayStatus(s,actual.date),'Unfinished');assert.throws(()=>D.confirmPlannedEntry(s,e.id,{},'2026-11-04'),/already/);assert.equal(s.entries.length,1);D.validate(s);
});
test('editing planned amounts uses their saved food snapshot and does not affect existing actual entries',()=>{
 const s=D.emptyStore(),f=food();s.foods.push(f);const actual=D.makeEntry(f,40,'g','2026-11-03','08:00');s.entries.push(actual);const e=D.makeEntry(f,60,'g','2026-11-04','08:00');D.savePlannedEntry(s,e);f.nutrition.calories=999;D.savePlannedEntry(s,D.makeEntry(e.snapshot,80,'g','2026-11-05','10:00'),e.id);assert.equal(s.plannedEntries[0].nutrition.calories,320);assert.equal(s.plannedEntries[0].createdAt,e.createdAt);assert.equal(actual.nutrition.calories,160);D.validate(s);
});
test('pending plans round-trip and merge; confirmed-versus-pending conflicts never duplicate intake',()=>{
 const s=D.emptyStore(),e=planned(s),restored=D.parseBackup(JSON.stringify(s));assert.deepEqual(restored,s);assert.deepEqual(D.mergeStores(D.emptyStore(),restored),restored);const current=D.clone(s);D.confirmPlannedEntry(current,e.id,{},'2026-11-04');assert.throws(()=>D.mergeStores(current,restored),/both planned and recorded/);assert.equal(current.entries.length,1);assert.equal(current.plannedEntries.length,0);
});
