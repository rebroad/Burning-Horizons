const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&Object.keys(v).every(k=>keys.includes(k));
const worldId=v=>typeof v==='string'&&/^elsemesh\.world:[A-Za-z0-9._:-]{1,120}$/.test(v);
const portalId=v=>typeof v==='string'&&/^elsemesh-portal:[A-Za-z0-9._:-]{1,120}$/.test(v);
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export const PUBLISHED_CATALOG_SCHEMA='elsemesh.published-world-catalog/1';
/** Public deployment permissions are an explicit bounded local star catalog, not VIEW/ENTER. */
export function validatePublishedWorldCatalog(value,{baseURL=globalThis.location?.href}={}){
 if(!exact(value,['schema','renderer','openingWorldId','worlds','routes'])||value.schema!==PUBLISHED_CATALOG_SCHEMA||value.renderer!=='webgl2'||!worldId(value.openingWorldId)||!Array.isArray(value.worlds)||![2,3].includes(value.worlds.length)||!Array.isArray(value.routes)||value.routes.length!==2*(value.worlds.length-1))throw Error('Invalid published world catalog');
 const base=new URL('./',baseURL);if(!['http:','https:'].includes(base.protocol)||base.username||base.password)throw Error('Published worlds require an HTTP deployment');
 const ids=new Set(),paths=new Set();
 for(const entry of value.worlds){
  if(!exact(entry,['worldId','contentDigest','bundlePath'])||!worldId(entry.worldId)||!digest(entry.contentDigest)||entry.bundlePath!=='worlds/'+entry.contentDigest+'/'||ids.has(entry.worldId)||paths.has(entry.bundlePath))throw Error('Invalid published world entry');
  const url=new URL(entry.bundlePath,base);if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname)||url.username||url.password||url.search||url.hash)throw Error('Published world escapes deployment prefix');ids.add(entry.worldId);paths.add(entry.bundlePath);
 }
 if(!ids.has(value.openingWorldId))throw Error('Published opening world is absent');
 for(const route of value.routes)if(!exact(route,['sourceWorldId','portalId','destinationWorldId','destinationPortalId'])||!ids.has(route.sourceWorldId)||!ids.has(route.destinationWorldId)||route.sourceWorldId===route.destinationWorldId||!portalId(route.portalId)||!portalId(route.destinationPortalId))throw Error('Invalid published route');
 const endpoints=new Set(),leaves=new Set();
 for(const route of value.routes){
  const key=route.sourceWorldId+'|'+route.portalId;
  if(endpoints.has(key))throw Error('Duplicate published portal endpoint');endpoints.add(key);
  if(route.sourceWorldId!==value.openingWorldId&&route.destinationWorldId!==value.openingWorldId)throw Error('Published routes must form an opening-world star');
  if(route.sourceWorldId===value.openingWorldId){if(leaves.has(route.destinationWorldId))throw Error('Duplicate published leaf connection');leaves.add(route.destinationWorldId);}
  const reverse=value.routes.filter(r=>r.sourceWorldId===route.destinationWorldId&&r.destinationWorldId===route.sourceWorldId&&r.portalId===route.destinationPortalId&&r.destinationPortalId===route.portalId);
  if(reverse.length!==1)throw Error('Published routes must be exact reciprocal pairs');
 }
 if(leaves.size!==value.worlds.length-1)throw Error('Published star must connect every leaf once');
 return Object.freeze({schema:value.schema,renderer:value.renderer,openingWorldId:value.openingWorldId,worlds:Object.freeze(value.worlds.map(e=>Object.freeze({...e}))),routes:Object.freeze(value.routes.map(e=>Object.freeze({...e})))});
}
export async function readDeploymentJSON(url,{fetcher=fetch,maxBytes=16384,timeoutMs=10000,optional=false}={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);let reader;
 try{
  const response=await fetcher(url,{credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',cache:'no-store',signal:controller.signal});
  if(response.redirected||response.url&&response.url!==String(url))throw Error('Installation response redirected');
  if(response.status===404&&optional)return null;
  if(!response.ok)throw Error('Installation request failed ('+response.status+')');
  const length=response.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>maxBytes))throw Error('Installation response exceeds byte limit');
  if(!response.body)throw Error('Installation response has no body');reader=response.body.getReader();const chunks=[];let total=0;
  for(;;){const part=await reader.read();if(part.done)break;total+=part.value.byteLength;if(total>maxBytes)throw Error('Installation response exceeds byte limit');chunks.push(part.value);}
  const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 }finally{clearTimeout(timer);if(reader){try{await reader.cancel();}catch{}reader.releaseLock();}}
}
export async function readPublishedWorldCatalog({fetcher=fetch,baseURL=location.href}={}){const value=await readDeploymentJSON(new URL('./published-worlds.json',baseURL),{fetcher,optional:true});return value===null?null:validatePublishedWorldCatalog(value,{baseURL});}
