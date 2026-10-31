import './MobileControls.css';
import {GraphicsPanel} from './GraphicsPanel.js';
import {WebGLSunsetOutput} from './WebGLSunsetOutput.js';
import {graphicsSceneEligible} from './GraphicsRuntimeState.js';
import {OpeningProgress} from './OpeningProgress.js';
import {renderWebGLOpaqueDepthPrepass,getQualifiedWarehouseDepthOccluders} from './WebGLOpaqueDepthPrepass.js';
import { repositoryWeatherShelters, setMistShelters } from './WeatherShelter.js';
import {MediaScreen,collectMediaScreenOccluders,mediaScreenCellVisibility} from './MediaScreen.js';
import {RepositoryPortalSky} from './RepositoryPortalSky.js';
import {readOpeningWorld,loadOpeningWorld,validateOpeningWorld} from './OpeningWorld.js';
import {webGLRepositoryReadinessSignature} from './WebGLRepositoryReadiness.js';
import {repositoryMediumWaterSettings} from './RepositoryWater.js';
import {PortalArrivalController} from './PortalArrivalController.js';
import {prepareWebGLRepositoryResources} from './WebGLRepositoryReadiness.js';
import {prepareNativeRepositoryResources,ReadiedRepositoryAvatar} from './NativeRepositoryReadiness.js';
import {RepositoryFollowCamera} from './RepositoryFollowCamera.js';
import {repositoryWorldActions} from './RepositoryWorldActions.js';
import {WebGLRepositoryAvatar} from './WebGLRepositoryAvatar.js';
import {createPortalEffects} from './RepositoryPortalEffects.js';
import {AvatarChooser} from '../player/AvatarChooser.js';
import {nativeIslandSceneOptions,nativeIslandDiagnostics} from './NativeIslandIntegration.js';
import {buildRepositoryScene,disposeRepositoryScene} from './RepositoryScene.js';
import {loadAppearance} from '../player/AvatarAppearance.js';
import {alignAvatarToPlayerView} from '../player/AvatarFacing.js';
import {initializeRenderBackend} from '../engine/Backend.js';
import {createWebGLRepositoryEngine,configureWebGLRepositoryScene,createWebGLRepositoryPeerLayer,addWebGLPortalFrame,updateWebGLRepositoryEnvironment} from './WebGLRepositoryBackend.js';
import * as N from '../engine/index.js';
import { Engine } from '../core/Engine.js';
import { Input } from '../core/Input.js';
import { GPU } from '../engine/gpu/GPU.js';
import { G } from '../engine/render/Frame.js';
import { SceneRenderer } from '../core/SceneRenderer.js';
import { SunShadows } from '../engine/render/Shadows.js';
import { Atmosphere, SUN_ILLUMINANCE } from '../sky/Atmosphere.js';
import { Sky, sunDirectionFromTime } from '../sky/Sky.js';
import { SkyProClouds } from '../sky/SkyProClouds.js';
import { Environment } from '../sky/Environment.js';
import { PostFX } from '../post/PostFX.js';
import { NativeWeather } from './NativeWeather.js';
import { createDryWorldMedium, terrainMistBase } from './DriftingMist.js';
import { hostedRepositorySource } from './HostedRepository.js';
import { localRepositorySource } from './LocalRepositoryFiles.js';
import { RepositorySession } from './RepositorySession.js';
import { RepositoryWorldHost } from './RepositoryWorldHost.js';
import {RefractionPass,REFRACTION_PREPARE_DEFINES} from '../ocean/RefractionPass.js';
import {resolveInstallationMode,installationRenderer,ownerEyePitch} from './InstallationMode.js';
import {PublicPortalRuntime} from './PublicPortalRuntime.js';
import {PublicMicroduck} from './PublicMicroduck.js';
import {repositorySceneOptions} from './RepositorySceneOptions.js';
import {withSplatMovementBoundary,confirmedSplatPose} from './SplatMovementBoundary.js';
import { RepositoryPortalRuntime } from './RepositoryPortalRuntime.js';
import {OwnerObjectAccessClient,canResumeObjectInteraction} from './OwnerObjectAccessClient.js';
import {WorldWelcomeController,WorldWelcomeView,LocalWelcomeSpeech,validWorldWelcome} from './WorldWelcome.js';
import {ObjectControlsHelp} from './ObjectControlsHelp.js';
import {ObjectAccessPanel} from './ObjectAccessPanel.js';
import { RepositoryRetro } from './RepositoryRetro.js';
import { effectiveObjectState,parseGitHubWorldLocation, resolveGitHubWorldSource } from './vendor/world-engine-contract.js';

const status=document.querySelector('#status'),hud=document.querySelector('#hud'),terminal=document.querySelector('#terminal');
const openingSplash=document.querySelector('#opening-splash');
const touchLayer=document.querySelector('#repository-touch-layer');
const openingProgress=new OpeningProgress({root:openingSplash,label:document.querySelector('#opening-splash-status'),bar:document.querySelector('#opening-splash-progress'),percent:document.querySelector('#opening-splash-percent')});
const report=message=>{status.textContent=message;};
const hideOpeningSplash=()=>{if(openingSplash)openingSplash.hidden=true;};
document.querySelector('#opening-recover')?.addEventListener('click',hideOpeningSplash);
async function init(){
 const installation=await resolveInstallationMode();
 const allowCrossWorldEyes=true;
 const container=document.querySelector('#app');let attempted;
 const selected=await initializeRenderBackend({webgpu:async()=>{if(installationRenderer(installation,new URLSearchParams(location.search).get('renderer'))==='webgl2')throw Error('WebGL2 selected');attempted=new Engine(container);attempted.maxOutputPixels=1000000;await attempted.init();attempted.meshRenderer.syncPipelines=true;attempted.backend='webgpu';return attempted;},webgl2:async()=>{attempted?.stop();attempted?.canvas?.remove();GPU.device?.destroy();return createWebGLRepositoryEngine(container);}});
 const engine=selected.value,isWebGL=selected.backend==='webgl2';
 openingProgress.advance('renderer-ready');
 let openingLoading=false,pendingOpeningReady=null,openingTargetWorldId=null,openingTargetDigest=null,openingExpectedGeneration=null;
 const captureQuality=new URLSearchParams(location.search).get('quality')==='capture';engine.maxOutputPixels=captureQuality?2100000:1000000;engine.resize();
 let playerEyes=null,eyeInputContext=null,graphics=null;
 let media,mediaContext=null,objectAccess,accessPanel,controlsHelp,worldWelcome,welcomeView,activeComputerId=null,interactionPending=false,interactionContext=null;
 const input=new Input(engine.canvas,{touchRoot:touchLayer,keyboardLookBlocked:()=>graphics?.open||playerEyes?.panel.open||terminal.open||retro.active||!!media?.controlsOpen||controlsHelp?.open||accessPanel?.root.open});
 const ownerMode=()=>portals.config?.protocol==='elsemesh.owner-runtime/1';
 const interactionState=()=>({active:host.active,hostGeneration:host.generation,inputEnabled:input.enabled,transport:portals.transport,connection:portals.transport.connectionEpoch,sessionId:portals.transport.membership?.sessionId,generation:portals.transport.generation});
 const canResume=()=>canResumeObjectInteraction(interactionContext,{active:host.active,hostGeneration:host.generation,pending:portals.pending,authorityOffline:portals.authorityOffline,transport:portals.transport,connected:portals.connected,ownerMode:ownerMode()});
 const retro=new RepositoryRetro(input,{canResume,canExecute:()=>!ownerMode()||!!objectAccess?.valid(activeComputerId),canCommand:async()=>{if(!ownerMode())return true;if(!objectAccess?.valid(activeComputerId)){objectAccess?.invalidate();return false;}try{await objectAccess.use(activeComputerId);return true;}catch(error){report(error.message);return false;}}});
 let publicDuck=null,movementPortals=null;
 let refraction,atmosphere,sky,clouds,environment,shadows,weather,renderer,medium,post,backendHost={},backendPortals={};
 if(isWebGL){
  const {buildWebGLRepositoryScene,disposeWebGLRepositoryScene,buildWebGLNeon}=await import('./WebGLRepositoryScene.js');
  const {WebGLPortalViews}=await import('./WebGLPortalViews.js');
  configureWebGLRepositoryScene(engine.scene);
  engine.repositoryReadinessSignature=webGLRepositoryReadinessSignature;engine.prepareRepositoryResources=root=>prepareWebGLRepositoryResources({renderer:engine.renderer,camera:engine.camera,root,targetScene:engine.scene});
  const buildGL=async(descriptor,camera,{loaded}={})=>{const candidate=await buildWebGLRepositoryScene(descriptor,camera,repositorySceneOptions(descriptor.project,loaded,{renderer:engine.renderer,backend:'webgl2'}));try{if(candidate.splatScene){candidate.terrain=withSplatMovementBoundary(candidate.splatScene.physics,{requireOwnerConfirmation:()=>movementPortals?.config?.protocol==='elsemesh.owner-runtime/1',getConfirmedPose:()=>confirmedSplatPose(movementPortals,candidate,{contentDigest:loaded?.identity?.contentDigest})});const warm=camera.clone();warm.position.fromArray(descriptor.project.spawn.position);warm.position.y+=1.62;warm.rotation.set(candidate.splatScene.physics.qualification.spawn.pitch??0,descriptor.project.spawn.yaw,0,'YXZ');warm.updateMatrixWorld(true);await candidate.splatScene.prepareResources(warm);}await publicDuck?.install(candidate);return candidate;}catch(error){disposeWebGLRepositoryScene(candidate);throw error;}};
  const disposeGL=candidate=>{publicDuck?.releaseCandidate(candidate);disposeWebGLRepositoryScene(candidate);};
  backendHost={buildCandidate:buildGL,disposeCandidate:disposeGL,buildNeon:buildWebGLNeon};
  backendPortals={buildScene:buildGL,disposeCandidate:disposeGL,createPeerLayer:(scene,id)=>createWebGLRepositoryPeerLayer(scene,id,engine.prepareRepositoryResources),addPortalFrame:addWebGLPortalFrame,views:new WebGLPortalViews({engine,mainCamera:engine.camera,configureScene:configureWebGLRepositoryScene})};
  renderer=engine.renderer;
 }else{
  atmosphere=new Atmosphere(engine);sky=new Sky(atmosphere);clouds=new SkyProClouds(engine,atmosphere);await clouds.ready;sky.clouds=clouds;backendPortals.background=new RepositoryPortalSky({sky});
  environment=new Environment(engine,engine.scene,sky,128);shadows=new SunShadows({size:1024});weather=new NativeWeather();engine.scene.add(weather.group);
  renderer=new SceneRenderer(engine.meshRenderer,engine.scene,engine.camera);renderer.background=sky.background;renderer.waterMaterial={needsSSRDepth:false};
   refraction=new RefractionPass({meshRenderer:engine.meshRenderer,scene:engine.scene,camera:engine.camera,sceneRenderer:renderer,scale:.5});renderer.onBeforeWater=view=>{if(host.active?.nativeIsland)refraction.render(G.seaLevel.value,view);};
  medium=createDryWorldMedium(renderer.sceneRT.depthTexture);post=new PostFX(engine,{sceneRenderer:renderer,camera:engine.camera,underwater:medium,clouds});
  if(post.motionBlur.strength)post.motionBlur.strength.value=0;
 }
 const followCamera=new RepositoryFollowCamera({camera:engine.camera});followCamera.setEnabled(new URLSearchParams(location.search).get('view')==='follow');
 const portalEffects=createPortalEffects({engine,isWebGL});backendPortals.addPortalFrame=portalEffects.addFrame;backendPortals.portalEffects=portalEffects;
 if(!isWebGL){
  const buildNative=(descriptor,camera,{loaded}={})=>buildRepositoryScene(descriptor,camera,nativeIslandSceneOptions(descriptor.project,loaded,{renderer:engine.meshRenderer,sky,sceneCopy:renderer.opaqueCopy,sceneDepthHalf:renderer.opaqueDepthHalf.texture,clouds,refraction}));
  backendHost.buildCandidate=buildNative;backendPortals.buildScene=buildNative;
  backendHost.disposeCandidate=candidate=>{if(candidate?.root)portalEffects.removeRoot(candidate.root);disposeRepositoryScene(candidate);};
  engine.prepareRepositoryResources=root=>prepareNativeRepositoryResources({meshRenderer:engine.meshRenderer,camera:engine.camera,root,refractionDefines:REFRACTION_PREPARE_DEFINES});
  backendHost.prepareResources=async prepared=>{
   if(!prepared.root.userData.repositoryPortalFramesReady)for(const portal of (prepared.project.portals??[]).slice(0,2))portalEffects.addFrame(prepared.root,portal);
   prepared.root.userData.repositoryPortalFramesReady=true;
   prepared.readiness=await engine.prepareRepositoryResources(prepared.root);
  };
 }

 const host=new RepositoryWorldHost({engine,input,...backendHost,onChange:active=>{playerEyes?.ownView('Viewer world changed');playerEyes?.roster.clear();if(!openingLoading||openingTargetWorldId&&(active.identity.worldId!==openingTargetWorldId||active.identity.contentDigest!==openingTargetDigest||host.generation!==openingExpectedGeneration)){openingLoading=false;pendingOpeningReady=null;hideOpeningSplash();}document.querySelector('#panel h1').textContent=active.project.metadata.name;followCamera.reset(active);retro.setWorld(active);post?.taau.resetHistory();if(medium)medium.uniforms.fields.base.value=terrainMistBase(active.project.terrain);report(active.project.metadata.name+' · '+active.identity.location+' · '+active.identity.contentDigest.slice(0,12));},onInteract:(computer,active)=>{
  void openComputer(computer,active);
 }});
 document.querySelector('#terminal-close').onclick=()=>{terminal.close();engine.canvas.focus();};
 let arrivals;
 const portalOptions={onPresence:packet=>arrivals?.receive(packet),onActivated:active=>arrivals?.activated(active),engine,host,input,...backendPortals,getPitch:()=>ownerEyePitch({protocol:portals.config?.protocol,backend:selected.backend,player:host.active?.player}),getAppearance:()=>app.avatarChooser?.value??loadAppearance(),onStatus:s=>{document.querySelector('#portal-status').textContent=s;}};
 const portals=installation.kind==='published'?new PublicPortalRuntime({...portalOptions,catalog:installation.catalog}):new RepositoryPortalRuntime(portalOptions);movementPortals=portals;
 if(installation.kind==='published'){publicDuck=new PublicMicroduck({runtime:portals,getActive:()=>host.active});portals.onBeforeDisconnect=()=>publicDuck.stop();}
 objectAccess=new OwnerObjectAccessClient({getContext:()=>{const t=portals.transport,a=host.active;return {transport:t,active:a,connection:t.connectionEpoch,worldId:a?.identity.worldId,contentDigest:a?.identity.contentDigest,sessionId:t.membership?.sessionId,generation:t.generation,authorityEpoch:t.membership?.world?.epoch,ready:ownerMode()&&portals.connected&&!portals.pending&&!portals.authorityOffline&&!t.closed&&!t.frozen&&t.worldId===a?.identity.worldId};},onLost:()=>{media?.exit();if(terminal.open)terminal.close();retro.clear({resume:false});if(canResume())input.resume();interactionContext=null;activeComputerId=null;document.querySelector('#computer-controls').textContent='Access restricted';},onSnapshot:snapshot=>{accessPanel?.render(snapshot);if(snapshot?.overlay)host.setRuntimeOverlay(snapshot.overlay);if(controlsHelp?.open)controlsHelp.render();}});
 accessPanel=new ObjectAccessPanel({client:objectAccess,host,parent:document.querySelector('#panel'),onStatus:report});
 if(installation.kind==='published'){
  accessPanel.root.hidden=true;document.querySelector('#session-url')?.closest('details')?.setAttribute('hidden','');document.querySelector('#coordinator-controls').hidden=true;
  const list=document.querySelector('#player-tips ul');if(list){list.replaceChildren();for(const tip of [
   'WASD to walk, Space to jump and Shift to run. On a phone or tablet, use the movement, look, jump and Use controls.',
   'Drag the mouse or use arrow keys to look. Press V to switch between first-person and follow view.',
   'Find the gold Table Tennis Room doorway beside the Dock portal in the warehouse. Move around it to see the room, then walk through when its view is ready.',
   'In the Table Tennis Room, walk within the room boundaries and around the table. Return through the same gold doorway.',
   'The Dock doorway leads to Bracken Quay Dock. Walk back through its doorway to return to the warehouse.',
   'Press E near a computer. At the TV, press E, then Play on TV. Return to game keeps it playing; press E again to control or stop it. Using a computer stops the TV.',
   'Microduck is your local companion for this browser session. It explores the warehouse, visits the Table Tennis Room through the gold doorway and returns.',
   'This is a public single-player tour. No owner connection or visitor permission setup is needed.',
   'Open world remains available if you want to leave the tour and open another repository.'
  ]){const item=document.createElement('li');item.textContent=tip;list.append(item);}}
 }

 let panelInputContext=null,helpInputContext=null;
 const resumeUI=context=>{if(canResumeObjectInteraction(context,{active:host.active,hostGeneration:host.generation,pending:portals.pending,authorityOffline:portals.authorityOffline,transport:portals.transport,connected:portals.connected,ownerMode:ownerMode()}))input.resume();};
 accessPanel.root.addEventListener('toggle',()=>{if(accessPanel.root.open){panelInputContext=interactionState();input.suspend();document.exitPointerLock?.();}else{resumeUI(panelInputContext);panelInputContext=null;}});
 controlsHelp=new ObjectControlsHelp({replayWelcome:()=>worldWelcome?.replay(),hasWelcome:()=>validWorldWelcome(host.active?.project.welcome),getProject:()=>host.active?.project,getSnapshot:()=>objectAccess.snapshot,getPlayerNodeId:()=>portals.transport.identity?.nodeId,isFresh:()=>!!objectAccess.snapshot&&objectAccess.same(objectAccess.snapshot.context)&&objectAccess.snapshot.expiresAt>Date.now(),canOpen:()=>installation.kind!=='published'&&!terminal.open&&!retro.active&&!media?.controlsOpen&&!accessPanel.root.open,onOpen:()=>{helpInputContext=interactionState();input.suspend();},onClose:()=>{resumeUI(helpInputContext);helpInputContext=null;}});
 async function openComputer(computer,active,device=null){
  if(interactionPending||terminal.open||retro.active||media?.controlsOpen)return;media?.exit();interactionPending=true;
  try{
   if(ownerMode()){if(!objectAccess.snapshot)await objectAccess.read();await objectAccess.use(computer.id);}
   if(host.active!==active||portals.pending||portals.authorityOffline)return;
   activeComputerId=computer.id;interactionContext=interactionState();
   const retroDevice=device??active.project.terminals?.find(t=>t.objectId===computer.id&&t.kind==='c64');
   if(retroDevice){retro.open(retroDevice);return;}
   input._clearTransientInput();document.exitPointerLock?.();document.querySelector('#computer-info').textContent='Computer '+computer.id+' · '+(ownerMode()?'Owner session':installation.kind==='published'?'Single player':'Local preview')+' · sign '+(computer.computer.targetSignId??'not assigned');
   document.querySelector('#computer-controls').textContent='';terminal.showModal();window.dispatchEvent(new CustomEvent('repository-computer',{detail:{computer,active}}));
  }catch(error){report(error.message);}finally{interactionPending=false;}
 }
 const mediaReady=()=>!!host.active&&!portals.pending&&!portals.authorityOffline&&(!ownerMode()||(portals.connected&&!portals.transport.closed&&!portals.transport.frozen&&portals.transport.worldId===host.active.identity.worldId));
 media=new MediaScreen({describeObstruction:()=>app.mediaOcclusion?.reasons?.join('; ')||'Scene geometry overlaps the TV sightline.',getContext:()=>({ready:mediaReady(),active:host.active,key:[host.generation,host.active?.identity.contentDigest,portals.transport.connectionEpoch,portals.transport.membership?.sessionId,portals.transport.generation].join('|'),camera:engine.camera,viewport:engine.canvas.getBoundingClientRect(),objectMatrix:id=>host.active?.matrices.get(id)}),isAuthorized:(id,action)=>!ownerMode()||objectAccess.valid(id,action),isUnobstructed:(projection,c,object)=>{const avatarRoots=[avatar.group,portals.activeLayer?.group].filter(Boolean),proof=collectMediaScreenOccluders(c.active,{camera:c.camera,projection,screenObjectId:object.id,avatarRoots});app.mediaOcclusion=proof;return mediaScreenCellVisibility(projection,c.camera,proof.bounds,proof);},onEnter:()=>input.suspend(),onExit:()=>{resumeUI(mediaContext);mediaContext=null;engine.canvas.focus();}});
 function nearestMedia(){const active=host.active;if(!active)return null;let found=null,best=Infinity;const feet=active.player.position;
  for(const o of active.project.objects){if(o.kind!=='media-screen'||!effectiveObjectState(active.project.objects,o.id).visible)continue;const m=active.matrices.get(o.id);if(!m)continue;const d=Math.hypot(m.elements[12]-feet.x,m.elements[13]-(feet.y+1.65),m.elements[14]-feet.z);if(d<Math.min(8,Math.max(3,o.mediaScreen.width))&&d<best){found=o;best=d;}}return found;}
 async function openMedia(object,active){if(interactionPending||terminal.open||retro.active||media.controlsOpen)return;interactionPending=true;try{
  if(ownerMode()){if(!objectAccess.snapshot)await objectAccess.read();await objectAccess.use(object.id,'media.play');}
  if(host.active!==active||!mediaReady())return;mediaContext=interactionState();media.enter(object,active);
 }catch(error){report(error.message);}finally{interactionPending=false;}}
 const avatar=isWebGL?new WebGLRepositoryAvatar(engine.scene,{prepareResources:engine.prepareRepositoryResources}):new ReadiedRepositoryAvatar(engine.scene,{model:{wheelPivot:{position:new N.Vector3()},lines:{deckY:0},group:new N.Group()},getYaw:()=>0},{prepareResources:engine.prepareRepositoryResources});
 arrivals=new PortalArrivalController({runtime:portals,localAvatar:avatar});
 const openingPlayer={avatarAppearance:loadAppearance()};
 const opaqueDepthPrepass={enabled:true,phase:'idle',lastResult:null,occluders:()=>getQualifiedWarehouseDepthOccluders(host.active)};
 let sunsetOutput=null;
 const renderMainScene=()=>{
  const draw=()=>{
   opaqueDepthPrepass.lastResult=renderWebGLOpaqueDepthPrepass({renderer,scene:engine.scene,camera:engine.camera,occluders:opaqueDepthPrepass.occluders(),enabled:opaqueDepthPrepass.enabled,onPhase:phase=>{opaqueDepthPrepass.phase=phase;}});
   return opaqueDepthPrepass.lastResult;
  };
  return sunsetOutput?sunsetOutput.renderMain(draw,{scene:engine.scene,camera:engine.camera,ordinary:true}):draw();
 };
 const app={publicDuck,media,objectAccess,accessPanel,controlsHelp,engine,input,host,renderer,post,weather,retro,portals,avatar,arrivals,followCamera,camera:engine.camera,freeCam:false,get player(){return host.active?.player??openingPlayer;},fly:{yaw:0,pitch:0,velocity:new N.Vector3(),setPose(position,yaw,pitch){this.yaw=yaw;this.pitch=pitch;engine.camera.position.copy(position);engine.camera.quaternion.setFromEuler(new N.Euler(pitch,yaw,0,'YXZ'));engine.camera.updateMatrixWorld();}},thirdIsland:{active:false},monorail:{state:'off'},setFreeCam(value){this.freeCam=!!value;},gpu:isWebGL?null:GPU,backend:selected.backend,fallbackReason:selected.fallbackReason,session:null,...repositoryWorldActions({host,portals,report})};
 let welcomeMuted=false;try{welcomeMuted=localStorage.getItem('elsemesh.world-welcome-muted/1')==='1';}catch{}
 if(isWebGL){sunsetOutput=new WebGLSunsetOutput({renderer,getActive:()=>host.active,getPortals:()=>portals});Object.assign(app,{opaqueDepthPrepass,renderMainScene,sunsetOutput});}
 const isWelcomeMuted=()=>welcomeMuted||!!app.audio?.muted||!!app.audioMuted;
 const welcomeSpeech=new LocalWelcomeSpeech({isMuted:isWelcomeMuted});
 welcomeView=new WorldWelcomeView({isMuted:isWelcomeMuted,onMute:value=>{welcomeMuted=value;try{localStorage.setItem('elsemesh.world-welcome-muted/1',value?'1':'0');}catch{}welcomeSpeech.tick();},onReplayAudio:()=>{const welcome=worldWelcome?.context()?.active.project.welcome;if(validWorldWelcome(welcome)&&welcome.audio)welcomeSpeech.play(welcome.text);}});
 worldWelcome=new WorldWelcomeController({getContext:()=>{const t=portals.transport,a=host.active,owner=ownerMode();return {active:a,transport:t,connection:t.connectionEpoch,worldId:a?.identity.worldId,contentDigest:a?.identity.contentDigest,sessionId:t.membership?.sessionId,generation:t.generation,authorityEpoch:t.membership?.world?.epoch,playerNodeId:t.identity?.nodeId,ownerMode:owner,visible:document.visibilityState!=='hidden',ready:!!a&&!portals.pending&&!portals.authorityOffline&&(!owner||(portals.connected&&!t.closed&&!t.frozen&&t.worldId===a.identity.worldId))};},present:welcome=>!document.querySelector('dialog[open]')&&welcomeView.show(welcome),clear:()=>welcomeView.hide(),speech:welcomeSpeech});
 app.worldWelcome=worldWelcome;
 const avatarChooser=new AvatarChooser({app});app.avatarChooser=avatarChooser;
 window.addEventListener('keydown',event=>{if(event.code==='KeyK'&&!graphics?.open&&!retro.active&&!terminal.open&&!media?.controlsOpen&&!portals.pending)avatarChooser.show();});
 const followButton=document.querySelector('#follow-player');const setFollow=enabled=>{if(enabled)alignAvatarToPlayerView(avatar,host.active?.player);followCamera.setEnabled(enabled);followButton.textContent=enabled?'First-person view · V':'Follow player · V';post?.taau.resetHistory();engine.canvas.focus();};followButton.onclick=()=>setFollow(!followCamera.enabled);followButton.textContent=followCamera.enabled?'First-person view · V':'Follow player · V';
 const canToggleView=()=>input.enabled&&!retro.active&&!terminal.open&&!media?.controlsOpen&&!avatarChooser.dialog.open&&!portals.pending&&!portals.authorityOffline;
 window.addEventListener('keydown',event=>{if(event.code==='KeyV'&&canToggleView())setFollow(!followCamera.enabled);});
 const touchGameplayReady=()=>!!host.active&&input.enabled&&!terminal.open&&!retro.active&&!media?.controlsOpen&&!interactionPending&&!controlsHelp.open&&!accessPanel.root.open&&!portals.pending&&!portals.authorityOffline&&!avatarChooser.dialog.open&&!app.freeCam&&!playerEyes?.panel.open&&!document.querySelector('dialog[open]');
 input.bindTouchAction(document.querySelector('#touch-use'),{code:'KeyE',allowed:touchGameplayReady});
 input.bindTouchAction(document.querySelector('#touch-jump'),{code:'Space',hold:true,allowed:touchGameplayReady});
 input.bindTouchAction(document.querySelector('#touch-view'),{allowed:()=>touchGameplayReady()&&canToggleView(),onPress:()=>setFollow(!followCamera.enabled)});
 let touchWasActive=false;
 window.__repositoryWorldApp=app;
 if(isWebGL){
  const [{PlayerEyeView},{PlayerEyeControls},{PlayerEyePanel},{RepositoryPlayerEyes},{WebGLPlayerEyeRenderer}]=await Promise.all([import('./PlayerEyeView.js'),import('./PlayerEyeControls.js'),import('./PlayerEyePanel.js'),import('./RepositoryPlayerEyes.js'),import('./WebGLPlayerEyeRenderer.js')]);
  const uiClear=()=>!graphics?.open&&!terminal.open&&!retro.active&&!media?.controlsOpen&&!interactionPending&&!controlsHelp.open&&!accessPanel.root.open&&!avatarChooser.dialog.open&&!playerEyes?.panel.open;
  const safeSession=()=>!engine.renderer.getContext?.()?.isContextLost?.()&&!!host.active&&host.active.player.mode==='walk'&&portals.connected&&!portals.pending&&!portals.authorityOffline&&!portals.transport.closed&&!portals.transport.frozen&&portals.transport.worldId===host.active.identity.worldId&&uiClear();
  const sameViewer=()=>!eyeInputContext||(eyeInputContext.active===host.active&&eyeInputContext.hostGeneration===host.generation&&eyeInputContext.transport===portals.transport&&eyeInputContext.connection===portals.transport.connectionEpoch&&eyeInputContext.sessionId===portals.transport.membership?.sessionId&&eyeInputContext.generation===portals.transport.generation);
  const roster=new RepositoryPlayerEyes({runtime:portals,timeoutMs:3000,allowCrossWorld:allowCrossWorldEyes});
  const eyeRenderer=new WebGLPlayerEyeRenderer({renderer:engine.renderer,resolveScene:worldId=>portals.resolveEyeScene(worldId),resolveTarget:key=>roster.resolve(key),ordinaryToneMapping:backendPortals.views.ordinaryToneMapping});
  const controls=new PlayerEyeControls({input,canvas:engine.canvas,getPlayer:()=>host.active?.player,canActivate:()=>safeSession()&&sameViewer(),canResume:()=>safeSession()&&sameViewer()&&canResumeObjectInteraction(eyeInputContext,{active:host.active,hostGeneration:host.generation,pending:portals.pending,authorityOffline:portals.authorityOffline,transport:portals.transport,connected:portals.connected,ownerMode:ownerMode()})});
  const controller=new PlayerEyeView({eyeCamera:engine.camera,timeoutMs:3000,allowCrossWorld:allowCrossWorldEyes,resolveTarget:key=>roster.resolve(key),listTargets:()=>roster.targets(),onActivate:()=>{eyeInputContext=interactionState();if(!controls.activate()){eyeInputContext=null;throw Error('Player eyes require a ready walking session.');}},onExit:()=>{try{controls.deactivate();}finally{eyeInputContext=null;eyeRenderer.reset();followCamera.reset(host.active);}}});
  let eyePanelContext=null;
  const panel=new PlayerEyePanel({controller,onOpen:()=>{controller.ownView('Shared views menu opened');eyePanelContext=interactionState();input.suspend();},onClose:()=>{if(!controller.status().active)resumeUI(eyePanelContext);eyePanelContext=null;},getTransport:()=>portals.transport,isSinglePlayer:()=>!portals.connected,parent:document.body,viewerWorldName:()=>host.active?.project.metadata.name??'your current world'});panel.select.style.width='100%';
  const eyeContextLost=()=>{controller.ownView('Graphics connection changed');eyeRenderer.reset();};engine.canvas.addEventListener('webglcontextlost',eyeContextLost);
  portals.onEyeConsent=()=>{if(controller.status().active&&!controller.update()){eyeRenderer.reset();}panel.refresh();};
  let disposed=false;playerEyes={controller,controls,panel,renderer:eyeRenderer,roster,enabled:true,allowCrossWorld:allowCrossWorldEyes,drawnFrames:0,select:key=>controller.select(key),ownView:reason=>controller.ownView(reason),targets:()=>controller.targets(),diagnostics:()=>({status:controller.status(),resources:eyeRenderer.diagnostics(),allowCrossWorld:allowCrossWorldEyes,lastError:playerEyes.lastError??null,drawnFrames:playerEyes.drawnFrames,body:{worldId:host.active?.identity.worldId,generation:portals.transport.generation,position:host.active?.player.position.toArray(),yaw:host.active?.player.yaw,pitch:host.active?.player.pitch,velocity:host.active?.player.velocity.toArray(),inputEnabled:input.enabled},eye:{position:controller.eyeCamera.position.toArray(),quaternion:controller.eyeCamera.quaternion.toArray()}}),dispose(){if(disposed)return;disposed=true;engine.canvas.removeEventListener('webglcontextlost',eyeContextLost);portals.onEyeConsent=()=>{};panel.dispose();controller.dispose();controls.dispose();eyeRenderer.dispose();roster.dispose();}};app.playerEyes=playerEyes;
 }else{
  const notice=document.createElement('section');notice.id='player-eye-panel';notice.style.cssText='position:fixed;top:16px;right:16px;z-index:45;max-width:260px;padding:8px;background:#101d2bf2;color:#e0ebe9;font:13px system-ui';const button=document.createElement('button');button.type='button';button.disabled=true;button.textContent='God view';const help=document.createElement('p');help.textContent='Shared player views require WebGL viewing mode.';notice.append(button,help);document.body.append(notice);
 }

 let graphicsInputContext=null;
 graphics=new GraphicsPanel({app,captureQuality,canOpen:()=>!!host.active&&!portals.pending&&!terminal.open&&!retro.active&&!media?.controlsOpen&&!interactionPending&&!controlsHelp.open&&!accessPanel.root.open&&!avatarChooser.dialog.open&&!playerEyes?.panel.open,
  onOpen:()=>{playerEyes?.ownView('Graphics menu opened');graphicsInputContext=interactionState();input.suspend();},
  onClose:()=>{resumeUI(graphicsInputContext);graphicsInputContext=null;}});app.graphics=graphics;
 const sessionStatus=document.querySelector('#session-status');
 host.beforeActivate=async()=>{graphics?.worldChanging();playerEyes?.panel.setOpen(false);playerEyes?.ownView('Viewer world is changing');media?.exit();worldWelcome?.reset();objectAccess.invalidate();controlsHelp.close();accessPanel.root.open=false;accessPanel.render(null);if(retro.active)retro.clear();document.querySelector('#apply-update').disabled=true;document.querySelector('#update-status').textContent='';app.session?.disconnect();if(terminal.open)terminal.close();};
 const makeSession=()=>new RepositorySession(host,{trustedOwners:new Set([document.querySelector('#session-url').value.trim()]),onStatus:value=>sessionStatus.textContent=value});
 document.querySelector('#session-identity').onclick=()=>void(async()=>{const session=app.session??makeSession();document.querySelector('#public-identity').textContent=JSON.stringify(await session.publicIdentity(),null,2);})().catch(error=>sessionStatus.textContent=error.message);
 document.querySelector('#session-connect').onclick=()=>void(async()=>{const file=document.querySelector('#admission').files[0];if(!file||file.size>100000)throw Error('Select an operator admission JSON under 100 KB.');const proof=JSON.parse(await file.text());if(portals.mode==='published')portals.disconnect();app.session?.disconnect();app.session=makeSession();await app.session.connect(proof);})().catch(error=>sessionStatus.textContent=error.message);
 document.querySelector('#session-disconnect').onclick=()=>app.session?.disconnect();
 window.addEventListener('repository-computer',event=>{
  const target=event.detail.computer.computer.targetSignId,controls=document.querySelector('#computer-controls');controls.textContent='';
  if(!target){controls.textContent='No neon sign is assigned to this computer.';return;}
  const authored=host.active.project.objects.find(o=>o.id===target&&o.kind==='neon-sign');
  if(!authored){controls.textContent='The assigned sign is missing.';return;}
  const config=structuredClone(host.overlay?.signs?.find(s=>s.id===target)?.config??authored.neon),fields={};
  for(const [key,label,type] of [['text','Text','text'],['color','Colour','color'],['brightness','Brightness','number'],['size','Letter size','number']]){const row=document.createElement('label');row.textContent=label;const field=document.createElement('input');field.type=type;field.value=config[key];if(type==='number')field.step='.1';fields[key]=field;row.append(field);controls.append(row);}
  const effect=document.createElement('select');for(const mode of ['steady','flicker','pulse','flash','sequence','colour-cycle','faulty','timed']){const option=document.createElement('option');option.value=mode;option.textContent=mode;effect.append(option);}effect.value=config.effect.mode;controls.append(effect);
  const apply=document.createElement('button');apply.textContent='Apply sign settings';apply.onclick=async()=>{try{const next={...config,text:fields.text.value,color:fields.color.value,brightness:Number(fields.brightness.value),size:Number(fields.size.value),effect:{...config.effect,mode:effect.value}};if(ownerMode())await objectAccess.effect(event.detail.computer.id,target,'neon.configure',next);else if(app.session?.connected)app.session.setConfig(target,next);else host.setLocalConfig(target,next);}catch(error){sessionStatus.textContent=error.message;}};controls.append(apply);
  for(const [label,powered] of [['Power on',true],['Power off',false]]){const button=document.createElement('button');button.textContent=label;button.onclick=async()=>{try{if(ownerMode())await objectAccess.effect(event.detail.computer.id,target,'neon.power',powered);else if(app.session?.connected)app.session.setPower(target,powered);else host.setLocalPower(target,powered);}catch(error){sessionStatus.textContent=error.message;}};controls.append(button);}
 });
 const loadFiles=async files=>app.load(localRepositorySource(files));
 document.querySelector('#check-update').onclick=()=>void app.checkUpdate().then(update=>{const apply=document.querySelector('#apply-update');apply.disabled=!update;document.querySelector('#update-status').textContent=update?`Checked revision ${update.fromCommit??update.fromDigest} → ${update.toCommit??update.toDigest}. Apply to reload and disconnect this session.`:'No newer revision found.';}).catch(error=>{document.querySelector('#apply-update').disabled=true;report(error.message);});
 document.querySelector('#apply-update').onclick=()=>void(async()=>{await app.applyUpdate();document.querySelector('#apply-update').disabled=true;})().catch(error=>report(error.message));
 document.querySelector('#folder').onclick=()=>document.querySelector('#files').click();document.querySelector('#files').onchange=e=>void loadFiles(e.target.files).catch(error=>{report('World rejected: '+error.message);console.error(error);});
 document.querySelector('#hosted-open').onclick=()=>void(async()=>{await app.load(hostedRepositorySource(document.querySelector('#hosted-url').value));})().catch(error=>report('World rejected: '+error.message));
 document.querySelector('#remote').onclick=()=>void(async()=>{const source=await resolveGitHubWorldSource(parseGitHubWorldLocation(document.querySelector('#github').value));await app.load(source);})().catch(error=>report(error.message));
 engine.start((dt,time)=>{
  try{
   graphics.beforeFrame(performance.now(),{eligible:graphicsSceneEligible({active:host.active,openingLoading,portals,eyeActive:playerEyes?.controller.status().active})});
   if(!isWebGL){GPU.beginFrame();G.time.value=time;G.dt.value=dt;G.exposure.value=.55;}
   if(!terminal.open&&!retro.active&&!media?.active&&!interactionPending){objectAccess.lease=null;interactionContext=null;activeComputerId=null;}
   if(ownerMode())objectAccess.tick();
   const touchActive=input.touchInterface&&touchGameplayReady();
   if(touchWasActive&&!touchActive)input._clearTransientInput();
   touchWasActive=touchActive;if(touchLayer)touchLayer.hidden=!touchActive;
   const canMove=!graphics.open&&!terminal.open&&!retro.active&&!media?.controlsOpen&&!interactionPending&&!controlsHelp.open&&!accessPanel.root.open&&!portals.pending&&!portals.authorityOffline&&!app.freeCam&&!playerEyes?.panel.open;
   if(playerEyes?.controller.status().active&&!playerEyes.controls.maintain())playerEyes.ownView('Viewer session changed');
   let eyeActive=!!playerEyes?.controller.status().active,eyeFrame=eyeActive?playerEyes.controller.update():null;eyeActive=!!eyeFrame;
    if(eyeActive||!app.freeCam)host.update(dt,time,{move:eyeActive||canMove,interact:!eyeActive&&canMove,viewCamera:eyeFrame&&eyeFrame.target.worldId===host.active?.identity.worldId?eyeFrame.camera:engine.camera});
    if(canMove&&!eyeActive){const device=retro.nearest(engine.camera.position),tv=nearestMedia();if(input.hit('KeyE')){if(device){const computer=host.active.project.objects.find(o=>o.id===device.objectId);if(computer)void openComputer(computer,host.active,device);else if(!ownerMode()){interactionContext=interactionState();retro.open(device);}else report('Access restricted');}else if(tv)void openMedia(tv,host.active);}}
   if(host.active&&!app.freeCam)followCamera.update(dt,host.active,{suspended:eyeActive||playerEyes?.panel.open||terminal.open||retro.active||!!media?.controlsOpen||controlsHelp.open||accessPanel.root.open||portals.pending});
   if(host.active)avatar.update(dt,host.active.player,engine.camera,app.freeCam||followCamera.enabled||eyeActive);else avatar.group.visible=false;
   portals.update(dt,time,{allowCrossing:!eyeActive,viewCamera:eyeFrame?.camera??engine.camera,viewWorldId:eyeFrame?.target.worldId??host.active?.identity.worldId});publicDuck?.update(dt);if(eyeActive){eyeFrame=playerEyes.controller.update();eyeActive=!!eyeFrame;}if(playerEyes&&performance.now()>=(playerEyes.nextPanelAt??0)){playerEyes.panel.refresh();playerEyes.nextPanelAt=performance.now()+250;}arrivals.update();portalEffects.update(dt,time);input.endFrame();
   const env=host.environment()??{timeOfDay:14,cloudCoverage:.49,windSpeed:6,sunAzimuth:0};let weatherState;const water=host.active?.project.water;
   if(isWebGL){weatherState=updateWebGLRepositoryEnvironment(engine,host.active,time,env);renderer.toneMapping=host.active?.splatScene?.expectedToneMapping??backendPortals.views.ordinaryToneMapping;let eyeDrawn=false;if(eyeFrame){eyeFrame.camera.aspect=engine.width/engine.height;eyeFrame.camera.updateProjectionMatrix();try{eyeDrawn=playerEyes.renderer.render(eyeFrame,{width:engine.width,height:engine.height,time});}catch(error){playerEyes.lastError=String(error?.message??error);playerEyes.ownView('Player eye rendering unavailable');report('Player eyes unavailable: '+playerEyes.lastError);}if(eyeDrawn)playerEyes.drawnFrames++;else playerEyes.ownView('Player scene authorization changed');}if(!eyeDrawn){portals.render({width:engine.width,height:engine.height,time});host.active?.nativeIsland?.bindView(engine.camera);renderMainScene();}}
   else{const shelters=repositoryWeatherShelters(host.active?.project);setMistShelters(medium.uniforms,shelters);clouds.coverage.value=env.cloudCoverage??.49;G.windSpeed.value=env.windSpeed??6;
   G.seaLevel.value=host.active?.nativeIsland?.water.seaLevel??host.active?.project.water?.level??0;
    for(const [key,value]of Object.entries(repositoryMediumWaterSettings(host.active?.project,engine.camera.position,time)))medium.uniforms.fields[key].value=value;
   medium.uniforms.fields.storm.value=env.weather==='storm'?1:0;medium.uniforms.fields.density.value=env.mistDensity??.004;medium.uniforms.fields.speed.value=env.mistSpeed??2;medium.uniforms.fields.height.value=env.mistHeight??9;
   const dir=sunDirectionFromTime(env.timeOfDay??14).applyAxisAngle(new N.Vector3(0,1,0),env.sunAzimuth??0);atmosphere.sunDir.value.copy(dir);
   const night=N.MathUtils.smoothstep(-dir.y,.02,.18);G.night.value=night;sky.starIntensity.value=night;const moon=new N.Vector3(-dir.x,Math.abs(dir.y)*.8+.25,-dir.z).normalize();sky.moonDir.value.copy(moon);G.sunDir.value.copy(dir.y>-.07?dir:moon);
   weatherState=weather.update(time,engine.camera,host.active?.player.yaw??0,env,()=>{},shelters);medium.uniforms.fields.lightning.value=weatherState.flash;
   atmosphere.update(dt,engine.camera.position.y);
   if(atmosphere.sunTransmittance){const t=atmosphere.sunTransmittance;if(dir.y>-.07)G.sunColor.value.setRGB(...t).multiplyScalar(SUN_ILLUMINANCE*N.MathUtils.smoothstep(dir.y,-.03,.02));else G.sunColor.value.setRGB(.6,.7,1).multiplyScalar(.12*night);const a=atmosphere.skyIrradiance,k=.012*night;G.skyIrradiance.value.setRGB(a[0]+k*.6,a[1]+k*.7,a[2]+k);G.horizonColor.value.setRGB(...atmosphere.horizon);}
   clouds.update(dt,engine.camera);environment.update(dt);post.beginFrame();portals.render({width:renderer.width,height:renderer.height,time});host.active?.nativeIsland?.bindView(engine.camera);renderer.waterMaterial=host.active?.nativeIsland?.waterMaterial??{needsSSRDepth:false};shadows.render(engine.scene,engine.meshRenderer,shadows.update(engine.camera,G.sunDir.value));renderer.render();post.render();post.endFrame();GPU.submit();}
   media.update();worldWelcome.tick();
   if(openingLoading&&pendingOpeningReady&&pendingOpeningReady===host.active){const activeOpeningFrame=host.active;openingProgress.advance('first-frame');pendingOpeningReady=null;openingLoading=false;requestAnimationFrame(()=>{if(host.active===activeOpeningFrame)hideOpeningSplash();});}
   const active=host.active;hud.textContent=active?`${active.project.metadata.name} · ${active.player.mode} · ${active.player.position.toArray().map(v=>v.toFixed(1)).join(', ')}${retro.nearest(engine.camera.position)?' · E: use Commodore / retro computer':host.nearestComputer()?' · E: use computer':nearestMedia()?' · E: turn on or control TV (Play, then Return to game)':''}`:'Open a repository to explore';
   app.diagnostics={playerEyes:playerEyes?.diagnostics()??null,media:media.diagnostics(),mediaOcclusion:app.mediaOcclusion&&{complete:app.mediaOcclusion.complete,reasons:app.mediaOcclusion.reasons,stats:app.mediaOcclusion.stats},backend:selected.backend,fallbackReason:selected.fallbackReason,renderSize:[engine.canvas.width,engine.canvas.height],cameraView:followCamera.state,portalLongEdge:portals.views.maxLongEdge,frames:engine.frame,worldId:active?.identity.worldId,contentDigest:active?.identity.contentDigest,position:active?.player.position.toArray(),mode:active?.player.mode,grounded:active?.player.grounded,boxes:active?.colliders.boxes.length,assets:active?.assets,weather:weatherState,environment:env,water:water??null,nativeIsland:nativeIslandDiagnostics(active,selected.backend),assetBatches:active?.assetBatchCount,portals:portals.diagnostics(),portalEffects:portalEffects.diagnostics(),avatar:{appearance:app.player.avatarAppearance??loadAppearance(),loaded:!!(avatar.scanned||avatar.model),model:avatar.characterAsset??avatar.asset??avatar.appearance?.style},retro:{active:retro.active,near:retro.nearest(engine.camera.position)?.kind},neons:[]};active?.root.traverse(node=>{if(node.userData.neonState)app.diagnostics.neons.push(node.userData.neonState);});
  }catch(error){engine.stop();if(openingLoading)openingProgress.fail('Rendering failed: '+error.message);report('Runtime failed: '+error.message);console.error(error);app.error=error.message;}
 });
 document.querySelector('#portal-recover').onclick=()=>void portals.recover().catch(error=>{document.querySelector('#portal-status').textContent=error.message;});
 document.querySelector('#panel-toggle').onclick=()=>{document.querySelector('#panel').hidden=true;engine.canvas.focus();};
 window.addEventListener('keydown',event=>{if(event.code==='KeyH'&&!retro.active&&!terminal.open)document.querySelector('#panel').hidden=!document.querySelector('#panel').hidden;});
 document.querySelector('#portal-connect').onclick=()=>void connectOpening().catch(error=>{document.querySelector('#portal-status').textContent=error.message;});
 async function connectOpening(){if(installation.kind!=='network')return false;await portals.connect(installation.runtimeConfig);return true;}
 document.querySelector('#choose-world').onclick=()=>{const tools=document.querySelector('#repository-tools');tools.hidden=!tools.hidden;};
 const openingGeneration=host.generation;
 void (async()=>{
  if(await connectOpening())return;
  openingProgress.advance('reading-world');
  const config=await readOpeningWorld();if(!config){hideOpeningSplash();return;}if(host.generation!==openingGeneration)return;
  openingLoading=true;openingTargetWorldId=config.worldId;openingTargetDigest=config.contentDigest;openingExpectedGeneration=openingGeneration+1;
  report(installation.kind==='published'?'Loading Warehouse, Dock and Table Tennis Room single-player tour…':'Loading published opening island…');
  const active=await loadOpeningWorld(app,config,{publishedCatalog:installation.kind==='published'?installation.catalog:null,onProgress:stage=>{if(openingLoading&&host.generation<=openingExpectedGeneration)openingProgress.advance(stage);}});if(!active)return;
  pendingOpeningReady=active;
  document.querySelector('#repository-tools').hidden=true;document.querySelector('#choose-world').hidden=false;document.querySelector('#coordinator-controls').hidden=true;
  document.querySelector('#panel h1').textContent=active.project.metadata.name;
  if(installation.kind==='published'){report('Warehouse, Dock and Table Tennis Room · single player');document.querySelector('#portal-status').textContent='Walk through either the Dock or gold Table Tennis Room doorway. Return through the doorway in that world.';}else report('Published island · revision '+(active.identity.resolvedCommit??validateOpeningWorld(config).source.ref).slice(0,12)+' · '+selected.backend);
 })().catch(error=>{openingProgress.fail(error.message);report('Opening world could not load: '+error.message);document.querySelector('#portal-status').textContent='Opening world unavailable. Retry by reloading, or choose a repository.';});
 window.addEventListener('pagehide',()=>{graphics?.dispose();sunsetOutput?.dispose();playerEyes?.dispose();media.dispose();refraction?.dispose();objectAccess.invalidate();worldWelcome.dispose();welcomeView.dispose();controlsHelp.dispose();portals.dispose();portalEffects.dispose();retro.dispose();avatar.dispose();host.dispose();engine.stop();if(isWebGL)engine.dispose();else GPU.device?.destroy();});report('ElseMesh '+selected.backend+' ready. Open a world repository folder or public GitHub source.');
 window.dispatchEvent(new CustomEvent('repository-world-ready',{detail:app}));
}
init().catch(error=>{console.error(error);openingProgress.fail(error.message);report(error.message);});
