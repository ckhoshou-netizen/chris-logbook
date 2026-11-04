import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../app/domain.mjs';
const cereal=()=>D.makeFood({name:'Synthetic Cereal',quantity:40,unit:'g',calories:160,protein:4,carbs:30,fat:2});
const weigh=(date,lb)=>({...D.stamp(),date,lb});
const plan=(effective='2026-11-01',calories=1800)=>({...D.stamp(),effective,...D.calculateTargets(calories,132),goal:{value:1,unit:'lb'},referenceWindow:null});
test('stated food energy, scaling and immutable historical portions',()=>{
 const f=cereal(),e=D.makeEntry(f,60,'g','2026-11-01','08:00');assert.deepEqual(D.REQUIRED.map(k=>e.nutrition[k]),[240,6,45,3]);assert.deepEqual(D.REQUIRED.map(k=>D.portion(f,100,'g').nutrition[k]),[400,10,75,5]);
 f.nutrition.calories=999;assert.equal(e.nutrition.calories,240);assert.equal(e.snapshot.nutrition.calories,160);assert.equal(D.portion(e.snapshot,80,'g').nutrition.calories,320);
 assert.equal(e.nutrition.fibre,null);assert.notEqual(e.nutrition.calories,4*6+4*45+9*3);
});
test('volume-only serving never invents a gram conversion; total carbs remain unchanged',()=>{
 const f=D.makeFood({name:'Volume',quantity:250,unit:'mL',grams:'',calories:100,protein:5,carbs:15,fat:2,fibre:4});assert.throws(()=>D.portion(f,250,'g'),/conversion/);assert.equal(D.portion(f,125,'mL').nutrition.carbs,7.5);assert.equal(D.portion(f,1,'serving').nutrition.fibre,4);
});
test('exact macro example, deterministic rounding, manual overrides and negative budget rejection',()=>{
 const p=D.calculateTargets(1800,132);assert.deepEqual([p.protein,p.fat,p.carbs,p.macroCalories],[132,43,221,1799]);assert.deepEqual(p.band,[130,135]);assert.deepEqual(D.calculateTargets(1800,135).band,[135,140]);
 const manual=D.calculateTargets(1800,132,{protein:140,fat:50});assert.equal(manual.carbs,198);assert.deepEqual(manual.band,[140,140]);assert.equal(D.calculateTargets(1800,132,{protein:140,fat:50,carbs:200}).carbs,200);assert.equal(D.calculateTargets(1900,132).carbs,246);assert.throws(()=>D.calculateTargets(100,132),/exceed/);
});
test('seven local calendar days, even median, old weights excluded, DST-safe dates',()=>{
 const s=D.emptyStore(),end='2026-11-01';s.weights=[132,130,131,134,133,135,129].map((lb,i)=>weigh(D.addDays(end,i-6),lb));assert.equal(D.medianWindow(s.weights,end).value,132);
 s.weights=[130,132,134,136].map((lb,i)=>weigh(D.addDays(end,i-3),lb));const m=D.medianWindow(s.weights,end);assert.equal(m.value,133);assert.equal(m.count,4);s.weights.push(weigh(D.addDays(end,-8),100));assert.equal(D.medianWindow(s.weights,end).count,4);assert.equal(D.medianWindow([],end).value,null);
 assert.equal(D.addDays('2026-11-01',-6),'2026-10-26');assert.equal(D.today('America/Toronto',new Date('2026-11-02T03:30:00Z')),'2026-11-01');assert.equal(D.change(134,132).loss,2);assert.ok(Math.abs(D.change(134,132).percent-1.492537)<.00001);
});
test('only Completed days with recorded intake enter averages; status changes retain food and weight eligibility',()=>{
 const s=D.emptyStore(),f=cereal(),week=D.dates('2026-10-25','2026-10-31');s.foods.push(f);for(const [i,date]of week.entries()){s.entries.push(D.makeEntry(f,1,'serving',date,'12:00'));s.statuses.push({...D.stamp(),date,status:i<5?'Complete':'Untracked'});}s.weights.push(weigh(week[6],132));
 const r=D.diaryReview(s,week[0],week[6]);assert.equal(r.denominator,5);assert.equal(r.average.calories,160);assert.deepEqual(r.counts,{Complete:5,Untracked:2});s.statuses.forEach(x=>x.status='Untracked');assert.equal(D.diaryReview(s,week[0],week[6]).average,null);assert.equal(s.entries.length,7);assert.equal(D.medianWindow(s.weights,week[6]).count,1);
});
test('saved target history, phase independence and Sunday snapshots survive backfills',()=>{
 const s=D.emptyStore();s.plans.push(plan());s.weights=[weigh('2026-10-25',134),weigh('2026-11-01',132)];const c=D.buildCheckin(s,'2026-11-01');s.checkins.push(c);const before=JSON.stringify(c);s.weights.push(weigh('2026-10-30',130));s.plans.push(plan('2026-11-08',1900));s.phases.push({...D.stamp(),effective:'2026-11-03',phase:'Gain'});assert.equal(D.latest(s.plans,'2026-11-02').calories,1800);assert.equal(D.latest(s.plans,'2026-11-09').calories,1900);assert.equal(JSON.stringify(c),before);assert.equal(D.medianWindow(s.weights,'2026-11-01').value,131);assert.equal(c.weight.value,132);D.validate(s);
});
test('cardio counts performed fractional minutes once; credits stay bounded and same-week',()=>{
 const s=D.emptyStore();s.cardioTargets.push({...D.stamp(),effective:'2026-11-01',weekly:140,daily:20,days:7,authority:'daily',category:'Zone 2'});
 const x={...D.stamp(),date:'2026-11-02',minutes:37,completed:true};s.cardioSessions.push(x);assert.equal(D.cardioTotal(s,'2026-11-03').minutes,37);assert.equal(140-D.cardioTotal(s,'2026-11-03').minutes,103);s.cardioSessions.push({...D.stamp(),date:'2026-11-03',minutes:12.5,completed:true},{...D.stamp(),date:'2026-11-07',minutes:60,completed:false});assert.equal(D.cardioTotal(s,'2026-11-03').minutes,49.5);
 x.minutes=60;for(const date of ['2026-11-01','2026-11-02','2026-11-06'])s.cardioCredits.push({...D.stamp(),sessionId:x.id,date,minutes:20});assert.equal(D.cardioTotal(s,'2026-11-03').minutes,72.5);D.validate(s);x.minutes=25;D.reconcileCredits(s,x.id);assert.equal(s.cardioCredits.reduce((a,c)=>a+c.minutes,0),25);D.validate(s);s.cardioCredits.push({...D.stamp(),sessionId:x.id,date:'2026-11-08',minutes:1});assert.throws(()=>D.validate(s),/same week/);
});
test('training versions, single occurrence move, and independent cardio days',()=>{
 const s=D.emptyStore(),a={...D.stamp(),effective:'2026-10-25',days:[{id:'a',weekday:1,title:'Torso A'},{id:'b',weekday:3,title:'Legs'}]};s.trainingSchedules.push(a);const original=D.trainingWeek(s,'2026-10-28')[1];s.trainingOccurrences.push({...original,...D.stamp(),date:'2026-10-29',completed:true});assert.equal(D.trainingWeek(s,'2026-10-29').length,2);assert.equal(D.trainingWeek(s,'2026-10-29')[1].date,'2026-10-29');s.trainingSchedules.push({...D.stamp(),effective:'2026-11-01',days:[{id:'c',weekday:6,title:'Legs B'}]});assert.equal(D.trainingWeek(s,'2026-10-29')[1].title,'Legs');assert.equal(D.trainingWeek(s,'2026-11-03').length,1);D.validate(s);
});
test('full JSON round trip, strict validation, additive merge and conflict rejection',()=>{
 const s=D.emptyStore(),f=cereal();s.foods.push(f);s.entries.push(D.makeEntry(f,60,'g','2026-11-01','09:00'));s.weights.push(weigh('2026-11-01',132));s.plans.push(plan());s.stepTargets.push({...D.stamp(),effective:'2026-11-01',target:8000});const c=D.buildCheckin(s,'2026-11-01');s.checkins.push(c);s.exportedSnapshots.push({...D.stamp(),checkinId:c.id,text:D.checkinText(c)});
 const restored=D.parseBackup(JSON.stringify(s));assert.deepEqual(restored,s);assert.deepEqual(D.mergeStores(D.emptyStore(),restored),restored);assert.deepEqual(D.mergeStores(restored,restored),restored);const conflicting=D.clone(restored);conflicting.foods[0].name='Changed';assert.throws(()=>D.mergeStores(restored,conflicting),/conflict/);assert.equal(restored.foods[0].name,'Synthetic Cereal');
 const invalid=D.clone(s);invalid.schemaVersion=99;assert.throws(()=>D.parseBackup(JSON.stringify(invalid)),/Unsupported/);const bad=D.clone(s);bad.entries[0].nutrition.calories=1;assert.throws(()=>D.validate(bad),/snapshot/);assert.throws(()=>D.parseBackup('{oops'),/valid JSON/);
});
