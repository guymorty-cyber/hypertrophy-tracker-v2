export const DEFAULT_PROGRAMME=[
{id:'upper-a',name:'Upper A',exercises:[['Incline DB Press',3,6,10,2.5],['Chest-Supported T-Bar Row',4,6,10,2.5],['Flat DB Press',3,8,12,2.5],['Cable Row',3,8,12,2.5],['Cable Fly',3,10,15,2.5],['Bayesian Cable Curl',3,8,12,2.5],['Overhead Cable Triceps Extension',3,10,15,2.5]]},
{id:'lower-a',name:'Lower A',exercises:[['RDL',3,6,10,5],['Hip Thrust',4,8,12,5],['Leg Curl',4,8,12,2.5],['Leg Press',2,8,12,5],['Abs',3,10,15,2.5]]},
{id:'upper-b',name:'Upper B',exercises:[['DB Shoulder Press',3,6,10,2.5],['Chest-Supported T-Bar Row',3,8,12,2.5],['Incline DB Press',3,8,12,2.5],['Cable Row',3,8,12,2.5],['Cable Lateral Raise',3,10,15,2.5],['DB Curl',3,8,12,2.5],['Cable Triceps Extension',3,10,15,2.5]]},
{id:'lower-b',name:'Lower B',exercises:[['RDL',3,6,10,5],['Hip Thrust',3,8,12,5],['Leg Curl',4,8,12,2.5],['Pendulum Squat',3,8,12,5],['Abs',3,10,15,2.5]]}
];

export function cloneProgramme(p=DEFAULT_PROGRAMME){return JSON.parse(JSON.stringify(p));}
export function exerciseFromTuple(t){return {name:t[0],sets:t[1],min:t[2],max:t[3],increment:t[4]};}
export function dayExercises(day){return day.exercises.map(exerciseFromTuple);}
