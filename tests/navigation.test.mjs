import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../app/domain.mjs';
import {ui} from './ui-harness.mjs';
function fixture(){
 const s=D.emptyStore(),f=D.makeFood({name:'Synthetic Cereal',quantity:40,unit:'g',calories:160,protein:4,carbs:30,fat:2});
 s.foods.push(f);s.entries.push(D.makeEntry(f,60,'g','2026-11-03','08:00'));D.savePlannedEntry(s,D.makeEntry(f,80,'g','2026-11-04','08:00'));
 s.weights.push({...D.stamp(),date:'2026-10-25',lb:134},{...D.stamp(),date:'2026-11-01',lb:132},{...D.stamp(),date:'2026-11-03',lb:132});
 s.plans.push({...D.stamp(),effective:'2026-11-01',...D.calculateTargets(1800,132),goal:{value:.5,unit:'lb'},referenceWindow:D.medianWindow(s.weights,'2026-11-01')});
 const e=D.saveExercise(s,{name:'Bench Press'});D.saveTrainingSplit(s,'2026-11-01',[{id:'upper',weekday:1,title:'Torso A',exercises:[e.id]}]);
 s.checkins.push(D.buildCheckin(s,'2026-11-01'));s.exportedSnapshots.push({...D.stamp(),checkinId:s.checkins[0].id,text:'Saved report remains unchanged.'});return s;
}
test('task-based screens retain the same foods, workout references, weights and saved goals without rewriting records',()=>{
 const s=fixture(),before=structuredClone(s),{api}=ui(s,'2026-11-03');
 const nutrition=api.nutritionScreen(),training=api.trainingScreen(),checkin=api.checkinScreen();
 assert.match(nutrition,/Synthetic Cereal/);assert.match(nutrition,/240/);assert.doesNotMatch(nutrition,/data-action="weight"|data-training=|Log Cardio/);
 assert.match(training,/Torso A/);assert.match(training,/Bench Press/);assert.match(training,/data-action="cardio-day"/);assert.doesNotMatch(training,/Calories Recorded|data-action="weight"/);
 assert.match(checkin,/Today’s Weight/);assert.match(checkin,/132 lb/);assert.match(checkin,/1,800/);assert.match(checkin,/0.5 lb\/week/);assert.match(checkin,/Weight Trends/);assert.match(checkin,/−2\.0 lb/);
 assert.deepEqual(s,before);assert.deepEqual(D.parseBackup(JSON.stringify(s)),before);
});
test('legacy bookmarks and unknown links resolve to a usable destination',()=>{
 const {api}=ui(D.emptyStore());for(const [hash,tab]of Object.entries({'#today':'nutrition','#trends':'checkin','#sunday':'checkin','#nutrition':'nutrition','#training':'training','#checkin':'checkin','':'nutrition','#unknown':'nutrition'}))assert.equal(api.resolveTab(hash),tab);
});
test('opening Check-in from a future food plan keeps weight entry on an actual calendar date',async()=>{
 const s=fixture(),{api,node}=ui(s,'2026-11-05','2026-11-03');const before=structuredClone(s),html=api.checkinScreen();assert.match(html,/Today’s Weight/);assert.match(html,/132 lb/);assert.match(html,/Oct 28 – Nov 3/);
 await api.action('weight');assert.match(node('#sheet-content').innerHTML,/name="date"[^>]*value="2026-11-03"/);
 await assert.rejects(()=>api.submit('weight-date',{values:{date:'2026-11-04'}}),/past date/);assert.deepEqual(s,before);
});
for(const [mode,start,step,expected] of [
 ['nutrition','2026-10-31',1,'2026-11-01'],
 ['training','2026-10-31',7,'2026-11-07'],
 ['checkin','2026-11-04',1,'2026-11-05'],
])test(`${mode} arrow changes the calendar date without focusing the iPhone date picker or changing records`,async()=>{
 const s=fixture(),before=structuredClone(s),{api,node,context}=ui(s,start,'2026-11-05');context.location.hash='#'+mode;
 let dateFocus=0;node(`[data-day-date="${mode}"]`).focus=()=>dateFocus++;
 context.document.activeElement={dataset:{action:'day-step',value:`${mode}:${step}`}};
 await api.action('day-step',`${mode}:${step}`);
 assert.match(node('#screen').innerHTML,new RegExp(`data-day-date="${mode}" value="${expected}"`));assert.equal(dateFocus,0);assert.deepEqual(s,before);
 await api.action('day-step',`${mode}:${-step}`);
 assert.match(node('#screen').innerHTML,new RegExp(`data-day-date="${mode}" value="${start}"`));assert.equal(dateFocus,0);assert.deepEqual(s,before);
});
test('choosing a calendar date commits it without refocusing or reopening the picker',async()=>{
 const s=fixture(),before=structuredClone(s),{node,listeners}=ui(s,'2026-11-04','2026-11-05');let dateFocus=0;node('[data-day-date="nutrition"]').focus=()=>dateFocus++;
 await listeners.change({target:{dataset:{dayDate:'nutrition'},value:'2026-11-02',closest:()=>null}});
 assert.match(node('#screen').innerHTML,/data-day-date="nutrition" value="2026-11-02"/);assert.equal(dateFocus,0);assert.deepEqual(s,before);
});
