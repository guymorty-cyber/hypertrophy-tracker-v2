import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const PROGRAMME = [
  { id:'upper-a', name:'Upper A', exercises:[
    ['Incline DB Press',3,'6–10'],['Chest-Supported T-Bar Row',4,'6–10'],['Flat DB Press',3,'8–12'],
    ['Cable Row',3,'8–12'],['Cable Fly',3,'10–15'],['Bayesian Cable Curl',3,'8–12'],['Overhead Cable Triceps Extension',3,'10–15']
  ]},
  { id:'lower-a', name:'Lower A', exercises:[['RDL',3,'6–10'],['Hip Thrust',4,'8–12'],['Leg Curl',4,'8–12'],['Leg Press',2,'8–12'],['Abs',3,'10–15']]},
  { id:'upper-b', name:'Upper B', exercises:[['DB Shoulder Press',3,'6–10'],['Chest-Supported T-Bar Row',3,'8–12'],['Incline DB Press',3,'8–12'],['Cable Row',3,'8–12'],['Cable Lateral Raise',3,'10–15'],['DB Curl',3,'8–12'],['Cable Triceps Extension',3,'10–15']]},
  { id:'lower-b', name:'Lower B', exercises:[['RDL',3,'6–10'],['Hip Thrust',3,'8–12'],['Leg Curl',4,'8–12'],['Pendulum Squat',3,'8–12'],['Abs',3,'10–15']]}
];

function loadSessions(){ try{return JSON.parse(localStorage.getItem('ht_sessions')||'[]')}catch{return []} }
function saveSessions(v){localStorage.setItem('ht_sessions',JSON.stringify(v))}
function App(){
 const [tab,setTab]=useState('home'); const [sessions,setSessions]=useState(loadSessions); const [workout,setWorkout]=useState(null);
 const next=PROGRAMME[sessions.length%PROGRAMME.length];
 const deleteWorkout=(id)=>{if(confirm('Delete this completed workout?\n\nIt will be removed from History, Progress and coaching comparisons.')){const n=sessions.filter(s=>s.id!==id);setSessions(n);saveSessions(n)}};
 const start=()=>setWorkout(next);
 return <div className="app"><header><b>▰ HYPERTROPHY</b><span>8-WEEK BUILD</span></header>
  <main>{workout?<Workout day={workout} onFinish={(s)=>{const n=[...sessions,s];setSessions(n);saveSessions(n);setWorkout(null);setTab('history')}} onBack={()=>setWorkout(null)}/>:tab==='home'?<Home next={next} start={start} sessions={sessions}/>:tab==='history'?<History sessions={sessions} onDelete={deleteWorkout}/>:tab==='progress'?<Progress sessions={sessions}/>:<Programme/>}</main>
  <nav>{[['home','⌂','Home'],['history','▤','History'],['progress','↗','Progress'],['programme','⚙','Programme']].map(([id,i,l])=><button className={tab===id?'active':''} onClick={()=>setTab(id)} key={id}><strong>{i}</strong>{l}</button>)}</nav>
 </div>
}
function Home({next,start,sessions}){return <><section className="card next"><small>NEXT WORKOUT</small><h1>{next.name}</h1><p>{next.exercises.length} exercises · progressive overload</p><button onClick={start}>START WORKOUT</button></section><div className="grid"><Stat n={sessions.length} l="Workouts"/><Stat n={sessions.length?Math.round(sessions.reduce((a,s)=>a+s.volume,0)).toLocaleString()+' kg':'—'} l="Total volume"/></div><section className="card"><h2>How your coach works</h2><p>Every exercise compares your last completed session with today’s target load and reps. The goal is simple: add reps, then add weight when you earn it.</p></section></>}
function Stat({n,l}){return <div className="stat"><b>{n}</b><small>{l}</small></div>}
function Workout({day,onFinish,onBack}){const [sets,setSets]=useState({}); const [start]=useState(Date.now()); return <><div className="topline"><button onClick={onBack}>‹ Back</button><b>{day.name}</b></div>{day.exercises.map(([name,count,range])=><Exercise key={name} name={name} count={count} range={range} sets={sets[name]||[]} setSets={(v)=>setSets({...sets,[name]:v})}/>)}<button className="finish" onClick={()=>{let volume=0;Object.values(sets).forEach(a=>a.forEach(x=>volume+=(+x.weight||0)*(+x.reps||0)));onFinish({id:crypto.randomUUID(),date:new Date().toISOString(),dayName:day.name,sets:Object.values(sets).reduce((a,x)=>a+x.length,0),volume})}}>FINISH WORKOUT</button></>}
function Exercise({name,count,range,sets,setSets}){const rows=Array.from({length:count},(_,i)=>sets[i]||{});const update=(i,k,v)=>{const n=rows.map(x=>({...x}));n[i][k]=v;setSets(n)};return <section className="exercise"><div className="exhead"><b>{name}</b><span>{count} × {range}</span><em>Coach: use last performance to beat reps, then increase load.</em></div>{rows.map((x,i)=><div className="set" key={i}><span>{i+1}</span><input inputMode="decimal" placeholder="kg" value={x.weight||''} onChange={e=>update(i,'weight',e.target.value)}/><input inputMode="numeric" placeholder="reps" value={x.reps||''} onChange={e=>update(i,'reps',e.target.value)}/></div>)}</section>}
function History({sessions,onDelete}){return <><h2>Workout History</h2>{sessions.length?sessions.slice().reverse().map(s=><section className="card hist" key={s.id}><div><b>{s.dayName}</b><small>{new Date(s.date).toLocaleDateString('en-GB')}</small></div><p>{s.sets} sets · {Math.round(s.volume).toLocaleString()} kg volume</p><button className="delete" onClick={()=>onDelete(s.id)}>Delete workout</button></section>):<section className="card">No completed workouts yet.</section>}</>}
function Progress({sessions}){return <><h2>Progress</h2><section className="card"><b>{sessions.length}</b><p>completed workouts</p><div className="bars">{sessions.slice(-8).map((s,i)=><i key={s.id} style={{height:Math.max(12,Math.min(100,s.volume/100))+'px'}} title={Math.round(s.volume)+' kg'}/>)}</div></section></>}
function Programme(){return <><h2>Programme</h2>{PROGRAMME.map(d=><section className="card" key={d.id}><b>{d.name}</b><p>{d.exercises.map(x=>x[0]).join(' · ')}</p></section>)}</>}
createRoot(document.getElementById('root')).render(<App/>);
