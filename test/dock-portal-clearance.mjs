import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadWorldSource,describeRuntimeWorld,repositoryDigest,mapPortalPoint,portalLocalPoint,portalWorldPoint,sweepPortalCapsule} from '../src/world-runtime/vendor/world-engine-contract.js';
import {isRepositoryContentPath} from '../src/world-runtime/LocalRepositoryFiles.js';
import {prepareNativeIslandPhysics} from '../network/repository-native-physics.mjs';
import {addLandscapeCollisions} from '../src/world-runtime/RepositoryLandscape.js';
import {PublicPortalRuntime} from '../src/world-runtime/PublicPortalRuntime.js';
import {Player} from '../src/player/Player.js';
import {Colliders} from '../src/world/Colliders.js';
import {Vector3} from '../src/engine/index.js';
const warehouseRoot=process.env.ELSEMESH_DOCK_WAREHOUSE_ROOT??fileURLToPath(new URL('../../opening-world/',import.meta.url));
const dockRoot=process.env.ELSEMESH_DOCK_SOURCE_ROOT??path.join(warehouseRoot,'worlds/dock');
const pins={warehouse:'9e45eda57c26c7ac1622504b0093be6291e5115bd5e77d3baf299d54e3df3809',dock:'36e60f42dffa422ef20dce60a14a9da238ccce49eb96e248dc5952f6b3429808'};
async function fixture(directory,pin){
 const root=await fs.realpath(directory),read=async(relative,limit)=>{assert.ok(isRepositoryContentPath(relative));const full=await fs.realpath(path.join(root,relative));assert.ok(full.startsWith(root+path.sep));const info=await fs.lstat(full);assert.ok(info.isFile()&&!info.isSymbolicLink()&&info.size<=limit);return new Uint8Array(await fs.readFile(full));};
 assert.equal(await repositoryDigest(await read('world.json',1024*1024)),pin);
 const loaded=await loadWorldSource({kind:'local',read},{expectedContentDigest:pin}),descriptor=describeRuntimeWorld(loaded.project),native=await prepareNativeIslandPhysics(loaded.project,read),colliders=new Colliders();
 for(const b of descriptor.boxes)colliders.addBox(new Vector3(...b.center),new Vector3(...b.half),b.rotY??b.yaw??0,{walkable:b.walkable,solid:b.solid,tag:b.id});
 addLandscapeCollisions(loaded.project,colliders);
 return {loaded,project:loaded.project,terrain:native?{heightAt:native.heightAt}:descriptor.terrain,colliders,native};
}

test('pinned Warehouse and Dock reciprocal doorway supports the full capsule lane, real arrival and angled egress',async t=>{
 const [warehouse,dock]=await Promise.all([fixture(warehouseRoot,pins.warehouse),fixture(dockRoot,pins.dock)]),source=warehouse.project.portals.find(p=>p.destination.worldId===dock.project.metadata.worldId),exit=dock.project.portals.find(p=>p.id===source?.destination.portalId);
 assert.ok(source&&exit);assert.equal(exit.destination.worldId,warehouse.project.metadata.worldId);assert.equal(exit.destination.portalId,source.id);
 assert.deepEqual(source.position,[-4,4.8,-80]);assert.deepEqual(exit.position,[640,6.8,441]);assert.equal(source.width,3);assert.equal(exit.width,3);assert.equal(source.height,3.6);assert.equal(exit.height,3.6);assert.equal(source.yaw,0);assert.equal(exit.yaw,0);
 const radius=.3,bodyHeight=1.8,usable=Math.min(source.width,exit.width)/2-radius,laneSteps=Math.ceil(2*usable/.005);let sweeps=0,segments=0,points=0;
 function segment(candidate,from,to,context){
  // Same arrival/floor and exact capsule checks as published player travel.
  assert.doesNotThrow(()=>PublicPortalRuntime.prototype.validateSegment.call({},candidate,from,to),context);
  const distance=Math.hypot(...to.map((v,i)=>v-from[i])),steps=Math.max(1,Math.ceil(distance/.02));
  for(let n=0;n<=steps;n++){
   const p=from.map((v,i)=>v+(to[i]-v)*n/steps),ground=Player.prototype.groundAt.call(candidate,p[0],p[2],p[1]+.001);
   assert.ok(Number.isFinite(ground)&&Math.abs(ground-p[1])<=.08,JSON.stringify({context,p,ground}));
   // Whole-foot support in addition to the runtime's centre floor query.
   for(const [dx,dz]of [[-.35,-.35],[-.35,.35],[.35,-.35],[.35,.35]]){const floor=Player.prototype.groundAt.call(candidate,p[0]+dx,p[2]+dz,p[1]+.001);assert.ok(Number.isFinite(floor)&&Math.abs(floor-p[1])<=.08,JSON.stringify({context,p,dx,dz,floor}));}
   points++;
  }
  segments++;
 }
 for(const [from,to,portal,destination]of [[warehouse,dock,source,exit],[dock,warehouse,exit,source]])for(let lane=0;lane<=laneSteps;lane++){
  // Inward 1 nm at the mathematical endpoints prevents 640m-coordinate rounding
  // alone from rejecting an exactly tangent capsule in the strict vendor sweep.
  const lateral=Math.max(-usable+1e-9,Math.min(usable-1e-9,-usable+2*usable*lane/laneSteps)),before=portalWorldPoint(portal,[lateral,-portal.height/2,.005]),after=portalWorldPoint(portal,[lateral,-portal.height/2,-.005]),context=JSON.stringify({world:from.project.metadata.name,lateral});
  segment(from,before,after,context+' source crossing');assert.ok(sweepPortalCapsule({portal,previousFeet:before,nextFeet:after,radius,bodyHeight}),context);sweeps++;
  const mapped=mapPortalPoint(portal,destination,after),local=portalLocalPoint(destination,mapped),arrival=portalWorldPoint(destination,[local[0],local[1],Math.max(.15,local[2])]),egress=portalWorldPoint(destination,[local[0],local[1],.4]);
  segment(to,mapped,arrival,context+' mapped arrival');segment(to,arrival,egress,context+' runtime egress');
  for(const heading of [-.1,0,.1]){const end=portalWorldPoint(destination,[local[0]+Math.tan(heading)*(1.05-local[2]),local[1],1.05]);segment(to,mapped,end,context+' angled egress '+heading);}
 }
 assert.equal(sweeps,2*(laneSteps+1));assert.equal(segments,sweeps*6);
 t.diagnostic(JSON.stringify({warehouseDigest:pins.warehouse,dockDigest:pins.dock,laneHalfWidth:usable,laneSpacingMetres:.005,capsule:{radius,bodyHeight,footRadius:.35},sweeps,segments,supportPoints:points,nativeHeightTiles:{warehouse:warehouse.native?.tiles??0,dock:dock.native?.tiles??0},qualification:'CPU loader, authored colliders, player floor and published arrival checks; browser and device acceptance remain separate'}));
});
