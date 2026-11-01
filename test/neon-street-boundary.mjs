import test from 'node:test';import assert from 'node:assert/strict';
import {T} from '../src/world-runtime/vendor/world-engine-contract.js';
import {Player} from '../src/player/Player.js';import {Colliders} from '../src/world/Colliders.js';import {Vector3} from '../src/engine/index.js';
import {NEON_SHIFT_LOTS} from '../src/world-runtime/NeonShiftLots.js';
import {createNeonStreetBoundary,installNeonStreetClearance,NEON_STREET_CAPSULE_RADIUS} from '../src/world-runtime/NeonStreetBoundary.js';
const terrain=()=>createNeonStreetBoundary({heightAt:()=>0});
test('street support uses the full radius disk at fixed corners and an inset outer perimeter without changing heights',()=>{
 const original={heightAt:(x,z)=>x/1000+z/1000},guard=createNeonStreetBoundary(original),lot=NEON_SHIFT_LOTS[0];
 assert.equal(guard.heightAt(200,200),original.heightAt(200,200));assert.equal(guard.supportsFootprint(0,0),true);assert.equal(guard.supportsFootprint(95.64,0),true);assert.equal(guard.supportsFootprint(95.66,0),false);assert.equal(guard.supportsFootprint(-95.66,0),false);
 assert.equal(guard.supportsFootprint(lot.x+5.25,lot.z+5.25),true,'Rounded corner disk clears diagonal despite intersecting square expansion');assert.equal(guard.supportsFootprint(lot.x+5.24,lot.z+5.24),false);assert.equal(guard.supportsFootprint(lot.x+5.34,lot.z),false);assert.equal(guard.supportsFootprint(lot.x+5.36,lot.z),true);
 for(const mode of ['swim','deck','boat','fly'])assert.throws(()=>guard.assertMovementMode(mode));assert.equal(guard.assertMovementMode('walk'),true);
 assert.throws(()=>guard.assertPlayerPose([lot.x,20,lot.z]));assert.throws(()=>guard.assertPlayerPose([96,0,0]));assert.throws(()=>guard.assertPlayerPose([0,20,0]));assert.equal(guard.assertPlayerPose([0,20,0],{arrival:false}),true);
});
test('continuous horizontal guard blocks large-delta airborne lot tunnels, corner clips and perimeter escapes while preserving gravity',()=>{
 const guard=terrain(),lot=NEON_SHIFT_LOTS[0],old=new Vector3(lot.x-6,2,lot.z),next=new Vector3(lot.x+6,1.9,lot.z);assert.equal(guard.constrainPlayer(old,next),false);assert.deepEqual(next.toArray(),[old.x,1.9,old.z]);
 const near=new Vector3(lot.x-6,1,lot.z+5.2),across=new Vector3(lot.x+6,.8,lot.z+5.2);assert.equal(guard.constrainPlayer(near,across),false);assert.equal(across.y,.8);
 const safe=new Vector3(lot.x-6,1,lot.z+5.4),safeEnd=new Vector3(lot.x+6,.8,lot.z+5.4);assert.equal(guard.constrainPlayer(safe,safeEnd),true);
 const edge=new Vector3(95,1,0),outside=new Vector3(200,.7,0);assert.equal(guard.constrainPlayer(edge,outside),false);assert.deepEqual(outside.toArray(),[95,.7,0]);
 for(const invalid of [new Vector3(lot.x,5,lot.z),new Vector3(200,0,0),new Vector3(0,-1,0),new Vector3(NaN,0,0)])assert.throws(()=>guard.constrainPlayer(invalid,new Vector3(0,0,0)),/Prior/);
});
function playerAt(x,z,dx,dz,{colliders=new Colliders()}={}){
 const guard=terrain(),player=new Player({camera:{},input:{moveAxes:()=>({x:dx,y:-dz,sprint:1}),down:()=>false,hit:key=>key==='Space'},terrain:guard,colliders,query:{allocate:()=>0},boat:null});player.position.set(x,0,z);player.velocity.set(0,0,0);player.yaw=0;player.grounded=true;player.waterH=-100000;player.waterMean=-100000;return player;
}
test('actual Player repeated jumps cannot enter any reserved lot face or corner even without supporting colliders',()=>{
 let attempts=0,peak=0;for(const lot of NEON_SHIFT_LOTS)for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
  const player=playerAt(lot.x+dx*5.8,lot.z+dz*5.8,-dx,-dz);
  for(let frame=0;frame<120;frame++){player.updateWalk(1/60);assert.equal(player.terrain.supportsFootprint(player.position.x,player.position.z),true);assert.ok(player.position.y>=0&&player.position.y<1.2);peak=Math.max(peak,player.position.y);}
  attempts++;
 }assert.equal(attempts,640);assert.ok(peak>1);const outer=playerAt(95,0,1,0);for(let i=0;i<240;i++){outer.updateWalk(1/60);assert.ok(outer.position.x<95.65);assert.ok(outer.position.y<1.2);}
});
test('actual Player validates post-collision pushes, blocks large dt tunnels and retains valid airborne motion',()=>{
 const lot=NEON_SHIFT_LOTS[0],push={groundHeightAt:()=>-Infinity,resolveCapsule:p=>{p.x=lot.x;p.z=lot.z;}},player=playerAt(lot.x-6,lot.z,1,0,{colliders:push});player.updateWalk(1/60);assert.equal(player.position.x,lot.x-6);assert.equal(player.velocity.x,0);assert.ok(player.position.y>0);assert.ok(player.velocity.y>0);
 const large=playerAt(lot.x-6,lot.z,1,0);large.grounded=false;large.position.y=8;large.velocity.x=30;large.updateWalk(4);assert.equal(large.position.x,lot.x-6);assert.equal(large.velocity.x,0);assert.equal(large.position.y,0);
 const safe=playerAt(0,0,1,0);safe.updateWalk(1/60);assert.ok(safe.position.x>0);assert.ok(safe.position.y>0);assert.ok(safe.velocity.y>0);
});

function actualCityColliders(){const colliders=new Colliders();for(const lot of NEON_SHIFT_LOTS)colliders.addBox(new Vector3(lot.x,1.5,lot.z),new Vector3(5,1.5,5));for(const side of [-1,1]){colliders.addBox(new Vector3(side*96.5,5,0),new Vector3(.5,5,97));colliders.addBox(new Vector3(0,5,side*96.5),new Vector3(97,5,.5));}return installNeonStreetClearance(colliders);}

test('pinned-instance physical clearance preserves real contacts, receiver, return value and idempotence',()=>{
 const prototype=Colliders.prototype.resolveCapsule,colliders=new Colliders();colliders.addBox(new Vector3(-81,1.5,-63),new Vector3(5,1.5,5));installNeonStreetClearance(colliders);const wrapped=colliders.resolveCapsule;installNeonStreetClearance(colliders);assert.equal(colliders.resolveCapsule,wrapped);assert.equal(Colliders.prototype.resolveCapsule,prototype);assert.equal(new Colliders().resolveCapsule,prototype);
 const old=new Vector3(-86.36,0,-63),next=old.clone().add(new Vector3(.1,0,.1)),contacts=[];assert.equal(colliders.resolveCapsule(next,.3,1.75,.4,c=>contacts.push(c)),true);assert.ok(contacts.length>0);assert.ok(Math.abs(next.x+86.4)<1e-9);assert.ok(Math.abs(next.z+62.9)<1e-9);assert.equal(terrain().constrainPlayer(old,next),true);assert.ok(next.z>old.z);
 const large=new Vector3(-86.4,0,-63);colliders.resolveCapsule(large,.6,1.75,.4);assert.ok(Math.abs(large.x+86.6)<1e-9,'Larger authored capsule requests remain larger');
 let receiver,args;const fake={resolveCapsule(...a){receiver=this;args=a;return 'sentinel';}};installNeonStreetClearance(fake);const callback=()=>{};assert.equal(fake.resolveCapsule(next,.3,1.75,.2,callback),'sentinel');assert.equal(receiver,fake);assert.deepEqual(args,[next,.4,1.75,.2,callback]);
});

test('actual Player slides tangentially along all fixed lot faces and corners under repeated diagonal sprint jumps',t=>{
 const colliders=actualCityColliders();let cases=0,minProgress=Infinity;
 for(const lot of NEON_SHIFT_LOTS)for(const [nx,nz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]])for(const direction of [-1,1])for(const dt of [1/20,1/30,1/60]){
  const corner=nx!==0&&nz!==0,offset=corner?5+.36/Math.SQRT2+.02:5.36,startX=lot.x+nx*offset,startZ=lot.z+nz*offset;
  // Face pressure plus tangent; at a corner turn around either adjoining face.
  const tx=corner?(direction===1?-nx:nx):nz*direction,tz=corner?(direction===1?nz:-nz):-nx*direction,dx=corner?tx:tx-nx,dz=corner?tz:tz-nz;
  const player=playerAt(startX,startZ,dx,dz,{colliders});let peak=0;
  for(let frame=0;frame<Math.round(2/dt);frame++){player.updateWalk(dt);assert.equal(player.terrain.supportsFootprint(player.position.x,player.position.z),true);peak=Math.max(peak,player.position.y);}
  const progress=((player.position.x-startX)*tx+(player.position.z-startZ)*tz)/Math.hypot(tx,tz);assert.ok(progress>2,JSON.stringify({lot:lot.id,nx,nz,direction,dt,progress,start:[startX,startZ],end:player.position.toArray()}));assert.ok(peak>.9&&peak<1.2);minProgress=Math.min(minProgress,progress);cases++;
 }
 assert.equal(cases,3840);assert.ok(minProgress>2);t.diagnostic(JSON.stringify({cases,secondsPerCase:2,frameRates:[20,30,60],minimumTangentialProgress:minProgress,physicalRadius:NEON_STREET_CAPSULE_RADIUS,analyticFootRadius:.35}));
});

test('actual Player glances positively along all four outer walls while the analytic guard still blocks lot tunnelling',()=>{
 const colliders=actualCityColliders();for(const [nx,nz]of [[1,0],[-1,0],[0,1],[0,-1]])for(const direction of [-1,1]){const tx=nz*direction,tz=-nx*direction,startX=nx*95.64,startZ=nz*95.64,player=playerAt(startX,startZ,nx+tx,nz+tz,{colliders});for(let frame=0;frame<120;frame++){player.updateWalk(1/60);assert.ok(player.terrain.supportsFootprint(player.position.x,player.position.z));}const progress=(player.position.x-startX)*tx+(player.position.z-startZ)*tz;assert.ok(progress>2);}
 const lot=NEON_SHIFT_LOTS[0],player=playerAt(lot.x-6,lot.z,1,0,{colliders});player.grounded=false;player.position.y=20;player.velocity.x=30;player.updateWalk(4);assert.equal(player.position.x,lot.x-6);assert.ok(player.terrain.supportsFootprint(player.position.x,player.position.z));assert.equal(player.velocity.x,0);
});


test('maximum public frame delta keeps positive motion when diagonal sprinting starts immediately before every lot corner',()=>{
 const colliders=actualCityColliders();let cases=0;
 for(const lot of NEON_SHIFT_LOTS)for(const [nx,nz]of [[1,0],[-1,0],[0,1],[0,-1]])for(const sign of [-1,1])for(const dt of [1/20,1/30,1/60]){
  const tx=nz*sign,tz=-nx*sign,startX=lot.x+nx*5.36+tx*4.8,startZ=lot.z+nz*5.36+tz*4.8,player=playerAt(startX,startZ,tx-nx,tz-nz,{colliders});
  for(let frame=0;frame<Math.round(2/dt);frame++){player.updateWalk(dt);assert.ok(player.terrain.supportsFootprint(player.position.x,player.position.z));}
  const progress=(player.position.x-startX)*tx+(player.position.z-startZ)*tz;assert.ok(progress>2,JSON.stringify({lot:lot.id,nx,nz,sign,dt,progress,end:player.position.toArray()}));cases++;
 }assert.equal(cases,1920);
});


test('maximum public sprint step admits resolved chords around every corner angle without weakening analytic exclusions',()=>{
 const colliders=actualCityColliders(),guard=terrain(),radius=NEON_STREET_CAPSULE_RADIUS,step=6.2*.05;
 // Ideal isolated-circle projection bound only; actual resolved segment cases
 // below establish the tested operating range rather than a universal proof.
 const minimumChordClearance=radius*Math.cos(Math.asin(step/radius)/2);assert.ok(minimumChordClearance>.35);
 let cases=0;for(const lot of NEON_SHIFT_LOTS)for(const [sx,sz]of [[1,1],[1,-1],[-1,1],[-1,-1]])for(let degrees=0;degrees<=90;degrees++)for(const pressure of [.25,.5,1,2,4]){
  const angle=degrees*Math.PI/180,nx=Math.cos(angle)*sx,nz=Math.sin(angle)*sz,old=new Vector3(lot.x+sx*5+nx*(radius+1e-7),0,lot.z+sz*5+nz*(radius+1e-7)),dx=-nz*pressure-nx,dz=nx*pressure-nz,length=Math.hypot(dx,dz),next=old.clone().add(new Vector3(dx/length*step,0,dz/length*step));colliders.resolveCapsule(next,.3,1.75,.4);const resolved=next.clone();assert.equal(guard.constrainPlayer(old,next),true,JSON.stringify({lot:lot.id,sx,sz,degrees,pressure,old:old.toArray(),resolved:resolved.toArray()}));assert.ok(next.distanceTo(old)>.001);cases++;
 }assert.equal(cases,145600);
});

test('actual resolved prior clearances retain validated partial tangents and reject pure inward movement',t=>{
 const colliders=actualCityColliders(),guard=terrain(),lot=NEON_SHIFT_LOTS[0],step=6.2*.05;let partial=0,cases=0;
 for(const prior of [.350001,.36,.375,.399,.4])for(const [sx,sz]of [[1,1],[1,-1],[-1,1],[-1,-1]])for(let degrees=0;degrees<=90;degrees++)for(const pressure of [.25,.5,1,2,4]){
  const angle=degrees*Math.PI/180,nx=Math.cos(angle)*sx,nz=Math.sin(angle)*sz,old=new Vector3(lot.x+sx*5+nx*prior,0,lot.z+sz*5+nz*prior),dx=-nz*pressure-nx,dz=nx*pressure-nz,length=Math.hypot(dx,dz),next=old.clone().add(new Vector3(dx/length*step,-.02,dz/length*step));colliders.resolveCapsule(next,.3,1.75,.4);const resolved=next.clone();
  assert.equal(guard.constrainPlayer(old,next),true,JSON.stringify({prior,sx,sz,degrees,pressure}));assert.equal(next.y,resolved.y);assert.ok(Math.hypot(next.x-old.x,next.z-old.z)>1e-9);
  if(next.x!==resolved.x||next.z!==resolved.z){partial++;assert.ok(next.x===old.x||next.z===old.z);}
  const accepted=next.clone();assert.equal(guard.constrainPlayer(old,accepted),true);assert.deepEqual(accepted.toArray(),next.toArray(),'Accepted segment independently passes the same analytic guard without further projection');
  const steps=Math.ceil(Math.hypot(next.x-old.x,next.z-old.z)/.002);for(let i=0;i<=steps;i++)assert.ok(guard.supportsFootprint(old.x+(next.x-old.x)*i/steps,old.z+(next.z-old.z)*i/steps));cases++;
 }
 assert.equal(cases,9100);assert.ok(partial>0);const old=new Vector3(lot.x-5.350001,0,lot.z),inward=new Vector3(lot.x,1,lot.z);assert.equal(guard.constrainPlayer(old,inward),false);assert.deepEqual(inward.toArray(),[old.x,1,old.z]);t.diagnostic(JSON.stringify({cases,validatedPartialSlides:partial,priorClearances:[.350001,.36,.375,.399,.4]}));
});

test('actual Player has positive corner tangent progress for every valid prior clearance at 20,30,60Hz',t=>{
 const colliders=actualCityColliders(),lot=NEON_SHIFT_LOTS[0];let cases=0,minimumProgress=Infinity;
 for(const prior of [.350001,.36,.375,.399,.4])for(const [sx,sz]of [[1,1],[1,-1],[-1,1],[-1,-1]])for(const degrees of [0,15,30,45,60,75,90])for(const dt of [1/20,1/30,1/60])for(const sign of [-1,1]){
  const angle=degrees*Math.PI/180,nx=Math.cos(angle)*sx,nz=Math.sin(angle)*sz,tx=-nz*sign,tz=nx*sign,startX=lot.x+sx*5+nx*prior,startZ=lot.z+sz*5+nz*prior,player=playerAt(startX,startZ,tx-nx,tz-nz,{colliders});
  for(let frame=0;frame<Math.round(2/dt);frame++){const old=player.position.clone();player.updateWalk(dt);assert.ok(player.terrain.supportsFootprint(player.position.x,player.position.z));const accepted=player.position.clone();assert.equal(player.terrain.constrainPlayer(old,accepted),true);assert.deepEqual(accepted.toArray(),player.position.toArray());}
  const progress=(player.position.x-startX)*tx+(player.position.z-startZ)*tz;assert.ok(progress>2,JSON.stringify({prior,sx,sz,degrees,dt,sign,progress}));minimumProgress=Math.min(minimumProgress,progress);cases++;
 }assert.equal(cases,840);t.diagnostic(JSON.stringify({cases,minimumProgress,secondsPerCase:2,priorClearances:[.350001,.36,.375,.399,.4],frameRates:[20,30,60]}));
});
