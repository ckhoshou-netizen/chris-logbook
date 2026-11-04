import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../app/domain.mjs';
import {ui} from './ui-harness.mjs';

function fixture(){
 const s=D.emptyStore(),food=D.makeFood({name:'Synthetic Cereal',quantity:40,unit:'g',calories:160,protein:4,carbs:30,fat:2});s.foods.push(food);
 for(const [date,quantity] of [['2026-11-01',40],['2026-11-02',60]]){const e=D.makeEntry(food,quantity,'g',date,'08:00');e.createdAt=date+'T12:00:00.000Z';s.entries.push(e);}
 return {s,food};
}

test('repeat-food takes the most recent portion and current profile, leaving historic snapshots untouched',async()=>{
 const {s,food}=fixture(),old=D.clone(s.entries);food.nutrition.calories=180;
 const {api}=ui(s,'2026-11-04','2026-11-04');await api.action('food-hour','12:00');await api.action('repeat-food',food.id);
 const e=s.entries.at(-1);assert.equal(e.quantity,60);assert.equal(e.date,'2026-11-04');assert.equal(e.time,'12:00');assert.equal(e.nutrition.calories,270);assert.deepEqual(s.entries.slice(0,2),old);
 await api.action('undo');assert.deepEqual(s.entries,old);D.validate(s);
});

test('future repeat-food creates only a plan and Undo removes that one plan',async()=>{
 const {s,food}=fixture(),old=D.clone(s.entries),{api}=ui(s,'2026-11-06','2026-11-04');
 await api.action('food-hour','18:00');await api.action('repeat-food',food.id);
 assert.equal(s.plannedEntries.length,1);assert.equal(s.plannedEntries[0].time,'18:00');assert.equal(s.plannedEntries[0].date,'2026-11-06');assert.deepEqual(s.entries,old);
 await api.action('undo');assert.equal(s.plannedEntries.length,0);assert.deepEqual(s.entries,old);
});

test('quick-repeat refuses unknown units and never invents a gram conversion',async()=>{
 const {s,food}=fixture();food.unit='mL';food.grams=null;
 const before=D.clone(s),{api}=ui(s,'2026-11-04','2026-11-04');await assert.rejects(()=>api.action('repeat-food',food.id),/Choose an amount/);assert.deepEqual(s,before);
});

test('one-tap Mark Eaten keeps the planned snapshot and Undo restores the same record once',async()=>{
 const {s,food}=fixture(),planned=D.makeEntry(food,60,'g','2026-11-04','09:30');D.savePlannedEntry(s,planned);food.nutrition.calories=999;
 s.statuses.push({...D.stamp(),date:'2026-11-04',status:'Complete',zeroIntakeConfirmed:true});
 const before=D.clone(s),{api}=ui(s,'2026-11-04','2026-11-04');await api.action('confirm-planned',planned.id);
 assert.equal(s.plannedEntries.length,0);const recorded=s.entries.find(x=>x.id===planned.id);assert.equal(recorded.nutrition.calories,240);assert.deepEqual(recorded.snapshot,planned.snapshot);assert.equal(recorded.time,'09:30');assert.equal(s.statuses[0].zeroIntakeConfirmed,undefined);
 await assert.rejects(()=>api.action('confirm-planned',planned.id));assert.equal(s.entries.filter(x=>x.id===planned.id).length,1);
 await api.action('undo');assert.deepEqual(s,before);await assert.rejects(()=>api.action('undo'),/expired/);
});

test('food Undo preserves intervening changes and saved check-ins',async()=>{
 const {s,food}=fixture(),planned=D.makeEntry(food,60,'g','2026-11-04','09:30');D.savePlannedEntry(s,planned);
 const checkin=D.buildCheckin(s,'2026-11-01');s.checkins.push(checkin);const frozen=D.clone(checkin),{api}=ui(s,'2026-11-04','2026-11-04');
 await api.action('confirm-planned',planned.id);s.entries.find(x=>x.id===planned.id).time='10:00';
 await assert.rejects(()=>api.action('undo'),/newer entry/);assert.equal(s.entries.find(x=>x.id===planned.id).time,'10:00');assert.equal(s.plannedEntries.length,0);assert.deepEqual(s.checkins[0],frozen);D.validate(s);
});

test('a plan scheduled in the future cannot be marked eaten early',async()=>{
 const {s,food}=fixture(),planned=D.makeEntry(food,60,'g','2026-11-06','09:30');D.savePlannedEntry(s,planned);const before=D.clone(s),{api}=ui(s,'2026-11-06','2026-11-04');await assert.rejects(()=>api.action('confirm-planned',planned.id),/Future food/);assert.deepEqual(s,before);
});
