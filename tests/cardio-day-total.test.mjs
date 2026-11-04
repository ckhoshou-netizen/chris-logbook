import test from 'node:test';import assert from 'node:assert/strict';import * as D from '../app/domain.mjs';
function fixture(){const s=D.emptyStore();s.cardioTargets.push({...D.stamp(),effective:'2026-11-01',weekly:140,daily:20,days:7,authority:'daily',category:'Zone 2'});const session=(date,minutes,completed=true)=>({...D.stamp(),date,minutes,completed,category:'Zone 2'});s.cardioSessions.push(session('2026-11-03',40),session('2026-11-03',12.5),session('2026-11-03',60,false),session('2026-11-04',20));s.cardioCredits.push({...D.stamp(),sessionId:s.cardioSessions[0].id,date:'2026-11-06',minutes:20});return s;}
const total=(s,d)=>s.cardioSessions.filter(x=>x.date===d&&x.completed).reduce((a,x)=>a+x.minutes,0);
test('editing a daily total replaces the aggregate exactly, preserves IDs where possible, and never counts old plans',()=>{const s=fixture(),first=D.clone(s.cardioSessions[0]),planned=D.clone(s.cardioSessions[2]),other=D.clone(s.cardioSessions[3]);const change=D.setCardioDayTotal(s,'2026-11-03',37,'2026-11-04');assert.equal(total(s,'2026-11-03'),37);assert.equal(s.cardioSessions.find(x=>x.id===first.id).minutes,37);assert.equal(s.cardioSessions.find(x=>x.id===first.id).createdAt,first.createdAt);assert.deepEqual(s.cardioSessions.find(x=>x.id===planned.id),planned);assert.deepEqual(s.cardioSessions.find(x=>x.id===other.id),other);assert.equal(s.cardioCredits[0].minutes,20);assert.equal(D.cardioTotal(s,'2026-11-04',{asOfDate:'2026-11-04'}).minutes,57);assert.equal(D.setCardioDayTotal(s,'2026-11-03',37,'2026-11-04').changed,false);D.setCardioDayTotal(s,'2026-11-03',60,'2026-11-04');assert.equal(total(s,'2026-11-03'),60);assert.equal(s.cardioSessions.filter(x=>x.date==='2026-11-03'&&x.completed).length,1);D.validate(s);assert.ok(change.changed);});
test('zero clears actual minutes, trims dependent credits, and Undo restores exact records without duplication',()=>{const s=fixture(),before=D.clone(s),change=D.setCardioDayTotal(s,'2026-11-03',0,'2026-11-04');assert.equal(total(s,'2026-11-03'),0);assert.equal(s.cardioCredits.length,0);assert.equal(s.cardioSessions.filter(x=>x.date==='2026-11-03').length,0);D.validate(s);D.undoCardioDayTotal(s,change);assert.equal(total(s,'2026-11-03'),52.5);assert.deepEqual(s.cardioSessions.filter(x=>x.date==='2026-11-03'&&x.completed),before.cardioSessions.filter(x=>x.date==='2026-11-03'&&x.completed));assert.deepEqual(s.cardioCredits,before.cardioCredits);assert.throws(()=>D.undoCardioDayTotal(s,change),/changed/);D.validate(s);});
test('Undo refuses conflicting newer edits; fractional, empty and invalid values stay well defined',()=>{const s=fixture(),change=D.setCardioDayTotal(s,'2026-11-03',12.5,'2026-11-04');assert.equal(s.cardioCredits[0].minutes,12.5);D.setCardioDayTotal(s,'2026-11-03',15,'2026-11-04');assert.throws(()=>D.undoCardioDayTotal(s,change),/changed/);assert.equal(D.setCardioDayTotal(s,'2026-11-02',0,'2026-11-04').changed,false);D.setCardioDayTotal(s,'2026-11-02',37,'2026-11-04');assert.equal(total(s,'2026-11-02'),37);D.setCardioDayTotal(s,'2026-11-02',12.5,'2026-11-04');assert.equal(total(s,'2026-11-02'),12.5);for(const bad of[-1,'',Infinity,'abc'])assert.throws(()=>D.setCardioDayTotal(s,'2026-11-02',bad,'2026-11-04'));D.validate(s);});
test('daily edits change live rollover and their own dated week, while saved check-ins and backups retain their snapshots',()=>{const s=fixture();D.setCardioDayTotal(s,'2026-11-03',160,'2026-11-04');const c=D.buildCheckin(s,'2026-11-08');s.checkins.push(c);s.exportedSnapshots.push({...D.stamp(),checkinId:c.id,text:D.checkinText(c)});const saved=D.clone(c),text=s.exportedSnapshots[0].text;assert.equal(D.cardioTotal(s,'2026-11-08',{asOfDate:'2026-11-08'}).carriedIn,40);D.setCardioDayTotal(s,'2026-11-03',40,'2026-11-08');assert.equal(D.cardioTotal(s,'2026-11-08',{asOfDate:'2026-11-08'}).carriedIn,0);assert.deepEqual(s.checkins[0],saved);assert.equal(s.exportedSnapshots[0].text,text);D.validate(s);assert.deepEqual(D.parseBackup(JSON.stringify(s)),s);});

test('future daily amounts stay visible and editable, but never auto-count on arrival or create rollover',()=>{
 const s=fixture(),before=D.clone(s),change=D.setCardioDayTotal(s,'2026-11-06',200,'2026-11-04');
 assert.deepEqual(D.cardioDayValue(s,'2026-11-06','2026-11-04'),{minutes:200,pending:true});
 assert.equal(change.after.sessions[0].completed,false);const id=change.after.sessions[0].id;
 assert.equal(D.setCardioDayTotal(s,'2026-11-06',200,'2026-11-04').changed,false);
 assert.equal(D.cardioTotal(s,'2026-11-06',{asOfDate:'2026-11-06'}).minutes,72.5);
 assert.equal(D.cardioTotal(s,'2026-11-08',{asOfDate:'2026-11-08'}).carriedIn,0);
 assert.equal(D.cardioDayValue(s,'2026-11-06','2026-11-06').pending,true);
 const confirmed=D.setCardioDayTotal(s,'2026-11-06',200,'2026-11-06');assert.equal(confirmed.changed,true);
 assert.equal(s.cardioSessions.find(x=>x.id===id).completed,true);assert.equal(s.cardioSessions.filter(x=>x.date==='2026-11-06').length,1);
 assert.deepEqual(D.cardioDayValue(s,'2026-11-06','2026-11-06'),{minutes:200,pending:false});
 assert.equal(D.cardioTotal(s,'2026-11-08',{asOfDate:'2026-11-08'}).carriedIn,132.5);
 D.undoCardioDayTotal(s,confirmed);assert.equal(s.cardioSessions.find(x=>x.id===id).completed,false);
 D.setCardioDayTotal(s,'2026-11-06',12.5,'2026-11-04');assert.equal(D.cardioDayValue(s,'2026-11-06','2026-11-04').minutes,12.5);
 const cleared=D.setCardioDayTotal(s,'2026-11-06',0,'2026-11-04');assert.equal(D.cardioDayValue(s,'2026-11-06','2026-11-04').minutes,0);
 D.undoCardioDayTotal(s,cleared);assert.deepEqual(D.cardioDayValue(s,'2026-11-06','2026-11-04'),{minutes:12.5,pending:true});
 assert.deepEqual(s.cardioSessions.filter(x=>x.date!=='2026-11-06'),before.cardioSessions);D.validate(s);assert.deepEqual(D.parseBackup(JSON.stringify(s)),s);
});
test('confirming a saved amount on a past date preserves saved exports and its source identity',()=>{
 const s=fixture();D.setCardioDayTotal(s,'2026-11-06',37,'2026-11-04');const id=s.cardioSessions.at(-1).id;
 const c=D.buildCheckin(s,'2026-11-08');s.checkins.push(c);s.exportedSnapshots.push({...D.stamp(),checkinId:c.id,text:D.checkinText(c)});const snapshots=D.clone(s.checkins),exports=D.clone(s.exportedSnapshots);
 D.setCardioDayTotal(s,'2026-11-06',37,'2026-11-09');assert.equal(s.cardioSessions.find(x=>x.id===id).completed,true);
 assert.equal(D.cardioTotal(s,'2026-11-07',{asOfDate:'2026-11-09'}).minutes,109.5);
 assert.deepEqual(s.checkins,snapshots);assert.deepEqual(s.exportedSnapshots,exports);D.validate(s);
});
