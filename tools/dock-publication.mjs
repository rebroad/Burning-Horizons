import fs from 'node:fs/promises';
import path from 'node:path';
import {loadWorldSource,repositoryDigest} from '../src/world-runtime/vendor/world-engine-contract.js';
export const DOCK_WORLD_ID='elsemesh.world:63121706-d439-4091-95b0-780b7d8563e8';
export const ROOM_WORLD_ID='elsemesh.world:5c2e6618-a04a-4460-912a-bfc57bc5bbad';
export const DOCK_CONTENT_DIGEST='36e60f42dffa422ef20dce60a14a9da238ccce49eb96e248dc5952f6b3429808';
export const DOCK_SOURCE_COMMIT='fbc9f7e352b03b18d96ad428742770f844fcfc0d';
export const DOCK_NOTICE_PINS={
  "NOTICE": {
    "sha256": "277949b3e42b8ecb399d2287c7b7e06f423d7309299845bdbcf547c0f40dfe3a",
    "bytes": 562
  },
  "ATTRIBUTION.md": {
    "sha256": "4e0b6723adfd4d5538ab58dc30a82cb200e664e674ba2e285eed21a02a137ea3",
    "bytes": 958
  },
  "LICENSE": {
    "sha256": "413204504456b6b29e99d565629023e9aeee5916907e41fe8ffe8549219348ec",
    "bytes": 1083
  },
  "README.md": {
    "sha256": "263060e834781975723b35892182fcdfc9ee5d869acd8a15aacef9ae5924aae6",
    "bytes": 1140
  },
  "models/port/CREDITS.md": {
    "sha256": "18a5fa138ff37d94996875f32de17bd777b47eb3fd3f40ec1921818a24e23359",
    "bytes": 3866
  },
  "models/port/licensing/README.md": {
    "sha256": "a16f12393846298ae5b25d32c46befeec77b866bc5a6d1e1ec9be29005636437",
    "bytes": 966
  },
  "models/port/licensing/original-openx-source-package.zip": {
    "sha256": "b234d510ce334062207ad86745c15938a97be6743a2639f5fdeead8804b8d34c",
    "bytes": 4937933
  },
  "models/port/licensing/licenses/MPL-2.0.txt": {
    "sha256": "66a3107d5ad6a058aab753eaac2047ccb2ed0e39465dd0fe5844da3e300d5172",
    "bytes": 16727
  },
  "models/port/licensing/licenses/CC-BY-4.0.txt": {
    "sha256": "d557539df68e771cc1eedcc91d13f70fca930e508d11eedcafa4b15db49e3744",
    "bytes": 17023
  }
};
const activePath=/^(?:world\.json|snapshots\/[a-f0-9]{64}\/[a-z-]+\.json|assets\/[a-f0-9]{64}\.glb)$/;
// This checks the decoded GLB JSON, including extras, rather than trusting a
// .glb extension or scanning compressed binary bytes for external references.
export function auditDockGLB(bytes){
 const b=Buffer.from(bytes);if(b.length<20||b.readUInt32LE(0)!==0x46546c67||b.readUInt32LE(4)!==2||b.readUInt32LE(8)!==b.length)throw Error('Invalid Dock GLB header');
 let offset=12,document;while(offset<b.length){if(offset+8>b.length)throw Error('Invalid Dock GLB chunk');const n=b.readUInt32LE(offset),type=b.readUInt32LE(offset+4);offset+=8;if(n%4||offset+n>b.length)throw Error('Invalid Dock GLB chunk length');if(type===0x4e4f534a){if(document)throw Error('Duplicate Dock GLB JSON');document=JSON.parse(b.subarray(offset,offset+n).toString('utf8'));}offset+=n;}
 if(!document)throw Error('Missing Dock GLB JSON');
 const inspect=v=>{if(typeof v==='string'&&/(?:https?:\/\/|file:|[A-Z]:\\|\/home\/|\/Users\/|BEGIN [A-Z ]*PRIVATE KEY|(?:password|access_token|api[_-]?key)\s*[:=])/i.test(v))throw Error('Private or external Dock GLB metadata');if(Array.isArray(v))v.forEach(inspect);else if(v&&typeof v==='object')for(const[k,x]of Object.entries(v)){if(k==='uri')throw Error('External Dock GLB resource');inspect(x);}};inspect(document);return document;
}
export async function readDockPublication(sourceRoot,{tracked}={}){
 if((await fs.lstat(sourceRoot)).isSymbolicLink()||(await fs.lstat(path.dirname(path.resolve(sourceRoot)))).isSymbolicLink())throw Error('Symlink in Dock source root');
 const root=await fs.realpath(sourceRoot),files=new Map();let total=0;
 async function read(relative,limit=8*1024*1024){
  if(!activePath.test(relative)&&!Object.hasOwn(DOCK_NOTICE_PINS,relative))throw Error('Unsupported Dock publication path');
  if(tracked&&!tracked.has('worlds/dock/'+relative))throw Error('Uncommitted public Dock file');
  let full=root;for(const segment of relative.split('/')){full=path.join(full,segment);if((await fs.lstat(full)).isSymbolicLink())throw Error('Symlink in Dock source');}
  const info=await fs.lstat(full),resolved=await fs.realpath(full);if(!info.isFile()||!resolved.startsWith(root+path.sep)||info.size>limit)throw Error('Dock source confinement or size');
  const sourceBytes=new Uint8Array(await fs.readFile(full));const textPin=Object.hasOwn(DOCK_NOTICE_PINS,relative)&&!relative.endsWith('.zip');const bytes=textPin?new Uint8Array(Buffer.from(new TextDecoder('utf-8',{fatal:true}).decode(sourceBytes).replace(/\r\n?/g,'\n'))):sourceBytes;if(!files.has(relative)){total+=bytes.length;if(total>16*1024*1024||files.size>=32)throw Error('Dock package budget');files.set(relative,bytes);}return bytes;
 }
 const manifestBytes=await read('world.json',64*1024);if(await repositoryDigest(manifestBytes)!==DOCK_CONTENT_DIGEST)throw Error('Dock curated manifest changed');
 const manifest=JSON.parse(new TextDecoder().decode(manifestBytes));if(manifest.provenance?.sourceCommit!==DOCK_SOURCE_COMMIT)throw Error('Dock source provenance changed');
 const loaded=await loadWorldSource({kind:'local',label:'public Dock source',read},{expectedWorldId:DOCK_WORLD_ID,expectedContentDigest:DOCK_CONTENT_DIGEST});
 if(loaded.project.assets.length!==4||loaded.project.objects.length!==35||loaded.project.traffic?.count!==6||loaded.project.splatScene||loaded.project.nativeIsland)throw Error('Unexpected Dock active scene');
 for(const [name,ref]of Object.entries(DOCK_NOTICE_PINS)){const bytes=await read(name,8*1024*1024);if(bytes.length!==ref.bytes||await repositoryDigest(bytes)!==ref.sha256)throw Error('Dock required notice/source archive integrity');}
 for(const[name,bytes]of files)if(name.endsWith('.glb'))auditDockGLB(bytes);
 return {loaded,files,total};
}
