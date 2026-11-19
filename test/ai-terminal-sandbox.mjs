import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import net from 'node:net';
import {publicAddress,pinnedAddress,startConnectProxy,PROVIDER_HOSTS} from '../tools/ai-terminal-proxy.mjs';

test('CONNECT address classifier rejects local, metadata, reserved and mapped address families',()=>{
 for(const address of ['0.0.0.0',('' + ('' + '10.' + '3.2.1' + '') + ''),'127.0.0.1','100.64.0.1','100.127.255.255','169.254.169.254',('' + ('' + '172.' + '16.0.1' + '') + ''),('' + ('' + '172.' + '31.255.255' + '') + ''),('' + ('' + '192.' + '168.1.1' + '') + ''),'192.0.0.1','192.0.2.1','192.88.99.1','198.18.0.1','198.19.255.255','198.51.100.1','203.0.113.1','224.0.0.1','255.255.255.255','::','::1','fc00::1','fe80::1','::ffff:127.0.0.1','::ffff:7f00:1','2001:db8::1','3fff::1','2001::1','2002:0808:0808::1','fe80::1%lo','not-an-ip'])assert.equal(publicAddress(address),false,address);
 for(const address of ['8.8.8.8','1.1.1.1','104.18.2.2','2606:4700:4700::1111','2001:4860:4860::8888'])assert.equal(publicAddress(address),true,address);
});

test('DNS pinning evaluates all records once and denies mixed public/private answers',async()=>{
 let calls=0;const lookup=async(host,options)=>{calls++;assert.equal(host,'auth.openai.com');assert.deepEqual(options,{all:true,verbatim:true});return [{address:'8.8.8.8',family:4},{address:'127.0.0.1',family:4}];};
 await assert.rejects(pinnedAddress('auth.openai.com',lookup));assert.equal(calls,1);
 for(const records of [[],[{address:'8.8.8.8',family:6}],[{address:'::ffff:8.8.8.8',family:6}]])await assert.rejects(pinnedAddress('auth.openai.com',async()=>records));
 assert.deepEqual(await pinnedAddress('auth.openai.com',async()=>[{address:'8.8.8.8',family:4}]),{address:'8.8.8.8',family:4});
});

async function request(path,text){return new Promise((resolve,reject)=>{const socket=net.connect(path);let result='';socket.setTimeout(3000,()=>{socket.destroy();reject(Error('proxy response timeout'));});socket.on('error',reject);socket.on('connect',()=>socket.write(text));socket.on('data',data=>{result+=data.toString();if(result.includes('\r\n\r\n')){socket.destroy();resolve(result);}});socket.on('end',()=>resolve(result));});}

test('real Unix CONNECT proxy rejects all unlisted authorities and ordinary HTTP without DNS', {skip:process.platform==='win32'},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'fred-ai-'));let lookups=0;const path=join(directory,'p.sock');const proxy=await startConnectProxy({socketPath:path,provider:'codex',lookup:async()=>{lookups++;return [{address:'8.8.8.8',family:4}];}});
 try{
  for(const authority of ['localhost:443','127.0.0.1:443','auth.openai.com:80','AUTH.OPENAI.COM:443','auth.openai.com.:443','auth.openai.com.evil.test:443','auth.openai.com@127.0.0.1:443','[::1]:443','auth.openai.com:443/path'])assert.match(await request(path,'CONNECT '+authority+' HTTP/1.1\r\nHost: '+authority+'\r\n\r\n'),/403/);
  assert.match(await request(path,'GET http://auth.openai.com/ HTTP/1.1\r\nHost: auth.openai.com\r\n\r\n'),/405/);assert.equal(lookups,0);
 }finally{await proxy.close();await rm(directory,{recursive:true,force:true});}
});

test('CONNECT establishes only a validated pinned IP and transports opaque bytes', {skip:process.platform==='win32'},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'fred-ai-'));const path=join(directory,'p.sock');const upstream=net.createServer(socket=>socket.on('data',data=>socket.write(data)));
 await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve));let connects=0,lookups=0;
 const proxy=await startConnectProxy({socketPath:path,provider:'codex',lookup:async()=>{lookups++;return [{address:'8.8.8.8',family:4}];},connect:options=>{connects++;assert.deepEqual(options,{host:'8.8.8.8',family:4,port:443});return net.connect(upstream.address().port,'127.0.0.1');}});
 let client;
 try{
  const result=await new Promise((resolve,reject)=>{client=net.connect(path);let text='',sent=false;client.setTimeout(3000,()=>reject(Error('tunnel timeout')));client.on('error',reject);client.on('connect',()=>client.write('CONNECT auth.openai.com:443 HTTP/1.1\r\nHost: auth.openai.com:443\r\n\r\n'));client.on('data',data=>{text+=data.toString();if(text.includes('200 Connection Established')&&!sent){sent=true;client.write('opaque-test');}if(text.includes('opaque-test'))resolve(text);});});
  assert.match(result,/opaque-test/);assert.equal(connects,1);assert.equal(lookups,1);
 }finally{client?.destroy();await proxy.close();await new Promise(resolve=>upstream.close(resolve));await rm(directory,{recursive:true,force:true});}
});

test('proxy rejects rebinding DNS answer before opening any connection', {skip:process.platform==='win32'},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'fred-ai-'));const path=join(directory,'p.sock');let connects=0;
 const proxy=await startConnectProxy({socketPath:path,provider:'codex',lookup:async()=>[{address:'8.8.8.8',family:4},{address:'169.254.169.254',family:4}],connect:()=>{connects++;throw Error('must not connect');}});
 try{assert.match(await request(path,'CONNECT auth.openai.com:443 HTTP/1.1\r\nHost: auth.openai.com:443\r\n\r\n'),/403/);assert.equal(connects,0);}finally{await proxy.close();await rm(directory,{recursive:true,force:true});}
});

test('provider allowlists are fixed exact hosts, and sandbox has no production command field',async()=>{
 assert.ok(PROVIDER_HOSTS.codex.includes('auth.openai.com'));assert.ok(PROVIDER_HOSTS.claude.includes('api.anthropic.com'));
 assert.ok(Object.values(PROVIDER_HOSTS).flat().every(host=>/^[a-z0-9.-]+$/.test(host)&&!host.includes('*')));
 const source=await readFile(new URL('../tools/ai-terminal-sandbox.py',import.meta.url),'utf8');
 assert.match(source,/set\(data\)==\{'type','provider','cols','rows'\}/);assert.match(source,/CPUQuota=50%/);assert.match(source,/MemoryMax=1536M/);assert.match(source,/MemorySwapMax=0/);assert.match(source,/--unshare-all/);assert.match(source,/--remount-ro/);assert.match(source,/--kill-whom=all/);assert.match(source,/ai-terminal-watchdog.py/);
});
