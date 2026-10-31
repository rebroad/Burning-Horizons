import {Vector3} from '../engine/index.js';
const DEFAULT_OFFSET=[3.2,2.4,4.5],RADIUS=.22,SKIN=.08;
const finite=v=>v&&[v.x,v.y,v.z].every(Number.isFinite);
function portalDistance(portal,p){return Math.hypot(p.x-portal.position[0],p.z-portal.position[2]);}
function front(portal){return new Vector3(Math.sin(portal.yaw),0,Math.cos(portal.yaw));}
/** Render-camera tracking only. Call after Player.update; never enable app.freeCam. */
export class RepositoryFollowCamera{
 constructor({camera}={}){
  if(!camera?.position||typeof camera.lookAt!=='function')throw Error('A compatible render camera is required');
  this.camera=camera;this.enabled=false;this.active=null;this.mode=null;this.distance=null;this.offset=new Vector3(...DEFAULT_OFFSET);this.state={enabled:false};
 }
 setEnabled(value){const enabled=!!value;if(enabled!==this.enabled){this.enabled=enabled;this.reset();}this.state.enabled=enabled;}
 reset(active){this.active=null;this.mode=null;this.distance=null;if(active)this.initialize(active);}
 initialize(active){
  this.offset.set(...DEFAULT_OFFSET);
  this.active=active;this.mode=active.player.mode;this.distance=null;
 }
 planeClearance(){
  const near=Math.max(.01,this.camera.near??.06),fov=(this.camera.fov??62)*Math.PI/180,aspect=Math.max(1,this.camera.aspect??1);
  // A conservative bounding sphere encloses all near-plane corners regardless
  // of camera aim. Keeping this entire sphere in front prevents portal backs.
  return Math.max(RADIUS,near*Math.sqrt(1+Math.tan(fov/2)**2*(1+aspect**2)))+SKIN;
 }
 constrainFront(point,portal,clearance){
  const n=front(portal),z=(point.x-portal.position[0])*n.x+(point.z-portal.position[2])*n.z;
  if(z<clearance)point.addScaledVector(n,clearance-z);
 }
 safeDistance(active,anchor,direction,maxDistance){
  const right=new Vector3(direction.z,0,-direction.x);if(right.lengthSq()<1e-8)right.set(1,0,0);else right.normalize();
  const up=new Vector3().crossVectors(direction,right).normalize(),colliders=active.colliders??active.player.colliders;
  let safe=maxDistance;
  if(colliders?.raycast)for(const offset of [new Vector3(),right.clone().multiplyScalar(RADIUS),right.clone().multiplyScalar(-RADIUS),up.clone().multiplyScalar(RADIUS),up.clone().multiplyScalar(-RADIUS)]){
   const hit=colliders.raycast(anchor.clone().add(offset),direction,maxDistance+SKIN);
   if(Number.isFinite(hit)&&hit<maxDistance+SKIN-1e-6)safe=Math.min(safe,Math.max(0,hit-SKIN));
  }
  const terrain=active.terrain??active.player.terrain;
  if(terrain?.heightAt)for(let d=0;d<=safe+.00001;d=Math.min(safe,d+.2)){
   const point=anchor.clone().addScaledVector(direction,d),floor=terrain.heightAt(point.x,point.z);
   if(!Number.isFinite(floor)||point.y<floor+RADIUS){safe=Math.max(0,d-.25);break;}
   if(d===safe)break;
  }
  return safe;
 }
 update(dt,active,{suspended=false,arrivalPortal}={}){
  if(!this.enabled||!active?.player||suspended)return false;
  const player=active.player;if(!finite(player.position))return false;
  if(this.active!==active||this.mode!==player.mode)this.initialize(active,arrivalPortal);
  const yaw=Number.isFinite(player.yaw)?player.yaw:0;
  this.offset.set(DEFAULT_OFFSET[0]*Math.cos(yaw)+DEFAULT_OFFSET[2]*Math.sin(yaw),DEFAULT_OFFSET[1],-DEFAULT_OFFSET[0]*Math.sin(yaw)+DEFAULT_OFFSET[2]*Math.cos(yaw));
  const target=player.position.clone();target.y+=1.15;
  const lookPitch=Math.max(-1.25,Math.min(1.25,Number.isFinite(player.pitch)?player.pitch:0));
  target.y+=Math.tan(lookPitch)*Math.hypot(this.offset.x,this.offset.z);
  const anchor=target.clone(),desired=target.clone().add(this.offset),clearance=this.planeClearance();
  const planes=(active.project?.portals??[]).filter(portal=>{
   if(portal.enabled===false||portalDistance(portal,player.position)>7)return false;
   const n=front(portal),z=(player.position.x-portal.position[0])*n.x+(player.position.z-portal.position[2])*n.z;
   return z>=-.35;
  });
  for(const portal of planes){this.constrainFront(anchor,portal,clearance);this.constrainFront(desired,portal,clearance);}
  const direction=desired.clone().sub(anchor),wanted=direction.length();if(wanted<1e-6)return false;direction.multiplyScalar(1/wanted);
  const safe=this.safeDistance(active,anchor,direction,wanted),step=Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0));
  this.distance=this.distance===null||safe<this.distance?safe:this.distance+(safe-this.distance)*(1-Math.exp(-step*5));
  this.distance=Math.min(this.distance,safe);
  const position=anchor.clone().addScaledVector(direction,this.distance);
  this.camera.position.copy(position);this.camera.lookAt(target.x,target.y,target.z);this.camera.updateMatrixWorld?.(true);
  this.state={enabled:true,worldId:active.identity?.worldId,mode:player.mode,distance:this.distance,occluded:safe<wanted-.05,avatarClear:this.distance>.8,position:position.toArray(),target:target.toArray(),portalFrontClearance:clearance,constrainedPortals:planes.map(p=>p.id)};
  return true;
 }
}
export const newRepositoryFollowCamera=options=>new RepositoryFollowCamera(options);
