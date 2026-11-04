import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
import * as D from '../app/domain.mjs';import * as C from '../app/catalog.mjs';
const catalogue=JSON.parse(fs.readFileSync(new URL('../app/data/cnf-2026.json',import.meta.url),'utf8'));
const food=id=>D.clone(catalogue.foods.find(f=>f.id==='cnf-2026-'+id));
test('official CNF import keeps distinguishable preparations, original IDs, units and source energy',()=>{
 C.validateCatalog(catalogue);assert.equal(catalogue.foodCount,3620);assert.equal(catalogue.sourceFoodCount,5993);
 const raw=food('2240'),baked=food('2241'),boiled=food('2242');assert.match(raw.name,/raw/);assert.match(baked.name,/baked/);assert.match(boiled.name,/boiled/);
 assert.equal(raw.nutrition.calories,86);assert.equal(baked.nutrition.calories,90);assert.equal(boiled.nutrition.calories,77);assert.equal(baked.provenance.nutrients.calories.id,'208');assert.equal(baked.provenance.nutrients.sodium.unit,'Milligram');
 assert.equal(baked.provenance.originalDescription,baked.name);assert.notEqual(baked.nutrition.calories,4*baked.nutrition.protein+4*baked.nutrition.carbs+9*baked.nutrition.fat);assert.equal(baked.nutrition.carbs,20.71);assert.equal(baked.nutrition.fibre,3.3);
});
test('grams and source-defined household measures scale without rounding or invented conversions',()=>{
 const f=food('2241');assert.equal(D.portion(f,60,'g').nutrition.calories,54);assert.equal(D.portion(f,1,'measure:139').nutrition.calories,162);assert.equal(D.portion(f,2,'measure:139').nutrition.carbs,20.71*3.6);assert.equal(D.portionLabel(f,1,'measure:139'),'1 × 1 large');assert.throws(()=>D.portion(f,1,'measure:unknown'),/conversion/);
 const unknown=catalogue.foods.find(f=>f.nutrition.sugar===null);assert.ok(unknown);assert.equal(D.portion(unknown,25,'g').nutrition.sugar,null);
 const slices=Array.from({length:20},()=>D.portion(f,5,'g'));assert.ok(Math.abs(slices.reduce((n,p)=>n+p.nutrition.protein,0)-f.nutrition.protein)<1e-12);
});
test('Canadian foods are read-only; an explicitly separate Custom copy retains source attribution',()=>{
 const original=food('2241'),before=D.clone(original);assert.throws(()=>D.makeFood({name:'Changed'},original),/separate custom copy/);
 const copy=D.makeFood({name:'My Baked Sweet Potato',quantity:100,unit:'g',...original.nutrition,copiedFrom:original.provenance});assert.equal(copy.source,'Custom');assert.notEqual(copy.id,original.id);assert.equal(copy.copiedFrom.foodId,original.provenance.foodId);assert.deepEqual(original,before);
 const invalid=D.clone(original);invalid.provenance.nutrients.calories.id='268';assert.throws(()=>D.validateFood(invalid),/units or energy/);
});
test('catalogue replacement never alters recorded nutrition, favourites or saved check-ins',()=>{
 const s=D.emptyStore(),f=food('2241');D.keepFoodReference(s,f);s.favourites.push({...D.stamp(),foodId:f.id});s.entries.push(D.makeEntry(f,60,'g','2026-11-01','12:00'));s.statuses.push({...D.stamp(),date:'2026-11-01',status:'Complete'});s.checkins.push(D.buildCheckin(s,'2026-11-08'));s.exportedSnapshots.push({...D.stamp(),checkinId:s.checkins[0].id,text:D.checkinText(s.checkins[0])});
 const entry=D.clone(s.entries[0]),snapshot=D.clone(s.checkins[0]),report=D.clone(s.exportedSnapshots[0]);const updated=D.clone(f);updated.nutrition.calories=91;D.keepFoodReference(s,updated);
 assert.deepEqual(s.entries[0],entry);assert.deepEqual(s.checkins[0],snapshot);assert.deepEqual(s.exportedSnapshots[0],report);assert.equal(s.favourites[0].foodId,f.id);assert.equal(D.portion(s.entries[0].snapshot,100,'g').nutrition.calories,90);
 const restored=D.parseBackup(JSON.stringify(s));assert.deepEqual(restored,s);assert.deepEqual(D.mergeStores(D.emptyStore(),restored),s);assert.deepEqual(D.mergeStores(s,restored),s);
});
test('search covers custom and Canadian foods, plurals and preparation words without combining records',()=>{
 const custom=D.makeFood({name:'My Cereal',quantity:40,unit:'g',calories:160,protein:4,carbs:30,fat:2}),all=C.foodPool([custom],catalogue.foods);
 assert.equal(C.searchFoods(all,'sweet potatoes baked')[0].id,'cnf-2026-2241');assert.equal(C.searchFoods(all,'my cereal')[0].id,custom.id);assert.ok(C.searchFoods(all,'bananas raw').some(f=>f.name==='Banana, raw'));assert.equal(C.searchFoods(all,'sweet potato boiled')[0].id,'cnf-2026-2242');assert.ok(C.searchFoods(all,'chicken breast raw').every(f=>/raw/.test(f.name)));
 assert.equal(C.foodPool([food('2241')],catalogue.foods).filter(f=>f.id==='cnf-2026-2241').length,1);
});
test('v3 device storage upgrades without rewriting history; Canadian entries and favourites restore into a clean store',{concurrency:false},async()=>{
 const require=createRequire(import.meta.url),{IDBFactory}=require('fake-indexeddb');globalThis.indexedDB=new IDBFactory();globalThis.location={reload(){}};
 const old=D.emptyStore();old.schemaVersion=3;const cereal=D.makeFood({name:'Synthetic Cereal',quantity:40,unit:'g',calories:160,protein:4,carbs:30,fat:2});old.foods.push(cereal);old.entries.push(D.makeEntry(cereal,60,'g','2026-11-01','08:00'));old.weights.push({...D.stamp(),date:'2026-11-01',lb:132});old.plans.push({...D.stamp(),effective:'2026-11-01',...D.calculateTargets(1800,132),goal:{value:1,unit:'lb'},referenceWindow:null});old.checkins.push(D.buildCheckin(old,'2026-11-08'));const before=D.clone(old);
 await new Promise((resolve,reject)=>{const r=indexedDB.open('chris-logbook',3);r.onupgradeneeded=()=>r.result.createObjectStore('records').put(old,'state');r.onsuccess=()=>{r.result.close();resolve();};r.onerror=()=>reject(r.error);});
 const S=await import('../app/storage.mjs?cnf-migration');const upgraded=await S.readStore();assert.equal(upgraded.schemaVersion,D.VERSION);for(const key of Object.keys(before))if(key!=='schemaVersion')assert.deepEqual(upgraded[key],before[key],key);assert.deepEqual(D.parseBackup(JSON.stringify(old)),upgraded);assert.deepEqual(old,before);
 const f=food('2241');await S.updateStore(s=>{D.keepFoodReference(s,f);s.entries.push(D.makeEntry(f,1,'measure:139','2026-11-03','12:00'));s.favourites.push({...D.stamp(),foodId:f.id});});const backup=JSON.stringify(await S.readStore());await S.updateStore(()=>D.emptyStore());await S.updateStore(()=>D.parseBackup(backup));const restored=await S.readStore();assert.equal(restored.entries[1].nutrition.calories,162);assert.equal(restored.foods.find(x=>x.id===f.id).provenance.foodId,'2241');assert.equal(restored.favourites[0].foodId,f.id);assert.deepEqual(restored.checkins,before.checkins);(await S.openStore()).close();
});
