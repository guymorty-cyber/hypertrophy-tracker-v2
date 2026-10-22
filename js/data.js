/* ============================= DATA ============================= */
const STORAGE_KEY = 'htData_v1';
const APP_BUILD = '__BUILD_SHA__';

const PROGRAM_TEMPLATE = [
 {id:'d1',name:'Upper A',short:'Upper A',type:'training',isLower:false,exercises:[
   {id:'d1e1',name:'Incline Dumbbell Press',sets:3,repMin:6,repMax:10,restSec:150,cat:'heavy',inc:2.5},
   {id:'d1e2',name:'Chest-Supported T-Bar Row',sets:4,repMin:6,repMax:10,restSec:150,cat:'heavy',inc:5,alts:['Pendlay Row','Cable Row']},
   {id:'d1e3',name:'Flat Dumbbell Press',sets:3,repMin:8,repMax:12,restSec:105,cat:'moderate',inc:2.5},
   {id:'d1e4',name:'Cable Row',sets:3,repMin:8,repMax:12,restSec:105,cat:'moderate',inc:2.5,alts:['Chest-Supported T-Bar Row','Pendlay Row']},
   {id:'d1e5',name:'Cable Fly',sets:3,repMin:10,repMax:15,restSec:60,cat:'isolation',inc:2,finalPartials:true},
   {id:'d1e6',name:'Bayesian Cable Curl',sets:3,repMin:8,repMax:12,restSec:60,cat:'isolation',inc:1.5,finalPartials:true},
   {id:'d1e7',name:'Overhead Cable Triceps Extension',sets:3,repMin:10,repMax:15,restSec:60,cat:'isolation',inc:1.5,finalPartials:true}
 ]},
 {id:'d2',name:'Lower A',short:'Lower A',type:'training',isLower:true,exercises:[
   {id:'d2e1',name:'Romanian Deadlift',sets:3,repMin:6,repMax:10,restSec:150,cat:'heavy',inc:5,alts:['Smith RDL','Dumbbell RDL']},
   {id:'d2e2',name:'Hip Thrust Machine / Smith Hip Thrust',sets:4,repMin:8,repMax:12,restSec:120,cat:'moderate',inc:5},
   {id:'d2e3',name:'Leg Curl',sets:4,repMin:8,repMax:12,restSec:60,cat:'isolation',inc:2,finalPartials:true},
   {id:'d2e4',name:'Leg Press',sets:2,repMin:8,repMax:12,restSec:105,cat:'moderate',inc:5,note:'Use controlled, knee-friendly depth.'},
   {id:'d2e5',name:'Bulgarian Split Squat / Controlled Step-Up',sets:2,repMin:8,repMax:12,restSec:105,cat:'moderate',inc:2,perLeg:true,note:'Use pain-free range of motion.'},
   {id:'d2e6',name:'Cable/DB Hip-Dominant Glute Movement',sets:2,repMin:10,repMax:15,restSec:60,cat:'isolation',inc:2}
 ]},
 {id:'d3',name:'Push',short:'Push',type:'training',isLower:false,exercises:[
   {id:'d3e1',name:'Dumbbell Shoulder Press',sets:3,repMin:6,repMax:10,restSec:150,cat:'heavy',inc:2.5},
   {id:'d3e2',name:'Incline Dumbbell Press',sets:3,repMin:8,repMax:12,restSec:105,cat:'moderate',inc:2.5},
   {id:'d3e3',name:'Cable Fly',sets:3,repMin:10,repMax:15,restSec:60,cat:'isolation',inc:2,finalPartials:true},
   {id:'d3e4',name:'Cable Lateral Raise',sets:3,repMin:10,repMax:15,restSec:60,cat:'isolation',inc:1.5,finalPartials:true},
   {id:'d3e5',name:'Dumbbell Lateral Raise',sets:3,repMin:12,repMax:20,restSec:60,cat:'isolation',inc:1},
   {id:'d3e6',name:'Overhead Cable Triceps Extension',sets:3,repMin:10,repMax:15,restSec:60,cat:'isolation',inc:1.5,finalPartials:true},
   {id:'d3e7',name:'Cable Pressdown',sets:3,repMin:10,repMax:15,restSec:60,cat:'isolation',inc:2}
 ]},
 {id:'d4',name:'Pull',short:'Pull',type:'training',isLower:false,exercises:[
   {id:'d4e1',name:'Lat Pulldown / Pull-Up',sets:4,repMin:6,repMax:10,restSec:150,cat:'heavy',inc:2.5},
   {id:'d4e2',name:'Chest-Supported T-Bar Row',sets:3,repMin:8,repMax:12,restSec:105,cat:'moderate',inc:5,alts:['Pendlay Row','Cable Row']},
   {id:'d4e3',name:'Cable Row',sets:3,repMin:10,repMax:15,restSec:105,cat:'moderate',inc:2.5,alts:['Chest-Supported T-Bar Row','Pendlay Row']},
   {id:'d4e4',name:'Straight-Arm Cable Pulldown',sets:2,repMin:10,repMax:15,restSec:60,cat:'isolation',inc:2},
   {id:'d4e5',name:'Cable Lateral Raise',sets:2,repMin:12,repMax:20,restSec:60,cat:'isolation',inc:1.5},
   {id:'d4e6',name:'Incline Dumbbell Curl',sets:3,repMin:8,repMax:12,restSec:60,cat:'isolation',inc:1.5},
   {id:'d4e7',name:'Cable Curl',sets:3,repMin:10,repMax:15,restSec:60,cat:'isolation',inc:1.5,finalPartials:true}
 ]},
 {id:'d5',name:'Rest',short:'Rest',type:'rest',isLower:false,exercises:[]},
 {id:'d6',name:'Lower B',short:'Lower B',type:'training',isLower:true,exercises:[
   {id:'d6e1',name:'Smith Hip Thrust',sets:3,repMin:6,repMax:10,restSec:150,cat:'heavy',inc:5},
   {id:'d6e2',name:'Romanian Deadlift',sets:3,repMin:8,repMax:10,restSec:150,cat:'heavy',inc:5,alts:['Smith RDL','Dumbbell RDL']},
   {id:'d6e3',name:'Leg Curl',sets:4,repMin:10,repMax:15,restSec:60,cat:'isolation',inc:2,finalPartials:true},
   {id:'d6e4',name:'Leg Press',sets:3,repMin:8,repMax:12,restSec:105,cat:'moderate',inc:5,note:'Use knee-friendly range of motion.'},
   {id:'d6e5',name:'Leg Extension',sets:2,repMin:10,repMax:15,restSec:60,cat:'isolation',inc:2,note:'Use pain-free range of motion.'},
   {id:'d6e6',name:'Controlled Step-Up',sets:2,repMin:8,repMax:12,restSec:105,cat:'moderate',inc:2,perLeg:true,note:'Use pain-free range of motion.'},
   {id:'d6e7',name:'Dumbbell/Smith Glute Exercise',sets:2,repMin:10,repMax:15,restSec:60,cat:'isolation',inc:2}
 ]},
 {id:'d7',name:'Delts & Arms',short:'Delts & Arms',type:'training',isLower:false,exercises:[
   {id:'d7e1',name:'Dumbbell Shoulder Press',sets:3,repMin:8,repMax:12,restSec:120,cat:'moderate',inc:2.5},
   {id:'d7e2',name:'Cable Lateral Raise',sets:3,repMin:12,repMax:20,restSec:60,cat:'isolation',inc:1.5},
   {id:'d7e3',name:'Dumbbell Lateral Raise',sets:3,repMin:12,repMax:20,restSec:60,cat:'isolation',inc:1},
   {id:'d7e4',name:'Rear-Delt Cable Fly',sets:3,repMin:12,repMax:20,restSec:60,cat:'isolation',inc:1.5},
   {id:'d7e5',name:'Incline Dumbbell Curl',sets:3,repMin:8,repMax:12,restSec:60,cat:'isolation',inc:1.5},
   {id:'d7e6',name:'Bayesian Cable Curl',sets:2,repMin:10,repMax:15,restSec:60,cat:'isolation',inc:1.5,finalPartials:true},
   {id:'d7e7',name:'Overhead Cable Triceps Extension',sets:3,repMin:10,repMax:15,restSec:60,cat:'isolation',inc:1.5,finalPartials:true},
   {id:'d7e8',name:'Cable Pressdown',sets:3,repMin:10,repMax:15,restSec:60,cat:'isolation',inc:2}
 ]}
];

const PHASES = [
 {weeks:[1,2],name:'Calibration',detail:'Compounds: leave 2 reps in reserve · Isolation: leave 1 rep in reserve'},
 {weeks:[3,4],name:'Overload',detail:'Compounds: leave 1–2 reps in reserve · Isolation: push close to failure'},
 {weeks:[5,5],name:'Deload',detail:'Volume −45–50% · Stay well short of failure · No partials'},
 {weeks:[6,7],name:'Intensification',detail:'Compounds: leave 1–2 reps in reserve · Isolation: push close to failure'},
 {weeks:[8,8],name:'Peak',detail:'Compounds: leave ~1 rep in reserve · Final isolation sets can reach failure'}
];

const NUTRITION_TARGET = {calories:2850,protein:160,fat:70,carbs:400};
const WEIGHT_GAIN_TARGET = {min:0.10,max:0.20};

function defaultData(){
  return {
    programStartDate: todayISO(),
    program: JSON.parse(JSON.stringify(PROGRAM_TEMPLATE)),
    sessions: [],
    bodyweight: [],
    nutrition: [],
    activeSession: null,
    pendingNextMorning: null // {sessionId, dayName, date}
  };
}

function todayISO(){ const d=new Date(); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'); }
