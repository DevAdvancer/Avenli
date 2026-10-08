// Maintenance bridge using Codex's authenticated MCP connection. No credentials are read.
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const readline=require('node:readline');
const exe='C:/Users/Abhirup/AppData/Local/OpenAI/Codex/bin/9691020b546a15b2/codex.exe';
const p=spawn(exe,['app-server','--listen','stdio://'],{cwd:process.cwd(),windowsHide:true,stdio:['pipe','pipe','pipe']});
let id=0;const pending=new Map();
readline.createInterface({input:p.stdout}).on('line',line=>{let v;try{v=JSON.parse(line)}catch{return}if(v.id!=null&&pending.has(v.id)){const c=pending.get(v.id);pending.delete(v.id);v.error?c.reject(new Error(v.error.message)):c.resolve(v.result)}});
// Do not mirror app-server logs: they can contain OAuth metadata.
p.stderr.on('data',()=>{});
const rpc=(method,params)=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});p.stdin.write(JSON.stringify({id:n,method,params})+'\n')});
const timer=setTimeout(()=>{p.kill();process.exit(1)},180000);
async function run(input){await rpc('initialize',{clientInfo:{name:'avenli_setup',version:'1.0.0'},capabilities:{experimentalApi:true}});p.stdin.write(JSON.stringify({method:'initialized',params:{}})+'\n');const t=await rpc('thread/start',{cwd:process.cwd(),ephemeral:true,sandbox:'workspace-write',approvalPolicy:'never'});const threadId=t.thread.id;await rpc('mcpServerStatus/list',{threadId,serverName:'supabase',detail:'toolsAndAuthOnly'});let args=input.arguments||{};if(input.sqlFile)args.query=fs.readFileSync(input.sqlFile,'utf8');if(input.files)args.files=input.files.map(f=>({name:f.name,content:fs.readFileSync(f.path,'utf8')}));const result=await rpc('mcpServer/tool/call',{threadId,server:'supabase',tool:input.tool,arguments:args});console.log(JSON.stringify(result));}
console.log('Ready for MCP request JSON on stdin.');
if(process.stdin.isTTY)process.stdin.setRawMode(true);
const rl=readline.createInterface({input:process.stdin,terminal:false});
rl.once('line',line=>{rl.close();run(JSON.parse(line)).catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>{clearTimeout(timer);p.kill()})});

