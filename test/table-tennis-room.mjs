import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {loadWorldSource,packWorldRepository,validateSplatScene,repositoryDigest,mapPortalPoint,portalWorldPoint,sweepPortalCapsule} from '../src/world-runtime/vendor/world-engine-contract.js';
import {TABLE_TENNIS_SPLAT_PROFILE,assertQualifiedSplatProfile} from '../src/world-runtime/SplatSceneProfiles.js';
import {compileSplatScenePhysics} from '../src/world-runtime/SplatScenePhysics.js';
import {loadVerifiedPhysicsBytes} from '../src/world-runtime/SplatSceneSource.js';
import {createSplatSceneAdapter} from '../src/world-runtime/SplatSceneAdapter.js';
import {prepareSplatWorldPhysics} from '../network/splat-world-physics.mjs';
import {isRepositoryContentPath} from '../src/world-runtime/LocalRepositoryFiles.js';
const sourceRoot=process.env.ELSEMESH_PUBLIC_ROOM_SOURCE_ROOT;
async function fixture(){
 const root=await fs.realpath(sourceRoot),read=async(relative,limit)=>{assert.ok(isRepositoryContentPath(relative));const full=await fs.realpath(path.join(root,relative));assert.ok(full.startsWith(root+path.sep));const info=await fs.lstat(full);assert.ok(info.isFile()&&!info.isSymbolicLink()&&info.size<=limit);return new Uint8Array(await fs.readFile(full));};
 return {root,read,loaded:await loadWorldSource({kind:'local',read})};
}
test('actual Room pins, honest SOG provenance, native qualification and owner admission',{skip:!sourceRoot},async()=>{
 const {read,loaded}=await fixture(),project=loaded.project,scene=project.splatScene;
 assert.equal(project.metadata.worldId,'elsemesh.world:5c2e6618-a04a-4460-912a-bfc57bc5bbad');assert.equal(assertQualifiedSplatProfile(project),TABLE_TENNIS_SPLAT_PROFILE);assert.deepEqual(validateSplatScene(scene),[]);
 assert.deepEqual(Object.keys(scene.provenance).sort(),['sourceFormat','sourceManifestSha256','reviewSha256','qualificationSha256'].sort());assert.equal(scene.provenance.sourceFormat,'sog');
 for(const hash of [scene.provenance.sourceManifestSha256,scene.provenance.reviewSha256]){const bytes=await read('splat-scenes/'+hash+'.json',64*1024);assert.equal(await repositoryDigest(bytes),hash);}
 const bytes=await loadVerifiedPhysicsBytes(project,read),physics=await compileSplatScenePhysics(project,bytes),owner=await prepareSplatWorldPhysics(project,read);
 assert.equal(physics.assetSha256,scene.asset.sha256);assert.ok(physics.clearance(project.spawn.position));assert.ok(owner.clearance(project.spawn.position));
 for(const route of physics.qualification.reviewedRoutes)for(let i=1;i<route.length;i++){assert.ok(physics.segment(route[i-1],route[i]).valid);assert.ok(owner.segment(route[i-1],route[i]).valid);}
 assert.ok(physics.clearance(physics.arrival.mappedPosition));assert.ok(physics.segment(physics.arrival.mappedPosition,physics.arrival.egressPosition).valid);
 assert.equal(physics.clearance([physics.bounds.max[0]+1,project.spawn.position[1],project.spawn.position[2]]),false);
});
test('actual Room roundtrip keeps source-manifest provenance and exact lazy payloads',{skip:!sourceRoot},async()=>{
 const {read,loaded}=await fixture(),files=await packWorldRepository(loaded.project,{splatSceneRead:read}),reloaded=await loadWorldSource({kind:'local',read:async(relative,limit)=>{const bytes=files.get(relative);assert.ok(bytes&&bytes.length<=limit);return bytes;}});
 assert.deepEqual(reloaded.project.splatScene,loaded.project.splatScene);assert.equal(assertQualifiedSplatProfile(reloaded.project),TABLE_TENNIS_SPLAT_PROFILE);
 for(const ref of [loaded.project.splatScene.asset,loaded.project.splatScene.physics])assert.equal(await repositoryDigest(await reloaded.splatSceneRead(ref.path,ref.bytes)),ref.sha256);
});
test('actual Room provenance variants, pins and payload corruption fail closed',{skip:!sourceRoot},async()=>{
 const {read,loaded}=await fixture();
 for(const change of [p=>p.splatScene.asset.count--,p=>p.splatScene.physics.bytes--,p=>p.splatScene.transform.scale+=.001,p=>p.splatScene.provenance.reviewSha256='a'.repeat(64)]){
  const p=structuredClone(loaded.project);change(p);let reads=0;await assert.rejects(createSplatSceneAdapter(p,{read:async()=>{reads++;}}));await assert.rejects(prepareSplatWorldPhysics(p,async()=>{reads++;}));assert.equal(reads,0);
 }
 for(const provenance of [{...loaded.project.splatScene.provenance,videoSha256:'a'.repeat(64)},{...loaded.project.splatScene.provenance,sourceFormat:'ply'},{...loaded.project.splatScene.provenance,sourceManifestSha256:'bad'}])assert.ok(validateSplatScene({...loaded.project.splatScene,provenance}).length);
 for(const ref of [loaded.project.splatScene.asset,loaded.project.splatScene.physics])await assert.rejects(prepareSplatWorldPhysics(loaded.project,async(relative,limit)=>{const bytes=await read(relative,limit);if(relative===ref.path){const corrupt=bytes.slice();corrupt[0]^=1;return corrupt;}return bytes;}),/hash|integrity|SHA/i);
});
test('actual reciprocal doorway supports the full usable entrance lane and slightly angled egress',{skip:!sourceRoot},async()=>{
 const {root,read,loaded}=await fixture(),warehouseRoot=await fs.realpath(path.join(root,'../..'));
 const warehouse=await loadWorldSource({kind:'local',read:async(relative,limit)=>{assert.ok(isRepositoryContentPath(relative));const full=await fs.realpath(path.join(warehouseRoot,relative));assert.ok(full.startsWith(warehouseRoot+path.sep));const info=await fs.lstat(full);assert.ok(info.isFile()&&info.size<=limit);return new Uint8Array(await fs.readFile(full));}});
 const source=warehouse.project.portals.find(p=>p.destination.worldId===loaded.project.metadata.worldId),destination=loaded.project.portals.find(p=>p.id===source.destination.portalId),physics=await compileSplatScenePhysics(loaded.project,await loadVerifiedPhysicsBytes(loaded.project,read));
 assert.equal(source.width,destination.width);assert.equal(destination.width,1.4);assert.equal(destination.position[0],1.8);
 const radius=.3,margin=.1,usable=Math.min(source.width,destination.width)/2-radius-margin;
 assert.ok(Math.abs(usable-.3)<1e-12);let samples=0;
 // Include both exact lane endpoints, every 5 mm between them, and small
 // outward headings in each direction. The real mapping supplies foot height.
 for(let lane=0;lane<=120;lane++){
  const lateral=-usable+2*usable*lane/120,previous=portalWorldPoint(source,[lateral,-source.height/2,.005]),crossed=portalWorldPoint(source,[lateral,-source.height/2,-.005]);
  assert.ok(sweepPortalCapsule({portal:source,previousFeet:previous,nextFeet:crossed,radius,bodyHeight:1.8}));
  const incoming=mapPortalPoint(source,destination,crossed);assert.ok(physics.clearance(incoming),JSON.stringify({lateral,incoming}));
  for(const heading of [-.1,0,.1])for(let step=1;step<=21;step++){
   const distance=step*.05,localLateral=-lateral+Math.tan(heading)*(distance-.005),egress=portalWorldPoint(destination,[localLateral,-destination.height/2,distance]);
   const segment=physics.segment(incoming,egress);assert.ok(segment.valid,JSON.stringify({lateral,heading,distance,incoming,egress,reason:segment.reason}));samples++;
  }
 }
 assert.equal(samples,7623);
 // Captured failure: the former wide aperture admitted local X -0.552,
 // mapping to Room X 2.502 beyond its supported whole-footprint boundary.
 const oldSource={...source,width:2.06},oldDestination={...destination,width:2.06,position:[1.95,...destination.position.slice(1)]},oldBefore=portalWorldPoint(oldSource,[-.552,-source.height/2,.005]),oldAfter=portalWorldPoint(oldSource,[-.552,-source.height/2,-.005]),badArrival=mapPortalPoint(oldSource,oldDestination,oldAfter);
 assert.ok(sweepPortalCapsule({portal:oldSource,previousFeet:oldBefore,nextFeet:oldAfter,radius,bodyHeight:1.8}));assert.ok(Math.abs(badArrival[0]-2.502)<1e-10);assert.equal(physics.clearance(badArrival),false);assert.equal(physics.segment(badArrival,portalWorldPoint(oldDestination,[.552,-destination.height/2,1.05])).valid,false);
 assert.equal(sweepPortalCapsule({portal:source,previousFeet:oldBefore,nextFeet:oldAfter,radius,bodyHeight:1.8}),null);
});
test('retired Sunset source is absent from the tracked world tree and active tour routes',{skip:!sourceRoot},async()=>{
 const {root,loaded}=await fixture(),warehouseRoot=await fs.realpath(path.join(root,'../..')),tracked=execFileSync('git',['-C',warehouseRoot,'ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean),retiredWorld='elsemesh.world:0934ce76-df15-406f-914e-74209d48accf';
 assert.ok(tracked.length>0);assert.ok(!tracked.some(name=>name==='worlds/sunset'||name.startsWith('worlds/sunset/')),'Git tracked index excludes retired world files');assert.ok(!tracked.some(name=>/^snapshots\/11269/.test(name)),'Git tracked index excludes obsolete Warehouse snapshot');
 await assert.rejects(fs.access(path.join(warehouseRoot,'worlds/sunset')),{code:'ENOENT'});
 const catalog=JSON.parse(await fs.readFile(new URL('../public/published-worlds.json',import.meta.url),'utf8'));assert.ok(!JSON.stringify(catalog).includes(retiredWorld));assert.equal(catalog.worlds.length,3);assert.ok(catalog.worlds.some(world=>world.worldId===loaded.project.metadata.worldId));assert.ok(catalog.worlds.some(world=>world.worldId==='elsemesh.world:63121706-d439-4091-95b0-780b7d8563e8'));
 assert.ok(!JSON.stringify(loaded.project.portals).includes(retiredWorld));
 const manifest=JSON.parse(await fs.readFile(path.join(warehouseRoot,'world.json'),'utf8')),connections=await fs.readFile(path.join(warehouseRoot,manifest.components.connections.path),'utf8');assert.ok(!connections.includes(retiredWorld));assert.ok(connections.includes(loaded.project.metadata.worldId));
});
