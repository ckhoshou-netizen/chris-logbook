import test from 'node:test';import assert from 'node:assert/strict';import * as D from '../app/domain.mjs';
function fixture(){const s=D.emptyStore();s.cardioTargets.push({...D.stamp(),effective:'2026-11-01',weekly:140,daily:20,days:7,authority:'daily',category:'Zone 2'});const session=(date,minutes,completed=true)=>({...D.stamp(),date,minutes,completed,category:'Zone 2'});s.cardioSessions.push(session('2026-11-03',40),session('2026-11-03',12.5),session('2026-11-03',60,false),session('2026-11-04',20));s.cardioCredits.push({...D.stamp(),sessionId:s.cardioSessions[0].id,date:'2026-11-06',minutes:20});return s;}
const total=(s,d)=>s.cardioSessions.filter(x=>x.date===d&&x.completed).reduce((a,x)=>a+x.minutes,0);
test('editing a daily total replaces the aggregate exactly, preserves IDs where possible, and excludes duplicate legacy plans on the same date',()=>{const s=fixture(),first=D.clone(s.cardioSessions[0]),planned=D.clone(s.cardioSessions[2]),other=D.clone(s.cardioSessions[3]);const change=D.setCardioDayTotal(s,'2026-11-03',37,'2026-11-04');assert.equal(total(s,'2026-11-03'),37);assert.equal(s.cardioSessions.find(x=>x.id===first.id).minutes,37);assert.equal(s.cardioSessions.find(x=>x.id===first.id).createdAt,first.createdAt);assert.deepEqual(s.cardioSessions.find(x=>x.id===planned.id),planned);assert.deepEqual(s.cardioSessions.find(x=>x.id===other.id),other);assert.equal(s.cardioCredits[0].minutes,20);assert.equal(D.cardioTotal(s,'2026-11-04',{asOfDate:'2026-11-04'}).minutes,57);assert.equal(D.setCardioDayTotal(s,'2026-11-03',37,'2026-11-04').changed,false);D.setCardioDayTotal(s,'2026-11-03',60,'2026-11-04');assert.equal(total(s,'2026-11-03'),60);assert.equal(s.cardioSessions.filter(x=>x.date==='2026-11-03'&&x.completed).length,1);D.validate(s);assert.ok(change.changed);});
test('zero clears actual minutes, trims dependent credits, and Undo restores exact records without duplication',()=>{const s=fixture(),before=D.clone(s),change=D.setCardioDayTotal(s,'2026-11-03',0,'2026-11-04');assert.equal(total(s,'2026-11-03'),0);assert.equal(s.cardioCredits.length,0);assert.equal(s.cardioSessions.filter(x=>x.date==='2026-11-03').length,0);D.validate(s);D.undoCardioDayTotal(s,change);assert.equal(total(s,'2026-11-03'),52.5);assert.deepEqual(s.cardioSessions.filter(x=>x.date==='2026-11-03'&&x.completed),before.cardioSessions.filter(x=>x.date==='2026-11-03'&&x.completed));assert.deepEqual(s.cardioCredits,before.cardioCredits);assert.throws(()=>D.undoCardioDayTotal(s,change),/changed/);D.validate(s);});
test('Undo refuses conflicting newer edits; fractional, empty and invalid values stay well defined',()=>{const s=fixture(),change=D.setCardioDayTotal(s,'2026-11-03',12.5,'2026-11-04');assert.equal(s.cardioCredits[0].minutes,12.5);D.setCardioDayTotal(s,'2026-11-03',15,'2026-11-04');assert.throws(()=>D.undoCardioDayTotal(s,change),/changed/);assert.equal(D.setCardioDayTotal(s,'2026-11-02',0,'2026-11-04').changed,false);D.setCardioDayTotal(s,'2026-11-02',37,'2026-11-04');assert.equal(total(s,'2026-11-02'),37);D.setCardioDayTotal(s,'2026-11-02',12.5,'2026-11-04');assert.equal(total(s,'2026-11-02'),12.5);for(const bad of[-1,'',Infinity,'abc'])assert.throws(()=>D.setCardioDayTotal(s,'2026-11-02',bad,'2026-11-04'));D.validate(s);});
test('daily edits change live rollover and their own dated week, while saved check-ins and backups retain their snapshots',()=>{const s=fixture();D.setCardioDayTotal(s,'2026-11-03',160,'2026-11-04');const c=D.buildCheckin(s,'2026-11-08');s.checkins.push(c);s.exportedSnapshots.push({...D.stamp(),checkinId:c.id,text:D.checkinText(c)});const saved=D.clone(c),text=s.exportedSnapshots[0].text;assert.equal(D.cardioTotal(s,'2026-11-08',{asOfDate:'2026-11-08'}).carriedIn,40);D.setCardioDayTotal(s,'2026-11-03',40,'2026-11-08');assert.equal(D.cardioTotal(s,'2026-11-08',{asOfDate:'2026-11-08'}).carriedIn,0);assert.deepEqual(s.checkins[0],saved);assert.equal(s.exportedSnapshots[0].text,text);D.validate(s);assert.deepEqual(D.parseBackup(JSON.stringify(s)),s);});

test('future amounts count immediately and stay constant across the date boundary without confirmation',()=>{
 const s=fixture(),before=D.clone(s),change=D.setCardioDayTotal(s,'2026-11-06',200,'2026-11-04');const id=change.after.sessions[0].id;
 assert.deepEqual(D.cardioDayValue(s,'2026-11-06','2026-11-04'),{minutes:200});
 assert.equal(D.cardioTotal(s,'2026-11-04',{asOfDate:'2026-11-04'}).minutes,272.5);
 assert.equal(D.cardioTotal(s,'2026-11-06',{asOfDate:'2026-11-06'}).minutes,272.5);
 assert.equal(D.setCardioDayTotal(s,'2026-11-06',200,'2026-11-06').changed,false);
 assert.equal(s.cardioSessions.filter(x=>x.date==='2026-11-06').length,1);
 assert.equal(s.cardioSessions.find(x=>x.id===id).minutes,200);
 assert.equal(D.cardioTotal(s,'2026-11-08',{asOfDate:'2026-11-04'}).carriedIn,0);
 assert.equal(D.cardioTotal(s,'2026-11-08',{asOfDate:'2026-11-08'}).carriedIn,132.5);
 D.setCardioDayTotal(s,'2026-11-06',12.5,'2026-11-04');assert.equal(D.cardioTotal(s,'2026-11-04',{asOfDate:'2026-11-04'}).minutes,85);
 const cleared=D.setCardioDayTotal(s,'2026-11-06',0,'2026-11-04');assert.equal(D.cardioDayValue(s,'2026-11-06','2026-11-04').minutes,0);
 D.undoCardioDayTotal(s,cleared);assert.deepEqual(D.cardioDayValue(s,'2026-11-06','2026-11-04'),{minutes:12.5});
 assert.deepEqual(s.cardioSessions.filter(x=>x.date!=='2026-11-06'),before.cardioSessions);D.validate(s);assert.deepEqual(D.parseBackup(JSON.stringify(s)),s);
});
test('already saved future minutes count without re-entry, while old snapshots retain their calculation',()=>{
 const s=fixture(),original=D.buildCheckin(s,'2026-11-08');original.cardio.rolloverVersion='surplus-v1';
 s.checkins.push(original);s.exportedSnapshots.push({...D.stamp(),checkinId:original.id,text:D.checkinText(original)});
 const snapshots=D.clone(s.checkins),exports=D.clone(s.exportedSnapshots);
 s.cardioSessions.push({...D.stamp(),date:'2026-11-06',minutes:37,completed:false,category:'Zone 2'});
 assert.equal(D.cardioTotal(s,'2026-11-04',{asOfDate:'2026-11-04'}).minutes,109.5);
 assert.equal(D.cardioDayValue(s,'2026-11-06','2026-11-04').minutes,37);
 const next=D.buildCheckin(s,'2026-11-08');assert.equal(next.cardio.rolloverVersion,'saved-minutes-v2');assert.equal(next.cardio.minutes,109.5);assert.match(D.checkinText(next),/Cardio entered: 109.5/);s.checkins.push(next);
 assert.deepEqual(s.checkins.slice(0,1),snapshots);assert.deepEqual(s.exportedSnapshots,exports);D.validate(s);assert.deepEqual(D.parseBackup(JSON.stringify(s)),s);
 const bad=D.clone(s);bad.checkins[1].cardio.minutes+=37;assert.throws(()=>D.validate(bad),/unique|minutes/);
});
