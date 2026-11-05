import * as D from '../../app/domain.mjs';

// Synthetic records only. Used by the presentation audit, never loaded by the app.
export function presentationStore(date='2026-11-04'){
 const s=D.emptyStore(),start=D.weekStart(date);
 s.settings.lastExport=date+'T12:00:00Z';
 const foods=[['Greek yogurt',170,18,10,5,170],['Rolled oats',156,5,27,3,40],['Chicken & rice',620,48,75,14,350],['Whey isolate',120,27,2,1,30]];
 for(const [i,[name,calories,protein,carbs,fat,quantity]] of foods.entries()){
  const food=D.makeFood({name,calories,protein,carbs,fat,quantity,unit:'g'});s.foods.push(food);
  s.entries.push(D.makeEntry(food,quantity,'g',date,['08:00','08:00','12:30','16:00'][i]));
 }
 for(let i=0;i<28;i++)s.weights.push({...D.stamp(),date:D.addDays(date,-i),lb:184+i*.14+Math.sin(i)*.4});
 s.plans.push({...D.stamp(),effective:D.addDays(start,-21),...D.calculateTargets(2400,187),goal:{value:1,unit:'lb'},referenceWindow:D.medianWindow(s.weights,start)});
 s.phases.push({...D.stamp(),effective:start,phase:'Cut'});
 D.saveWeightGoal(s,{effective:start,referenceWeight:187,referenceSunday:start,targetWeight:175,targetSunday:D.addDays(start,84)});
 const exercises=['Incline Dumbbell Press','Cable Fly','Lat Pulldown','Chest Supported Row','Lateral Raise','Squat','Romanian Deadlift'].map(name=>D.saveExercise(s,{name}));
 D.saveTrainingSplit(s,D.addDays(start,-7),[
  {id:'upper-a',weekday:1,title:'Upper body A',exercises:exercises.slice(0,3).map(e=>({id:e.id,sets:3}))},
  {id:'lower-a',weekday:2,title:'Lower body A',exercises:exercises.slice(5).map(e=>({id:e.id,sets:3}))},
  {id:'upper-b',weekday:4,title:'Upper body B',exercises:exercises.slice(2,5).map(e=>({id:e.id,sets:3}))},
  {id:'lower-b',weekday:5,title:'Lower body B',exercises:exercises.slice(5).map(e=>({id:e.id,sets:3}))}
 ]);
 s.cardioTargets.push({...D.stamp(),effective:start,weekly:140,daily:20,days:7,authority:'weekly',category:'Zone 2'});
 for(const [day,minutes]of[[1,25],[2,20],[3,30]])D.setCardioDayTotal(s,D.addDays(start,day),minutes,date);
 s.stepTargets.push({...D.stamp(),effective:start,target:10000});
 return D.validate(s);
}
