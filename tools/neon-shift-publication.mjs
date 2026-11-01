import fs from'node:fs/promises';import path from'node:path';
import{loadWorldSource,repositoryDigest}from'../src/world-runtime/vendor/world-engine-contract.js';
import{SHIFT_WORLD_ID,SHIFT_CONTENT_DIGEST,SHIFT_RETURN_PORTAL_ID}from'../src/world-runtime/ShiftingWorldProfile.js';
import{NEON_SHIFT_LOTS,assertNeonShiftFoundations}from'../src/world-runtime/NeonShiftLots.js';
export async function readNeonShiftPublication(directory,{tracked}={}){
 const requested=path.resolve(directory);for(const p of [requested,path.dirname(requested)])if((await fs.lstat(p)).isSymbolicLink())throw Error('Neon source symlink');const root=await fs.realpath(requested),files=new Map();let total=0;
 const read=async(relative,limit)=>{if(!/^(?:world\.json|README\.md|ATTRIBUTION\.md|LICENSE|snapshots\/[a-f0-9]{64}\/[a-z-]+\.json)$/.test(relative)||tracked&&!tracked.has('worlds/neon-shift/'+relative))throw Error('Unexpected or untracked Neon source');const full=path.resolve(root,relative);if(!full.startsWith(root+path.sep))throw Error('Neon source escaped');let cursor=root;for(const part of relative.split('/')){cursor=path.join(cursor,part);if((await fs.lstat(cursor)).isSymbolicLink())throw Error('Neon source symlink');}const info=await fs.stat(full);if(!info.isFile()||info.size>Math.min(limit,1024*1024))throw Error('Neon source budget');const bytes=new Uint8Array(await fs.readFile(full));if(!files.has(relative)){total+=bytes.length;if(total>1024*1024||files.size>=32)throw Error('Neon publication budget');files.set(relative,bytes);}return bytes;};
 if(await repositoryDigest(await read('world.json',1024*1024))!==SHIFT_CONTENT_DIGEST)throw Error('Neon manifest pin changed');
 const loaded=await loadWorldSource({kind:'local',read},{expectedWorldId:SHIFT_WORLD_ID,expectedContentDigest:SHIFT_CONTENT_DIGEST});
 if(loaded.project.assets.length||loaded.project.splatScene||loaded.project.nativeIsland||loaded.project.portals.length!==1||loaded.project.portals[0].id!==SHIFT_RETURN_PORTAL_ID||loaded.project.objects.length!==NEON_SHIFT_LOTS.length+5)throw Error('Unexpected Neon runtime closure');
 assertNeonShiftFoundations(loaded.project);
 for(const name of ['README.md','ATTRIBUTION.md','LICENSE'])await read(name,64*1024);
 return{loaded,files,total};
}
