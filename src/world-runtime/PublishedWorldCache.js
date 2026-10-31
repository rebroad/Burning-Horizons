const keyOf=(loaded,renderer)=>renderer+'|'+loaded.identity.worldId+'|'+loaded.identity.contentDigest;
const check=(v,m)=>{if(!v)throw Error(m);};
const fingerprint=c=>{const values=[];c.root.traverse(n=>{for(const m of Array.isArray(n.material)?n.material:[n.material])if(m)values.push(m.id+':'+m.version);});return [...new Set(values)].sort().join('|');};
/** Two or three content-only packages. Preparation leases protect the entire coupled
 * graph (roots, apertures and materials) before any asynchronous GPU operation. */
export class PublishedWorldCache{
 constructor({renderer='webgl2',limit=2,dispose=()=>{},readinessFingerprint=fingerprint}={}){check(Number.isInteger(limit)&&limit>=2&&limit<=3,'Published cache requires two or three slots');Object.assign(this,{renderer,limit,disposeCandidate:dispose,fingerprint:readinessFingerprint});this.records=new Map();this.active=null;this.disposed=false;this.whenDisposed=new Promise(resolve=>{this.resolveDisposed=resolve;});}
 get(loaded){if(this.disposed)return null;const r=this.records.get(keyOf(loaded,this.renderer));return r&&!r.disposed?r:null;}
 register(loaded,candidate){check(!this.disposed&&loaded?.identity?.worldId&&loaded.identity.contentDigest&&candidate?.root,'Invalid published cache registration');const key=keyOf(loaded,this.renderer),old=this.records.get(key);if(old){check(old.candidate.root===candidate.root,'Duplicate published package');return old;}check(this.records.size<this.limit,'Published cache capacity exhausted');check(![...this.records.values()].some(r=>r.candidate.root===candidate.root),'Published root already registered');const {player,generation,resourceLease,preparedState,...graphics}=candidate,r={key,loaded,candidate:graphics,active:false,pin:null,disposed:false,ready:true,fingerprint:this.fingerprint(candidate),viewEntries:candidate.publicViewEntries??null,disposeViews:candidate.disposePublicViews};this.records.set(key,r);return r;}
 isReady(record){return !this.disposed&&!!record&&!record.disposed&&record.ready&&record.fingerprint===this.fingerprint(record.candidate);}
 markReady(record){check(!this.disposed&&!record.disposed,'Published package disposed');record.fingerprint=this.fingerprint(record.candidate);record.ready=true;}
 reservePreparation(loaded){
  check(!this.disposed,'Published cache closed');const record=this.get(loaded);if(!record)return null;check(!record.active&&!record.pin,'Published package already active or leased');const token={};record.pin=token;let settled=false;
  const settle=()=>{if(settled)return false;settled=true;if(record.pin===token)record.pin=null;this.finishDisposal();return true;};
  return {candidate:record.candidate,record,commit:()=>{check(!settled&&!this.disposed&&!record.disposed&&record.pin===token,'Published lease settled');check(this.isReady(record),'Published readiness changed');settled=true;record.pin=null;if(this.active)this.active.active=false;record.active=true;this.active=record;},release:()=>{settle();}};
 }
 borrow(loaded){check(!this.disposed,'Published cache closed');const record=this.get(loaded);if(!record)return null;check(this.isReady(record),'Published readiness changed');return this.reservePreparation(loaded);}
 setActive(record){check(!this.disposed&&!record.disposed&&!record.pin,'Invalid published activation');if(this.active)this.active.active=false;record.active=true;this.active=record;}
 retains(root){return [...this.records.values()].some(r=>!r.disposed&&r.candidate.root===root);}
 evict(record,{preserveRoot=null}={}){if(!record||record.disposed)return;check(!record.pin,'Published preparation still leased');record.disposed=true;const keep=typeof preserveRoot==='function'?preserveRoot():preserveRoot;try{record.disposeViews?.();}finally{this.records.delete(record.key);if(this.active===record)this.active=null;if(record.candidate.root!==keep)this.disposeCandidate(record.candidate);}}
 finishDisposal(){if(!this.disposed||this.finishing||[...this.records.values()].some(r=>r.pin))return;this.finishing=true;try{for(const r of [...this.records.values()])this.evict(r,{preserveRoot:this.preserveRoot});}finally{this.finishing=false;if(!this.records.size)this.resolveDisposed();}}
 dispose({preserveRoot=null}={}){if(!this.disposed){this.disposed=true;this.preserveRoot=preserveRoot;}this.finishDisposal();return this.whenDisposed;}
}
