"use client";
import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Timer, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
type Session={id:string;total:number;remaining:number;endsAt:number|null};
export function FocusTimer({duration,onComplete,storageKey}:{duration:number;onComplete:(id:string,minutes:number)=>Promise<boolean>;storageKey:string}){
 const [session,setSession]=useState<Session|null>(null);const [now,setNow]=useState(0);const [saving,setSaving]=useState(false);const saved=useRef(false);
 const draftKey="avenli-focus-draft:"+storageKey;
 function update(value:Session|null){setSession(value);try{if(value)localStorage.setItem(draftKey,JSON.stringify(value));else localStorage.removeItem(draftKey)}catch{/* A running timer still works if browser storage is disabled. */}}
 useEffect(()=>{try{const raw=localStorage.getItem(draftKey);if(raw){const value=JSON.parse(raw) as Session;if(typeof value.id==="string"&&value.total>=300&&value.total<=7200&&typeof value.remaining==="number"&&(value.endsAt===null||typeof value.endsAt==="number")){
 // Hydrate only the device-local running timer; completed focus records live in Supabase.
 // eslint-disable-next-line react-hooks/set-state-in-effect
 setSession(value);setNow(Date.now());}}}catch{/* Ignore a stale or invalid timer draft. */}},[draftKey]);
 useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id)},[]);
 const seconds=session?(session.endsAt?Math.max(0,Math.ceil((session.endsAt-now)/1000)):session.remaining):duration*60;
 const finished=!!session&&seconds===0;
 async function complete(){if(!session||saving||saved.current)return;setSaving(true);const ok=await onComplete(session.id,Math.max(1,Math.round(session.total/60)));if(ok){saved.current=true;update(null)}setSaving(false);}
 return <div className="focus-card"><div className="focus-top"><span><span className="live-dot"/>MAKE A LITTLE SPACE</span><Timer size={17}/></div><h2>{finished?"A little progress, made.":"One thing at a time."}</h2><p>{finished?"Save this session to your focus history.":"A quiet moment. Your full attention."}</p><div className="timer-display" aria-live="off" aria-label={`${Math.floor(seconds/60)} minutes ${seconds%60} seconds remaining`}>{String(Math.floor(seconds/60)).padStart(2,"0")}<span>:</span>{String(seconds%60).padStart(2,"0")}</div><div className="timer-actions"><Button className="focus-button" disabled={saving} onClick={()=>{if(finished){void complete();return}saved.current=false;if(session?.endsAt){update({...session,remaining:seconds,endsAt:null})}else{const total=session?.remaining??duration*60;setNow(Date.now());update({id:session?.id??crypto.randomUUID(),total:session?.total??total,remaining:total,endsAt:Date.now()+total*1000})}}}>{finished?<Check size={14}/>:session?.endsAt?<Pause size={14}/>:<Play size={14}/>} {finished?(saving?"Saving…":"Save focus session"):session?.endsAt?"Pause focus":session?"Resume focus":"Start a focus session"}</Button>{session&&<Button variant="ghost" size="icon" aria-label="Reset focus timer" disabled={saving} onClick={()=>update(null)}><RotateCcw size={15}/></Button>}</div><small>{finished?"You made time for something that matters.":`${duration} minutes of focus. A little room to recharge.`}</small></div>;
}



