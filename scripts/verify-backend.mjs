import fs from 'node:fs';
import {createHmac,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const secret=fs.readFileSync('.env','utf8').match(/^AVENLI_BACKEND_SECRET=(.+)$/m)[1].trim();
const endpoint='https://dpahxvrwkyihqukermji.supabase.co/functions/v1/avenli-api';
const suffix=randomUUID();const ownerA='avenli_verify_'+suffix+'_a',ownerB='avenli_verify_'+suffix+'_b';
fs.mkdirSync('work',{recursive:true});fs.writeFileSync('work/verification-owners.json',JSON.stringify([ownerA,ownerB]));
function request(owner,action,payload={},nonce=randomUUID()) {const body=JSON.stringify({owner,email:'verification@example.test',name:'Verification',action,payload});const timestamp=String(Date.now());const signature=createHmac('sha256',secret).update(`POST\navenli-api\n${timestamp}\n${nonce}\n${body}`).digest('hex');return {method:'POST',headers:{'Content-Type':'application/json','x-avenli-time':timestamp,'x-avenli-nonce':nonce,'x-avenli-signature':signature},body};}
async function call(owner,action,payload={},status=200){const r=await fetch(endpoint,request(owner,action,payload));const body=await r.json();assert.equal(r.status,status,action+': '+JSON.stringify(body));return body;}
const today=new Date().toISOString().slice(0,10),goal={id:randomUUID(),title:'Verification goal',notes:'Disposable verification record',area:'Personal growth',target_date:null,target:10,current:2,unit:'steps'};
const task={id:randomUUID(),title:'Verification recurring task',notes:'Disposable verification record',area:'Work & career',priority:'high',status:'todo',due_date:today,due_time:'10:00',my_day:true,recurrence:'daily',goal_id:goal.id,subtasks:[{id:randomUUID(),title:'Verification step',done:true}],reminder_at:null};
let checks=0;function passed(label){checks++;console.log('PASS '+label)}
try{
 let r=await fetch(endpoint,{method:'POST',body:'{}'});assert.equal(r.status,401);passed('Unsigned requests rejected');
 await call(ownerA,'load');await call(ownerB,'load');
 await call(ownerA,'goal.save',goal);await call(ownerA,'task.save',task);let a=await call(ownerA,'load');assert.equal(a.tasks[0].title,task.title);assert.equal(a.goals[0].current,2);passed('Goals and tasks persist');
 const exported=await call(ownerA,'export');assert.equal(exported.tasks[0].id,task.id);assert.equal(exported.goals[0].id,goal.id);const otherExport=await call(ownerB,'export');assert.equal(otherExport.tasks.length,0);passed('Workspace export contains owned data only');
 let b=await call(ownerB,'load');assert.equal(b.tasks.length,0);assert.equal(b.goals.length,0);passed('User data remains isolated');
 await call(ownerB,'task.save',task,404);await call(ownerB,'task.delete',{id:task.id},404);await call(ownerB,'goal.save',goal,404);await call(ownerB,'task.save',{...task,id:randomUUID()},404);passed('Cross-user edits, deletes, and goal links rejected');
 await call(ownerA,'task.save',{...task,title:'Updated verification task',priority:'low'});a=await call(ownerA,'load');assert.equal(a.tasks[0].priority,'low');passed('Task updates persist');
 await call(ownerA,'task.complete',{id:task.id,done:true});await call(ownerA,'task.complete',{id:task.id,done:true});a=await call(ownerA,'load');assert.equal(a.tasks.length,2);assert.equal(a.tasks.filter(t=>t.status==='done').length,1);assert.equal(a.tasks.find(t=>t.id!==task.id).subtasks[0].done,false);passed('Recurring completion is atomic and duplicate-safe');
 await call(ownerA,'task.complete',{id:task.id,done:false});await call(ownerA,'task.complete',{id:task.id,done:true});a=await call(ownerA,'load');assert.equal(a.tasks.length,2);passed('Reopening a recurring task does not duplicate its successor');
 await call(ownerA,'goal.delete',{id:goal.id});a=await call(ownerA,'load');assert.equal(a.tasks.length,2);assert.ok(a.tasks.every(t=>t.goal_id===null));passed('Deleting a goal preserves its tasks');
 const f={id:randomUUID(),minutes:25};await call(ownerA,'focus.complete',f);await call(ownerA,'focus.complete',f);a=await call(ownerA,'load');assert.equal(a.focus.length,1);passed('Focus history is persistent and idempotent');
 await call(ownerA,'task.save',{...task,id:randomUUID(),goal_id:null,title:'  '},400);passed('Invalid task input is rejected');
 const replay=request(ownerA,'load');r=await fetch(endpoint,replay);assert.equal(r.status,200);r=await fetch(endpoint,replay);assert.equal(r.status,409);passed('Signed request replay is rejected');
 // SMTP connectivity is checked separately by verify-smtp.mjs.
 console.log(JSON.stringify({passed:checks,owners:[ownerA,ownerB]}));
}finally{try{const a=await call(ownerA,'load');for(const t of a.tasks)await call(ownerA,'task.delete',{id:t.id});for(const g of a.goals)await call(ownerA,'goal.delete',{id:g.id});}catch{console.error('Verification cleanup requires maintenance query.')}}

