import { getVerifiedUser } from "@/lib/supabase/server";
export const dynamic="force-dynamic";
async function forward(request:Request,action:string,payload:unknown={}){
 const user=await getVerifiedUser();
 if(!user?.email || !user.email_confirmed_at)return Response.json({error:"Please sign in to access your workspace."},{status:401});
 const secret=process.env.AVENLI_BACKEND_SECRET;
 if(!secret)return Response.json({error:"Your workspace connection is being set up. Please try again shortly."},{status:503});
 const fullName=user.user_metadata?.full_name;
 const raw=JSON.stringify({owner:user.id,email:user.email,name:(typeof fullName==="string"?fullName:user.email.split("@")[0]).slice(0,80),action,payload});
 const time=String(Date.now()),nonce=crypto.randomUUID();
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const signature=Array.from(new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(`POST\navenli-api\n${time}\n${nonce}\n${raw}`))),b=>b.toString(16).padStart(2,"0")).join("");
 try{const r=await fetch("https://dpahxvrwkyihqukermji.supabase.co/functions/v1/avenli-api",{method:"POST",headers:{"Content-Type":"application/json","x-avenli-time":time,"x-avenli-nonce":nonce,"x-avenli-signature":signature},body:raw,signal:AbortSignal.timeout(45000)});return new Response(await r.text(),{status:r.status,headers:{"Content-Type":"application/json","Cache-Control":"private, no-store"}});}catch{return Response.json({error:"The workspace is temporarily unavailable. Your changes haven’t been saved. Please retry."},{status:503});}
}
export async function GET(request:Request){return forward(request,"load");}
export async function POST(request:Request){
 const origin=request.headers.get("origin"),host=request.headers.get("host");const expected=host?`${new URL(request.url).protocol}//${host}`:new URL(request.url).origin;if(!origin||origin!==expected)return Response.json({error:"Invalid request origin"},{status:403});
 if(Number(request.headers.get("content-length")??0)>48000)return Response.json({error:"Request too large"},{status:413});
 try{const raw=await request.text();if(raw.length>48000)return Response.json({error:"Request too large"},{status:413});const body=JSON.parse(raw);if(typeof body.action!=="string")return Response.json({error:"Invalid action"},{status:400});return forward(request,body.action,body.payload);}catch{return Response.json({error:"Invalid request"},{status:400});}
}
