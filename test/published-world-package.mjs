import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DOCK_WORLD_ID,DOCK_CONTENT_DIGEST,DOCK_NOTICE_PINS,readDockPublication} from '../tools/dock-publication.mjs';
import {TABLE_TENNIS_SPLAT_PROFILE,assertQualifiedSplatProfile} from '../src/world-runtime/SplatSceneProfiles.js';
import {validatePublishedWorldCatalog} from '../src/world-runtime/PublishedWorldCatalog.js';
import {patchOutputSurface,outputSurfaceManifestName,outputSurfaceTransformVersion} from '../tools/output-surface-transform.mjs';
const arg=process.env.PUBLIC_ROOM_PACKAGE??process.env.PUBLIC_SUNSET_PACKAGE;
if(!arg)throw Error('PUBLIC_ROOM_PACKAGE (or legacy PUBLIC_SUNSET_PACKAGE) must identify the generated publication candidate');
const root=await fs.realpath(arg),sha=b=>createHash('sha256').update(b).digest('hex');
const catalog=validatePublishedWorldCatalog(JSON.parse(await fs.readFile(path.join(root,'published-worlds.json'),'utf8')),{baseURL:'https://publication.invalid/ElseMesh/index.html'});
test('generated publication contains every manifest, native and lazy SOG/physics byte with the pinned hash',async()=>{
 let verified=0,bytes=0;const projects=[];
 for(const world of catalog.worlds){const dir=await fs.realpath(path.join(root,world.bundlePath)),seen=new Set(),json=[];
  const manifestBytes=await fs.readFile(path.join(dir,'world.json')),manifest=JSON.parse(manifestBytes);assert.equal(sha(manifestBytes),world.contentDigest);assert.equal(manifest.world.worldId,world.worldId);
  async function inspect(directory){for(const item of await fs.readdir(directory,{withFileTypes:true})){const full=path.join(directory,item.name);assert.ok(!item.isSymbolicLink());if(item.isDirectory())await inspect(full);else if(item.name.endsWith('.json'))json.push(full);}}
  await inspect(dir);
  async function visit(value){if(Array.isArray(value)){for(const x of value)await visit(x);return;}if(!value||typeof value!=='object')return;
   if(typeof value.path==='string'&&/^[a-f0-9]{64}$/.test(value.sha256??'')&&Number.isSafeInteger(value.bytes)){
    if(value.path.startsWith('sources/')){assert.match(value.path,/^sources\/table-tennis\/(?:meta\.json|means_l\.webp|means_u\.webp|scales\.webp|quats\.webp|sh0\.webp)$/);await assert.rejects(fs.access(path.join(dir,value.path)),{code:'ENOENT'});return;}
    assert.ok(!value.path.includes('..')&&!value.path.includes('\\')&&!value.path.startsWith('/'));
    if(!seen.has(value.path)){const full=await fs.realpath(path.join(dir,value.path));assert.ok(full.startsWith(dir+path.sep));const content=await fs.readFile(full);assert.equal(content.byteLength,value.bytes,value.path);assert.equal(sha(content),value.sha256,value.path);seen.add(value.path);verified++;bytes+=content.byteLength;}
   }
   for(const x of Object.values(value))await visit(x);
  }
  for(const file of json)await visit(JSON.parse(await fs.readFile(file,'utf8')));
  const connections=JSON.parse(await fs.readFile(path.join(dir,manifest.components.connections.path),'utf8'));projects.push({world,connections,dir});
  if(connections.splatScene){const scene=connections.splatScene;assert.equal(world.worldId,'elsemesh.world:5c2e6618-a04a-4460-912a-bfc57bc5bbad');assert.equal(assertQualifiedSplatProfile({splatScene:scene}),TABLE_TENNIS_SPLAT_PROFILE);assert.equal(scene.provenance.sourceFormat,'sog');for(const hash of [scene.provenance.sourceManifestSha256,scene.provenance.reviewSha256]){const audit=await fs.readFile(path.join(dir,'splat-scenes/'+hash+'.json'));assert.equal(sha(audit),hash);}assert.ok(seen.has(scene.asset.path));assert.ok(seen.has(scene.physics.path));}
 }
 assert.ok(verified>1000);assert.ok(bytes>80*1024*1024);
 for(const route of catalog.routes){const p=projects.find(p=>p.world.worldId===route.sourceWorldId).connections.portals.find(p=>p.id===route.portalId);assert.ok(p.enabled);assert.equal(p.destination.worldId,route.destinationWorldId);assert.equal(p.destination.portalId,route.destinationPortalId);}
});
test('publication preserves editor, notices, immutable opening pin and excludes lab/source evidence artifacts',async()=>{
 const openingCredits=await fs.readFile(path.join(root,'credits.html'),'utf8'),openingEntry=catalog.worlds.find(w=>w.worldId===catalog.openingWorldId);
 for(const name of ['ATTRIBUTION.md','LICENSE','NATIVE-VEGETATION-CREDITS.md']){assert.ok(openingCredits.includes(openingEntry.bundlePath+name));await fs.access(path.join(root,openingEntry.bundlePath,name));}
 const config=JSON.parse(await fs.readFile(path.join(root,'opening-world.json'),'utf8')),opening=catalog.worlds.find(w=>w.worldId===catalog.openingWorldId);assert.equal(config.bundlePath,opening.bundlePath);assert.equal(config.contentDigest,opening.contentDigest);await fs.access(path.join(root,'editor/index.html'));await fs.access(path.join(root,'licenses/SPARK-LICENSE.txt'));
 const denied=/^sources$|\.(?:mp4|ply|sqlite|pem|pyc)$|client-identities|owner-trace|sensor\.jsonl|\.local-evidence/i;
 async function visit(dir){for(const name of await fs.readdir(dir)){assert.ok(!denied.test(name),name);const full=path.join(dir,name),info=await fs.lstat(full);assert.ok(!info.isSymbolicLink());if(info.isDirectory())await visit(full);}}
 await visit(root);const credits=await fs.readFile(path.join(root,'credits.html'),'utf8');for(const text of ['Table Tennis Room','ethan3111','https://superspl.at/scene/0d9e613b','https://creativecommons.org/licenses/by/4.0/','decimation','orientation','gameplay-scale','authored collision'])assert.ok(credits.includes(text),text);
});
test('active publication closure excludes retired Sunset identities and payloads',async()=>{
 const retiredWorld='elsemesh.world:0934ce76-df15-406f-914e-74209d48accf',retiredSog='66334b9bcea5abb6b2a310c44c584fd7fdc8fb999db9c718c785473c41019298.sog',retiredPhysics='eedaeb18bfa8eacbee42c10d105b67d519f9351fb75879f4306645cf1d3a3757.json';
 assert.ok(!JSON.stringify(catalog).includes(retiredWorld));
 const publishedWorlds=path.join(root,'worlds');assert.deepEqual((await fs.readdir(publishedWorlds)).sort(),catalog.worlds.map(world=>world.contentDigest).sort());
 let inspected=0;async function inspect(directory){for(const item of await fs.readdir(directory,{withFileTypes:true})){assert.ok(!item.isSymbolicLink());assert.ok(![retiredSog,retiredPhysics,'sunset'].includes(item.name),item.name);const full=path.join(directory,item.name);if(item.isDirectory())await inspect(full);else if(item.name.endsWith('.json')){assert.ok(!(await fs.readFile(full,'utf8')).includes(retiredWorld),full);inspected++;}}}
 await inspect(publishedWorlds);assert.ok(inspected>20);
 const publication=await fs.readFile(path.join(root,'publication.json'),'utf8');assert.ok(!publication.includes(retiredWorld));
 // Retained compatibility application chunks and historical documentation are
 // deliberately outside this active-world payload/route closure assertion.
});

test('publication retains module closure used by an already-open warehouse tab',async()=>{
 const expected={
  'SplatScenePhysics-DnwdxMwA.js':'cffd6f1f388a979e70461b469c3ebaa7461b2525e3b886b490187c86a2d331ff',
  'WebGLPortalViews-K8knYW1g.js':'7230cc9e81593b9903b2ec882dcd1a5dcdc8247229417bde5fd4066f5c18025e',
  'WebGLRepositoryScene-Kr2hmB38.js':'b65a54f2a3e6af3984c5a0830660ee662d0255a484a4bf7478efb7146ab494ec',
  'main-CNOK0buL.js':'36e92b11c58cf5750ee839def9775fe8be39e69904a1dc2d0e3fecc1904e86b7',
  'spark.module-BgZ7pwUd.js':'fd9e32f82ef4f43b39d3d76002b0467b51d1310a84a597a64a2578dcb036c2bf',
  'world-engine-contract-BU9EDy71.js':'9e8a17d54f4831e6ea9f639f0c7b07ed6bd32c4faf25c4a423cf460a59629a31'
 };
 for(const [name,digest] of Object.entries(expected)){
  const bytes=await fs.readFile(path.join(root,'assets',name));assert.equal(sha(bytes),digest,name);
 }
});

test('published local duck has exact admitted model bytes, separate notices and no full-resolution source',async()=>{
 const dir=path.join(root,'models/microduck'),expected=['ATTRIBUTION.md','LICENSE-APACHE-2.0.txt','LICENSE-MODELS.md','collision-proxy.json','manifest.json','microduck-realtime.glb'];
 assert.deepEqual((await fs.readdir(dir)).sort(),expected.sort());
 const bytes=await fs.readFile(path.join(dir,'microduck-realtime.glb'));assert.equal(bytes.length,6929080);assert.equal(sha(bytes),'f8776b98041d44b51286cb13c599e6aaedbc59f15336f51aeb88da41c9878c54');
 const credits=await fs.readFile(path.join(root,'credits.html'),'utf8');assert.match(credits,/CC BY-NC-SA 4.0/);assert.match(credits,/Pollen Robotics/);assert.match(credits,/browser session/);
 for(const name of expected.filter(n=>!n.endsWith('.glb')))assert.doesNotMatch(await fs.readFile(path.join(dir,name),'utf8'),/\/fast\/|\/home\/|[A-Z]:\\(?:Users|Downloads)/);
});

test('publication retains the current editor and Original Island pins plus explicit downstream contract provenance',async()=>{
 const publication=JSON.parse(await fs.readFile(path.join(root,'publication.json'),'utf8'));
 assert.match(publication.engineCommit,/^[a-f0-9]{40}$/);assert.match(publication.editorCommit,/^[a-f0-9]{40}$/);
 const original=publication.optionalWorldRepositories.find(row=>row.worldId==='elsemesh.world:470d2706-d459-4cb6-92d8-d4074289bea5');assert.ok(original);assert.equal(original.commit,'21a8a59117d8e83ee7a7aa42f426486b05ad9ecc');assert.equal(original.contentDigest,'c64b45e75fe4b421dfb6b0e487c5c41eac7c6583e129029987ecad173abef214');assert.equal(original.bundledWithOpening,false);
 const provenance=JSON.parse(await fs.readFile(new URL('../src/world-runtime/vendor/world-engine-contract.provenance.json',import.meta.url),'utf8'));const sourceContract=await fs.readFile(new URL('../src/world-runtime/vendor/world-engine-contract.js',import.meta.url),'utf8');assert.equal(publication.worldContract.sourceNormalization,'UTF-8 LF');assert.equal(sha(sourceContract.replaceAll('\r\n','\n')),provenance.bundleSha256);assert.equal(publication.worldContract.bundleSha256,provenance.bundleSha256);assert.equal(publication.worldContract.commit,provenance.commit);assert.equal(publication.worldContract.baseBundleSha256,provenance.baseBundleSha256??provenance.bundleSha256);assert.deepEqual(publication.worldContract.downstreamPatches,provenance.downstreamPatches??[]);
});


test('generated publication preserves separately hashed output-surface derivative and its final chunk closure',async()=>{
 const publication=JSON.parse(await fs.readFile(path.join(root,'publication.json'),'utf8')),reference=publication.outputSurfaceDerivative;
 assert.ok(reference,'Separate output-surface provenance is required');assert.equal(reference.manifest,outputSurfaceManifestName);
 const file=path.join(root,reference.manifest),info=await fs.lstat(file);assert.ok(info.isFile()&&!info.isSymbolicLink());
 const bytes=await fs.readFile(file),manifest=JSON.parse(bytes);assert.equal(sha(bytes),reference.sha256);assert.equal(manifest.schema,'elsemesh.output-surface-derivative/1');assert.equal(manifest.version,outputSurfaceTransformVersion);assert.equal(reference.version,manifest.version);assert.equal(manifest.integration,'bounded-opt-in');
 const sourceContract=await fs.readFile(new URL('../src/world-runtime/vendor/world-engine-contract.js',import.meta.url),'utf8'),expected=patchOutputSurface(sourceContract).manifest;
 assert.equal(manifest.source.path,'src/world-runtime/vendor/world-engine-contract.js');assert.equal(manifest.source.normalization,'UTF-8 LF');assert.equal(manifest.source.upstreamBytesUnmodified,true);assert.equal(manifest.source.sha256,sha(sourceContract.replaceAll('\r\n','\n')));assert.equal(reference.upstreamSourceSha256,manifest.source.sha256);assert.equal(manifest.source.sha256,publication.worldContract.bundleSha256);
 assert.equal(manifest.transform.path,'tools/output-surface-transform.mjs');assert.equal(manifest.transform.version,outputSurfaceTransformVersion);assert.equal(manifest.transform.sha256,sha(await fs.readFile(new URL('../tools/output-surface-transform.mjs',import.meta.url))));assert.equal(reference.transformSha256,manifest.transform.sha256);assert.deepEqual(manifest.transform.edits,expected.edits);
 assert.equal(manifest.transformedModule.sha256,expected.outputSha256);assert.equal(reference.transformedModuleSha256,expected.outputSha256);assert.notEqual(manifest.transformedModule.sha256,manifest.source.sha256);assert.deepEqual(reference.finalChunks,manifest.finalChunks);
 const chunks=Object.entries(manifest.finalChunks);assert.ok(chunks.length>0&&chunks.length<=256);assert.equal(manifest.transformedModule.chunks.length,1);assert.ok(Object.hasOwn(manifest.finalChunks,manifest.transformedModule.chunks[0]));
 for(const [name,digest]of chunks){assert.match(name,/^assets\/[A-Za-z0-9_-][A-Za-z0-9_.-]*\.js$/);assert.ok(!name.includes('..'));assert.match(digest,/^[a-f0-9]{64}$/);const chunk=path.join(root,name),stat=await fs.lstat(chunk);assert.ok(stat.isFile()&&!stat.isSymbolicLink());assert.equal(sha(await fs.readFile(chunk)),digest,name);}
});



test('public game has three fixed world packages and complete admitted Dock runtime/source licences',async()=>{
 assert.equal(catalog.worlds.length,3);assert.equal(catalog.routes.length,4);
 const dock=catalog.worlds.find(w=>w.worldId===DOCK_WORLD_ID);assert.ok(dock);assert.equal(dock.contentDigest,DOCK_CONTENT_DIGEST);
 const {loaded,files,total}=await readDockPublication(path.join(root,dock.bundlePath));assert.equal(total,12478386);assert.equal(files.size,23);
 const actual=[];async function inspect(dir,prefix=''){for(const item of await fs.readdir(dir,{withFileTypes:true})){assert.ok(!item.isSymbolicLink());const relative=prefix+item.name;if(item.isDirectory())await inspect(path.join(dir,item.name),relative+'/');else actual.push(relative);}}await inspect(path.join(root,dock.bundlePath));assert.deepEqual(actual.sort(),[...files.keys()].sort());
 for(const name of Object.keys(DOCK_NOTICE_PINS))assert.ok(files.has(name));
 assert.equal(loaded.project.portals[0].destination.worldId,catalog.openingWorldId);
 const publication=JSON.parse(await fs.readFile(path.join(root,'publication.json'),'utf8'));assert.equal(publication.dock.contentDigest,DOCK_CONTENT_DIGEST);assert.equal(publication.dock.bytes,total);
 const credits=await fs.readFile(path.join(root,'credits.html'),'utf8');for(const text of ['Bracken Quay Dock','MPL-2.0 AND CC-BY-4.0',dock.bundlePath+'NOTICE',dock.bundlePath+'models/port/licensing/README.md'])assert.ok(credits.includes(text));
});
