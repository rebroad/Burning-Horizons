import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {DOCK_WORLD_ID,ROOM_WORLD_ID,DOCK_CONTENT_DIGEST,readDockPublication} from './dock-publication.mjs';
import {packageOutputSurfaceDerivative} from './output-surface-transform.mjs';
import {validatePublishedWorldCatalog} from '../src/world-runtime/PublishedWorldCatalog.js';
import {TABLE_TENNIS_SPLAT_PROFILE,assertQualifiedSplatProfile} from '../src/world-runtime/SplatSceneProfiles.js';
import {loadWorldSource,repositoryDigest} from '../src/world-runtime/vendor/world-engine-contract.js';
const [buildArg,worldArg,outputArg,previousPagesArg]=process.argv.slice(2);
if(!buildArg||!worldArg||!outputArg||!previousPagesArg)throw Error('Usage: node tools/package-published-worlds.mjs BUILD PINNED_WORLD_REPOSITORY NEW_OUTPUT PREVIOUS_PUBLIC_PAGES');
const build=await fs.realpath(buildArg),world=await fs.realpath(worldArg),previous=await fs.realpath(previousPagesArg),output=path.resolve(outputArg);
const catalog=validatePublishedWorldCatalog(JSON.parse(await fs.readFile(path.join(build,'published-worlds.json'),'utf8')),{baseURL:'https://publication.invalid/ElseMesh/index.html'});
const opening=catalog.worlds.find(w=>w.worldId===catalog.openingWorldId),room=catalog.worlds.find(w=>w.worldId===ROOM_WORLD_ID),dock=catalog.worlds.find(w=>w.worldId===DOCK_WORLD_ID);
if(!room||catalog.worlds.length>3||catalog.worlds.some(w=>![opening.worldId,ROOM_WORLD_ID,DOCK_WORLD_ID].includes(w.worldId))||dock&&dock.contentDigest!==DOCK_CONTENT_DIGEST)throw Error('Unsupported fixed public world inventory');
const git=(...args)=>{const r=spawnSync('git',['-C',world,...args],{encoding:'utf8',maxBuffer:1024*1024});if(r.status)throw Error('Pinned public world Git check failed');return r.stdout.trim();};
if(git('status','--porcelain','--untracked-files=all'))throw Error('World repository must be clean');const commit=git('rev-parse','HEAD');
const openingConfig=JSON.parse(await fs.readFile(path.join(build,'opening-world.json'),'utf8'));
if(openingConfig.worldId!==opening.worldId||openingConfig.contentDigest!==opening.contentDigest||!openingConfig.repository.endsWith('/tree/'+commit))throw Error('Opening configuration differs from catalog/source pin');
const tool=fileURLToPath(new URL('./package-opening-world.mjs',import.meta.url));
const base=spawnSync(process.execPath,[tool,build,world,output,opening.bundlePath],{stdio:'inherit'});if(base.status)throw Error('Opening package failed');
const sourceRoot=await fs.realpath(path.join(world,'worlds/table-tennis-room')),needed=new Set(['world.json','README.md','ATTRIBUTION.md','LICENSE']);
const tracked=new Set(spawnSync('git',['-C',world,'ls-files','-z'],{encoding:'utf8',maxBuffer:1024*1024}).stdout.split('\0').filter(Boolean));
const source={kind:'local',label:'public Table Tennis Room source',read:async(relative,limit)=>{needed.add(relative);if(!/^(?:world\.json|snapshots\/[a-f0-9]{64}\/[a-z-]+\.json|splat-scenes\/[a-f0-9]{64}\.(?:sog|json))$/.test(relative))throw Error('Unsupported Table Tennis Room source path');const full=await fs.realpath(path.join(sourceRoot,relative));if(!full.startsWith(sourceRoot+path.sep))throw Error('Table Tennis Room source escaped');const info=await fs.lstat(full);if(!info.isFile()||info.isSymbolicLink()||info.size>limit)throw Error('Invalid Table Tennis Room source file');return new Uint8Array(await fs.readFile(full));}};
const loaded=await loadWorldSource(source,{expectedWorldId:room.worldId,expectedContentDigest:room.contentDigest});
if(loaded.identity.worldId!==room.worldId||loaded.identity.contentDigest!==room.contentDigest||assertQualifiedSplatProfile(loaded.project)!==TABLE_TENNIS_SPLAT_PROFILE||loaded.project.objects.length)throw Error('Unexpected public Table Tennis Room content');
// SOG/physics are lazy runtime resources: loadWorldSource reads their descriptor,
// so publication must explicitly verify and include both immutable byte payloads.
for(const [key,limit]of [['asset',16*1024*1024],['physics',8*1024*1024]]){const ref=loaded.project.splatScene[key];if(!/^splat-scenes\/[a-f0-9]{64}\.(sog|json)$/.test(ref.path)||!ref.path.includes(ref.sha256))throw Error('Invalid Table Tennis Room payload reference');const bytes=await source.read(ref.path,limit);if(bytes.byteLength!==ref.bytes||await repositoryDigest(bytes)!==ref.sha256)throw Error('Table Tennis Room payload integrity');}

// Publish readable provenance records, while independently checking the tracked
// source inventory. Original reconstruction inputs remain outside the package.
const provenance=loaded.project.splatScene.provenance;
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const readAudit=async sha256=>{if(!hash(sha256))throw Error('Invalid Room audit pin');const bytes=await source.read('splat-scenes/'+sha256+'.json',64*1024);if(await repositoryDigest(bytes)!==sha256)throw Error('Room audit record integrity');return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));};
if(provenance.sourceFormat!=='sog'||!hash(provenance.sourceManifestSha256))throw Error('Room requires SOG source-manifest provenance');
const review=await readAudit(provenance.reviewSha256);
if(review.schema!=='elsemesh.table-tennis-review/1'||review.sourceManifestSha256!==provenance.sourceManifestSha256||!exact(review.asset,['sha256','bytes','count'])||review.asset.sha256!==TABLE_TENNIS_SPLAT_PROFILE.asset.sha256||review.asset.bytes!==TABLE_TENNIS_SPLAT_PROFILE.asset.bytes||review.asset.count!==TABLE_TENNIS_SPLAT_PROFILE.asset.count||JSON.stringify(review.transform)!==JSON.stringify(TABLE_TENNIS_SPLAT_PROFILE.transform))throw Error('Room review binding mismatch');
const inventory=await readAudit(provenance.sourceManifestSha256);
if(!exact(inventory,['schema','title','author','source','license','licenseURL','downloadBase','files','conversion','notes'])||inventory.schema!=='elsemesh.splat-source-manifest/1'||inventory.title!=='Table Tennis Room'||inventory.author!=='ethan3111'||inventory.source!=='https://superspl.at/scene/0d9e613b'||inventory.license!=='CC BY 4.0'||inventory.licenseURL!=='https://creativecommons.org/licenses/by/4.0/'||inventory.downloadBase!=='https://d28zzqy0iyovbz.cloudfront.net/0d9e613b/v1/'||typeof inventory.notes!=='string'||inventory.notes.length>12000||!Array.isArray(inventory.files)||inventory.files.length!==6)throw Error('Invalid Room source inventory');
const conversion=inventory.conversion;
if(!exact(conversion,['tool','version','command','sourceCount','outputCount'])||conversion.tool!=='@playcanvas/splat-transform'||conversion.version!=='2.3.2'||conversion.command!=='splat-transform --gpu cpu meta.json --decimate 719538 table-tennis.sog'||conversion.sourceCount!==1244410||conversion.outputCount!==TABLE_TENNIS_SPLAT_PROFILE.asset.count)throw Error('Room conversion inventory mismatch');
const originals=new Set(['meta.json','means_l.webp','means_u.webp','scales.webp','quats.webp','sh0.webp'].map(name=>'sources/table-tennis/'+name));let originalBytes=0;
for(const file of inventory.files){
 if(!exact(file,['path','sha256','bytes'])||!originals.delete(file.path)||!hash(file.sha256)||!Number.isSafeInteger(file.bytes)||file.bytes<1||file.bytes>(file.path.endsWith('/meta.json')?64*1024:16*1024*1024)||!tracked.has('worlds/table-tennis-room/'+file.path))throw Error('Invalid or untracked Room source inventory entry');
 originalBytes+=file.bytes;if(originalBytes>32*1024*1024)throw Error('Room original-source audit budget');
 const unresolved=path.join(sourceRoot,file.path),info=await fs.lstat(unresolved),full=await fs.realpath(unresolved);
 if(!full.startsWith(sourceRoot+path.sep)||!info.isFile()||info.isSymbolicLink()||info.size!==file.bytes)throw Error('Room original-source confinement or size mismatch');
 const bytes=new Uint8Array(await fs.readFile(full));if(bytes.byteLength!==file.bytes||await repositoryDigest(bytes)!==file.sha256)throw Error('Room original-source integrity');
}
if(originals.size)throw Error('Incomplete Room original-source inventory');

const warehouseManifest=JSON.parse(await fs.readFile(path.join(world,'world.json'),'utf8'));
const connectionsRef=warehouseManifest.components.connections;
if(!/^snapshots\/[a-f0-9]{64}\/connections\.json$/.test(connectionsRef.path))throw Error('Invalid warehouse connections path');
const connectionsBytes=new Uint8Array(await fs.readFile(path.join(world,connectionsRef.path)));
if(connectionsBytes.byteLength!==connectionsRef.bytes||await repositoryDigest(connectionsBytes)!==connectionsRef.sha256)throw Error('Warehouse connections integrity');
const warehousePortals=JSON.parse(new TextDecoder().decode(connectionsBytes)).portals;
const dockPackage=dock?await readDockPublication(path.join(world,'worlds/dock'),{tracked}):null;
const projectsByWorld=new Map([[opening.worldId,{portals:warehousePortals}],[ROOM_WORLD_ID,loaded.project],...(dockPackage?[[DOCK_WORLD_ID,dockPackage.loaded.project]]:[])]);
for(const route of catalog.routes){const portals=projectsByWorld.get(route.sourceWorldId)?.portals??[];const door=portals.find(p=>p.id===route.portalId);if(!door?.enabled||door.destination.worldId!==route.destinationWorldId||door.destination.portalId!==route.destinationPortalId)throw Error('Catalog route differs from authored world');}

if(await repositoryDigest(new Uint8Array(await fs.readFile(path.join(sourceRoot,'world.json'))))!==room.contentDigest)throw Error('Table Tennis Room manifest pin changed');
const destination=path.join(output,room.bundlePath);await fs.mkdir(destination,{recursive:false});let total=0;
for(const relative of [...needed].sort()){
 if(!tracked.has('worlds/table-tennis-room/'+relative))throw Error('Uncommitted public Table Tennis Room file');const full=await fs.realpath(path.join(sourceRoot,relative)),info=await fs.lstat(full);
 if(!full.startsWith(sourceRoot+path.sep)||!info.isFile()||info.isSymbolicLink())throw Error('Unsupported Table Tennis Room file');total+=info.size;if(total>32*1024*1024||needed.size>100)throw Error('Table Tennis Room package budget');
 const target=path.join(destination,relative);await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(full,target);
}
if(dockPackage){const destination=path.join(output,dock.bundlePath);await fs.mkdir(destination,{recursive:false});for(const [relative,bytes]of dockPackage.files){const target=path.join(destination,relative);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,bytes);}}
async function inspect(dir){const info=await fs.lstat(dir);if(info.isSymbolicLink())throw Error('Symlink in public editor');if(info.isDirectory())for(const name of await fs.readdir(dir))await inspect(path.join(dir,name));else if(!info.isFile())throw Error('Invalid editor file');}
// Keep bounded immutable asset names used by tabs opened before this release.
const priorAssets=path.join(previous,'assets'),outputAssets=path.join(output,'assets');
const priorNames=await fs.readdir(priorAssets);if(priorNames.length>96)throw Error('Too many prior application assets');
let retainedAssetBytes=0,retainedAssetCount=0;
for(const name of priorNames){
 if(name.includes('..')||!/^[A-Za-z][A-Za-z0-9_.-]*-[A-Za-z0-9_-]{8}\.(?:js|css)$/.test(name))throw Error('Unexpected prior application asset');
 const from=path.join(priorAssets,name),info=await fs.lstat(from);
 if(!info.isFile()||info.isSymbolicLink()||info.size>5*1024*1024)throw Error('Invalid prior application asset');
 retainedAssetBytes+=info.size;if(retainedAssetBytes>32*1024*1024)throw Error('Prior application asset budget');
 const target=path.join(outputAssets,name);
 const existing=await fs.lstat(target).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
 if(existing){if(!existing.isFile()||existing.isSymbolicLink()||existing.size!==info.size||await repositoryDigest(new Uint8Array(await fs.readFile(target)))!==await repositoryDigest(new Uint8Array(await fs.readFile(from))))throw Error('Application asset name collision');continue;}
 await fs.copyFile(from,target);retainedAssetCount++;
}
await inspect(path.join(previous,'editor'));await fs.cp(path.join(previous,'editor'),path.join(output,'editor'),{recursive:true,errorOnExist:true,force:false});
await fs.copyFile(path.join(build,'published-worlds.json'),path.join(output,'published-worlds.json'));
await fs.copyFile(fileURLToPath(new URL('../node_modules/@sparkjsdev/spark/LICENSE',import.meta.url)),path.join(output,'licenses/SPARK-LICENSE.txt'));
let credits=await fs.readFile(path.join(output,'credits.html'),'utf8');credits=credits.replace('</html>',`<section><h2>Table Tennis Room</h2><p><a href="https://superspl.at/scene/0d9e613b">Table Tennis Room</a> by ethan3111, licensed under <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Adapted for ElseMesh with decimation to ${TABLE_TENNIS_SPLAT_PROFILE.asset.count.toLocaleString('en-US')} Gaussians, orientation and gameplay-scale changes, and authored collision/support geometry.</p><p>Gaussian rendering uses Spark 2.4.0 and Three.js 0.180.0. <a href="licenses/SPARK-LICENSE.txt">Spark licence</a>. <a href="${room.bundlePath}ATTRIBUTION.md">Scene attribution</a>.</p></section></html>`);await fs.writeFile(path.join(output,'credits.html'),credits);
if(dock){let credits=await fs.readFile(path.join(output,'credits.html'),'utf8');credits=credits.replace('</html>',`<section><h2>Bracken Quay Dock</h2><p>Original procedural dock: DRG Software Solutions LLC, MIT. OpenX traffic derivatives: MPL-2.0 AND CC-BY-4.0; Dogan Ulus, myedsu and razor24. <a href="${dock.bundlePath}NOTICE">Notice</a> · <a href="${dock.bundlePath}ATTRIBUTION.md">Attribution</a> · <a href="${dock.bundlePath}models/port/CREDITS.md">Vehicle credits</a> · <a href="${dock.bundlePath}models/port/licensing/README.md">Modification sources and licences</a>.</p></section></html>`);await fs.writeFile(path.join(output,'credits.html'),credits);}
// The installed local companion is separately licensed from application code.
const duckFiles=['microduck-realtime.glb','ATTRIBUTION.md','LICENSE-MODELS.md','LICENSE-APACHE-2.0.txt','manifest.json','collision-proxy.json'];
await fs.mkdir(path.join(output,'models/microduck'));
for(const name of duckFiles){const from=path.join(build,'models/microduck',name);const info=await fs.lstat(from);if(!info.isFile()||info.isSymbolicLink()||info.size>8*1024*1024)throw Error('Invalid installed Microduck file');await fs.copyFile(from,path.join(output,'models/microduck',name));}
const duckAsset=await fs.readFile(path.join(output,'models/microduck/microduck-realtime.glb'));
if(duckAsset.byteLength!==6929080||await repositoryDigest(duckAsset)!=='f8776b98041d44b51286cb13c599e6aaedbc59f15336f51aeb88da41c9878c54')throw Error('Published Microduck integrity');
for(const name of ['ATTRIBUTION.md','LICENSE-MODELS.md','LICENSE-APACHE-2.0.txt','manifest.json','collision-proxy.json'])await fs.access(path.join(output,'models/microduck',name));
credits=await fs.readFile(path.join(output,'credits.html'),'utf8');credits=credits.replace('</html>','<section><h2>Microduck local companion</h2><p>Original robot geometry by Pollen Robotics, adapted to articulated glTF and animated from the official policy. Geometry and adaptations: CC BY-NC-SA 4.0, separate from application MIT code. This is a noncommercial demonstration. <a href="models/microduck/ATTRIBUTION.md">Attribution</a> · <a href="models/microduck/LICENSE-MODELS.md">Model licence</a> · <a href="models/microduck/LICENSE-APACHE-2.0.txt">Description and policy licence</a>.</p><p>The companion runs locally in this browser session and is not a shared or persistent online character.</p></section></html>');await fs.writeFile(path.join(output,'credits.html'),credits);
// Preserve the already-published editor and optional-world pins, not an older snapshot.
const priorPublication=JSON.parse(await fs.readFile(path.join(previous,'publication.json'),'utf8'));
if(priorPublication.schema!=='elsemesh.publication/1')throw Error('Unsupported prior publication provenance');
const preserved={};
if(priorPublication.editorCommit!==undefined){if(!/^[a-f0-9]{40}$/.test(priorPublication.editorCommit))throw Error('Invalid prior editor commit');preserved.editorCommit=priorPublication.editorCommit;}
if(priorPublication.optionalWorldRepositories!==undefined){const rows=priorPublication.optionalWorldRepositories;if(!Array.isArray(rows)||rows.length>16)throw Error('Invalid optional world provenance');for(const row of rows){if(!/^elsemesh[.]world:[a-f0-9-]{36}$/.test(row.worldId)||!/^https:\/\/github[.]com\/lozknowles\/[A-Za-z0-9_-]+$/.test(row.repository)||!/^[a-f0-9]{40}$/.test(row.commit)||!/^[a-f0-9]{64}$/.test(row.contentDigest)||typeof row.bundledWithOpening!=='boolean')throw Error('Invalid optional world pin');}preserved.optionalWorldRepositories=rows;}
const engineRoot=fileURLToPath(new URL('..',import.meta.url)),engineCommit=spawnSync('git',['-C',engineRoot,'rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim();if(!/^[a-f0-9]{40}$/.test(engineCommit))throw Error('Missing engine source revision');
const contractProvenance=JSON.parse(await fs.readFile(new URL('../src/world-runtime/vendor/world-engine-contract.provenance.json',import.meta.url),'utf8'));
const sourceContract=await fs.readFile(new URL('../src/world-runtime/vendor/world-engine-contract.js',import.meta.url),'utf8');if(await repositoryDigest(new TextEncoder().encode(sourceContract.replaceAll('\r\n','\n')))!==contractProvenance.bundleSha256)throw Error('World contract provenance mismatch');
// Upstream contract provenance covers its unchanged source bytes only.
// Record and preserve the build derivative separately, including final chunks.
const outputSurfaceDerivative=await packageOutputSurfaceDerivative(build,output);
await fs.writeFile(path.join(output,'publication.json'),JSON.stringify({schema:'elsemesh.publication/1',outputSurfaceDerivative,...preserved,engineCommit,worldContract:{sourceNormalization:'UTF-8 LF',commit:contractProvenance.commit,bundleSha256:contractProvenance.bundleSha256,baseBundleSha256:contractProvenance.baseBundleSha256??contractProvenance.bundleSha256,downstreamPatches:contractProvenance.downstreamPatches??[]},worldRepositoryCommit:commit,openingWorldId:opening.worldId,worlds:catalog.worlds,routes:catalog.routes,...(dockPackage?{dock:{sourceCommit:'fbc9f7e352b03b18d96ad428742770f844fcfc0d',contentDigest:DOCK_CONTENT_DIGEST,bytes:dockPackage.total,files:dockPackage.files.size}}:{}),scene:{name:TABLE_TENNIS_SPLAT_PROFILE.name,count:TABLE_TENNIS_SPLAT_PROFILE.asset.count,assetSha256:loaded.project.splatScene.asset.sha256,physicsSha256:loaded.project.splatScene.physics.sha256,sourceManifestSha256:provenance.sourceManifestSha256,reviewSha256:provenance.reviewSha256,auditedOriginalBytes:originalBytes},previousPublicEditorPreserved:true},null,2)+'\n');
console.log(JSON.stringify({output,worldRepositoryCommit:commit,roomBytes:total,auditedOriginalBytes:originalBytes,originalSourcesBundled:false,worlds:catalog.worlds}));
