import {PublishedWorldCache} from './PublishedWorldCache.js';
import {validatePublishedWorldCatalog} from './PublishedWorldCatalog.js';
import {hostedRepositorySource} from './HostedRepository.js';
import {Player} from '../player/Player.js';
import {Vector3} from '../engine/index.js';
import {loadWorldSource,describeRuntimeWorld,portalLocalPoint,portalWorldPoint,mapPortalPoint,mapPortalDirection,mapPortalYaw,sweepPortalCapsule} from './vendor/world-engine-contract.js';
const check=(v,m)=>{if(!v)throw Error(m);};
/** A published single-player journey. It never creates a network identity,
 * membership, owner grant, network peer, or authority receipt. */
export class PublicPortalRuntime{
 constructor({catalog,engine,host,input,views,buildScene,disposeCandidate,addPortalFrame,portalEffects,onStatus=()=>{},onChange=()=>{},onActivated=()=>{},baseURL=location.href,fetcher=fetch}={}){
  this.catalog=validatePublishedWorldCatalog(catalog,{baseURL});check(engine&&host&&input&&views&&buildScene&&disposeCandidate,'Public runtime dependencies missing');Object.assign(this,{engine,host,input,views,buildScene,disposeCandidate,addPortalFrame,portalEffects,onStatus,onChange,onActivated,baseURL,fetcher});
  this.mode='published';this.connected=false;this.config=null;this.transport={closed:true,frozen:false,connectionEpoch:0};this.loaded=new Map();this.descriptors=new Map();this.presence=new Map();this.previewRecords=new Map();this.loads=new Map();this.builds=new Map();this.pending=false;this.authorityOffline=false;this.enabled=false;this.disposed=false;this.epoch=0;this.lastPosition=null;this.rearm=null;this.errors=new Map();this.crossings=0;this.activeRecord=null;this.preparations=new Map();this.closingCaches=new Set();
  this.originalHooks={acquireResources:host.acquireResources,registerResources:host.registerResources,retainResources:host.retainResources};this.newCache();
 }
 newCache(){this.cache=new PublishedWorldCache({limit:this.catalog.worlds.length,renderer:this.engine.backend??'webgl2',dispose:c=>{this.portalEffects?.removeRoot(c.root);this.disposeCandidate(c);},readinessFingerprint:this.engine.repositoryReadinessSignature});}
 entry(id){return this.catalog.worlds.find(w=>w.worldId===id);}
 routedPortals(worldId,project){return (project.portals??[]).filter(p=>this.route(worldId,p.id));}
 route(worldId,portalId){return this.catalog.routes.find(r=>r.sourceWorldId===worldId&&r.portalId===portalId);}
 assertLoaded(loaded){const e=this.entry(loaded?.identity?.worldId);check(e&&loaded.identity.contentDigest===e.contentDigest,'Published content identity changed');return e;}
 installHooks(){
  const current=(cache,epoch,source,generation)=>this.enabled&&this.cache===cache&&!cache.disposed&&this.epoch===epoch&&this.host.active===source&&this.host.generation===generation;
  this.host.acquireResources=async loaded=>{
   if(!this.enabled)return null;this.assertLoaded(loaded);const cache=this.cache,epoch=this.epoch,source=this.host.active,generation=this.host.generation,record=cache.get(loaded);if(!record)return null;
   const existing=this.preparations.get(record);if(existing){await existing;check(current(cache,epoch,source,generation),'Published preparation superseded');return cache.borrow(loaded);}
   const lease=cache.reservePreparation(loaded);
   const work=(async()=>{try{if(!cache.isReady(record))await this.engine.prepareRepositoryResources?.(record.candidate.root);check(current(cache,epoch,source,generation)&&cache.get(loaded)===record,'Published preparation superseded');cache.markReady(record);check(cache.isReady(record),'Published readiness changed');return lease;}catch(error){lease.release();throw error;}})();
   this.preparations.set(record,work);try{return await work;}finally{if(this.preparations.get(record)===work)this.preparations.delete(record);}
  };
  this.host.registerResources=async prepared=>{if(!this.enabled)return null;this.assertLoaded(prepared.loaded);const cache=this.cache,epoch=this.epoch,source=this.host.active,generation=this.host.generation;await this.finishCandidate(prepared);check(current(cache,epoch,source,generation),'Published registration superseded');cache.register(prepared.loaded,prepared);return cache.borrow(prepared.loaded);};
  this.host.retainResources=active=>!!active&&(this.cache.retains(active.root)||[...this.closingCaches].some(cache=>cache.retains(active.root))||this.originalHooks.retainResources(active));
 }
 restoreHooks(){Object.assign(this.host,this.originalHooks);}
 async finishCandidate(candidate){
  const project=candidate.project??candidate.descriptor.project,worldId=candidate.loaded?.identity?.worldId??candidate.identity?.worldId??candidate.descriptor?.worldId??project.metadata?.worldId,portals=this.routedPortals(worldId,project);
  if(!candidate.root.userData.repositoryPortalFramesReady){for(const p of portals)this.addPortalFrame?.(candidate.root,p);candidate.root.userData.repositoryPortalFramesReady=true;}
  if(!candidate.publicViewEntries||candidate.publicViewEntries.size===0&&portals.length){const stage=this.views.fork();try{for(const p of portals)candidate.root.add(stage.setDestination(p.id,{source:p,authorizedView:false,state:'unavailable'}));await Promise.all([...stage.entries.keys()].map(id=>stage.whenReady?.(id)));candidate.publicViewEntries=stage.park();candidate.disposePublicViews=()=>stage.disposeEntries(candidate.publicViewEntries);}catch(error){stage.dispose();throw error;}}
  await this.engine.prepareRepositoryResources?.(candidate.root);
 }
 async load(id){
  const e=this.entry(id);check(e,'World is not in this published catalog');let loaded=this.loaded.get(id);if(loaded){this.assertLoaded(loaded);return loaded;}if(this.loads.has(id))return this.loads.get(id);const epoch=this.epoch;
  const work=(async()=>{const source=hostedRepositorySource(e.bundlePath,{baseURL:this.baseURL,origin:new URL(this.baseURL).origin,fetch:this.fetcher});const value=await loadWorldSource(source,{expectedWorldId:e.worldId,expectedContentDigest:e.contentDigest});this.assertLoaded(value);check(epoch===this.epoch&&this.enabled,'Published load superseded');this.loaded.set(id,value);return value;})();this.loads.set(id,work);try{return await work;}finally{if(this.loads.get(id)===work)this.loads.delete(id);}
 }
 async package(id){
  const loaded=await this.load(id);let record=this.cache.get(loaded);if(record)return record;if(this.builds.has(id))return this.builds.get(id);const epoch=this.epoch;
  const work=(async()=>{let candidate;try{candidate=await this.buildScene(describeRuntimeWorld(loaded.project),this.engine.camera.clone(),{loaded});check(epoch===this.epoch&&this.enabled,'Published preparation superseded');await this.finishCandidate(candidate);check(epoch===this.epoch&&this.enabled,'Published preparation superseded');record=this.cache.register(loaded,candidate);return record;}catch(error){if(candidate){candidate.disposePublicViews?.();this.disposeCandidate(candidate);}throw error;}})();this.builds.set(id,work);try{return await work;}finally{if(this.builds.get(id)===work)this.builds.delete(id);}
 }
 validateRoute(source,portal,destination){const r=this.route(source.identity.worldId,portal.id),exit=destination.loaded.project.portals?.find(p=>p.id===r?.destinationPortalId);check(r&&r.destinationWorldId===portal.destination?.worldId&&r.destinationPortalId===portal.destination?.portalId&&portal.enabled&&portal.traversal?.enabled!==false&&exit?.enabled&&exit.traversal?.enabled!==false&&exit.destination?.worldId===r.sourceWorldId&&exit.destination?.portalId===r.portalId,'Published authored portal pair mismatch');return exit;}
 async activateOffline(expected=this.host.active){
  check(!this.disposed&&!this.pending&&this.host.active===expected,'Published activation changed');this.assertLoaded(expected.loaded);const epoch=this.epoch,generation=this.host.generation,wasEnabled=this.input.enabled===true;if(this.cache.disposed)this.newCache();const cache=this.cache;this.enabled=true;this.pending=true;this.input.suspend();this.config={protocol:'elsemesh.published-runtime/1'};this.installHooks();let record,lease;
  const current=()=>this.host.active===expected&&this.enabled&&epoch===this.epoch&&generation===this.host.generation&&this.cache===cache&&!cache.disposed;
  try{
   await Promise.all([...this.closingCaches].map(c=>c.whenDisposed));check(current(),'Published opening superseded');
   record=cache.get(expected.loaded)??cache.register(expected.loaded,expected);check(!record.active,'Published opening already active');lease=cache.reservePreparation(expected.loaded);
   await this.finishCandidate(expected);check(current(),'Published opening superseded');record.viewEntries=expected.publicViewEntries;record.disposeViews=expected.disposePublicViews;record.candidate.publicViewEntries=expected.publicViewEntries;cache.markReady(record);lease.commit();this.loaded.set(expected.identity.worldId,expected.loaded);this.setActive(expected);this.onStatus('Published single-player worlds · no network membership');return true;
  }catch(error){if(current()){this.enabled=false;this.restoreHooks();cache.dispose({preserveRoot:()=>this.host.active?.root});}throw error;}
  finally{
   // Initial preparation creates its apertures before the GPU await. Keep their
   // final disposer attached to the protected package even on cancellation.
   if(record){record.viewEntries??=expected.publicViewEntries;record.disposeViews??=expected.disposePublicViews;}
   lease?.release();if(epoch===this.epoch&&generation===this.host.generation&&this.host.active===expected){this.pending=false;this.input._clearTransientInput?.();if(wasEnabled)this.input.resume();}
  }
 }
 setActive(active){
  if(this.activeRecord)this.activeRecord.viewEntries=this.views.park();else this.views.clear();
  const record=this.cache.get(active.loaded);check(record,'Published active package missing');this.activeRecord=record;this.views.restore(active,record.viewEntries);record.viewEntries=null;this.previewRecords.clear();this.lastPosition=active.player.position.toArray();this.onChange(active);this.onActivated(active);
 }
 async preview(portal){
  const source=this.host.active,route=this.route(source?.identity.worldId,portal.id);if(!this.enabled||!route)return false;const epoch=this.epoch;this.previewRecords.set(portal.id,{worldId:route.destinationWorldId,loading:true});
  try{const record=await this.package(route.destinationWorldId);check(this.enabled&&epoch===this.epoch&&source===this.host.active,'Published preview superseded');const exit=this.validateRoute(source,portal,record);check(!record.active&&!record.pin,'Published destination busy');
   if(record.candidate.root.parent&&record.candidate.root.parent!==this.views.getScene(portal.id))record.candidate.root.removeFromParent();
   this.views.setDestination(portal.id,{source:portal,destination:exit,candidate:record.candidate,ownsCandidate:false,authorizedView:true,state:'live'});await this.views.whenReady?.(portal.id);check(this.enabled&&epoch===this.epoch&&source===this.host.active,'Published preview superseded');this.previewRecords.set(portal.id,{worldId:route.destinationWorldId,record});this.errors.delete(portal.id);return true;
  }catch(error){if(epoch===this.epoch&&source===this.host.active){this.views.setState(portal.id,'unavailable');this.previewRecords.set(portal.id,{worldId:route.destinationWorldId,error:error.message,retryAt:performance.now()+5000});this.errors.set(portal.id,error.message);this.onStatus('Portal unavailable: '+error.message);}return false;}
 }
 validateSegment(candidate,from,to){
  const physics=candidate.splatScene?.physics;if(physics){check(physics.segment(from,to,{radius:.3,height:1.8,footRadius:.35,stepHeight:.001}).valid,'Destination corridor does not support arrival and exit');return;}
  const distance=Math.hypot(...to.map((v,i)=>v-from[i]));check(distance<=2,'Arrival segment is too long');const steps=Math.max(1,Math.ceil(distance/.02));
  for(let n=0;n<=steps;n++){const t=n/steps,p=from.map((v,i)=>v+(to[i]-v)*t),floor=Player.prototype.groundAt.call(candidate,p[0],p[2],p[1]+.001);check(Number.isFinite(floor)&&Math.abs(p[1]-floor)<=.08,'Destination arrival has no supported floor');check(!candidate.terrain.supportsFootprint||candidate.terrain.supportsFootprint(p[0],p[2],.35),'Destination footprint unsupported');const probe=new Vector3(...p);let solid=false;candidate.colliders.resolveCapsule(probe,.3,1.8,.001,c=>{if(!Number.isFinite(c.penetration)||Math.abs(c.penetration)>Math.min(1e-8,32*Number.EPSILON*Math.max(1,...p.map(Math.abs),...[c.collider?.center?.x,c.collider?.center?.z,c.collider?.half?.x,c.collider?.half?.z,c.collider?.radius,c.radius].filter(Number.isFinite).map(Math.abs))))solid=true;});check(!solid&&probe.distanceTo(new Vector3(...p))<=1e-8,'Destination arrival intersects solid geometry');}
 }
 async cross(portal,source=this.host.active,checkpoint){
  if(this.pending||!this.enabled||source!==this.host.active||source.player.mode!=='walk'||!this.route(source.identity.worldId,portal.id))return false;const epoch=this.epoch,generation=this.host.generation,wasEnabled=this.input.enabled===true;this.pending=true;this.input.suspend();let prepared,activated,activationGeneration;
  const saved=checkpoint??{position:source.player.position.toArray(),velocity:source.player.velocity.toArray(),yaw:source.player.yaw,pitch:source.player.pitch};
  try{const route=this.route(source.identity.worldId,portal.id),record=await this.package(route.destinationWorldId);check(this.enabled&&epoch===this.epoch&&source===this.host.active&&generation===this.host.generation,'Published travel superseded');const exit=this.validateRoute(source,portal,record),feet=source.player.position.toArray(),mapped=mapPortalPoint(portal,exit,feet),local=portalLocalPoint(exit,mapped),front=[...local];front[2]=Math.max(.15,front[2]);const arrival=portalWorldPoint(exit,front),end=[...front];end[2]=Math.max(.4,end[2]);const egress=portalWorldPoint(exit,end);await record.candidate.nativeIsland?.ensureArrival(arrival);
   check(this.enabled&&epoch===this.epoch&&source===this.host.active&&generation===this.host.generation,'Published travel superseded');this.validateSegment(record.candidate,mapped,arrival);this.validateSegment(record.candidate,arrival,egress);
   const pose={position:arrival,velocity:mapPortalDirection(portal,exit,source.player.velocity.toArray()),yaw:mapPortalYaw(portal,exit,source.player.yaw),pitch:source.player.pitch};this.preparePending=this.host.prepare(record.loaded,{pose});prepared=await this.preparePending;this.preparePending=null;check(prepared&&this.enabled&&epoch===this.epoch&&source===this.host.active&&generation===this.host.generation,'Published travel superseded');
   check(await this.host.activatePrepared(prepared),'Published activation superseded');prepared=null;activated=this.host.active;activationGeneration=this.host.generation;this.crossings++;this.rearm={worldId:route.destinationWorldId,portalId:route.destinationPortalId};this.setActive(this.host.active);this.portalEffects?.transition('active');this.onStatus('Arrived in '+this.host.active.project.metadata.name+' · single player');return true;
  }catch(error){if(prepared)this.host.discardPrepared(prepared);if(this.enabled&&epoch===this.epoch&&source===this.host.active&&generation===this.host.generation){source.player.position.fromArray(saved.position);source.player.velocity.set(0,0,0);source.player.yaw=saved.yaw;source.player.pitch=saved.pitch;this.input._clearTransientInput?.();source.player.update(0);this.lastPosition=source.player.position.toArray();this.errors.set(portal.id,error.message);this.onStatus('Stayed in source world: '+error.message);}return false;
  }finally{if(epoch===this.epoch){this.pending=false;const sameSource=this.host.active===source&&this.host.generation===generation,ownDestination=activated&&this.host.active===activated&&this.host.generation===activationGeneration;if(this.enabled&&(sameSource||ownDestination)){this.input._clearTransientInput?.();if(wasEnabled)this.input.resume();}}}
 }
 update(){if(!this.enabled||this.pending||!this.host.active)return;const active=this.host.active,position=active.player.position.toArray();for(const portal of this.routedPortals(active.identity.worldId,active.project)){const route=this.route(active.identity.worldId,portal.id);if(!route)continue;const local=portalLocalPoint(portal,position);if(this.rearm?.worldId===active.identity.worldId&&this.rearm.portalId===portal.id&&local[2]>.9)this.rearm=null;const record=this.previewRecords.get(portal.id);if(portal.enabled&&portal.view?.enabled!==false&&Math.hypot(...local)<(portal.view?.maxDistance??30)&&(!record||record.retryAt&&record.retryAt<performance.now()))void this.preview(portal);if(active.player.mode==='walk'&&!(this.rearm?.worldId===active.identity.worldId&&this.rearm.portalId===portal.id)&&this.lastPosition&&sweepPortalCapsule({portal,previousFeet:this.lastPosition,nextFeet:position,radius:.3,bodyHeight:1.8})){const checkpoint={position:[...this.lastPosition],velocity:active.player.velocity.toArray(),yaw:active.player.yaw,pitch:active.player.pitch};void this.cross(portal,active,checkpoint);break;}}this.lastPosition=position;}
 render(frame){this.views.render(frame);}
 getPeerLayer(){return null;}avatarRepresentations(){return [];}recover(){return Promise.reject(Error('Published single-player travel has no network recovery'));}
 diagnostics(){return {mode:'published',activeWorldId:this.host.active?.identity.worldId,pending:this.pending,enabled:this.enabled,crossings:this.crossings,cacheCount:this.cache.records.size,previewCount:[...this.previewRecords.values()].filter(r=>r.record).length,errors:[...this.errors].map(([portalId,error])=>({portalId,error})),portals:[...this.views.entries].map(([id,e])=>({id,state:e.aperture.userData.portalViewState,worldId:this.previewRecords.get(id)?.worldId}))};}
 disconnect(){
  this.onBeforeDisconnect?.();
  if(this.pending)this.host.generation++;this.epoch++;this.transport.connectionEpoch++;this.enabled=false;this.pending=false;this.config=null;this.restoreHooks();
  if(this.activeRecord){this.activeRecord.viewEntries=this.views.park();this.activeRecord=null;}else this.views.clear();
  const cache=this.cache;for(const prepared of [...this.host.prepared??[]])if(prepared.resourceLease?.record&&cache.records.has(prepared.resourceLease.record.key))this.host.discardPrepared(prepared);
  this.closingCaches.add(cache);const retain=active=>!!active&&(cache.retains(active.root)||[...this.closingCaches].some(c=>c.retains(active.root))||this.originalHooks.retainResources(active));this.host.retainResources=retain;
  cache.dispose({preserveRoot:()=>this.host.active?.root});void cache.whenDisposed.then(()=>{this.closingCaches.delete(cache);if(this.host.retainResources===retain)this.host.retainResources=this.originalHooks.retainResources;});
  this.previewRecords.clear();this.loaded.clear();this.loads.clear();this.errors.clear();this.lastPosition=null;
 }
 releaseOfflineResources(){}dispose(){if(this.disposed)return;this.disconnect();this.disposed=true;this.views.dispose();}
}
