// All arithmetic uses stored precision. Display rounding belongs to the UI.
export const VERSION = 5;
export const TABLES = ['foods','entries','weights','statuses','plans','phases','checkins','exportedSnapshots','cardioTargets','cardioSessions','cardioCredits','trainingSchedules','trainingOccurrences','stepTargets','stepTotals','favourites','plannedEntries','exercises'];
export const NUTRIENTS = ['calories','protein','carbs','fat','fibre','sugar','sodium'];
export const REQUIRED = ['calories','protein','carbs','fat'];
// This is the accepted feature's first week, not a moving "current week" default.
export const CARDIO_ROLLOVER_START = '2026-11-01';
export const clone = x => structuredClone(x);
export const id = () => crypto.randomUUID();
let lastStamp=0;
export const stamp = () => ({id:id(),createdAt:new Date(lastStamp=Math.max(Date.now(),lastStamp+1)).toISOString()});
export function assert(ok,message){if(!ok)throw new Error(message);}
export function number(value,label,{positive=false,optional=false}={}){
 if(optional && (value==='' || value==null))return null;
 assert(value!=='' && value!=null,`${label} is required.`);
 const n=Number(value);assert(Number.isFinite(n) && (positive?n>0:n>=0),`${label} must be ${positive?'greater than zero':'zero or greater'}.`);return n;
}
export function validDate(d){return typeof d==='string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d+'T12:00:00Z')) && new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;}
export function date(d){assert(validDate(d),'Choose a valid calendar date.');return d;}
export function addDays(d,n){date(d);const a=new Date(d+'T12:00:00Z');a.setUTCDate(a.getUTCDate()+n);return a.toISOString().slice(0,10);}
export function weekStart(d){return addDays(d,-new Date(d+'T12:00:00Z').getUTCDay());}
export function dates(from,to){date(from);date(to);assert(to>=from,'End date precedes start date.');const out=[];for(let d=from;d<=to;d=addDays(d,1)){assert(out.length<40000,'Date range is too large.');out.push(d);}return out;}
export function today(timezone='America/Toronto',now=new Date()){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));return `${parts.year}-${parts.month}-${parts.day}`;
}
export function emptyStore(){return {schemaVersion:VERSION,revision:0,settings:{timezone:'America/Toronto',weightUnit:'lb',lastExport:null,cardioRolloverFrom:CARDIO_ROLLOVER_START},...Object.fromEntries(TABLES.map(t=>[t,[]]))};}
export function migrateStore(input){
 // Never mutate a backup or an old stored value in place. Validate before committing.
 const s=clone(input);
 if(s?.schemaVersion===1){assert(!Object.hasOwn(s,'plannedEntries'),'Unexpected planning data in a version 1 backup.');s.plannedEntries=[];s.schemaVersion=2;}
 if(s?.schemaVersion===2){assert(!Object.hasOwn(s,'exercises'),'Unexpected exercise data in a version 2 backup.');s.exercises=[];s.schemaVersion=3;}
 if(s?.schemaVersion===3)s.schemaVersion=4;
 if(s?.schemaVersion===4){
  // Only live diary labels change. Saved check-ins and exports retain their original version.
  for(const r of s.statuses){
   if(r.status==='Complete'&&!s.entries.some(e=>e.date===r.date))r.zeroIntakeConfirmed=true;
   if(r.status==='Unfinished')r.status='Complete';
  }
  s.schemaVersion=5;
 }
 return validate(s);
}
export function latest(records,d){return records.filter(x=>x.effective<=d).sort((a,b)=>a.effective.localeCompare(b.effective)||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)).at(-1)??null;}
export function medianWindow(weights,d){const from=addDays(d,-6),rows=weights.filter(w=>w.date>=from&&w.date<=d),values=rows.map(w=>w.lb).sort((a,b)=>a-b),n=values.length;return {from,to:d,count:n,value:n?(n%2?values[(n-1)/2]:(values[n/2-1]+values[n/2])/2):null,weights:clone(rows)};}
export function change(previous,current){if(previous==null||current==null)return null;const loss=previous-current;return {loss,percent:loss/previous*100};}
export function weightChangeText(previous,current){
 if(previous==null||current==null)return 'Unavailable';
 const delta=current-previous,magnitude=Math.abs(delta);
 if(delta===0)return '0.0 lb';
 const amount=magnitude<.005?'<0.01':magnitude.toLocaleString('en-CA',{minimumFractionDigits:1,maximumFractionDigits:2});
 return `${delta<0?'−':'+'}${amount} lb`;
}
export const round = n => Math.floor(n+0.5);
export function calculateTargets(calories,reference,overrides={}){
 calories=number(calories,'Calories');reference=number(reference,'Reference weight',{positive:true});
 const protein=overrides.protein==null?round(reference):number(overrides.protein,'Protein');
 const fat=overrides.fat==null?round(reference*.325):number(overrides.fat,'Fat');
 const remaining=calories-4*protein-9*fat;
 assert(remaining>=0,'Protein and fat exceed the calorie target. Correct these inputs before saving.');
 const carbs=overrides.carbs==null?round(remaining/4):number(overrides.carbs,'Carbohydrates');
 let band=overrides.proteinBand??(overrides.protein==null?[5*Math.floor(reference/5),5*Math.floor(reference/5)+5]:[protein,protein]);
 assert(Array.isArray(band)&&band.length===2&&band.every(x=>typeof x==='number'&&Number.isFinite(x)&&x>=0)&&band[1]>=band[0],'Protein band must have a valid lower and upper value.');
 return {calories,reference,protein,fat,carbs,band:clone(band),macroCalories:4*protein+4*carbs+9*fat,overrides:clone(overrides),formula:'chris-v1-half-up'};
}
export function nutrients(input){return Object.fromEntries(NUTRIENTS.map(k=>[k,number(input[k],k,{optional:!REQUIRED.includes(k)})]));}
export function makeFood(input,previous=null){
 assert(!previous||previous.source==='Custom','Save a separate custom copy to change a government food.');
 const name=String(input.name??'').trim();assert(name,'Food name is required.');assert(['g','mL','piece','cup','serving'].includes(input.unit),'Choose a valid serving unit.');
 return {...stamp(),...(previous?{id:previous.id,createdAt:previous.createdAt}:{}),updatedAt:new Date().toISOString(),name,brand:String(input.brand??'').trim(),quantity:number(input.quantity,'Serving quantity',{positive:true}),unit:input.unit,grams:input.unit==='g'?number(input.quantity,'Serving grams',{positive:true}):number(input.grams,'Serving gram weight',{positive:true,optional:true}),nutrition:nutrients(input),source:'Custom',archived:previous?.archived??false,household:String(input.household??''),barcode:String(input.barcode??''),...(previous?.copiedFrom||input.copiedFrom?{copiedFrom:clone(previous?.copiedFrom??input.copiedFrom)}:{})};
}
export function validateFood(f){
 assert(f&&typeof f.name==='string'&&f.name.trim(),'Invalid food name.');assert(typeof f.quantity==='number'&&Number.isFinite(f.quantity)&&f.quantity>0,'Invalid serving quantity.');assert(['g','mL','piece','cup','serving'].includes(f.unit),'Invalid serving unit.');if(f.grams!=null)assert(typeof f.grams==='number'&&Number.isFinite(f.grams)&&f.grams>0,'Invalid gram conversion.');
 assert(f.nutrition&&typeof f.nutrition==='object','Missing nutrition.');for(const key of NUTRIENTS){const value=f.nutrition[key];if(!REQUIRED.includes(key)&&value==null)continue;assert(typeof value==='number'&&Number.isFinite(value)&&value>=0,`Invalid ${key}.`);}
 assert(['Custom','Canadian Nutrient File'].includes(f.source),'Unsupported food source.');
 if(f.source==='Canadian Nutrient File'){
  assert(f.readOnly===true&&f.unit==='g'&&f.quantity===100&&f.grams===100,'Invalid government food profile.');const p=f.provenance;
  assert(p?.dataset==='Canadian Nutrient File'&&['2015','2026'].includes(p.version)&&typeof p.foodId==='string'&&p.foodId&&typeof p.foodCode==='string'&&f.id===`cnf-${p.version}-${p.foodCode}`&&typeof p.originalDescription==='string'&&p.originalDescription,'Missing Canadian food provenance.');
  const units=p.version==='2026'?{calories:['208','kilocalorie'],protein:['203','Gram'],carbs:['205','Gram'],fat:['204','Gram'],fibre:['291','Gram'],sugar:['269','Gram'],sodium:['307','Milligram']}:{calories:['208','kCal'],protein:['203','g'],carbs:['205','g'],fat:['204','g'],fibre:['291','g'],sugar:['269','g'],sodium:['307','mg']};
  for(const [key,[id,unit]]of Object.entries(units)){if(f.nutrition[key]==null)continue;assert(p.nutrients?.[key]?.id===id&&p.nutrients[key].unit===unit,'Invalid Canadian nutrient units or energy field.');}
  assert(Array.isArray(f.portions),'Missing source measures.');const ids=new Set();for(const measure of f.portions){assert(typeof measure.id==='string'&&!ids.has(measure.id)&&typeof measure.label==='string'&&measure.label,'Invalid source measure.');ids.add(measure.id);assert(typeof measure.grams==='number'&&Number.isFinite(measure.grams)&&measure.grams>0,'Invalid measure conversion.');if(p.version==='2026')assert(measure.measureTypeCode==='6','Refuse and yield measures cannot be logged as portions.');}
 }
 return f;
}
export function keepFoodReference(s,food){
 validateFood(food);assert(food.source==='Canadian Nutrient File','Expected a government food.');const previous=s.foods.find(f=>f.id===food.id),saved={...clone(food),...(previous?{createdAt:previous.createdAt}:{})};
 s.foods=s.foods.filter(f=>f.id!==food.id);s.foods.push(saved);return saved;
}
export function portionLabel(food,quantity,unit){
 if(unit.startsWith('measure:'))return `${quantity} × ${food.portions?.find(p=>p.id===unit.slice(8))?.label??'Source Measure'}`;
 return `${quantity} ${unit==='serving'?'servings':unit}`;
}
export function scale(profile,ratio){return Object.fromEntries(NUTRIENTS.map(k=>[k,profile[k]==null?null:profile[k]*ratio]));}
export function portion(food,quantity,unit){
 quantity=number(quantity,'Amount',{positive:true});let factor;
 if(unit==='serving')factor=quantity;
 else if(unit.startsWith('measure:')){const measure=food.portions?.find(p=>p.id===unit.slice(8));assert(measure&&food.grams>0,'No conversion is known for this measure.');factor=quantity*measure.grams/food.grams;}
 else if(unit===food.unit)factor=quantity/food.quantity;
 else if(unit==='g'&&food.grams!=null)factor=quantity/food.grams;
 else throw new Error('No conversion is known for this unit. Do not treat mL as grams.');
 return {quantity,unit,nutrition:scale(food.nutrition,factor)};
}
export function makeEntry(food,quantity,unit,d,time){
 date(d);assert(/^\d{2}:\d{2}$/.test(time)&&time<'24:00'&&time.slice(3)<'60','Choose a valid time.');
 return {...stamp(),date:d,time,foodId:food.id,name:food.name,source:food.source,snapshot:clone(food),...portion(food,quantity,unit)};
}
export function savePlannedEntry(s,entry,existingId=null){
 const copy=clone(entry);
 if(existingId){const prior=s.plannedEntries.find(x=>x.id===existingId);assert(prior,'Planned entry no longer exists.');copy.id=prior.id;copy.createdAt=prior.createdAt;}
 assert(!s.entries.some(x=>x.id===copy.id),'This item is already recorded as eaten.');
 s.plannedEntries=s.plannedEntries.filter(x=>x.id!==copy.id);s.plannedEntries.push(copy);return copy;
}
export function confirmPlannedEntry(s,plannedId,changes={},currentDate=today(s.settings.timezone)){
 const planned=s.plannedEntries.find(x=>x.id===plannedId);assert(planned,'This plan has already been recorded or removed.');
 const actualDate=date(changes.date??planned.date);assert(actualDate<=currentDate,'Future food cannot be marked eaten.');
 assert(!s.entries.some(x=>x.id===plannedId),'This plan is already recorded as eaten.');
 const actual=makeEntry(planned.snapshot,changes.quantity??planned.quantity,changes.unit??planned.unit,actualDate,changes.time??planned.time);
 actual.id=planned.id;actual.createdAt=planned.createdAt;actual.foodId=planned.foodId;
 actual.plannedAt=planned.createdAt;actual.plannedFor=planned.date;actual.recordedAt=new Date().toISOString();
 s.plannedEntries=s.plannedEntries.filter(x=>x.id!==plannedId);s.entries.push(actual);return actual;
}
export function totals(entries){return Object.fromEntries(NUTRIENTS.map(k=>[k,entries.length&&entries.some(e=>e.nutrition[k]==null)?null:entries.reduce((sum,e)=>sum+(e.nutrition[k]??0),0)]));}
export function dayStatus(s,d){return s.statuses.find(x=>x.date===d)?.status??'Complete';}
export function hasRecordedIntake(s,d){return s.entries.some(e=>e.date===d)||s.statuses.some(r=>r.date===d&&r.status==='Complete'&&r.zeroIntakeConfirmed===true);}
export function diaryReview(s,from,to){
 const days=dates(from,to).map(d=>{const intakeRecorded=hasRecordedIntake(s,d);return {date:d,status:dayStatus(s,d),intakeRecorded,weight:s.weights.find(w=>w.date===d)?.lb??null,totals:intakeRecorded?totals(s.entries.filter(e=>e.date===d)):Object.fromEntries(NUTRIENTS.map(k=>[k,null])),plan:clone(latest(s.plans,d))};});
 const complete=days.filter(d=>d.status==='Complete'&&d.intakeRecorded),counts=Object.fromEntries(['Complete','Untracked'].map(k=>[k,days.filter(d=>d.status===k).length]));
 const average=complete.length?Object.fromEntries(NUTRIENTS.map(k=>[k,complete.some(d=>d.totals[k]==null)?null:complete.reduce((a,d)=>a+d.totals[k],0)/complete.length])):null;
 return {from,to,days,counts,completeDates:complete.map(d=>d.date),denominator:complete.length,emptyCompletedDays:days.filter(d=>d.status==='Complete'&&!d.intakeRecorded).length,average};
}
function minuteDifference(a,b){const diff=a-b;return Math.abs(diff)<=Number.EPSILON*Math.max(1,Math.abs(a),Math.abs(b))*4?0:diff;}
export function cardioRolloverStart(s){return s.settings.cardioRolloverFrom??CARDIO_ROLLOVER_START;}
export function cardioTotal(s,d,{asOfDate=today(s.settings.timezone)}={}){
 date(d);date(asOfDate);
 const from=weekStart(d),rolloverFrom=cardioRolloverStart(s),currentWeek=weekStart(asOfDate),history=[];
 const performed=s.cardioSessions.filter(x=>x.completed&&x.date<=asOfDate);
 function budget(week,carriedIn){
  const to=addDays(week,6),cutoff=to<asOfDate?to:asOfDate,sessions=performed.filter(x=>x.date>=week&&x.date<=to),target=latest(s.cardioTargets,cutoff),minutes=sessions.reduce((a,x)=>a+x.minutes,0),creditedMinutes=minutes+carriedIn,enabled=week>=rolloverFrom;
  const balance=target?minuteDifference(creditedMinutes,target.weekly):null,remaining=target?Math.max(0,-balance):null;
  // Unset is not a zero target: retain an existing bank, but create no new surplus.
  const carryOut=enabled?(target?Math.max(0,balance):carriedIn):0;
  return {from:week,to,sessions,minutes,target,carriedIn,creditedMinutes,remaining,carryOut,rolloverEnabled:enabled};
 }
 let carry=0;
 if(from>=rolloverFrom){
  const end=from<currentWeek?from:currentWeek;
  for(let week=rolloverFrom;week<end;week=addDays(week,7)){
   const b=budget(week,carry);history.push(clone(b));carry=b.carryOut;
  }
 }
 // A future, still unopened week has no transferred credit from the open week.
 const result=budget(from,from<=currentWeek?carry:0);
 return {...result,rolloverVersion:'surplus-v1',rolloverFrom,asOfDate,rolloverHistory:history};
}
export function makeExercise(input,previous=null){
 const name=String(input.name??'').trim();assert(name,'Exercise name is required.');
 return {...stamp(),...(previous?{id:previous.id,createdAt:previous.createdAt}:{}),name,archived:previous?.archived??false,updatedAt:new Date().toISOString()};
}
export function saveExercise(s,input,exerciseId=null){
 const previous=exerciseId?s.exercises.find(x=>x.id===exerciseId):null;assert(!exerciseId||previous,'Exercise no longer exists.');
 const exercise=makeExercise(input,previous);assert(!s.exercises.some(x=>x.id!==exercise.id&&!x.archived&&x.name.toLowerCase()===exercise.name.toLowerCase()),'An active exercise already has that name.');
 s.exercises=s.exercises.filter(x=>x.id!==exercise.id);s.exercises.push(exercise);return exercise;
}
export function saveTrainingSplit(s,effective,days){
 date(effective);assert(Array.isArray(days),'Choose workout days.');
 const prepared=days.map(day=>{
  assert(typeof day.title==='string'&&day.title.trim(),'Every workout needs a title.');assert(Number.isInteger(day.weekday)&&day.weekday>=0&&day.weekday<=6,'Choose a valid weekday.');
  const ids=(day.exercises??[]).map(x=>typeof x==='string'?x:x.id);assert(new Set(ids).size===ids.length,'An exercise is listed twice in this workout.');
  const exercises=ids.map(id=>{const exercise=s.exercises.find(e=>e.id===id);assert(exercise,'An assigned exercise no longer exists.');const assigned=latest(s.trainingSchedules,effective)?.days.find(x=>x.id===day.id)?.exercises?.some(x=>x.id===id);assert(!exercise.archived||assigned,'Restore an archived exercise before assigning it to a new workout.');return {id:exercise.id,name:exercise.name};});
  return {id:day.id||id(),weekday:day.weekday,title:day.title.trim(),exercises};
 });
 assert(new Set(prepared.map(x=>x.id)).size===prepared.length,'Duplicate workout identity.');
 const schedule={...stamp(),effective,days:prepared};s.trainingSchedules.push(schedule);return schedule;
}
function workoutIdentity(t){return t.workoutId??t.key.split(':')[1];}
export function trainingWeek(s,d,currentDate=today(s.settings.timezone)){
 const from=weekStart(d),to=addDays(from,6),out=[];
 const reference=t=>!t.completed&&t.date>=currentDate&&t.exercises?.length?{...t,exercises:t.exercises.map(e=>({id:e.id,name:s.exercises.find(x=>x.id===e.id)?.name??e.name}))}:t;
 for(const day of dates(from,to)){
  const schedule=latest(s.trainingSchedules,day),weekday=new Date(day+'T12:00:00Z').getUTCDay();
  for(const item of schedule?.days??[]){
   if(item.weekday!==weekday)continue;
   const key=`${schedule.id}:${item.id}:${day}`;
   const saved=s.trainingOccurrences.find(x=>x.key===key||x.originalDate===day&&workoutIdentity(x)===item.id);
   const exercises=(item.exercises??[]).map(e=>({id:e.id,name:day>=currentDate?(s.exercises.find(x=>x.id===e.id)?.name??e.name):e.name}));
   out.push(saved?reference(saved):{id:key,key,date:day,originalDate:day,title:item.title,scheduleId:schedule.id,workoutId:item.id,exercises,completed:false});
  }
 }
 // A moved occurrence is still one occurrence, even when its destination is a rest day.
 for(const saved of s.trainingOccurrences.filter(x=>x.originalDate>=from&&x.originalDate<=to)){
  if(!out.some(x=>x.key===saved.key)){
   // A schedule edit must not erase an already recorded occurrence/title.
   out.push(reference(saved));
  }
 }
 return out.filter((t,i,a)=>a.findIndex(x=>x.key===t.key)===i).sort((a,b)=>a.date.localeCompare(b.date));
}
export function markTraining(s,occurrenceKey,completed,currentDate=today(s.settings.timezone)){
 const matching=s.trainingOccurrences.find(x=>x.key===occurrenceKey),day=matching?.originalDate??occurrenceKey.split(':').at(-1);date(day);
 const occurrence=trainingWeek(s,day,currentDate).find(x=>x.key===occurrenceKey);assert(occurrence,'Workout no longer exists.');assert(occurrence.date<=currentDate,'Future workouts remain planned.');
 s.trainingOccurrences=s.trainingOccurrences.filter(x=>x.key!==occurrence.key);s.trainingOccurrences.push({...occurrence,...stamp(),completed:!!completed});
}
export function reconcileCredits(s,sessionId){const session=s.cardioSessions.find(x=>x.id===sessionId),credits=s.cardioCredits.filter(x=>x.sessionId===sessionId);let available=session?.completed?session.minutes:0;for(const c of credits){c.minutes=Math.min(c.minutes,available);available-=c.minutes;}s.cardioCredits=s.cardioCredits.filter(x=>x.minutes>0);}
export function buildCheckin(s,d){
 assert(weekStart(d)===d,'Choose a Sunday check-in date.');
 const previous=s.checkins.filter(x=>x.date===addDays(d,-7)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)).at(-1);
 const current=medianWindow(s.weights,d),prior=previous?.weight??medianWindow(s.weights,addDays(d,-7)),review=diaryReview(s,addDays(d,-7),addDays(d,-1));
 const cardio=cardioTotal(s,addDays(d,-1)),training=trainingWeek(s,addDays(d,-1)),stepTotals=s.stepTotals.filter(x=>x.date>=review.from&&x.date<=review.to),stepTargets=dates(review.from,review.to).map(date=>({date,target:clone(latest(s.stepTargets,date))}));
 const nextTarget=latest(s.cardioTargets,d),nextBudget=cardioTotal(s,d,{asOfDate:d});
 return {...stamp(),date:d,calculationVersion:'chris-v2-day-status',weight:current,previousWeight:clone(prior),change:change(prior.value,current.value),phase:clone(latest(s.phases,d)),review,reviewedPlans:dates(review.from,review.to).map(date=>({date,plan:clone(latest(s.plans,date))})),cardio:{...clone(cardio),targetVersions:clone(s.cardioTargets.filter(x=>x.effective<=review.to)),credits:clone(s.cardioCredits.filter(x=>x.date>=review.from&&x.date<=review.to))},training:clone(training),trainingSchedules:clone(s.trainingSchedules.filter(x=>x.effective<=review.to)),stepTargets,stepTotals:clone(stepTotals),nextPlan:clone(latest(s.plans.filter(p=>p.effective>=d),d)),nextCardio:clone(nextTarget),nextCardioRollover:{carriedIn:nextBudget.carriedIn,remainingAfterCredit:nextTarget?Math.max(0,-minuteDifference(nextBudget.carriedIn,nextTarget.weekly)):null,rolloverFrom:nextBudget.rolloverFrom},nextSteps:clone(latest(s.stepTargets,d))};
}
export function checkinText(c){
 const fmt=v=>v==null?'Unavailable':String(Math.round(v*100)/100),macro=p=>p?`${fmt(p.calories)} kcal; ${fmt(p.protein)} P (${p.band.join('–')} g band), ${fmt(p.carbs)} C, ${fmt(p.fat)} F`:'Unset';
 const med=w=>`${w.from}–${w.to}: ${fmt(w.value)} lb (${w.count}/7${w.count<7?', incomplete':''})`;
 const goal=p=>p?`${fmt(p.goal.value)} ${p.goal.unit}/week`:'Unset';
 const lines=[`CHECK-IN ${c.date} · ${c.phase?.phase??'Phase unset'}`,`This week median: ${med(c.weight)}`,`Previous week median: ${med(c.previousWeight)}`,`Change (this week minus previous): ${weightChangeText(c.previousWeight.value,c.weight.value)}${c.change?`; ${fmt(Math.abs(c.change.percent))}% ${c.change.loss>0?'loss':c.change.loss<0?'gain':'no change'}`:''}`,`Reviewed diary week: ${c.review.from}–${c.review.to}`,c.calculationVersion==='chris-v1'?`Coverage: ${c.review.counts.Complete} Complete / ${c.review.counts.Unfinished} Unfinished / ${c.review.counts.Untracked} Untracked (of 7)`:`Coverage: ${c.review.counts.Complete} Completed / ${c.review.counts.Untracked} Untracked (of 7); ${c.review.emptyCompletedDays} empty Completed days excluded from averages`,`Average on ${c.review.denominator} ${c.calculationVersion==='chris-v1'?'Complete days':'Completed days with recorded intake'} [${c.review.completeDates.join(', ')}]: ${c.review.average?`${fmt(c.review.average.calories)} kcal; ${fmt(c.review.average.protein)} P, ${fmt(c.review.average.carbs)} C, ${fmt(c.review.average.fat)} F`:'Unavailable'}`,'Incomplete coverage cannot establish full-week intake.','REVIEWED TARGETS & GOALS'];
 for(const x of c.reviewedPlans)lines.push(`${x.date}: ${macro(x.plan)} · intended loss ${goal(x.plan)} · effective ${x.plan?.effective??'unset'}`);
 lines.push('DAILY BREAKDOWN');for(const d of c.review.days)lines.push(`${d.date} · ${fmt(d.weight)} lb · ${d.status==='Complete'&&c.calculationVersion!=='chris-v1'?'Completed':d.status} · ${d.intakeRecorded===false?'no intake logged':d.status==='Untracked'?'intake unknown':`${d.status==='Unfinished'?'partial ':''}${fmt(d.totals.calories)} kcal; ${fmt(d.totals.protein)} P, ${fmt(d.totals.carbs)} C, ${fmt(d.totals.fat)} F`}`);
 lines.push(`Training: ${c.training.filter(t=>t.completed).length}/${c.training.length} marked complete`);for(const t of c.training){lines.push(`${t.date} ${t.title}: ${t.completed?'Complete':'Not marked complete'}`);if(t.exercises?.length)lines.push('Exercises: '+t.exercises.map(e=>e.name).join(', '));}
 if(c.cardio.rolloverVersion){lines.push(`Cardio performed: ${fmt(c.cardio.minutes)} min; ${c.cardio.sessions.length} sessions; ${c.cardio.target?.category??'category unset'}`,`Cardio credit: ${fmt(c.cardio.carriedIn)} min carried in; ${fmt(c.cardio.creditedMinutes)} / ${fmt(c.cardio.target?.weekly)} min credited; ${fmt(c.cardio.remaining)} min remaining; ${fmt(c.cardio.carryOut)} min carry forward. Carried credit is not another performed session.`);}
 else lines.push(`Cardio: ${fmt(c.cardio.minutes)} / ${fmt(c.cardio.target?.weekly)} min; ${c.cardio.sessions.length} sessions; ${c.cardio.target?.category??'category unset'}; ${c.cardio.target?fmt(Math.abs(c.cardio.target.weekly-c.cardio.minutes))+(c.cardio.minutes>c.cardio.target.weekly?' extra':' remaining'):'target unset'}`);
 for(const v of c.cardio.targetVersions)lines.push(`Cardio target effective ${v.effective}: ${fmt(v.weekly)} min/week; ${v.category}`);
 for(const t of c.stepTargets)lines.push(`Step target ${t.date}: ${fmt(t.target?.target)} (effective ${t.target?.effective??'unset'})`);
 if(c.stepTotals.length){lines.push('Manual step totals:');for(const t of c.stepTotals)lines.push(`${t.date}: ${t.total}`);lines.push(`Average steps on ${c.stepTotals.length} available completed dates [${c.stepTotals.map(t=>t.date).join(', ')}]: ${fmt(c.stepTotals.reduce((a,t)=>a+t.total,0)/c.stepTotals.length)}`);}
 lines.push('NEXT SAVED PLAN',c.nextPlan?`${macro(c.nextPlan)} · goal ${goal(c.nextPlan)} · effective ${c.nextPlan.effective}`:'Next plan not yet set',`Next cardio: ${c.nextCardio?`${fmt(c.nextCardio.weekly)} min/week (${fmt(c.nextCardio.daily)} min/day × ${c.nextCardio.days}), ${c.nextCardio.category}, effective ${c.nextCardio.effective}`:'Unset'}`);
 if(c.nextCardioRollover)lines.push(`Next cardio credit: ${fmt(c.nextCardioRollover.carriedIn)} min carried in; ${fmt(c.nextCardioRollover.remainingAfterCredit)} min target left before new sessions. Rollover starts ${c.nextCardioRollover.rolloverFrom}.`);
 lines.push(`Next daily step target: ${fmt(c.nextSteps?.target)} · effective ${c.nextSteps?.effective??'unset'}`);return lines.join('\n');
}

// Strict validation runs before every write and before any restore transaction.
export function validate(s){
 assert(s&&typeof s==='object'&&!Array.isArray(s),'Invalid backup.');assert(s.schemaVersion===VERSION,'Unsupported backup version. Your current records have not changed.');
 const requiredDates=new Set(['entries','plannedEntries','weights','statuses','checkins','cardioSessions','cardioCredits','trainingOccurrences','stepTotals']);
 const requiredEffective=new Set(['plans','phases','cardioTargets','trainingSchedules','stepTargets']);
 const allowed=new Set(['schemaVersion','revision','settings',...TABLES]);assert(Object.keys(s).every(k=>allowed.has(k)),'Backup has unsupported fields; nothing was imported.');
 assert(Number.isInteger(s.revision)&&s.revision>=0,'Invalid revision.');assert(s.settings&&typeof s.settings==='object','Missing settings.');assert(typeof s.settings.timezone==='string'&&s.settings.timezone,'Missing timezone.');assert(s.settings.lastExport===null||typeof s.settings.lastExport==='string'&&Number.isFinite(Date.parse(s.settings.lastExport)),'Invalid backup date.');
 try{new Intl.DateTimeFormat('en',{timeZone:s.settings.timezone}).format();}catch{throw new Error('Invalid timezone.');}
 assert(['lb','kg'].includes(s.settings.weightUnit),'Invalid weight unit.');
 if(s.settings.cardioRolloverFrom!==undefined){date(s.settings.cardioRolloverFrom);assert(weekStart(s.settings.cardioRolloverFrom)===s.settings.cardioRolloverFrom,'Cardio rollover must start on a Sunday.');}
 const checkNum=(v,label,positive=false)=>{assert(typeof v==='number'&&Number.isFinite(v)&&(positive?v>0:v>=0),`Invalid ${label}.`);};
 const checkNutrition=n=>{assert(n&&typeof n==='object','Missing nutrition.');for(const k of NUTRIENTS){if(!REQUIRED.includes(k)&&n[k]==null)continue;checkNum(n[k],k);}};
 for(const t of TABLES){assert(Array.isArray(s[t]),`Missing ${t}.`);const seen=new Set();for(const r of s[t]){assert(r&&typeof r.id==='string'&&r.id&&!seen.has(r.id),`Invalid or duplicate ${t} ID.`);seen.add(r.id);assert(typeof r.createdAt==='string'&&Number.isFinite(Date.parse(r.createdAt)),`Invalid ${t} timestamp.`);if('date'in r||requiredDates.has(t))date(r.date);if('effective'in r||requiredEffective.has(t))date(r.effective);}}
 for(const f of s.foods)validateFood(f);

 const recordedIds=new Set(s.entries.map(x=>x.id));
 for(const e of s.plannedEntries)assert(!recordedIds.has(e.id),'A food entry cannot be both planned and recorded.');
 for(const e of [...s.entries,...s.plannedEntries]){assert(typeof e.name==='string'&&e.name.trim(),'Invalid entry name.');assert(/^([01]\d|2[0-3]):[0-5]\d$/.test(e.time),'Invalid entry time.');checkNum(e.quantity,'entry quantity',true);checkNutrition(e.nutrition);assert(e.snapshot&&typeof e.snapshot.name==='string','Missing historical food snapshot.');checkNutrition(e.snapshot.nutrition);validateFood(e.snapshot);const expected=portion(e.snapshot,e.quantity,e.unit);for(const k of NUTRIENTS)assert(expected.nutrition[k]===e.nutrition[k]||Math.abs(expected.nutrition[k]-e.nutrition[k])<1e-9,'Entry nutrition does not match its snapshot.');}
 const unique=(rows,key,label)=>{const keys=rows.map(key);assert(new Set(keys).size===keys.length,`Duplicate ${label}.`);};
 unique(s.weights,x=>x.date,'weight date');for(const w of s.weights)checkNum(w.lb,'weight',true);
 unique(s.statuses,x=>x.date,'diary status date');for(const r of s.statuses)assert(['Complete','Untracked'].includes(r.status),'Invalid diary status.');for(const r of s.statuses)if(r.zeroIntakeConfirmed!==undefined)assert(typeof r.zeroIntakeConfirmed==='boolean','Invalid zero intake confirmation.');
 for(const p of s.plans){const expected=calculateTargets(p.calories,p.reference,p.overrides);for(const k of ['protein','fat','carbs','macroCalories'])assert(expected[k]===p[k],'Invalid saved macro calculation.');assert(JSON.stringify(expected.band)===JSON.stringify(p.band),'Invalid protein band.');checkNum(p.goal.value,'goal');assert(['lb','%'].includes(p.goal.unit),'Invalid authoritative goal unit.');assert(p.formula==='chris-v1-half-up','Unsupported target formula.');}
 for(const p of s.phases)assert(['Cut','Maintenance','Gain'].includes(p.phase),'Invalid phase.');
 for(const c of s.cardioTargets){checkNum(c.weekly,'weekly minutes');checkNum(c.days,'cardio days',true);assert(Number.isInteger(c.days)&&c.days<=7,'Cardio days must be 1–7.');checkNum(c.daily,'daily minutes');assert(Math.abs(c.daily*c.days-c.weekly)<1e-8,'Linked cardio values disagree.');assert(['daily','weekly'].includes(c.authority),'Missing cardio authority.');}
 for(const x of s.cardioSessions){checkNum(x.minutes,'cardio minutes',true);assert(typeof x.completed==='boolean','Invalid performed flag.');}
 unique(s.cardioCredits,x=>x.sessionId+':'+x.date,'cardio credit');
 for(const c of s.cardioCredits){checkNum(c.minutes,'credited minutes',true);const session=s.cardioSessions.find(x=>x.id===c.sessionId);assert(session?.completed&&weekStart(session.date)===weekStart(c.date),'Credit must reference a performed session in the same week.');}
 for(const x of s.cardioSessions)assert(s.cardioCredits.filter(c=>c.sessionId===x.id).reduce((a,c)=>a+c.minutes,0)<=x.minutes+1e-9,'Credits exceed performed minutes.');
 const checkExercises=items=>{assert(Array.isArray(items),'Invalid assigned exercises.');unique(items,x=>x.id,'assigned exercise');for(const e of items)assert(typeof e.id==='string'&&e.id&&typeof e.name==='string'&&e.name.trim(),'Invalid exercise snapshot.');};
 for(const e of s.exercises)assert(typeof e.name==='string'&&e.name.trim()&&typeof e.archived==='boolean','Invalid exercise library record.');
 for(const schedule of s.trainingSchedules){assert(Array.isArray(schedule.days),'Missing split days.');unique(schedule.days,x=>x.id,'workout ID');for(const d of schedule.days){assert(Number.isInteger(d.weekday)&&d.weekday>=0&&d.weekday<=6&&typeof d.title==='string'&&d.title.trim(),'Invalid training day.');if(d.exercises!==undefined)checkExercises(d.exercises);}}
 unique(s.trainingOccurrences,x=>x.key,'training occurrence');for(const t of s.trainingOccurrences){assert(typeof t.key==='string'&&t.key&&typeof t.title==='string'&&t.title.trim()&&typeof t.completed==='boolean','Invalid workout.');date(t.originalDate);assert(weekStart(t.date)===weekStart(t.originalDate),'Move workouts within the same week.');assert(s.trainingSchedules.some(x=>x.id===t.scheduleId),'Missing historical training schedule.');if(t.exercises!==undefined)checkExercises(t.exercises);}
 for(const t of s.stepTargets)checkNum(t.target,'step target');unique(s.stepTotals,x=>x.date,'step total date');for(const t of s.stepTotals)assert(Number.isInteger(t.total)&&t.total>=0,'Invalid step total.');
 unique(s.favourites,x=>x.foodId,'favourite');for(const f of s.favourites)assert(s.foods.some(x=>x.id===f.foodId),'Favourite food is missing.');
 for(const c of s.checkins){
  assert(['chris-v1','chris-v2-day-status'].includes(c.calculationVersion)&&weekStart(c.date)===c.date,'Invalid Sunday snapshot version/date.');
  const window=w=>{assert(w&&Array.isArray(w.weights),'Missing saved weight window.');date(w.from);date(w.to);assert(w.from===addDays(w.to,-6),'Invalid saved window dates.');assert(w.count===w.weights.length&&Number.isInteger(w.count)&&w.count>=0&&w.count<=7,'Invalid saved weigh-in count.');unique(w.weights,x=>x.date,'saved weight date');for(const x of w.weights){date(x.date);checkNum(x.lb,'saved weight',true);assert(x.date>=w.from&&x.date<=w.to,'Weight outside saved window.');}assert(medianWindow(w.weights,w.to).value===w.value,'Invalid saved median.');};
  window(c.weight);window(c.previousWeight);assert(c.weight.to===c.date&&c.previousWeight.to===addDays(c.date,-7),'Invalid comparison dates.');
  assert(c.review&&Array.isArray(c.review.days)&&c.review.days.length===7&&Array.isArray(c.review.completeDates),'Missing saved diary review.');assert(c.review.from===addDays(c.date,-7)&&c.review.to===addDays(c.date,-1),'Invalid diary review dates.');
  const legacy=c.calculationVersion==='chris-v1',statuses=legacy?['Complete','Unfinished','Untracked']:['Complete','Untracked'];
  assert(c.review.days.every((x,i)=>x.date===addDays(c.review.from,i)&&statuses.includes(x.status)),'Invalid saved daily breakdown.');
  for(const day of c.review.days){if(!legacy){assert(typeof day.intakeRecorded==='boolean','Missing saved intake availability.');if(!day.intakeRecorded){assert(NUTRIENTS.every(k=>day.totals[k]===null),'Empty intake cannot be stored as zero.');continue;}}checkNutrition(day.totals);}
  for(const status of statuses)assert(c.review.counts?.[status]===c.review.days.filter(x=>x.status===status).length,'Invalid saved coverage.');
  const completed=c.review.days.filter(x=>x.status==='Complete'&&(legacy||x.intakeRecorded));
  if(!legacy)assert(c.review.emptyCompletedDays===c.review.days.filter(x=>x.status==='Complete'&&!x.intakeRecorded).length,'Invalid empty-day count.');
  assert(c.review.denominator===completed.length&&JSON.stringify(c.review.completeDates)===JSON.stringify(completed.map(x=>x.date)),'Invalid average denominator.');
  if(c.review.denominator===0)assert(c.review.average===null,'Averages must be unavailable without recorded Completed days.');
  else {assert(c.review.average,'Missing saved averages.');for(const k of NUTRIENTS){const expected=completed.some(x=>x.totals[k]==null)?null:completed.reduce((a,x)=>a+x.totals[k],0)/completed.length;assert(c.review.average[k]===expected,'Invalid saved intake average.');}}
  assert(JSON.stringify(c.change)===JSON.stringify(change(c.previousWeight.value,c.weight.value)),'Invalid saved weight comparison.');
  assert(Array.isArray(c.reviewedPlans)&&Array.isArray(c.training)&&Array.isArray(c.stepTargets)&&Array.isArray(c.stepTotals)&&c.cardio&&Array.isArray(c.cardio.sessions)&&Array.isArray(c.cardio.targetVersions),'Incomplete saved activity/plan snapshot.');
  if(c.cardio.rolloverVersion!==undefined){
   const b=c.cardio;assert(b.rolloverVersion==='surplus-v1','Unsupported cardio rollover calculation.');date(b.rolloverFrom);date(b.asOfDate);assert(weekStart(b.rolloverFrom)===b.rolloverFrom,'Invalid rollover start.');assert(Array.isArray(b.rolloverHistory),'Missing saved rollover history.');
   let incoming=0,expectedWeek=b.rolloverFrom;
   for(const w of [...b.rolloverHistory,b]){
    date(w.from);date(w.to);assert(weekStart(w.from)===w.from&&w.to===addDays(w.from,6),'Invalid saved cardio week.');
    if(w!==b){assert(w.from===expectedWeek&&w.to<b.from&&w.to<b.asOfDate,'Invalid closed-week rollover history.');expectedWeek=addDays(w.from,7);}
    checkNum(w.minutes,'performed minutes');checkNum(w.carriedIn,'carried minutes');checkNum(w.creditedMinutes,'credited minutes');checkNum(w.carryOut,'outgoing minutes');
    assert(w.carriedIn===(w.from>=b.rolloverFrom?incoming:0),'Invalid incoming cardio credit.');
    assert(Array.isArray(w.sessions)&&w.sessions.every(x=>x.completed&&x.date>=w.from&&x.date<=w.to&&x.date<=b.asOfDate),'Invalid source cardio sessions.');
    assert(w.minutes===w.sessions.reduce((a,x)=>a+x.minutes,0)&&w.creditedMinutes===w.minutes+w.carriedIn,'Cardio credit is not unique performed minutes plus incoming credit.');
    const balance=w.target?minuteDifference(w.creditedMinutes,w.target.weekly):null;
    assert(w.remaining===(w.target?Math.max(0,-balance):null),'Invalid saved cardio remaining minutes.');
    assert(w.rolloverEnabled===(w.from>=b.rolloverFrom),'Invalid rollover policy.');
    assert(w.carryOut===(w.rolloverEnabled?(w.target?Math.max(0,balance):w.carriedIn):0),'Invalid saved outgoing cardio credit.');incoming=w.carryOut;
   }
   if(b.from>=b.rolloverFrom)assert(expectedWeek===b.from,'Incomplete saved rollover history.');
  }
  if(c.nextCardioRollover){
   const next=c.nextCardioRollover;checkNum(next.carriedIn,'next carried minutes');date(next.rolloverFrom);assert(weekStart(next.rolloverFrom)===next.rolloverFrom,'Invalid next rollover start.');
   assert(next.remainingAfterCredit===(c.nextCardio?Math.max(0,-minuteDifference(next.carriedIn,c.nextCardio.weekly)):null),'Invalid next-week remaining minutes.');
   if(c.cardio.rolloverVersion&&c.cardio.asOfDate>=c.date)assert(next.carriedIn===c.cardio.carryOut,'Next-week credit does not match the closed review week.');
  }
  const nested=emptyStore();nested.plans=[...c.reviewedPlans.map(x=>x.plan).filter(Boolean),...(c.nextPlan?[c.nextPlan]:[])].filter((p,i,a)=>a.findIndex(x=>x.id===p.id)===i);nested.cardioSessions=[...(c.cardio.rolloverHistory??[]).flatMap(w=>w.sessions),...c.cardio.sessions];nested.cardioCredits=c.cardio.credits??[];nested.cardioTargets=c.cardio.targetVersions;nested.stepTotals=c.stepTotals;nested.trainingSchedules=c.trainingSchedules??[];nested.trainingOccurrences=c.training.map(t=>({...t,createdAt:t.createdAt??c.createdAt}));
  validate(nested);
  assert(c.cardio.minutes===c.cardio.sessions.filter(x=>x.completed).reduce((a,x)=>a+x.minutes,0),'Invalid saved cardio minutes.');
 }

 for(const x of s.exportedSnapshots)assert(typeof x.text==='string'&&s.checkins.some(c=>c.id===x.checkinId),'Missing exported check-in.');
 return s;
}
export function parseBackup(text){assert(typeof text==='string','Choose a JSON backup file.');let s;try{s=JSON.parse(text);}catch{throw new Error('This file is not valid JSON. Nothing was imported.');}return migrateStore(s);}
export function mergeStores(current,incoming){
 validate(incoming);const out=clone(current);for(const t of TABLES)for(const row of incoming[t]){const old=out[t].find(x=>x.id===row.id);if(old){assert(JSON.stringify(old)===JSON.stringify(row),`Merge conflict in ${t}. Nothing changed. Use Replace after exporting your current data, or resolve this record in the source backup.`);}else out[t].push(clone(row));}
 // Settings are retained during additive merge, explicitly disclosed by the UI.
 return validate(out);
}
