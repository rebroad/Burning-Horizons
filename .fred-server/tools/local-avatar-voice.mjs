import {randomBytes, timingSafeEqual} from 'node:crypto';
import {spawn} from 'node:child_process';
import {readFile, realpath} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join, relative, isAbsolute, sep} from 'node:path';
import {cleanSpeechText, MAX_SPEECH_LENGTH} from '../src/network/SpeechText.js';

const maxAudioBytes=1_800_000;
const maxRequestBytes=2048;
const api='/api/avatar-voice';
export const defaultVoiceConfig=()=>process.env.FRED_VOICE_CONFIG??join(homedir(),'.config','fred','voice.json');
export function validateVoiceConnection(value) {
 if(!value||Object.keys(value).sort().join(',')!=='configuration,helper,host,lock,port')throw Error('Invalid voice connection');
 if(!/^[a-zA-Z0-9][a-zA-Z0-9.-]{0,100}$/.test(value.host)||!Number.isInteger(value.port)||value.port<1||value.port>65535)throw Error('Invalid voice host');
 for(const key of ['helper','configuration','lock'])if(typeof value[key]!=='string'||!/^\/[a-zA-Z0-9_./-]+$/.test(value[key])||value[key].split('/').includes('..'))throw Error('Invalid voice helper path');
 return value;
}
export function validVoiceWav(audio) {
 return Buffer.isBuffer(audio)&&audio.length>=44&&audio.length<=maxAudioBytes&&audio.toString('ascii',0,4)==='RIFF'&&audio.toString('ascii',8,12)==='WAVE'&&audio.readUInt32LE(4)+8===audio.length;
}

// Only operator configuration forms this command. Spoken text travels on stdin.
// flock spans helpers and local server restarts. The remote helper probes the
// single-threaded worker before submitting, including after an uncertain exit.
export function synthesizeOverSSH(connection,text,{spawnProcess=spawn,timeoutMs=145000}={}) {
 return new Promise((resolve,reject)=>{
  const args=['-T','-p',String(connection.port),'-o','BatchMode=yes','-o','ConnectTimeout=8','-o','ServerAliveInterval=10','-o','ServerAliveCountMax=3',connection.host,
   `flock --nonblock --conflict-exit-code 75 ${connection.lock} node ${connection.helper} ${connection.configuration}`];
  const child=spawnProcess('ssh',args,{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});
  let size=0,failed=false,finished=false;const chunks=[];
  const timer=setTimeout(()=>{failed=true;child.kill();},timeoutMs);timer.unref?.();
  child.stdout.on('data',chunk=>{size+=chunk.length;if(size>maxAudioBytes){failed=true;child.kill();}else chunks.push(chunk);});
  // Consume and discard remote diagnostics. They must never enter the response.
  child.stderr.on('data',()=>{});child.stdin.on('error',()=>{});
  child.once('error',()=>{finished=true;clearTimeout(timer);reject(Error('Voice connection unavailable'));});
  child.once('close',code=>{
   if(finished)return;finished=true;clearTimeout(timer);
   if(code===75)return reject(Object.assign(Error('Voice is still finishing a line. Try again shortly.'),{status:429}));
   const audio=Buffer.concat(chunks);
   if(failed||code!==0||!validVoiceWav(audio))return reject(Error('Voice generation unavailable. Please try again shortly.'));
   resolve(audio);
  });
  child.stdin.end(JSON.stringify({text}));
 });
}

export async function loadVoiceConnection(configPath,staticRoot) {
 try {
  const file=await realpath(configPath),root=await realpath(staticRoot),rel=relative(root,file);
  if(!(rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel)))throw Error('Voice settings must be outside the game folder');
  return validateVoiceConnection(JSON.parse(await readFile(file,'utf8')));
 }catch(error){if(error.code==='ENOENT')return null;throw error;}
}
function json(res,status,value) {
 if(res.destroyed||res.writableEnded)return;
 res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));
}
async function readRequest(req) {
 let size=0;const chunks=[];
 for await(const chunk of req){size+=chunk.length;if(size>maxRequestBytes)throw Error('Request too large');chunks.push(chunk);}
 const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 if(!value||Array.isArray(value)||Object.keys(value).join(',')!=='text'||typeof value.text!=='string'||value.text.length>MAX_SPEECH_LENGTH)throw Error('Invalid speech');
 const text=cleanSpeechText(value.text);if(!text)throw Error('Type a line first');return text;
}
export function createAvatarSpeechHandler({origin,connection=null,synthesize=text=>synthesizeOverSSH(connection,text)}) {
 const expected=new URL(origin);if(expected.protocol!=='http:'||expected.hostname!=='127.0.0.1')throw Error('Local voice requires loopback');
 const token=randomBytes(32).toString('hex');let busy=false;
 return async(req,res)=>{
  const path=req.url?.split('?')[0];if(path!==api&&path!==api+'/session')return false;
  if(req.url!==path||req.headers.host!==expected.host||req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&req.headers.origin!==origin)){json(res,403,{error:'Open voice controls from this Fred window.'});return true;}
  if(path===api+'/session'){
   if(req.method!=='GET'){json(res,405,{error:'Method unavailable'});return true;}
   json(res,200,connection?{available:true,token,maxCharacters:MAX_SPEECH_LENGTH}:{available:false,maxCharacters:MAX_SPEECH_LENGTH,message:'Your private voice connection is unavailable on this installation.'});return true;
  }
  const supplied=req.headers['x-fred-voice-token'];
  if(req.method!=='POST'||req.headers.origin!==origin||req.headers['content-type']!=='application/json'||typeof supplied!=='string'||!/^[a-f0-9]{64}$/.test(supplied)||!timingSafeEqual(Buffer.from(supplied),Buffer.from(token))){json(res,403,{error:'Reopen Fred voice controls and try again.'});return true;}
  if(!connection){json(res,503,{error:'Your private voice connection is unavailable.'});return true;}
  if(Number(req.headers['content-length']??0)>maxRequestBytes){json(res,413,{error:'Please shorten your line.'});req.resume();return true;}
  let text;try{text=await readRequest(req);}catch{json(res,400,{error:`Type between 1 and ${MAX_SPEECH_LENGTH} characters.`});return true;}
  if(req.aborted||res.destroyed)return true;
  if(busy){json(res,429,{error:'Voice is still finishing a line. Try again shortly.'});return true;}
  busy=true;
  // Browser Stop suppresses playback but does not free a still-computing job.
  // Keep this slot until SSH/helper completion, even after client disconnect.
  try {
   const audio=await synthesize(text);if(!validVoiceWav(audio))throw Error('Invalid voice result');
   if(!res.destroyed&&!res.writableEnded){res.writeHead(200,{'Content-Type':'audio/wav','Content-Length':audio.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(audio);}
  }catch(error){json(res,error.status===429?429:503,{error:error.status===429?'Voice is still finishing a line. Try again shortly.':'Voice generation is unavailable. Please try again shortly.'});}
  finally{busy=false;}
  return true;
 };
}
