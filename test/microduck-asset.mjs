import {BASE_WALK_SPEED,NAV_DEFAULTS} from '../src/npc/Navigation.js';
import {createHash} from 'node:crypto';
import {MICRODUCK_ASSET_VERSION,MICRODUCK_BYTES} from '../src/npc/MicroduckSpec.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseGLB} from '../src/engine/loaders/GLTF.js';
import {RigidCharacterVisual} from '../src/npc/RigidCharacterVisual.js';
import {Vector3} from '../src/engine/index.js';
const bytes=await readFile(new URL('../public/models/microduck/microduck-realtime.glb',import.meta.url)),data=parseGLB(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
test('installed GLB bytes match declared runtime version',()=>{assert.equal(bytes.length,MICRODUCK_BYTES);assert.equal('sha256:'+createHash('sha256').update(bytes).digest('hex'),MICRODUCK_ASSET_VERSION);});
for(const native of [false,true])test('installed authentic rigid asset loads and animates in '+(native?'native':'WebGL')+' scene adapter',async()=>{
 const visual=new RigidCharacterVisual({native,load:async()=>data});await visual.ready;assert.equal(visual.nodes.length,114);assert.equal(data.skins.length,0);assert.equal(data.images.length,0);
 const bounds=()=>{visual.root.updateMatrixWorld(true);const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],v=new Vector3();visual.root.traverse(n=>{if(!n.isMesh)return;const a=n.geometry.getAttribute('position');for(let i=0;i<a.count;i++){v.set(a.getX(i),a.getY(i),a.getZ(i)).applyMatrix4(n.matrixWorld);for(let k=0;k<3;k++){const value=[v.x,v.y,v.z][k];assert.ok(Number.isFinite(value));min[k]=Math.min(min[k],value);max[k]=Math.max(max[k],value);}}});return {min,max};};
 const rest=bounds();console.log(native,JSON.stringify(rest));assert.ok(Math.abs(rest.max[1]-rest.min[1]-.25)<.002);assert.ok(Math.abs(rest.min[1])<.002);
 visual.sample('Walk',0);const before=visual.nodes.map(n=>n.quaternion.toArray());visual.sample('Walk',.21);assert.ok(visual.nodes.some((n,i)=>n.quaternion.toArray().some((v,j)=>Math.abs(v-before[i][j])>.01)));const walking=bounds();assert.ok(walking.max[1]<.3);assert.ok(walking.min[1]>-.03);
 for(const clip of ['Idle','Walk','Turn','Stop','Look','EnterPortal','ExitPortal']){visual.sample(clip,1000.2);for(const n of visual.nodes)assert.ok([...n.position.toArray(),...n.quaternion.toArray()].every(Number.isFinite));}
 visual.dispose();visual.dispose();assert.equal(visual.root.children.length,0);
});

test('disposing a preview leaves another visual from the same immutable source intact',async()=>{const a=new RigidCharacterVisual({load:async()=>data}),b=new RigidCharacterVisual({load:async()=>data});await Promise.all([a.ready,b.ready]);assert.notEqual(a.geometries[0],b.geometries[0]);assert.notEqual(a.materials[0],b.materials[0]);a.dispose();b.sample('Walk',.3);assert.ok(b.root.children.length>0);assert.ok(b.nodes.every(n=>n.quaternion.toArray().every(Number.isFinite)));b.dispose();});

test('navigation units match the measured asset gait and conservative collision envelope',async()=>{const manifest=JSON.parse(await readFile(new URL('../public/models/microduck/manifest.json',import.meta.url),'utf8')),proxy=JSON.parse(await readFile(new URL('../public/models/microduck/collision-proxy.json',import.meta.url),'utf8'));assert.equal(BASE_WALK_SPEED,manifest.clips.Walk.display_forward_speed_m_s);assert.equal(NAV_DEFAULTS.radius,proxy.radius);assert.equal(NAV_DEFAULTS.height,proxy.height);});


test('optional installed model rejects an oversized stream before allocation or parsing',async()=>{
 const {loadPinnedMicroduck}=await import('../src/npc/RigidCharacterVisual.js');let cancelled=0;
 await assert.rejects(loadPinnedMicroduck('oversized-test',{fetcher:async()=>({ok:true,headers:new Headers(),body:{getReader:()=>({read:async()=>({done:false,value:new Uint8Array(MICRODUCK_BYTES+1)}),cancel:async()=>{cancelled++;}})}})}),/exceeds byte limit/);assert.equal(cancelled,1);
});
test('a stalled HTTP model body has a deadline and optional duck installation fails soft',async t=>{
 const {createServer}=await import('node:http'),{loadPinnedMicroduck}=await import('../src/npc/RigidCharacterVisual.js'),{PublicMicroduck}=await import('../src/world-runtime/PublicMicroduck.js');
 const server=createServer((req,res)=>{res.writeHead(200,{'Content-Type':'model/gltf-binary'});res.write(Buffer.from([1,2,3]));});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
 const root=new (await import('../src/world-runtime/vendor/world-engine-contract.js')).T.Group(),candidate={root,descriptor:{worldId:'a'},terrain:{heightAt:()=>0},colliders:{}},runtime={catalog:{openingWorldId:'a',worlds:[{worldId:'a'},{worldId:'b'}]},entry:id=>id==='a'?{contentDigest:'a'}:null,enabled:true};
 const duck=new PublicMicroduck({runtime,createVisual:()=>new RigidCharacterVisual({load:()=>loadPinnedMicroduck('http://127.0.0.1:'+server.address().port+'/',{timeoutMs:40})})});const begin=performance.now();
 try{assert.equal(await duck.install(candidate),false);assert.ok(performance.now()-begin<2000);assert.equal(root.children.length,0);assert.equal(runtime.enabled,true);assert.equal(duck.diagnostics().status,'unavailable');}finally{duck.dispose();}
});

test('valid decoded model body is admitted even when compressed transfer headers report a different size',async()=>{
 const {loadPinnedMicroduck}=await import('../src/npc/RigidCharacterVisual.js');const parsed=await loadPinnedMicroduck('compressed-transfer-test',{fetcher:async()=>new Response(bytes,{headers:{'Content-Encoding':'gzip','Content-Length':'12345'}})});assert.equal(parsed.nodes.length,data.nodes.length);assert.deepEqual(parsed.animations.map(a=>a.name),data.animations.map(a=>a.name));
});
