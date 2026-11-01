import {NEON_SHIFT_LOTS,NEON_STREET_LIMIT} from './NeonShiftLots.js';
const finite=p=>p&&[p.x,p.y,p.z].every(Number.isFinite);
const pointRectDistance=(x,z,lot)=>Math.hypot(Math.max(Math.abs(x-lot.x)-lot.half,0),Math.max(Math.abs(z-lot.z)-lot.half,0));
const pointSegmentDistance=(x,z,a,b)=>{const dx=b.x-a.x,dz=b.z-a.z,length=dx*dx+dz*dz,t=length?Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/length)):0;return Math.hypot(x-a.x-dx*t,z-a.z-dz*t);};
function segmentRectDistance(a,b,lot){
 let low=0,high=1;for(const axis of ['x','z']){const delta=b[axis]-a[axis],min=lot[axis]-lot.half,max=lot[axis]+lot.half;if(delta===0){if(a[axis]<min||a[axis]>max){low=2;break;}}else{const u=(min-a[axis])/delta,v=(max-a[axis])/delta;low=Math.max(low,Math.min(u,v));high=Math.min(high,Math.max(u,v));}}
 if(low<=high)return 0;
 let distance=Math.min(pointRectDistance(a.x,a.z,lot),pointRectDistance(b.x,b.z,lot));
 for(const dx of [-1,1])for(const dz of [-1,1])distance=Math.min(distance,pointSegmentDistance(lot.x+dx*lot.half,lot.z+dz*lot.half,a,b));return distance;
}
/** Fixed street footprint restriction; terrain heights and airborne gravity stay intact.
 * Installed only by the exact pinned Neon Shift presentation integration. */
export function createNeonStreetBoundary(terrain){
 if(typeof terrain?.heightAt!=='function')throw Error('Neon streets require an existing terrain');
 const radiusOf=r=>{if(!Number.isFinite(r)||r<0||r>2)throw Error('Invalid Neon street footprint radius');return Math.max(.35,r);};
 const supportsFootprint=(x,z,radius=.35)=>{if(!Number.isFinite(x)||!Number.isFinite(z))return false;const r=radiusOf(radius);return Math.abs(x)+r<NEON_STREET_LIMIT&&Math.abs(z)+r<NEON_STREET_LIMIT&&NEON_SHIFT_LOTS.every(lot=>pointRectDistance(x,z,lot)>r);};
 function assertMovementMode(mode){if(mode!=='walk')throw Error('Neon streets support walking and jumping only');return true;}
 function assertPlayerPose(position,{mode='walk',arrival=true}={}){assertMovementMode(mode);const p=Array.isArray(position)?{x:position[0],y:position[1],z:position[2]}:position;if(!finite(p)||!supportsFootprint(p.x,p.z))throw Error('Player is outside the fixed Neon streets');const floor=terrain.heightAt(p.x,p.z);if(!Number.isFinite(floor)||p.y<floor-.08||arrival&&Math.abs(p.y-floor)>.08)throw Error('Neon street arrival requires supported floor');return true;}
 function constrainPlayer(old,next,{radius=.3,mode='walk'}={}){
  assertMovementMode(mode);const r=radiusOf(radius);
  // Invalid prior ownership cannot be repaired by clamping or teleporting a pose.
  if(!finite(old)||!supportsFootprint(old.x,old.z,r)||!Number.isFinite(terrain.heightAt(old.x,old.z))||old.y<terrain.heightAt(old.x,old.z)-.08)throw Error('Prior player pose is outside the fixed Neon streets');
  if(!finite(next))throw Error('Invalid Neon street movement');
  const validSegment=p=>supportsFootprint(p.x,p.z,r)&&NEON_SHIFT_LOTS.every(lot=>segmentRectDistance(old,p,lot)>r);
  if(validSegment(next))return true;
  // A valid old pose may be nearer the .35m support edge than the .4m physical
  // contact radius. Retain only a fully validated tangential axis component.
  // Its endpoint may remain below .4m but always clears the strict .35m guard.
  const desired={x:next.x,y:next.y,z:next.z},projections=[{x:old.x,y:next.y,z:next.z},{x:next.x,y:next.y,z:old.z}].filter(p=>Math.hypot(p.x-old.x,p.z-old.z)>1e-9&&validSegment(p));
  projections.sort((a,b)=>(a.x-desired.x)**2+(a.z-desired.z)**2-((b.x-desired.x)**2+(b.z-desired.z)**2));
  if(projections.length){next.x=projections[0].x;next.z=projections[0].z;return true;}
  next.x=old.x;next.z=old.z;return false;
 }
 return Object.freeze({...terrain,heightAt:(x,z)=>terrain.heightAt(x,z),supportsFootprint,assertPlayerPose,assertMovementMode,constrainPlayer});
}

export const NEON_STREET_CAPSULE_RADIUS=.4;
const clearanceInstalled=new WeakSet();
/** Align local physical wall sliding with the .35m analytic street footprint.
 * The .05m margin improves ordinary corner sliding at the public .05s / 6.2m/s limit.
 * Ideal isolated-circle chord bounds guide this margin; resolved segments and
 * any partial slides still require the full analytic guard above. */
export function installNeonStreetClearance(colliders){
 if(typeof colliders?.resolveCapsule!=='function')throw Error('Neon street clearance requires colliders');
 if(clearanceInstalled.has(colliders))return colliders;
 const resolve=colliders.resolveCapsule;
 colliders.resolveCapsule=function(position,radius,...args){return resolve.call(this,position,Math.max(NEON_STREET_CAPSULE_RADIUS,radius),...args);};
 clearanceInstalled.add(colliders);return colliders;
}
