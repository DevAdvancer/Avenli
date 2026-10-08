import fs from 'node:fs';
import {createHmac,randomUUID} from 'node:crypto';
const secret=fs.readFileSync('.env','utf8').match(/^AVENLI_BACKEND_SECRET=(.+)$/m)[1].trim();
const body=JSON.stringify({owner:'local_seedy',email:'seedy@sites.test',name:'Seedy',action:'smtp.verify',payload:{}});
const time=String(Date.now()),nonce=randomUUID();const signature=createHmac('sha256',secret).update(`POST\navenli-api\n${time}\n${nonce}\n${body}`).digest('hex');
const r=await fetch('https://dpahxvrwkyihqukermji.supabase.co/functions/v1/avenli-api',{method:'POST',headers:{'Content-Type':'application/json','x-avenli-time':time,'x-avenli-nonce':nonce,'x-avenli-signature':signature},body});console.log(r.status,await r.text());
process.exitCode=r.ok?0:1;
