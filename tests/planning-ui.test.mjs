import test from 'node:test';import assert from 'node:assert/strict';import * as Domain from '../app/domain.mjs';
import {ui} from './ui-harness.mjs';
function seed(){const s=Domain.emptyStore(),f=Domain.makeFood({name:'Cereal <script>',quantity:40,unit:'g',calories:160,protein:4,carbs:30,fat:2});s.foods.push(f);Domain.savePlannedEntry(s,Domain.makeEntry(f,60,'g','2026-11-04','08:00'));return s;}
test('future view shows planned totals and one timeline, without future completion/weight controls',()=>{const {api}=ui(seed()),html=api.nutritionScreen();assert.match(html,/Calories Planned/);assert.match(html,/240/);assert.match(html,/Food Plan/);assert.match(html,/Planned/);assert.doesNotMatch(html,/Mark Eaten|id="day-status"|Today’s Weight|data-action="weight"/);assert.equal((html.match(/<ol /g)||[]).length,1);assert.match(html,/Cereal &lt;script&gt;/);});
test('when the day arrives, plans stay planned and are not shown as recorded calories',()=>{const {api}=ui(seed(),'2026-11-04','2026-11-04'),html=api.nutritionScreen();assert.match(html,/Calories Recorded/);assert.match(html,/0 Recorded/);assert.match(html,/240 kcal not included/);assert.match(html,/data-action="confirm-planned"/);assert.equal((html.match(/<ol /g)||[]).length,1);assert.match(html,/hero-number number">—/);});
test('recorded and planned food share chronological order with distinct actions',()=>{const s=seed();s.entries.push(Domain.makeEntry(s.foods[0],40,'g','2026-11-04','07:00'));const {api}=ui(s,'2026-11-04','2026-11-04'),html=api.nutritionScreen();assert.match(html,/hero-number number">160/);assert.equal((html.match(/<ol /g)||[]).length,1);assert.ok(html.indexOf('<time>07:00')<html.indexOf('<time>08:00'));assert.match(html,/data-action="edit-planned"/);assert.match(html,/data-action="delete-planned"/);assert.match(html,/data-action="copy-planned"/);});

test('future date selection, quick-add, and copied actual entries save as plans without changing recorded intake',async()=>{
 const s=seed();s.entries.push(Domain.makeEntry(s.foods[0],40,'g','2026-11-03','12:00'));const original=Domain.clone(s.entries[0]),{api}=ui(s,'2026-11-03');
 await api.submit('date',{values:{date:'2026-11-05'}});
 await assert.rejects(()=>api.submit('quick',{values:{name:'Quick',calories:'100',protein:'5',carbs:'15',fat:'2',kind:'recorded'}}),/past date/);
 await api.submit('quick',{values:{name:'Quick',calories:'100',protein:'5',carbs:'15',fat:'2',kind:'planned'}});assert.equal(s.plannedEntries.length,2);assert.equal(s.entries.length,1);
 api.setEditing({id:original.id,planned:false});await api.submit('copy',{values:{date:'2026-11-06'}});assert.equal(s.plannedEntries.length,3);assert.deepEqual(s.entries[0],original);assert.equal(s.plannedEntries.at(-1).date,'2026-11-06');assert.equal(s.plannedEntries.at(-1).nutrition.calories,160);
});
test('portion edit and confirmation form use the saved profile and cannot confirm twice',async()=>{
 const s=seed(),id=s.plannedEntries[0].id,{api}=ui(s,'2026-11-04','2026-11-04');
 api.setEditing({food:s.plannedEntries[0].snapshot,plannedId:id});await api.submit('portion',{values:{quantity:'80',unit:'g',date:'2026-11-04',time:'09:00',kind:'planned'}});assert.equal(s.plannedEntries[0].nutrition.calories,320);assert.equal(s.entries.length,0);
 api.setEditing({food:s.plannedEntries[0].snapshot,plannedId:id,confirm:true});await api.submit('portion',{values:{quantity:'40',unit:'g',date:'2026-11-04',time:'09:30',kind:'confirm'}});assert.equal(s.entries.length,1);assert.equal(s.entries[0].nutrition.calories,160);assert.equal(s.plannedEntries.length,0);
});
test('deleting a planned entry and Undo restore the plan, never a recorded entry',async()=>{
 const s=seed(),before=Domain.clone(s.plannedEntries[0]),{api}=ui(s);await api.action('delete-planned',before.id);assert.equal(s.plannedEntries.length,0);assert.equal(s.entries.length,0);await api.action('undo');assert.deepEqual(s.plannedEntries[0],before);assert.equal(s.entries.length,0);
});

test('navigating from a future food plan does not move the live weight window into the future',()=>{const s=seed();s.weights.push({...Domain.stamp(),date:'2026-11-03',lb:132});const {api}=ui(s,'2026-11-04','2026-11-03');const html=api.weightTrends();assert.match(html,/Oct 28 – Nov 3/);assert.match(html,/132/);assert.doesNotMatch(html,/Oct 29 – Nov 4/);});
