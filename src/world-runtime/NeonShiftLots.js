// Shared by the authored world exporter, renderer and publication validator.
export const NEON_STREET_LIMIT=96,NEON_FOUNDATION_HALF=5,NEON_FOUNDATION_HEIGHT=3;
export const NEON_TOWER_JITTER=.6,NEON_TOWER_MAX_WIDTH=8,NEON_TOWER_BASE_Y=3.05;
const lots=[];
for(let x=-81;x<=81;x+=18)for(let z=-81;z<=81;z+=18){
 if(Math.abs(x)<34&&Math.abs(z)<34||Math.abs(x)===81&&Math.abs(z)===81)continue;
 lots.push(Object.freeze({id:'neon-foundation-'+String(lots.length).padStart(2,'0'),x,z,half:NEON_FOUNDATION_HALF,height:NEON_FOUNDATION_HEIGHT}));
}
export const NEON_SHIFT_LOTS=Object.freeze(lots);
export function assertNeonShiftFoundations(project){
 const actual=project.objects.filter(o=>o.id.startsWith('neon-foundation-'));
 if(actual.length!==NEON_SHIFT_LOTS.length)throw Error('Neon foundation inventory differs from visual lots');
 for(const lot of NEON_SHIFT_LOTS){const o=actual.find(o=>o.id===lot.id);if(!o||o.parentId!=null||o.ambientBehaviour||JSON.stringify(o.position)!==JSON.stringify([lot.x,1.5,lot.z])||JSON.stringify(o.scale)!==JSON.stringify([6.25,1.875,6.25])||o.rotation.some(v=>v!==0)||o.collision!=='solid'||o.visible!==true)throw Error('Neon foundation differs from fixed street lot: '+lot.id);}
 return true;
}
