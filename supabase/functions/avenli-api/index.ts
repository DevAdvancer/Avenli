import nodemailer from "npm:nodemailer@10.0.16";
import { z } from "npm:zod@3.25.76";

const url=Deno.env.get("SUPABASE_URL")!;
const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const dbHeaders={apikey:service,Authorization:`Bearer ${service}`,"Content-Type":"application/json"};
const response=(value:unknown,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"no-store"}});
class HttpError extends Error{constructor(message:string,public status=400){super(message)}}
async function db(path:string,method="GET",body?:unknown,prefer="return=representation"){
 const r=await fetch(`${url}/rest/v1/${path}`,{method,headers:{...dbHeaders,Prefer:prefer},body:body===undefined?undefined:JSON.stringify(body)});
 if(!r.ok){const code=(await r.json().catch(()=>({}))).code;if(code==="23505")throw new HttpError("This operation was already received.",409);throw new HttpError("Your change could not be saved. Please try again.",502)}
 if(r.status===204)return null;const text=await r.text();return text?JSON.parse(text):null;
}
// Keyset pagination avoids silently losing records at the Data API row limit.
async function allOwned(table:string,owner:string){
 const rows:Record<string,unknown>[]=[];let cursor="";
 for(;;){const batch=await db(`${table}?${ownerQuery(owner)}&order=id.asc&limit=500${cursor?`&id=gt.${cursor}`:""}`);
 rows.push(...batch);if(batch.length<500)return rows;
 if(rows.length>=50000)throw new HttpError("This workspace is too large to export in one request. Please contact support.",413);
 cursor=batch[batch.length-1].id;
 }
}
let cached:{data:Record<string,string>;expires:number}|null=null;
async function config(){if(cached&&cached.expires>Date.now())return cached.data;const data=await db("rpc/avenli_runtime_config","POST",{});cached={data,expires:Date.now()+60000};return data as Record<string,string>;}
const areas=["Work & career","Health & wellbeing","Personal growth","Life admin"] as const;
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(x=>!Number.isNaN(Date.parse(x)));
const taskSchema=z.object({id:z.string().uuid(),title:z.string().trim().min(1).max(240),notes:z.string().max(5000).default(""),area:z.enum(areas),priority:z.enum(["high","medium","low"]),status:z.enum(["todo","in_progress","done"]),due_date:date.nullable(),due_time:z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable(),my_day:z.boolean(),recurrence:z.enum(["none","daily","weekly","monthly"]),goal_id:z.string().uuid().nullable(),subtasks:z.array(z.object({id:z.string().uuid(),title:z.string().trim().min(1).max(200),done:z.boolean()})).max(50),reminder_at:z.string().datetime({offset:true}).nullable()});
const goalSchema=z.object({id:z.string().uuid(),title:z.string().trim().min(1).max(240),notes:z.string().max(5000).default(""),area:z.enum(areas),target_date:date.nullable(),target:z.number().positive().max(1000000),current:z.number().nonnegative().max(1000000),unit:z.string().trim().min(1).max(40)});
const settingsSchema=z.object({display_name:z.string().trim().max(80),timezone:z.string().max(80).refine(x=>{try{new Intl.DateTimeFormat("en",{timeZone:x});return true}catch{return false}}),email_reminders:z.boolean(),daily_digest:z.boolean(),digest_hour:z.number().int().min(0).max(23),quiet_start:z.number().int().min(0).max(23),quiet_end:z.number().int().min(0).max(23),focus_minutes:z.number().int().min(5).max(120)});
const ownerQuery=(owner:string)=>`owner_id=eq.${encodeURIComponent(owner)}`;
async function owned(table:string,owner:string,id:string){const rows=await db(`${table}?${ownerQuery(owner)}&id=eq.${z.string().uuid().parse(id)}&limit=1`);if(!rows?.length)throw new HttpError("This item no longer exists.",404);return rows[0];}
function transport(cfg:Record<string,string>){return nodemailer.createTransport({host:"smtp-relay.brevo.com",port:465,secure:true,auth:{user:"b79b59001@smtp-brevo.com",pass:cfg.avenli_smtp_password},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000,disableFileAccess:true,disableUrlAccess:true});}
function escape(s:string){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));}
async function send(cfg:Record<string,string>,email:string,title:string,body:string,id:string){
 const configuredUrl=Deno.env.get("AVENLI_APP_URL") || "https://avenli.silverspaceinc.tech";
 const appUrl=configuredUrl&&/^https:\/\//.test(configuredUrl)?configuredUrl:null;
 const mail=transport(cfg);try{const result=await mail.sendMail({from:{name:"Avenli",address:"abhirupvizva@gmail.com"},to:email,subject:`${title} · Avenli`,messageId:`<${id}@avenli.app>`,text:`${body}\n\nMake room for what matters.${appUrl?`\nOpen Avenli: ${appUrl}`:""}\n\nYou can change reminders in Settings.`,html:`<div style="font-family:Arial,sans-serif;max-width:520px;margin:32px auto;background:#f7f9f2;padding:36px;border-radius:16px;color:#35432b"><h2 style="color:#57714a">avenli.</h2><h1 style="font-size:22px">${escape(title)}</h1><p style="line-height:1.8">${escape(body)}</p>${appUrl?`<a href="${escape(appUrl)}" style="display:inline-block;margin:16px 0;background:#59724b;color:white;padding:12px 20px;border-radius:8px;text-decoration:none">Open your workspace</a>`:""}<p style="font-size:12px;color:#718263">Make room for what matters.<br/>Manage reminders in Avenli Settings.</p></div>`});if(!result.accepted?.length)throw new Error("Recipient not accepted");return result.messageId;}finally{mail.close();}}
async function reminders(cfg:Record<string,string>){
 await db("rpc/avenli_queue_reminders","POST",{});const notices=await db("rpc/avenli_claim_emails","POST",{});let sent=0,failed=0;
 for(const n of notices??[]){try{
   const [s]=await db(`avenli_settings?${ownerQuery(n.owner_id)}&limit=1`);
   if(!s||(!s.email_reminders&&n.task_id)||(!s.daily_digest&&!n.task_id)){await db(`avenli_notifications?id=eq.${n.id}`,"PATCH",{email_state:"skipped"});continue;}
   if(n.task_id){const [task]=await db(`avenli_tasks?${ownerQuery(n.owner_id)}&id=eq.${n.task_id}&status=neq.done&limit=1`);if(!task||!task.reminder_at||!n.scheduled_at||Date.parse(task.reminder_at)!==Date.parse(n.scheduled_at)){await db(`avenli_notifications?id=eq.${n.id}`,"PATCH",{email_state:"skipped"});continue;}}
   await send(cfg,s.email,n.title,n.body,n.id);await db(`avenli_notifications?id=eq.${n.id}`,"PATCH",{email_state:"sent",last_error:null});sent++;
  }catch{await db(`avenli_notifications?id=eq.${n.id}`,"PATCH",{email_state:"failed",last_error:"The email could not be confirmed. Check your inbox before retrying."});failed++;}}
 return {sent,failed,checked:notices?.length??0};
}
async function signed(req:Request,raw:string,cfg:Record<string,string>){
 const stamp=req.headers.get("x-avenli-time")??"",nonce=req.headers.get("x-avenli-nonce")??"",signature=req.headers.get("x-avenli-signature")??"";
 if(!/^\d+$/.test(stamp)||Math.abs(Date.now()-Number(stamp))>120000||!z.string().uuid().safeParse(nonce).success||!/^[a-f0-9]{64}$/.test(signature))throw new HttpError("Unauthorized",401);
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(cfg.avenli_backend_secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
 const sig=Uint8Array.from(signature.match(/.{2}/g)!,x=>parseInt(x,16));
 if(!await crypto.subtle.verify("HMAC",key,sig,new TextEncoder().encode(`POST\navenli-api\n${stamp}\n${nonce}\n${raw}`)))throw new HttpError("Unauthorized",401);
 await db("avenli_request_nonces","POST",{nonce},"return=minimal");
}
Deno.serve(async req=>{try{
 if(req.method!=="POST")return response({error:"Method not allowed"},405);
 if(Number(req.headers.get("content-length")||0)>64000)return response({error:"Request too large"},413);
 const raw=await req.text();if(raw.length>64000)return response({error:"Request too large"},413);
 const cfg=await config();
 const cron=req.headers.get("x-avenli-cron");
 if(cron){const a=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(cron));const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(cfg.avenli_cron_secret));const aa=new Uint8Array(a),bb=new Uint8Array(b);let mismatch=0;for(let i=0;i<32;i++)mismatch|=aa[i]^bb[i];if(mismatch)throw new HttpError("Unauthorized",401);return response(await reminders(cfg));}
 await signed(req,raw,cfg);
 const envelope=z.object({owner:z.string().min(1).max(200),email:z.string().email().max(254),name:z.string().max(80),action:z.string(),payload:z.unknown().optional()}).parse(JSON.parse(raw));
 const {owner,email,name,action}=envelope;const p=envelope.payload as Record<string,unknown>??{};
 await db("avenli_settings?on_conflict=owner_id","POST",{owner_id:owner,email,display_name:name},"resolution=ignore-duplicates,return=minimal");
 await db(`avenli_settings?${ownerQuery(owner)}`,"PATCH",{email},"return=minimal");
 switch(action){
 case "export":
 case "load": {const [tasks,goals,notifications,focus,settings]=await Promise.all([
 allOwned("avenli_tasks",owner),allOwned("avenli_goals",owner),action==="export"?allOwned("avenli_notifications",owner):db(`avenli_notifications?${ownerQuery(owner)}&order=created_at.desc&limit=100`),allOwned("avenli_focus",owner),db(`avenli_settings?${ownerQuery(owner)}&limit=1`)]);return response({tasks,goals,notifications,focus,settings:settings[0],smtp_ready:!!cfg.avenli_smtp_password});}
 case "task.save":{const t=taskSchema.parse(p);if(t.goal_id)await owned("avenli_goals",owner,t.goal_id);const existing=await db(`avenli_tasks?id=eq.${t.id}&select=owner_id,status&limit=1`);if(existing?.length){if(existing[0].owner_id!==owner)throw new HttpError("This item no longer exists.",404);if(t.status!==existing[0].status&&(t.status==="done"||existing[0].status==="done"))throw new HttpError("Use the completion action to change completed tasks.");await db(`avenli_tasks?${ownerQuery(owner)}&id=eq.${t.id}`,"PATCH",t);}else{if(t.status==="done")throw new HttpError("Create a task before completing it.");await db("avenli_tasks","POST",{...t,owner_id:owner});}return response({ok:true});}
 case "task.complete":{const d=z.object({id:z.string().uuid(),done:z.boolean()}).parse(p);await db("rpc/avenli_complete_task","POST",{p_owner:owner,p_id:d.id,p_done:d.done});return response({ok:true});}
 case "task.delete":{const id=z.string().uuid().parse(p.id);await owned("avenli_tasks",owner,id);await db(`avenli_tasks?${ownerQuery(owner)}&id=eq.${id}`,"DELETE");return response({ok:true});}
 case "goal.save":{const g=goalSchema.parse(p);const existing=await db(`avenli_goals?id=eq.${g.id}&select=owner_id&limit=1`);if(existing?.length){if(existing[0].owner_id!==owner)throw new HttpError("This item no longer exists.",404);await db(`avenli_goals?${ownerQuery(owner)}&id=eq.${g.id}`,"PATCH",g);}else await db("avenli_goals","POST",{...g,owner_id:owner});return response({ok:true});}
 case "goal.delete":{const id=z.string().uuid().parse(p.id);await owned("avenli_goals",owner,id);await db(`avenli_goals?${ownerQuery(owner)}&id=eq.${id}`,"DELETE");return response({ok:true});}
 case "settings.save":{const s=settingsSchema.parse(p);await db(`avenli_settings?${ownerQuery(owner)}`,"PATCH",{...s,updated_at:new Date().toISOString()});if(!s.email_reminders)await db(`avenli_notifications?${ownerQuery(owner)}&task_id=not.is.null&email_state=eq.pending`,"PATCH",{email_state:"skipped"});if(!s.daily_digest)await db(`avenli_notifications?${ownerQuery(owner)}&task_id=is.null&email_state=eq.pending`,"PATCH",{email_state:"skipped"});return response({ok:true});}
 case "focus.complete":{const f=z.object({id:z.string().uuid(),minutes:z.number().int().min(1).max(180)}).parse(p);await db("avenli_focus?on_conflict=id","POST",{...f,owner_id:owner},"resolution=ignore-duplicates,return=minimal");return response({ok:true});}
 case "notifications.read":{await db(`avenli_notifications?${ownerQuery(owner)}&read_at=is.null`,"PATCH",{read_at:new Date().toISOString()});return response({ok:true});}
 case "smtp.verify":{const mail=transport(cfg);try{await mail.verify();return response({ok:true,message:"Secure SMTP connection verified"});}catch(e){throw new HttpError("SMTP check failed: "+(e instanceof Error?e.message.replaceAll(cfg.avenli_smtp_password,"[redacted]"):"Unknown error"),502);}finally{mail.close();}}
 case "smtp.test":{const last=await db(`avenli_notifications?${ownerQuery(owner)}&dedupe_key=like.test:*&created_at=gte.${new Date(Date.now()-60000).toISOString()}&limit=1`);if(last.length)throw new HttpError("Please wait a minute before sending another test.",429);const id=crypto.randomUUID();await db("avenli_notifications","POST",{id,owner_id:owner,dedupe_key:`test:${id}`,title:"Email test requested",body:"A test email was requested from Settings.",email_state:"processing",claimed_at:new Date().toISOString()});try{await send(cfg,email,"Your reminders are connected","You’re all set. Avenli will help you remember the things that matter.",id);await db(`avenli_notifications?id=eq.${id}`,"PATCH",{email_state:"sent"});return response({ok:true,message:"Test email accepted by the mail server. Check your inbox."});}catch{await db(`avenli_notifications?id=eq.${id}`,"PATCH",{email_state:"failed"});throw new HttpError("The test email could not be confirmed. Check your inbox and sender verification.",502);}}
 default:throw new HttpError("Unknown action");
 }
 }catch(e){if(e instanceof z.ZodError)return response({error:e.issues.map(i=>`${i.path.join(".")}: ${i.message}`).join("; ")},400);if(e instanceof HttpError)return response({error:e.message},e.status);console.error("Avenli request failed",e instanceof Error?e.name:"UnknownError",(e as {code?:string}).code??"",(e as {command?:string}).command??"",(e as {responseCode?:number}).responseCode??"", e instanceof Error?e.message.replace(/xsmtpsib-[^ ]+/g,"[REDACTED]"):"");return response({error:"We couldn’t complete that request. Please try again."},500)}});



