import test from 'node:test';import assert from 'node:assert/strict';
import {T} from '../src/world-runtime/vendor/world-engine-contract.js';
import {Player} from '../src/player/Player.js';import {Colliders} from '../src/world/Colliders.js';import {Vector3} from '../src/engine/index.js';
import {NEON_SHIFT_LOTS} from '../src/world-runtime/NeonShiftLots.js';
import {createNeonStreetBoundary} from '../src/world-runtime/NeonStreetBoundary.js';
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
