import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat,realpath} from 'node:fs/promises';
import {extname,join,relative} from 'node:path';
import {createAvatarSpeechHandler,loadVoiceConnection,defaultVoiceConfig} from './local-avatar-voice.mjs';
import {createTerminalBroker,loadTerminalConnection,defaultTerminalConfig} from './local-ai-terminal.mjs';
import {createPeriodSunBroker,loadPeriodSunConnection,defaultPeriodSunConfig} from './local-period-sun.mjs';

export async function startLocalWorldServer({root:directory,port=Number(process.env.ELSEMESH_PORT??18888),voiceConfig=defaultVoiceConfig(),terminalConfig=defaultTerminalConfig(),periodConfig=defaultPeriodSunConfig()}={}) {
const root=await realpath(directory);
if(!Number.isSafeInteger(port)||port<1024||port>65535)throw Error('ELSEMESH_PORT must be a number from 1024 to 65535.');
const origin='http://127.0.0.1:'+port;
const connection=await loadVoiceConnection(voiceConfig,root);
const speech=createAvatarSpeechHandler({origin,connection});
const aiTerminal=createTerminalBroker({origin,connection:await loadTerminalConnection(terminalConfig,root)});
const periodSun=createPeriodSunBroker({origin,connection:await loadPeriodSunConnection(periodConfig,root)});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary','.bin':'application/octet-stream','.woff2':'font/woff2','.mp3':'audio/mpeg'};
const server=createServer(async(req,res)=>{
 try{
  if(await aiTerminal.handle(req,res))return;
  if(await periodSun.handle(req,res))return;
  if(await speech(req,res))return;
  if(req.headers.host!==new URL(origin).host){res.writeHead(403);res.end();return;}
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
  const url=new URL(req.url,'http://127.0.0.1:'+port),name=decodeURIComponent(url.pathname);
  if(name.includes('\\')||name.includes('\0')||name.split('/').some(part=>part==='..'||part.startsWith('.'))){res.writeHead(404);res.end();return;}
  const file=await realpath(join(root,name==='/'?'index.html':name));
  const rel=relative(root,file),info=await stat(file);
  if(!rel||rel.startsWith('..')||!info.isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream','Content-Length':info.size,'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});
  if(req.method==='HEAD')res.end();else createReadStream(file).pipe(res);
 }catch{res.writeHead(404);res.end();}
});
server.on('upgrade',(req,socket,head)=>{
 if(!periodSun.upgrade(req,socket,head))aiTerminal.upgrade(req,socket,head);
});
const closeBrokers=()=>{periodSun.close();aiTerminal.dispose();};
server.once('close',closeBrokers);
const shutdown=()=>{closeBrokers();server.close();};
process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
server.once('close',()=>{process.removeListener('SIGTERM',shutdown);process.removeListener('SIGINT',shutdown);});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
console.log('Fred: '+origin+'/');
return server;
}
