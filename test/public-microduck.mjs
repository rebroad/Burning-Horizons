import test from 'node:test';
import assert from 'node:assert/strict';
import {PublicMicroduck} from '../src/world-runtime/PublicMicroduck.js';
import {AutonomousCharacter} from '../src/npc/AutonomousCharacter.js';
import {Navigation} from '../src/npc/Navigation.js';
import {Vector3} from '../src/engine/index.js';
import {Colliders} from '../src/world/Colliders.js';
import {T} from '../src/world-runtime/vendor/world-engine-contract.js';
import {webGLRepositoryReadinessSignature} from '../src/world-runtime/WebGLRepositoryReadiness.js';
export function makeFixture({candidates,createVisual,config}={}){
 const portal=(id,worldId,to,position,yaw)=>({id,position,yaw,width:2.06,height:2.904,enabled:true,traversal:{enabled:true},destination:{worldId,portalId:to}});
 candidates??=[{descriptor:{worldId:'a'},project:{portals:[portal('p','b','q',[0,1.452,0],0)]},root:new T.Group(),terrain:{heightAt:()=>0},colliders:new Colliders()},{descriptor:{worldId:'b'},project:{portals:[portal('q','a','p',[10,1.452,0],Math.PI/2)]},root:new T.Group(),terrain:{heightAt:()=>0},colliders:new Colliders()}];
 const catalog={openingWorldId:candidates[0].descriptor.worldId,worlds:candidates.map(c=>({worldId:c.descriptor.worldId,contentDigest:'digest-'+c.descriptor.worldId})),routes:candidates.map(c=>{const p=c.project.portals[0];return {sourceWorldId:c.descriptor.worldId,portalId:p.id,destinationWorldId:p.destination.worldId,destinationPortalId:p.destination.portalId};})};
 const records=new Map(),loaded=new Map();for(const c of candidates){const worldId=c.descriptor.worldId,l={identity:{worldId,contentDigest:'digest-'+worldId},project:c.project};c.identity=l.identity;c.loaded=l;loaded.set(worldId,l);records.set(worldId,{candidate:c,loaded:l});}
 let active=candidates[0],created=0,disposed=0;
 const fakeVisual=()=>{created++;const root=new T.Group(),geometry=new T.BoxGeometry(.1,.2,.1),material=new T.MeshBasicMaterial();root.add(new T.Mesh(geometry,material));return {root,ready:Promise.resolve(true),update:s=>{root.position.fromArray(s.position);root.rotation.y=s.yaw;},dispose(){if(this.disposed)return;this.disposed=true;disposed++;root.removeFromParent();geometry.dispose();material.dispose();root.clear();}};};
 const runtime={catalog,loaded,enabled:true,epoch:0,entry:id=>catalog.worlds.find(w=>w.worldId===id),route:(w,p)=>catalog.routes.find(r=>r.sourceWorldId===w&&r.portalId===p),cache:{get:l=>records.get(l.identity.worldId)},package:async id=>records.get(id),validateRoute(source,p,destination){const r=this.route(source.identity.worldId,p.id),exit=destination.loaded.project.portals.find(p=>p.id===r?.destinationPortalId);assert.ok(exit?.enabled&&exit.traversal.enabled&&exit.destination.worldId===source.identity.worldId&&exit.destination.portalId===p.id);return exit;}};
 const duck=new PublicMicroduck({runtime,getActive:()=>active,createVisual:createVisual??fakeVisual,config});
 return {duck,runtime,candidates,records,setActive:a=>active=a,counts:()=>({created,disposed})};
}
async function install(f){await Promise.all(f.candidates.map(c=>f.duck.install(c)));f.duck.update(1/30);assert.ok(f.duck.actor);}
async function advance(duck,seconds,onTick=()=>{}){for(let n=0;n<seconds*30;n++){duck.update(1/30);if(duck.actor?.pending)await duck.actor.transferPromise;onTick(n/30);}}
test('one controller repeatedly walks the reciprocal portals with two permanent readiness-stable visuals',async()=>{
 const f=makeFixture();await install(f);const before=f.candidates.map(c=>webGLRepositoryReadinessSignature(c));await advance(f.duck,160);assert.ok(f.duck.actor.traversalCount>=2);assert.equal(f.counts().created,2);assert.equal(f.duck.diagnostics().worlds.filter(w=>w.visible).length,1);assert.deepEqual(f.candidates.map(c=>webGLRepositoryReadinessSignature(c)),before);assert.equal(f.duck.actor.id,'public-microduck');f.duck.stop();assert.equal(f.counts().disposed,0);for(const c of f.candidates)f.duck.releaseCandidate(c);assert.deepEqual(f.counts(),{created:2,disposed:2});
});
test('bounded steering turns in place without instantaneous body yaw or walking feet',()=>{
 const actor=new AutonomousCharacter({worldId:'a',terrain:{heightAt:()=>0},colliders:new Colliders(),config:{speed:.22,turnRate:1.8}});actor.path=[new Vector3(1,0,0)];actor.transition('Navigate');const before=actor.position.clone();actor.update(1/30);assert.ok(Math.abs(actor.yaw)<=1.8/30+1e-8);assert.equal(actor.clip,'Turn');assert.ok(actor.position.equals(before));for(let i=0;i<60;i++)actor.update(1/30);assert.ok(actor.position.x>0);assert.equal(actor.clip,'Walk');
});
test('blocked destination cancels to actual previous source pose without a partial world commit',async()=>{
 const f=makeFixture();await install(f);f.candidates[1].terrain.heightAt=()=>-Infinity;await advance(f.duck,35);assert.equal(f.duck.actor.worldId,'a');assert.equal(f.duck.actor.traversalCount,0);assert.equal(f.duck.actor.pending,false);assert.match(f.duck.error,/unsupported|spawn|corridor/);assert.ok(f.duck.actor.position.z>=0);f.duck.dispose();
});
test('disconnect fences async transfer and disposes each independent visual once before generic traversal',async()=>{
 const f=makeFixture();await install(f);let resolve;f.runtime.package=()=>new Promise(r=>resolve=r);const actor=f.duck.actor,portal=f.candidates[0].project.portals[0];actor.position.set(0,0,-.001);actor.portal=portal;actor.beginTransfer(portal,new Vector3(0,0,.001));await Promise.resolve();f.duck.stop();resolve(f.records.get('b'));await actor.transferPromise;assert.equal(actor.worldId,'a');assert.equal(f.duck.actor,null);for(const c of f.candidates){f.duck.releaseCandidate(c);assert.equal(c.root.children.length,0);}assert.deepEqual(f.counts(),{created:2,disposed:2});f.duck.dispose();assert.equal(f.counts().disposed,2);
});
test('asset rejection and stopped pending installation are fail-soft and leave no partially attached graph',async()=>{
 const f=makeFixture({createVisual:()=>({root:new T.Group(),ready:Promise.reject(Error('asset denied')),dispose(){this.disposed=true;}})});assert.equal(await f.duck.install(f.candidates[0]),false);assert.equal(f.candidates[0].root.children.length,0);assert.equal(f.duck.diagnostics().visualCount,0);assert.equal(f.runtime.enabled,true);
 const g=makeFixture({createVisual:()=>{throw Error('allocation failed');}});assert.equal(await g.duck.install(g.candidates[0]),false);assert.match(g.duck.error,/allocation/);
});
test('replacement root and catalog digest fence movement, while an unknown opening never starts',async()=>{
 const f=makeFixture();await install(f);f.records.get('b').candidate={...f.candidates[1],root:new T.Group()};assert.equal(f.duck.eligibility(f.candidates[0].project.portals[0]),false);f.candidates[0].identity.contentDigest='forged';f.duck.update(1/30);assert.equal(f.duck.actor,null);assert.equal(f.duck.diagnostics().visualCount,0);
});

test('terminal asset failure does not schedule a package retry every animation frame',async()=>{
 const f=makeFixture({createVisual:()=>({root:new T.Group(),ready:Promise.reject(Error('asset failed')),dispose(){}})});await f.duck.install(f.candidates[0]);let calls=0;f.runtime.package=async()=>{calls++;throw Error('must not retry');};for(let n=0;n<100;n++)f.duck.update(1/60);await Promise.resolve();assert.equal(calls,0);assert.equal(f.duck.diagnostics().status,'unavailable');
});
test('late visual load after stop cannot attach a half-registered graph and a new session can install',async()=>{
 let finish,disposed=0;const f=makeFixture({createVisual:()=>({root:new T.Group(),ready:new Promise(r=>finish=r),dispose(){disposed++;this.root.removeFromParent();}})});const pending=f.duck.install(f.candidates[0]);f.duck.stop();finish(true);assert.equal(await pending,false);assert.equal(f.candidates[0].root.children.length,0);assert.equal(disposed,1);assert.equal(f.duck.diagnostics().visualCount,0);f.duck.createVisual=()=>({root:new T.Group(),ready:Promise.resolve(true),dispose(){this.root.removeFromParent();}});assert.equal(await f.duck.install(f.candidates[0]),true);f.duck.dispose();
});
test('public metadata and notices contain no local source paths and do not ship the full GLB',async()=>{
 const {readFile,stat}=await import('node:fs/promises');for(const name of ['manifest.json','collision-proxy.json','ATTRIBUTION.md','LICENSE-MODELS.md']){const body=await readFile(new URL('../public/models/microduck/'+name,import.meta.url),'utf8');assert.doesNotMatch(body,/\/fast\/|\/home\/|[A-Za-z]:\\|blend_location/);}
 const docs=await readFile(new URL('../docs/MICRODUCK-ASSET.md',import.meta.url),'utf8');assert.doesNotMatch(docs,/\/fast\/|\/home\/|[A-Za-z]:\\/);assert.match(docs,/CC BY-NC-SA/);await assert.rejects(stat(new URL('../public/models/microduck/microduck-full.glb',import.meta.url)),{code:'ENOENT'});
});

test('replacement installation retains old GPU graph until retirement and cannot stop the new actor on late cleanup',async()=>{
 const f=makeFixture();await install(f);const old=f.candidates[0],replacement={...old,root:new T.Group()};f.setActive(replacement);f.records.get('a').candidate=replacement;
 await f.duck.install(replacement);assert.equal(f.counts().disposed,0);assert.equal(f.duck.retired.size,1);assert.ok(old.root.children.length);f.duck.update(1/30);const actor=f.duck.actor;assert.ok(actor);const pose=actor.position.toArray();f.duck.releaseCandidate(old);assert.equal(f.counts().disposed,1);assert.equal(f.duck.actor,actor);assert.deepEqual(actor.position.toArray(),pose);assert.equal(f.duck.context('a').root,replacement.root);
 f.duck.stop();for(const c of [old,replacement,f.candidates[1]])f.duck.releaseCandidate(c);assert.deepEqual(f.counts(),{created:3,disposed:3});
});

function starFixture(){
 const roomId='elsemesh.world:5c2e6618-a04a-4460-912a-bfc57bc5bbad',ids=['warehouse',roomId,'dock'],portal=(id,to,exit,x=0)=>({id,position:[x,1.452,0],yaw:0,width:2.06,height:2.904,enabled:true,traversal:{enabled:true},destination:{worldId:to,portalId:exit}}),candidates=ids.map(id=>({descriptor:{worldId:id},root:new T.Group(),terrain:{heightAt:()=>0},colliders:new Colliders(),project:{portals:[]}}));
 candidates[0].project.portals=[portal('dock-door',ids[2],'dock-return',10),portal('room-door',ids[1],'room-return')];candidates[1].project.portals=[portal('room-return',ids[0],'room-door')];candidates[2].project.portals=[portal('dock-return',ids[0],'dock-door')];
 const f=makeFixture({candidates});f.runtime.catalog.routes=candidates.flatMap(c=>c.project.portals.map(p=>({sourceWorldId:c.descriptor.worldId,portalId:p.id,destinationWorldId:p.destination.worldId,destinationPortalId:p.destination.portalId})));return f;
}

test('three-world companion installs and prepares only Warehouse and explicit Room even when Dock is unavailable',async()=>{
 const f=starFixture(),[warehouse,room,dock]=f.candidates,requests=[];assert.equal(await f.duck.install(dock),false);assert.equal(f.counts().created,0);await f.duck.install(warehouse);
 f.runtime.package=async id=>{requests.push(id);assert.notEqual(id,'dock');const record=f.records.get(id);await f.duck.install(record.candidate);return record;};
 await f.duck.prepareOther();await f.duck.loading;f.duck.update(1/30);assert.ok(f.duck.actor);assert.equal(f.duck.contexts.size,2);assert.deepEqual(requests,[room.descriptor.worldId]);assert.deepEqual(f.duck.actor.explorationOrigin.toArray(),[0,0,.8]);assert.equal(f.counts().created,2);
 const dockDoor=warehouse.project.portals[0],actor=f.duck.actor;assert.equal(f.duck.eligibility(dockDoor),false);const before=requests.length,result=await f.duck.transfer({actorId:actor.id,sourceWorldId:actor.worldId,portal:dockDoor,sourcePosition:[10,0,0],previousPosition:[10,0,.1]});assert.equal(result.cancelled,true);assert.equal(requests.length,before);assert.equal(actor.worldId,warehouse.descriptor.worldId);
 f.setActive(dock);f.duck.update(1/30);assert.equal(f.duck.actor,actor);assert.equal(f.duck.context('dock'),null);assert.equal(f.counts().created,2);f.duck.stop();for(const c of f.candidates)f.duck.releaseCandidate(c);assert.deepEqual(f.counts(),{created:2,disposed:2});
});

test('three-world companion does not silently choose Dock if explicit Room is absent',async()=>{
 const f=starFixture();f.runtime.catalog.worlds[1].worldId='another-leaf';const duck=new PublicMicroduck({runtime:f.runtime,getActive:()=>f.candidates[0],createVisual:f.duck.createVisual});assert.equal(duck.habitat.size,1);assert.equal(await duck.install(f.candidates[2]),false);assert.equal(await duck.install(f.candidates[1]),false);await duck.install(f.candidates[0]);assert.equal(duck.start(),false);duck.dispose();duck.releaseCandidate(f.candidates[0]);
});
