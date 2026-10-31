import {AutonomousCharacter} from '../npc/AutonomousCharacter.js';
import {Navigation,vector} from '../npc/Navigation.js';
import {RigidCharacterVisual} from '../npc/RigidCharacterVisual.js';
import {mapPortalPoint,portalLocalPoint,portalWorldPoint} from './vendor/world-engine-contract.js';
const check=(condition,message)=>{if(!condition)throw Error(message);};
const projectOf=c=>c?.project??c?.descriptor?.project;
const idOf=c=>c?.identity?.worldId??c?.descriptor?.worldId??projectOf(c)?.worldId;
const ROOM_WORLD_ID='elsemesh.world:5c2e6618-a04a-4460-912a-bfc57bc5bbad';
const CONFIG=Object.freeze({radius:.1,height:.275,speed:.22,turnRate:1.8,portalCooldown:8,portalInterval:12,portalProbability:1,exploreRadius:2,wanderRadius:.8,idleMin:.4,idleMax:1});
/** One local actor, with two independently owned permanent graphics instances.
 * This component never activates a player world or accesses a network identity. */
export class PublicMicroduck{
 constructor({runtime,getActive,createVisual=()=>new RigidCharacterVisual(),config={}}={}){
  const opening=runtime.catalog.openingWorldId,leaf=runtime.catalog.worlds.length===2?runtime.catalog.worlds.find(w=>w.worldId!==opening)?.worldId:ROOM_WORLD_ID;
  this.habitat=new Set([opening,leaf].filter(id=>runtime.entry(id)));
  Object.assign(this,{runtime,getActive,createVisual});this.config={...CONFIG,...config};this.contexts=new Map();this.retired=new Map();this.installing=new Map();this.epoch=0;this.disposed=false;this.actor=null;this.error=null;this.status='waiting';this.loading=null;
 }
 async install(candidate){
  if(this.disposed)return false;const worldId=idOf(candidate),entry=this.runtime.entry(worldId);if(!this.habitat.has(worldId)||!entry||!candidate?.root||!candidate.terrain||!candidate.colliders)return false;
  const existing=this.contexts.get(worldId);if(existing?.root===candidate.root)return true;if(existing){existing.visual.root.visible=false;this.retired.set(existing.root,existing);this.contexts.delete(worldId);if(this.actor){this.actor._epoch++;this.actor.setActive(false);this.actor=null;}}
  if(this.installing.has(candidate.root))return this.installing.get(candidate.root);
  let visual;try{visual=this.createVisual();}catch(error){this.error=error.message;this.status='unavailable';return false;}const epoch=this.epoch,pending=(async()=>{try{
   check(await visual.ready!==false,'Microduck asset preparation failed');check(!this.disposed&&epoch===this.epoch&&!candidate.disposed,'Microduck preparation superseded');
   check(!this.contexts.has(worldId),'Microduck world package replaced');visual.root.visible=false;candidate.root.add(visual.root);
   this.contexts.set(worldId,{worldId,digest:entry.contentDigest,candidate,root:candidate.root,visual,project:projectOf(candidate)});this.status='waiting';return true;
  }catch(error){visual.dispose();if(epoch===this.epoch){this.error=error.message;this.status='unavailable';}return false;}finally{if(this.installing.get(candidate.root)===pending)this.installing.delete(candidate.root);}})();
  this.installing.set(candidate.root,pending);return pending;
 }
 context(worldId){const context=this.contexts.get(worldId),entry=this.runtime.entry(worldId);return context&&entry&&entry.contentDigest===context.digest&&!context.candidate.disposed&&!context.visual.disposed&&context.visual.root.parent===context.root?context:null;}
 bound(context){
  const active=this.getActive?.();if(active?.root===context.root)return active.identity?.worldId===context.worldId&&active.identity?.contentDigest===context.digest;
  const loaded=this.runtime.loaded.get(context.worldId),record=loaded&&this.runtime.cache.get(loaded);return !!record&&record.candidate.root===context.root&&loaded.identity.contentDigest===context.digest&&!record.disposed;
 }
 habitatRoute(worldId,portalId){return this.runtime.catalog.routes.find(r=>r.sourceWorldId===worldId&&(portalId===undefined||r.portalId===portalId)&&this.habitat.has(r.sourceWorldId)&&this.habitat.has(r.destinationWorldId));}
 home(context){const route=this.habitatRoute(context.worldId),portal=context.project.portals?.find(p=>p.id===route?.portalId);check(portal,'Microduck authored doorway missing');const p=vector(portalWorldPoint(portal,[0,-portal.height/2,.8])),nav=new Navigation({...context.candidate,config:this.config}),ground=nav.ground(p.x,p.z,p.y+nav.config.stepHeight+.1);p.y=ground;const safe=nav.surface(p);check(safe,'Microduck doorway has no supported spawn');return safe;}
 async prepareOther(){
  if(this.loading||this.disposed)return;const epoch=this.epoch;
  this.loading=(async()=>{try{for(const entry of this.runtime.catalog.worlds.filter(e=>this.habitat.has(e.worldId))){if(this.context(entry.worldId))continue;const record=await this.runtime.package(entry.worldId);check(epoch===this.epoch&&this.runtime.enabled,'Microduck loading superseded');check(this.context(entry.worldId)?.root===record.candidate.root,'Microduck visual was not installed before package registration');}}catch(error){if(epoch===this.epoch){this.error=error.message;this.status='unavailable';}}finally{if(epoch===this.epoch)this.loading=null;}})();
 }
 start(){
  const active=this.getActive?.();if(!active||active.identity?.worldId!==this.runtime.catalog.openingWorldId)return false;
  const source=this.context(active.identity.worldId);if(!source||!this.bound(source)||this.habitat.size!==2||this.contexts.size!==2||[...this.contexts.values()].some(c=>!this.bound(c)))return false;
  try{const position=this.home(source);this.actor=new AutonomousCharacter({id:'public-microduck',seed:1052025,worldId:source.worldId,terrain:source.candidate.terrain,colliders:source.candidate.colliders,portals:source.project.portals,position:position.toArray(),config:this.config,canTraverse:p=>this.eligibility(p),transfer:r=>this.transfer(r)});this.actor.explorationOrigin=position.clone();this.status='exploring';this.error=null;return true;}catch(error){this.error=error.message;this.status='unavailable';return false;}
 }
 eligibility(portal){
  if(!this.runtime.enabled||!this.actor)return false;const source=this.context(this.actor.worldId),route=this.habitatRoute(this.actor.worldId,portal.id),destination=this.context(route?.destinationWorldId);
  if(!source||!destination||!this.bound(source)||!this.bound(destination))return false;
  try{const exit=this.runtime.validateRoute({identity:{worldId:source.worldId}},portal,{loaded:{project:destination.project}});return {destinationPortal:exit};}catch{return false;}
 }
 validate(context,from,to){
  const nav=new Navigation({...context.candidate,config:this.config}),a=vector(from),b=vector(to),safe=nav.segment(a,b);check(nav.surface(a)&&safe,'Microduck unsupported capsule segment');
  const physics=context.candidate.splatScene?.physics;if(physics)check(physics.segment(from,safe.toArray(),{radius:this.config.radius,height:this.config.height,footRadius:this.config.radius,stepHeight:.001}).valid,'Microduck segment leaves reviewed corridor');return safe;
 }
 async transfer(request){
  const epoch=this.epoch,actor=this.actor,source=this.context(request.sourceWorldId),previous=request.previousPosition;
  try{
   check(actor&&request.actorId===actor.id&&source&&this.bound(source)&&this.runtime.enabled,'Microduck source changed');const route=this.habitatRoute(source.worldId,request.portal.id);check(route,'Microduck route unavailable');
   const record=await this.runtime.package(route.destinationWorldId),destination=this.context(route.destinationWorldId);
   check(epoch===this.epoch&&this.actor===actor&&destination&&destination.root===record.candidate.root&&this.bound(source)&&this.bound(destination)&&this.runtime.enabled,'Microduck destination changed');
   const exit=this.runtime.validateRoute({identity:{worldId:source.worldId}},request.portal,record),mapped=mapPortalPoint(request.portal,exit,request.sourcePosition);
   // Native chunks are prepared without moving a player or changing active ownership.
   await destination.candidate.nativeIsland?.ensureArrival(mapped);
   check(epoch===this.epoch&&this.actor===actor&&this.bound(source)&&this.bound(destination)&&this.runtime.enabled,'Microduck transfer superseded');
   this.validate(source,previous??request.sourcePosition,request.sourcePosition);
   const arrival=this.validate(destination,mapped,mapped),local=portalLocalPoint(exit,arrival.toArray()),egress=portalWorldPoint(exit,[local[0],local[1],Math.max(.4,this.config.radius+.15)]);this.validate(destination,arrival.toArray(),egress);
   const origin=this.home(destination);
   return {worldId:destination.worldId,terrain:destination.candidate.terrain,colliders:destination.candidate.colliders,portals:destination.project.portals,destinationPortal:exit,explorationOrigin:origin.toArray(),commit:()=>{check(epoch===this.epoch&&this.actor===actor&&this.runtime.enabled&&this.bound(source)&&this.bound(destination),'Microduck commit superseded');}};
  }catch(error){if(epoch===this.epoch){this.error=error.message;this.status='stayed in source';}return {cancelled:true};}
 }
 update(dt){
  if(this.disposed||!this.runtime.enabled)return;const active=this.getActive?.();if(!this.runtime.entry(active?.identity?.worldId))return;
  if(!this.actor){if(this.status==='unavailable')return;void this.prepareOther();if(!this.start())return;}
  const context=this.context(this.actor.worldId);if(!context||!this.bound(context)){this.stop();this.error='Microduck package changed';return;}
  this.actor.update(dt);const snapshot=this.actor.snapshot();for(const c of this.contexts.values()){const visible=c.worldId===snapshot.worldId;c.visual.root.visible=visible;if(visible)c.visual.update(snapshot);}
 }
 // Simulation ends immediately. GPU disposal belongs to actual package retirement,
 // after its preparation lease settles, even when a hidden graph is preserved active.
 releaseCandidate(candidate){
  const root=candidate?.root,context=[...this.contexts.values()].find(c=>c.root===root)??this.retired.get(root);if(!context)return;
  const current=this.contexts.get(context.worldId)===context;if(current)this.contexts.delete(context.worldId);this.retired.delete(root);context.visual.dispose();
  if(current&&this.actor){this.actor._epoch++;this.actor.setActive(false);this.actor=null;}if(current)this.status='waiting';
 }
 stop(){this.epoch++;if(this.actor){this.actor._epoch++;this.actor.setActive(false);}this.actor=null;this.loading=null;for(const c of this.contexts.values()){c.visual.root.visible=false;this.retired.set(c.root,c);}this.contexts.clear();this.status='stopped';}
 dispose(){if(this.disposed)return;this.stop();this.disposed=true;}
 diagnostics(){return {status:this.status,error:this.error,epoch:this.epoch,visualCount:this.contexts.size,worlds:[...this.contexts.values()].map(c=>({worldId:c.worldId,visible:c.visual.root.visible,bound:this.bound(c)})),actor:this.actor?.snapshot()??null};}
}
