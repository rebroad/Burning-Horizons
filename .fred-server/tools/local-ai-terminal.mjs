import {randomBytes,timingSafeEqual} from 'node:crypto';
import {spawn} from 'node:child_process';
import {readFile,realpath} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join,relative,isAbsolute,sep} from 'node:path';
import {WebSocketServer,WebSocket} from 'ws';

const api='/api/ai-terminal',token=()=>randomBytes(32).toString('base64url');
const opaque=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
const equal=(a,b)=>opaque(a)&&opaque(b)&&timingSafeEqual(Buffer.from(a,'ascii'),Buffer.from(b,'ascii'));
const base64=(value,limit,empty=false)=>typeof value==='string'&&(empty||value.length>0)&&value.length<=limit&&value.length%4===0&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)&&Buffer.from(value,'base64').toString('base64')===value;
const dimensions=(cols,rows)=>Number.isInteger(cols)&&Number.isInteger(rows)&&cols>=20&&cols<=300&&rows>=20&&rows<=300;
const MAX_SESSION_MS=1800000;
const json=(res,status,value)=>{if(res.writableEnded||res.destroyed)return;res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
export const defaultTerminalConfig=()=>process.env.FRED_TERMINAL_CONFIG??join(homedir(),'.config','fred','terminal.json');
export function validateTerminalConnection(value){
 if(!value||Object.keys(value).sort().join(',')!=='host,port,worker'||!/^[a-zA-Z0-9][a-zA-Z0-9.-]{0,100}$/.test(value.host)||!Number.isInteger(value.port)||value.port<1||value.port>65535||!/^\/[a-zA-Z0-9_./-]+$/.test(value.worker)||value.worker.split('/').includes('..'))throw Error('Invalid terminal connection');
 return value;
}
export async function loadTerminalConnection(configPath,staticRoot){
 try{const file=await realpath(configPath),root=await realpath(staticRoot),rel=relative(root,file);if(!(rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel)))throw Error('Terminal settings must be outside the game folder');return validateTerminalConnection(JSON.parse(await readFile(file,'utf8')));}catch(error){if(error.code==='ENOENT')return null;throw error;}
}
export function terminalOverSSH(connection){
 return spawn('ssh',['-T','-p',String(connection.port),'-o','BatchMode=yes','-o','ConnectTimeout=8','-o','ServerAliveInterval=15','-o','ServerAliveCountMax=2',connection.host,`python3 ${connection.worker}`],{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});
}
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>2048)throw Error('Request too large');}return JSON.parse(text);}
/** Loopback-only owner broker. Provider credentials and terminal bytes are never persisted here. */
export function createTerminalBroker({origin,connection=null,spawnWorker=()=>terminalOverSSH(connection),now=Date.now,graceMs=60000,idleMs=1800000,attachMs=30000,maxSessions=2,killMs=12000,endWaitMs=12000}={}){
 const expected=new URL(origin);if(expected.protocol!=='http:'||expected.hostname!=='127.0.0.1'||expected.origin!==origin)throw Error('Local terminal requires an exact loopback origin');
 const host=expected.host,cookieName='fred_terminal_'+expected.port,owners=new Map(),sessions=new Map();
 const wss=new WebSocketServer({noServer:true,maxPayload:8192,perMessageDeflate:false});
 let disposed=false;
 function allowed(req,strict=false){return req.headers.host===host&&(!req.headers.origin?!strict:req.headers.origin===origin)&&(!req.headers['sec-fetch-site']||['same-origin','none'].includes(req.headers['sec-fetch-site']));}
 function owner(req){const value=(req.headers.cookie??'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);return value&&owners.get(value);}
 function send(ws,value){if(ws?.readyState===WebSocket.OPEN){if(ws.bufferedAmount>524288){ws.close(1009,'Terminal receiver too slow');return false;}try{ws.send(JSON.stringify(value));}catch{return false;}}return true;}
 function confirmed(session){
  if(session.cleanAck===true&&session.childClosed&&session.childCode===0){session.cleaned=true;sessions.delete(session.id);clearTimeout(session.killTimer);session.resolveCleanup(true);return true;}
  if(session.cleanAck===false||session.childClosed&&(session.childCode!==0||session.cleanAck!==true))session.quarantined=true;return false;
 }
 function stop(session){
  if(!session||session.ended)return;session.ended=true;session.attachment=null;session.queue=[];session.queuedBytes=0;session.socket?.close(1000,'Session stopping');session.socket=null;
  if(!session.childClosed){session.killTimer=setTimeout(()=>{session.quarantined=true;try{session.child.kill();}catch{}},killMs);session.killTimer.unref?.();}
  try{session.child.stdin.end(JSON.stringify({type:'stop'})+'\n');}catch{session.quarantined=true;}confirmed(session);
 }
 async function waitCleanup(session){
  if(confirmed(session))return true;let timer;
  const clean=await Promise.race([session.cleanupPromise,new Promise(resolve=>{timer=setTimeout(()=>resolve(false),endWaitMs);})]);clearTimeout(timer);if(!clean)session.quarantined=true;return clean;
 }
 function write(session,message){if(session.ended||session.child.stdin.destroyed||session.child.stdin.writableLength>65536){stop(session);return false;}try{return session.child.stdin.write(JSON.stringify(message)+'\n');}catch{stop(session);return false;}}
 function issue(session){session.attachment=token();session.attachExpiry=now()+attachMs;return {sessionId:session.id,attachment:session.attachment,expiresIn:attachMs/1000,provider:session.provider};}
 function output(session,value){
  if(value?.type==='ended'){session.cleanAck=value.clean===true;confirmed(session);return;}
  if(session.ended)return;
  if(value.type==='output'){
   if(!base64(value.data,90000,true)){stop(session);return;}
   if(session.socket?.readyState===WebSocket.OPEN){if(!send(session.socket,value))stop(session);}
   else{session.queue.push(value);session.queuedBytes+=value.data.length;if(session.queuedBytes>524288)stop(session);}
  }else if(value.type==='ready'){session.ready=true;send(session.socket,{type:'ready',provider:session.provider});}
  else if(value.type==='exit'){send(session.socket,{type:'exit',code:Number.isInteger(value.code)?value.code:1});stop(session);}
  else if(value.type==='error'){send(session.socket,{type:'error',message:'The private terminal could not start. Please reconnect.'});stop(session);}
 }
 async function handle(req,res){
  const path=new URL(req.url,origin).pathname;if(!path.startsWith(api+'/'))return false;
  if(disposed||!allowed(req,req.method!=='GET')){json(res,403,{error:'Terminal access denied'});return true;}
  reap();
  let own=owner(req);
  if(req.method==='GET'&&path===api+'/session'){
   if(!own){if(owners.size>=64){json(res,429,{error:'Too many browser sessions'});return true;}const id=token();own={id,csrf:token(),last:now()};owners.set(id,own);res.setHeader('Set-Cookie',`${cookieName}=${id}; HttpOnly; SameSite=Strict; Path=${api}; Max-Age=14400`);}
   own.last=now();json(res,200,{available:!!connection,providers:connection?['codex','claude']:[],csrf:own.csrf,disconnectGraceSeconds:graceMs/1000,maxSessionSeconds:MAX_SESSION_MS/1000});return true;
  }
  if(req.method!=='POST'||!own||!equal(req.headers['x-fred-terminal-token'],own.csrf)||!/^application\/json(?:;|$)/i.test(req.headers['content-type']??'')){json(res,403,{error:'Terminal access denied'});return true;}
  own.last=now();let value;try{value=await body(req);if(!value||typeof value!=='object'||Array.isArray(value))throw Error();}catch{json(res,400,{error:'Invalid terminal request'});return true;}
  if(path===api+'/start'){
   if(!connection){json(res,503,{error:'Private AI terminal is not connected on this server'});return true;}
   if(!['codex','claude'].includes(value.provider)||!dimensions(value.cols,value.rows)){json(res,400,{error:'Invalid terminal settings'});return true;}
   if(sessions.size>=maxSessions||[...sessions.values()].some(s=>s.owner===own&&s.provider===value.provider)){json(res,429,{error:'End the existing provider session before starting another'});return true;}
   let child;try{child=spawnWorker();}catch{json(res,503,{error:'Private terminal unavailable'});return true;}
   const session={id:token(),owner:own,provider:value.provider,child,created:now(),last:now(),disconnected:now(),ready:false,ended:false,cleaned:false,childClosed:false,cleanAck:null,quarantined:false,socket:null,queue:[],queuedBytes:0};session.cleanupPromise=new Promise(resolve=>{session.resolveCleanup=resolve;});sessions.set(session.id,session);
   let buffer='';child.stdout.on('data',chunk=>{buffer+=chunk.toString('utf8');if(buffer.length>150000){stop(session);return;}let newline;while((newline=buffer.indexOf('\n'))!==-1){const line=buffer.slice(0,newline);buffer=buffer.slice(newline+1);try{output(session,JSON.parse(line));}catch{stop(session);}}});
   child.stderr.on('data',()=>{});child.stdout.on('error',()=>stop(session));child.stderr.on('error',()=>stop(session));child.stdin.on('error',()=>stop(session));child.once('error',()=>{send(session.socket,{type:'error',message:'Private terminal connection failed'});stop(session);});child.once('close',code=>{session.childClosed=true;session.childCode=code;clearTimeout(session.killTimer);send(session.socket,{type:'exit',code:Number.isInteger(code)?code:1});stop(session);confirmed(session);});
   write(session,{type:'start',provider:value.provider,cols:value.cols,rows:value.rows});if(session.ended){json(res,503,{error:'Private terminal unavailable'});return true;}json(res,201,issue(session));return true;
  }
  const session=sessions.get(value.sessionId);
  if(!session||session.owner!==own){json(res,404,{error:'Terminal session unavailable'});return true;}
  if(path===api+'/attach'){if(session.ended){json(res,409,{error:'Terminal cleanup is still pending'});return true;}if(session.socket){json(res,409,{error:'Terminal is already open'});return true;}session.last=now();json(res,200,issue(session));return true;}
  if(path===api+'/end'){stop(session);if(await waitCleanup(session))json(res,200,{ok:true});else json(res,503,{error:'Terminal cleanup is still pending'});return true;}
  json(res,404,{error:'Unknown terminal action'});return true;
 }
 function upgrade(req,socket,head){
  reap();
  if(new URL(req.url,origin).pathname!==api+'/ws'||disposed||!allowed(req,true)||!owner(req)){socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();return;}
  wss.handleUpgrade(req,socket,head,ws=>{
   const own=owner(req);let session=null;const deadline=setTimeout(()=>ws.close(1008,'Attachment required'),3000);deadline.unref?.();
   ws.on('error',()=>{});
   ws.on('message',(bytes,binary)=>{
    reap();let value;try{if(binary)throw Error();value=JSON.parse(bytes.toString());if(!value||typeof value!=='object'||Array.isArray(value))throw Error();}catch{ws.close(1008,'Invalid message');return;}
    if(!session){
     const candidate=sessions.get(value.sessionId);if(value.type!=='attach'||!candidate||candidate.ended||candidate.owner!==own||candidate.socket||candidate.attachExpiry<=now()||!equal(value.attachment,candidate.attachment)){ws.close(1008,'Invalid attachment');return;}
     session=candidate;session.attachment=null;session.socket=ws;session.disconnected=null;session.last=now();clearTimeout(deadline);
     if(session.ready)send(ws,{type:'ready',provider:session.provider});for(const item of session.queue)if(!send(ws,item)){stop(session);break;}session.queue=[];session.queuedBytes=0;return;
    }
    if(session.ended||session.owner!==own||session.socket!==ws){ws.close(1008,'Session ended');return;}
    if(value.type==='input'&&base64(value.data,5464)&&Buffer.from(value.data,'base64').length<=4096){session.last=now();write(session,{type:'input',data:value.data});}
    else if(value.type==='resize'&&dimensions(value.cols,value.rows)){write(session,{type:'resize',cols:value.cols,rows:value.rows});}
    else ws.close(1008,'Invalid terminal message');
   });
   ws.on('close',()=>{clearTimeout(deadline);if(session?.socket===ws){session.socket=null;session.disconnected=now();}});
  });
 }
 function reap(){const at=now();for(const session of sessions.values())if(at-session.created>=MAX_SESSION_MS||at-session.last>=idleMs||session.disconnected!==null&&at-session.disconnected>=graceMs)stop(session);for(const [id,own] of owners)if(at-own.last>=14400000&&![...sessions.values()].some(s=>s.owner===own))owners.delete(id);}
 const timer=setInterval(reap,1000);timer.unref?.();
 function dispose(){if(disposed)return;disposed=true;clearInterval(timer);for(const session of sessions.values())stop(session);for(const ws of wss.clients)ws.terminate();wss.close();owners.clear();}
 return {handle,upgrade,dispose,reap,diagnostics:()=>({sessions:sessions.size,owners:owners.size,stopping:[...sessions.values()].filter(s=>s.ended).length,quarantined:[...sessions.values()].filter(s=>s.quarantined).length})};
}
