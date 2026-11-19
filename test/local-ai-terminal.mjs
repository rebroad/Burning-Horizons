import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request} from 'node:http';
import {EventEmitter,once} from 'node:events';
import {PassThrough} from 'node:stream';
import {WebSocket} from 'ws';
import {createTerminalBroker} from '../tools/local-ai-terminal.mjs';

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(predicate,timeout=1500){const end=Date.now()+timeout;while(!predicate()){if(Date.now()>end)throw Error('Condition did not settle');await wait(5);}}
function fakeChild(){
 const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();child.commands=[];child.kills=0;child.pressure=0;child.autoClean=true;
 Object.defineProperty(child.stdin,'writableLength',{get:()=>child.pressure});let pending='';child.stdin.on('data',chunk=>{pending+=chunk.toString();let end;while((end=pending.indexOf('\n'))!==-1){const message=JSON.parse(pending.slice(0,end));child.commands.push(message);pending=pending.slice(end+1);if(message.type==='stop'&&child.autoClean)setImmediate(()=>child.clean());}});
 child.clean=()=>{child.emitOutput({type:'ended',clean:true});child.closed=true;child.emit('close',0);};child.kill=()=>{child.kills++;child.closed=true;child.emit('close',1);return true;};child.emitOutput=value=>child.stdout.write(JSON.stringify(value)+'\n');return child;
}
async function fixture(t,options={}){
 const children=[],clients=[];let clock=100000,broker;
 const server=createServer(async(req,res)=>{try{if(!await broker.handle(req,res)){res.writeHead(404);res.end();}}catch(error){res.writeHead(500);res.end(error.message);}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 broker=createTerminalBroker({origin,connection:{host:'fixture',port:22,worker:'/fixture.py'},spawnWorker:()=>{const child=fakeChild();children.push(child);return child;},now:()=>clock,graceMs:60,idleMs:1000,attachMs:50,killMs:15,endWaitMs:40,...options});server.on('upgrade',(req,socket,head)=>broker.upgrade(req,socket,head));
 t.after(async()=>{for(const client of clients)client.terminate();broker.dispose();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await wait(20);});
 const http=async(path='/session',{method='GET',owner,body,raw,headers={}}={})=>{
  const data=raw??(body===undefined?undefined:JSON.stringify(body));
  return new Promise((resolve,reject)=>{const req=request(origin+'/api/ai-terminal'+path,{method,headers:{Origin:origin,...(owner?{Cookie:owner.cookie,'X-Fred-Terminal-Token':owner.csrf}:{}),...(data!==undefined?{'Content-Type':'application/json'}:{}),...headers}},res=>{let text='';res.on('data',chunk=>text+=chunk);res.on('end',()=>{let value;try{value=JSON.parse(text);}catch{value=text;}resolve({status:res.statusCode,headers:res.headers,value});});});req.on('error',reject);req.end(data);});
 };
 const owner=async()=>{const result=await http();assert.equal(result.status,200);return {cookie:result.headers['set-cookie'][0].split(';')[0],csrf:result.value.csrf,result};};
 const start=async(own,provider='codex',extra={})=>{const result=await http('/start',{method:'POST',owner:own,body:{provider,cols:80,rows:24,...extra}});assert.equal(result.status,201,JSON.stringify(result.value));return result.value;};
 const socket=async(own,headers={})=>{const ws=new WebSocket(origin.replace('http:','ws:')+'/api/ai-terminal/ws',{headers:{Origin:origin,Cookie:own.cookie,...headers}});clients.push(ws);ws.messages=[];ws.on('message',bytes=>ws.messages.push(JSON.parse(bytes.toString())));await once(ws,'open');return ws;};
 const attach=async(own,cap)=>{const ws=await socket(own);ws.send(JSON.stringify({type:'attach',sessionId:cap.sessionId,attachment:cap.attachment}));await wait(10);return ws;};
 const close=async ws=>{if(ws.readyState===WebSocket.CLOSED)return;const closed=once(ws,'close');ws.close();await closed;await wait(15);};
 return {broker,origin,http,owner,start,socket,attach,close,children,clients,advance:ms=>{clock+=ms;}};
}
test('terminal broker only admits an exact HTTP127 loopback origin',()=>{
 for(const origin of ['https://127.0.0.1:9000','http://localhost:9000','http://0.0.0.0:9000',('http://' + ('' + '192.' + '168.1.2' + '') + ':9000'),'http://user@127.0.0.1:9000','http://127.0.0.1:9000/','http://127.0.0.1:9000/path'])assert.throws(()=>createTerminalBroker({origin}),/loopback/);
});
test('actual HTTP capability uses HttpOnly owner cookie, exact origin/host and CSRF; unicode/null/malformed bodies fail closed',async t=>{
 const f=await fixture(t),owner=await f.owner();assert.match(owner.result.headers['set-cookie'][0],/HttpOnly; SameSite=Strict; Path=\/api\/ai-terminal/);assert.equal(owner.result.headers['cache-control'],'no-store');assert.equal(owner.result.value.available,true);assert.deepEqual(owner.result.value.providers,['codex','claude']);assert.match(owner.csrf,/^[A-Za-z0-9_-]{43}$/);
 assert.equal(owner.result.value.maxSessionSeconds,1800);
 for(const headers of [{Origin:'https://evil.test'},{Origin:''},{Host:'localhost:'+new URL(f.origin).port},{'Sec-Fetch-Site':'cross-site'},{'X-Fred-Terminal-Token':'é'.repeat(43)},{'X-Fred-Terminal-Token':'x'.repeat(43)},{'Content-Type':'text/plain'}])assert.equal((await f.http('/start',{method:'POST',owner,body:{provider:'codex',cols:80,rows:24},headers})).status,403);
 assert.equal((await f.http('/start',{method:'POST',body:{provider:'codex',cols:80,rows:24}})).status,403);
 for(const raw of ['null','[]','42','"text"','{','x'.repeat(2100)])assert.equal((await f.http('/start',{method:'POST',owner,raw})).status,400);
 assert.equal(f.children.length,0);assert.equal((await f.http()).status,200,'malformed requests did not kill broker');
});
test('owner isolation applies to HTTP/end/attach and WebSocket capability; consumed or rotated tokens cannot replay',async t=>{
 const f=await fixture(t),a=await f.owner(),b=await f.owner(),cap=await f.start(a);
 for(const path of ['/attach','/end'])assert.equal((await f.http(path,{method:'POST',owner:b,body:{sessionId:cap.sessionId}})).status,404);
 const wrong=await f.socket(b),denied=once(wrong,'close');wrong.send(JSON.stringify({type:'attach',...cap}));assert.equal((await denied)[0],1008);
 const rotated=await f.http('/attach',{method:'POST',owner:a,body:{sessionId:cap.sessionId}});assert.equal(rotated.status,200);assert.notEqual(rotated.value.attachment,cap.attachment);
 const old=await f.socket(a),oldClosed=once(old,'close');old.send(JSON.stringify({type:'attach',...cap}));assert.equal((await oldClosed)[0],1008);
 const ws=await f.attach(a,rotated.value);assert.equal(ws.readyState,WebSocket.OPEN);assert.equal((await f.http('/attach',{method:'POST',owner:a,body:{sessionId:cap.sessionId}})).status,409);
 const replay=await f.socket(a),replayed=once(replay,'close');replay.send(JSON.stringify({type:'attach',...rotated.value}));assert.equal((await replayed)[0],1008);
 await f.close(ws);const consumed=await f.socket(a),consumedClosed=once(consumed,'close');consumed.send(JSON.stringify({type:'attach',...rotated.value}));assert.equal((await consumedClosed)[0],1008);
});
test('actual websocket rejects forged Origin/Host/no cookie before upgrade, malformed JSON/null/binary and expired capabilities',async t=>{
 const f=await fixture(t),owner=await f.owner(),cap=await f.start(owner);
 for(const headers of [{Origin:'https://evil.test'},{Origin:''},{Host:'evil.test'},{Cookie:''},{'Sec-Fetch-Site':'cross-site'}]){
  const ws=new WebSocket(f.origin.replace('http:','ws:')+'/api/ai-terminal/ws',{headers:{Origin:f.origin,Cookie:owner.cookie,...headers}});f.clients.push(ws);ws.on('error',()=>{});const response=await new Promise(resolve=>ws.on('unexpected-response',(_req,res)=>{res.resume();ws.terminate();resolve(res.statusCode);}));assert.equal(response,403);
 }
 for(const payload of ['null','[]','{',JSON.stringify({type:'attach',...cap,attachment:'é'.repeat(43)})]){const ws=await f.socket(owner),closed=once(ws,'close');ws.send(payload);assert.equal((await closed)[0],1008);}
 const binary=await f.socket(owner),closed=once(binary,'close');binary.send(Buffer.from('{}'));assert.equal((await closed)[0],1008);
 f.advance(51);const expired=await f.socket(owner),expiredClosed=once(expired,'close');expired.send(JSON.stringify({type:'attach',...cap}));assert.equal((await expiredClosed)[0],1008);
});
test('actual PTY protocol forwards ready without claiming login, UTF8 input and exact dimension bounds',async t=>{
 const f=await fixture(t),owner=await f.owner(),cap=await f.start(owner,'claude'),child=f.children[0];assert.deepEqual(child.commands[0],{type:'start',provider:'claude',cols:80,rows:24});child.emitOutput({type:'ready'});child.emitOutput({type:'output',data:Buffer.from('official CLI\r\n').toString('base64')});
 const ws=await f.attach(owner,cap);await until(()=>ws.messages.length===2);assert.deepEqual(ws.messages[0],{type:'ready',provider:'claude'});assert.equal('authenticated' in ws.messages[0],false);assert.equal(Buffer.from(ws.messages[1].data,'base64').toString(),'official CLI\r\n');
 for(const [cols,rows]of [[20,20],[300,300]])ws.send(JSON.stringify({type:'resize',cols,rows}));ws.send(JSON.stringify({type:'input',data:Buffer.from('λ😀\r').toString('base64')}));ws.send(JSON.stringify({type:'input',data:Buffer.alloc(4096,120).toString('base64')}));await until(()=>child.commands.length===5);assert.equal(Buffer.from(child.commands[3].data,'base64').toString(),'λ😀\r');assert.equal(Buffer.from(child.commands[4].data,'base64').length,4096);
});
test('invalid settings and websocket input/resize bounds including noncanonical base64 are rejected',async t=>{
 const f=await fixture(t),owner=await f.owner();for(const extra of [{cols:19},{rows:19},{cols:301},{rows:301},{rows:20.5},{provider:'shell'}])assert.equal((await f.http('/start',{method:'POST',owner,body:{provider:'codex',cols:80,rows:24,...extra}})).status,400);
 const cap=await f.start(owner);for(const value of [{type:'input',data:Buffer.alloc(4097).toString('base64')},{type:'input',data:'Zg='},{type:'input',data:'Zh=='},{type:'input',data:''},{type:'input',data:'!!!!'},{type:'resize',cols:20,rows:19},{type:'resize',cols:301,rows:20},{type:'unknown'}]){
  const refreshed=await f.http('/attach',{method:'POST',owner,body:{sessionId:cap.sessionId}});const ws=await f.attach(owner,refreshed.value),closed=once(ws,'close');ws.send(JSON.stringify(value));assert.equal((await closed)[0],1008);await wait(5);
 }
 assert.equal(f.children[0].commands.length,1,'no invalid command reached PTY');
});
test('disconnect resumes one PTY within grace; expired grace/idle/end request and verify child cleanup',async t=>{
 const f=await fixture(t),owner=await f.owner(),cap=await f.start(owner),ws=await f.attach(owner,cap);await f.close(ws);assert.equal(f.broker.diagnostics().sessions,1);
 f.advance(20);const resume=await f.http('/attach',{method:'POST',owner,body:{sessionId:cap.sessionId}});assert.equal(resume.status,200);f.children[0].emitOutput({type:'output',data:Buffer.from('while detached').toString('base64')});const again=await f.attach(owner,resume.value);assert.equal(f.children.length,1);await until(()=>again.messages.some(m=>m.type==='output'));await f.close(again);await wait(5);f.advance(61);
 assert.equal((await f.http('/attach',{method:'POST',owner,body:{sessionId:cap.sessionId}})).status,409,'expiry immediately begins cleanup before timer reap');await until(()=>f.broker.diagnostics().sessions===0);await until(()=>f.children[0].closed===true);assert.ok(f.children[0].commands.some(m=>m.type==='stop'));
 const next=await f.start(owner),active=await f.attach(owner,next);f.advance(1001);f.broker.reap();await until(()=>active.readyState===WebSocket.CLOSED);await until(()=>f.broker.diagnostics().sessions===0);assert.equal(f.broker.diagnostics().sessions,0);await until(()=>f.children[1].closed===true);
 const last=await f.start(owner);const ended=await f.http('/end',{method:'POST',owner,body:{sessionId:last.sessionId}});assert.equal(ended.status,200);assert.deepEqual(ended.value,{ok:true});await until(()=>f.children[2].closed===true);await until(()=>f.broker.diagnostics().sessions===0);assert.equal(f.broker.diagnostics().sessions,0);
});
test('End waits for final clean acknowledgement AND SSH close0; pending/quarantined sessions still occupy capacity',async t=>{
 const f=await fixture(t,{killMs:1000,endWaitMs:50}),owner=await f.owner(),first=await f.start(owner,'codex'),second=await f.start(owner,'claude');f.children.forEach(child=>{child.autoClean=false;});
 let resolved=false;const ending=f.http('/end',{method:'POST',owner,body:{sessionId:first.sessionId}}).then(result=>{resolved=true;return result;});await wait(5);assert.equal(f.broker.diagnostics().sessions,2);assert.equal(f.broker.diagnostics().stopping,1);
 const other=await f.owner();assert.equal((await f.http('/start',{method:'POST',owner:other,body:{provider:'codex',cols:80,rows:24}})).status,429);
 f.children[0].emitOutput({type:'ended',clean:true});await wait(5);assert.equal(resolved,false,'ack alone cannot claim remote process exit');assert.equal(f.broker.diagnostics().sessions,2);f.children[0].closed=true;f.children[0].emit('close',0);assert.equal((await ending).status,200);assert.equal(f.broker.diagnostics().sessions,1);
 const bad=f.http('/end',{method:'POST',owner,body:{sessionId:second.sessionId}});await wait(5);f.children[1].emitOutput({type:'ended',clean:false});f.children[1].closed=true;f.children[1].emit('close',0);assert.equal((await bad).status,503);assert.equal(f.broker.diagnostics().sessions,1);assert.equal(f.broker.diagnostics().quarantined,1);assert.equal((await f.http('/attach',{method:'POST',owner,body:{sessionId:second.sessionId}})).status,409);assert.equal((await f.http('/start',{method:'POST',owner,body:{provider:'claude',cols:80,rows:24}})).status,429);
});
test('SSH close without cleanup proof and forced transport kill remain quarantined without false successful End',async t=>{
 const f=await fixture(t,{killMs:15,endWaitMs:40}),owner=await f.owner(),cap=await f.start(owner);const child=f.children[0];child.autoClean=false;child.closed=true;child.emit('close',0);assert.equal((await f.http('/end',{method:'POST',owner,body:{sessionId:cap.sessionId}})).status,503);assert.equal(f.broker.diagnostics().sessions,1);assert.equal(f.broker.diagnostics().quarantined,1);
 const second=await f.start(owner,'claude'),forced=f.children[1];forced.autoClean=false;assert.equal((await f.http('/end',{method:'POST',owner,body:{sessionId:second.sessionId}})).status,503);assert.equal(forced.kills,1);assert.equal(f.broker.diagnostics().quarantined,2);assert.equal(f.broker.diagnostics().sessions,2);
});
test('startup failures, child errors/exits and malformed/oversized detached output never leave a live session',async t=>{
 const throwing=await fixture(t,{spawnWorker(){throw Error('private details must not leak');}}),owner=await throwing.owner();const failed=await throwing.http('/start',{method:'POST',owner,body:{provider:'codex',cols:80,rows:24}});assert.equal(failed.status,503);assert.doesNotMatch(JSON.stringify(failed.value),/private details/);assert.equal(throwing.broker.diagnostics().sessions,0);
 const f=await fixture(t),a=await f.owner();let cap=await f.start(a),child=f.children.at(-1);child.emit('error',Error('ssh secret'));await until(()=>f.broker.diagnostics().sessions===0);assert.equal(f.broker.diagnostics().sessions,0);await until(()=>child.closed===true);
 cap=await f.start(a);child=f.children.at(-1);const ws=await f.attach(a,cap);child.emitOutput({type:'error',message:'DO NOT EXPOSE THIS LOGIN CODE'});await until(()=>ws.readyState===WebSocket.CLOSED);assert.ok(ws.messages.some(m=>m.type==='error'));assert.doesNotMatch(JSON.stringify(ws.messages),/LOGIN CODE/);await until(()=>f.broker.diagnostics().sessions===0);assert.equal(f.broker.diagnostics().sessions,0);
 await f.start(a);child=f.children.at(-1);child.emitOutput({type:'output',data:'Zh=='});await until(()=>f.broker.diagnostics().sessions===0);assert.equal(f.broker.diagnostics().sessions,0);
 await f.start(a);child=f.children.at(-1);for(let i=0;i<12&&f.broker.diagnostics().sessions;i++)child.emitOutput({type:'output',data:Buffer.alloc(49152).toString('base64')});await until(()=>f.broker.diagnostics().sessions===0);assert.equal(f.broker.diagnostics().sessions,0,'detached output queue remains bounded');
});
test('slow actual WebSocket receivers and backed-up PTY stdin are terminated with bounded memory',async t=>{
 const f=await fixture(t),owner=await f.owner(),cap=await f.start(owner),ws=await f.attach(owner,cap),child=f.children[0];ws._socket.pause();const data=Buffer.alloc(49152,120).toString('base64');let chunks=0;
 for(;chunks<1024&&!f.broker.diagnostics().stopping;chunks++)child.emitOutput({type:'output',data});await until(()=>f.broker.diagnostics().sessions===0);assert.equal(f.broker.diagnostics().sessions,0,'output receiver backpressure must stop session');assert.ok(chunks<1024);ws._socket.resume();await until(()=>ws.readyState===WebSocket.CLOSED,3000);await until(()=>child.closed===true);
 const second=await f.start(owner),live=await f.attach(owner,second),backed=f.children[1];backed.pressure=65537;live.send(JSON.stringify({type:'input',data:'eA=='}));await until(()=>f.broker.diagnostics().sessions===0);await until(()=>backed.closed===true);
});
test('terminal hard lifetime expires at30minutes even when recent input prevents idle expiry',async t=>{
 const f=await fixture(t,{idleMs:3600000}),owner=await f.owner(),cap=await f.start(owner),ws=await f.attach(owner,cap);
 f.advance(1799999);ws.send(JSON.stringify({type:'input',data:'eA=='}));await until(()=>f.children[0].commands.some(m=>m.type==='input'));assert.equal(f.broker.diagnostics().sessions,1);f.advance(1);f.broker.reap();await until(()=>f.broker.diagnostics().sessions===0);assert.equal(f.broker.diagnostics().sessions,0);await until(()=>f.children[0].closed===true);
});
