import{H as e,R as t,t as n}from"./Colliders-B7TxXLIb.js";import{A as r,B as i,C as a,D as o,E as s,F as c,I as l,L as u,M as d,O as f,P as p,R as m,S as h,T as g,V as _,_ as v,a as y,b,c as x,d as S,f as C,g as w,h as T,i as E,j as D,k as O,l as k,m as A,n as j,o as M,p as N,r as P,s as F,t as I,u as L,v as R,w as z,x as ee,y as te}from"./main-BX1Yzpe1.js";import{S as ne,U as re,V as ie,X as B,_ as ae,c as oe,g as V,i as se,m as ce,s as le,v as H,x as U,z as W}from"./world-engine-contract-C3e-C6LY.js";var ue=6291456,de=25165824;function G(e){if(e.textureTiers===void 0)return[];if(!Array.isArray(e.textureTiers)||e.textureTiers.length>3)throw Error(`Invalid texture tier count`);let t=1/0,n=e.bytes;return e.textureTiers.map(e=>{if(!e||Object.keys(e).some(e=>![`path`,`sha256`,`bytes`,`distance`].includes(e))||!/^[a-f0-9]{64}$/.test(e.sha256??``)||e.path!==`assets/${e.sha256}.glb`||!Number.isSafeInteger(e.bytes)||e.bytes<=n||e.bytes>ue||!Number.isFinite(e.distance)||e.distance<=0||e.distance>=t||e.distance>2e3)throw Error(`Invalid pinned texture tier reference`);return t=e.distance,n=e.bytes,{...e}})}function K(e){let t=e.buffer.slice(e.byteOffset,e.byteOffset+e.byteLength);ne(t);let n=new DataView(t).getUint32(12,!0);return{json:JSON.parse(new TextDecoder().decode(new Uint8Array(t,20,n))),bin:new Uint8Array(t,28+n)}}function fe(e,t){let n=K(e),r=K(t);if(!n.json.images?.length)throw Error(`Texture tiers require embedded images`);let i=({json:e,bin:t})=>{let n=new Set(e.images.map(e=>e.bufferView));if(e.accessors.some(e=>n.has(e.bufferView)))throw Error(`Texture tier image aliases geometry`);for(let t of n){let r=e.bufferViews[t],i=r.byteOffset??0,a=i+r.byteLength;if(e.bufferViews.some((e,t)=>!n.has(t)&&Math.max(i,e.byteOffset??0)<Math.min(a,(e.byteOffset??0)+e.byteLength)))throw Error(`Texture tier image overlaps geometry`)}let r=e.bufferViews.map((e,r)=>n.has(r)?null:t.slice(e.byteOffset??0,(e.byteOffset??0)+e.byteLength));e.buffers[0].byteLength=0;for(let t of n)e.bufferViews[t].byteOffset=0,e.bufferViews[t].byteLength=0;return{json:JSON.stringify(e),payloads:r}},a=i(n),o=i(r);if(a.json!==o.json||a.payloads.some((e,t)=>e&&(e.length!==o.payloads[t]?.length||e.some((e,n)=>e!==o.payloads[t][n]))))throw Error(`Texture tier changes geometry or material semantics`)}async function pe(e,t,n,r){let i=new Uint8Array(await e(t.path,t.bytes,{signal:r}));if(r?.aborted)throw r.reason;if(i.byteLength!==t.bytes||await W(i)!==t.sha256)throw Error(`Texture tier hash or size mismatch`);return fe(n,i),i}function me(e,t){let n=new Map([...t.materialIndices].map(([e,t])=>[t,e]));for(let[t,r]of e.materialIndices){let e=n.get(r);if(!e)throw Error(`Texture tier material slot missing`);for(let n of Object.keys(t))if(t[n]?.isTexture){if(!e[n]?.isTexture)throw Error(`Texture tier texture slot missing`);t[n].image=e[n].image,t[n].needsUpdate=!0}}}function he({read:e,parse:t=U,dispose:n=V,onLoaded:r=()=>{}}={}){let i=new Map,a=new AbortController,o=!1,s=!1,c=0,l=Promise.resolve(),u={eligible:0,requests:0,verifiedBytes:0,promotions:0,failures:0,retainedSourceBytes:0},d=e=>{e.bytes&&=(u.retainedSourceBytes-=e.bytes.byteLength,null)};return{stats:u,register(t,n,r,a){let o=G(t);if(!o.length||!e)return;let s=i.get(t.id);if(!s){if(c+=o.reduce((e,t)=>e+t.bytes,0),c>de)throw Error(`Texture tier candidate byte budget exceeded`);s={refs:o,bytes:n,loaded:r,positions:[],level:0,failed:!1},i.set(t.id,s),u.eligible++,u.retainedSourceBytes+=n.byteLength}s.positions.push(...a)},update(c){if(o||s||!c?.position)return;let f=c.position;for(let c of i.values()){let i=c.refs[c.level];if(i&&!c.failed&&c.positions.some(e=>Math.hypot(f.x-e[0],f.y-e[1],f.z-e[2])<=i.distance)){s=!0,u.requests++,l=(async()=>{let l;try{let s=await pe(e,i,c.bytes,a.signal);if(u.verifiedBytes+=s.length,l=await t(s.buffer.slice(s.byteOffset,s.byteOffset+s.byteLength)),o){n(l.scene);return}me(c.loaded,l),r(l),l=null,c.level++,u.promotions++,c.level===c.refs.length&&d(c)}catch(e){l&&n(l.scene),d(c),o||(c.failed=!0,u.failures++,c.error=e.message)}finally{s=!1}})();break}}},whenIdle(){return l},dispose(){if(!o){o=!0,a.abort(new DOMException(`World disposed`,`AbortError`));for(let e of i.values())d(e);i.clear()}}}}function ge(e,t,n,r,i=.1){let a=new B.Vector3().subVectors(t,e).cross(new B.Vector3().subVectors(n,e)),o=a.length();if(!Number.isFinite(o)||o<1e-6)return null;a.divideScalar(o);let s=a.dot(new B.Vector3().subVectors(r,e));if(Math.abs(s)<Math.max(i*4,.25)||Math.abs(s)/r.distanceTo(e)<.08)return null;s<0&&a.negate();let c=new B.Plane().setFromNormalAndCoplanarPoint(a,e),l=[];for(let[i,a,o]of[[e,t,n],[t,n,e],[n,e,t]]){let e=new B.Vector3().subVectors(i,r).cross(new B.Vector3().subVectors(a,r)).normalize();e.dot(new B.Vector3().subVectors(o,r))<0&&e.negate(),l.push(new B.Plane().setFromNormalAndCoplanarPoint(e,r))}return{plane:c,edges:l,area:o}}function _e(e){let t=Array.from({length:256},()=>[]),n=new B.Matrix4,r=new B.Vector3,a=[],o=!0,s=[],c=[],l=0,u=0,d=0,f=0,p=null,m=null,h=0,g=`no-occluders`,_=new B.Vector3,v=new B.Matrix4,y=new B.Matrix4,b=new B.Vector3,x=e=>{s=[],p=null,g=e;for(let e of t)e.length=0};function S(e,r,i,a){if(!s.length)return!1;l++;let o=n.elements,c=o[3]*e+o[7]*r+o[11]*i+o[15];if(c<=0)return!1;let f=(o[0]*e+o[4]*r+o[8]*i+o[12])/c,p=(o[1]*e+o[5]*r+o[9]*i+o[13])/c;if(f<-1||f>1||p<-1||p>1)return!1;let m=t[Math.min(15,Math.floor((p+1)*.5*16))*16+Math.min(15,Math.floor((f+1)*.5*16))],h=a+.15;if(!Number.isFinite(h)||h<=0)return!1;for(let t of m){let n=t.planes;if(d++,n[0]*e+n[1]*r+n[2]*i+n[3]>=-h)continue;let a=!0;for(let t=4;t<16;t+=4)if(d++,n[t]*e+n[t+1]*r+n[t+2]*i+n[t+3]<=h){a=!1;break}if(a)return u++,!0}return!1}return{setOccluders(e){a=e??[],f++},setEnabled(e){o!==!!e&&(o=!!e,p=null)},get configured(){return o&&a.length>0},get active(){return o&&s.length>0},get signature(){return p},resetCounters(){l=u=d=0},prepare(l,u=null){if(!o||!a.length){x(o?`no-occluders`:`disabled`);return}if(l!==e||!l.isPerspectiveCamera||l.isArrayCamera){x(`alternate-view`);return}if(Math.abs(l.projectionMatrix.elements[2])+Math.abs(l.projectionMatrix.elements[6])>1e-8){x(`oblique-projection`);return}let d=[],S=[f],C=u;for(;C?.parent;)C=C.parent;for(let e of a){if(!i(e)||e.material.wireframe||!e.layers.test(l.layers))continue;let t=!0,n=e;for(let r=e;r;r=r.parent)r.visible||(t=!1),n=r;if(!t||!e.parent||C&&n!==C)continue;e.updateWorldMatrix(!0,!1),d.push(e);let r=e.geometry,a=r.getAttribute(`position`);S.push(e.uuid,r.uuid,a.id,a.version,r.index?.id,r.index?.version,e.instanceMatrix?.id,e.instanceMatrix?.version,e.count,e.material.side,r.drawRange.start,r.drawRange.count,...e.matrixWorld.elements)}h=d.length;let w=S.join(`,`);if(m!==w){m=w,c=[];for(let e of d){let t=e.geometry,n=t.getAttribute(`position`),r=t.index,i=t.drawRange.start,a=Math.min(r?.count??n.count,i+t.drawRange.count);for(let t=0;t<(e.isInstancedMesh?e.count:1);t++)if(e.isInstancedMesh?(e.getMatrixAt(t,v),y.multiplyMatrices(e.matrixWorld,v)):y.copy(e.matrixWorld),!(y.determinant()<=0))for(let t=i;t+2<a;t+=3){let i=new B.Vector3().fromBufferAttribute(n,r?r.getX(t):t).applyMatrix4(y),a=new B.Vector3().fromBufferAttribute(n,r?r.getX(t+1):t+1).applyMatrix4(y),o=new B.Vector3().fromBufferAttribute(n,r?r.getX(t+2):t+2).applyMatrix4(y);c.push({a:i,b:a,c:o,side:e.material.side,normal:new B.Vector3().subVectors(a,i).cross(new B.Vector3().subVectors(o,i))})}}}let T=[w,...l.matrixWorld.elements,...l.projectionMatrix.elements,l.near,l.layers.mask].join(`,`);if(p===T)return;p=T,s=[];for(let e of t)e.length=0;l.getWorldPosition(_),n.multiplyMatrices(l.projectionMatrix,l.matrixWorldInverse);for(let e of c){let{a:t,b:i,c:a,normal:o}=e;if([t,i,a].some(e=>b.copy(e).applyMatrix4(l.matrixWorldInverse).z>=-Math.max(l.near*4,.25)))continue;let c=o.dot(b.subVectors(_,t));if(e.side===B.FrontSide&&c<=0||e.side===B.BackSide&&c>=0)continue;let u=ge(t,i,a,_,l.near);if(!u)continue;let d=new Float64Array(16);for(let[e,t]of[u.plane,...u.edges].entries())d.set([t.normal.x,t.normal.y,t.normal.z,t.constant],e*4);let f={minX:1/0,maxX:-1/0,minY:1/0,maxY:-1/0};for(let e of[t,i,a])r.copy(e).applyMatrix4(n),f.minX=Math.min(f.minX,r.x),f.maxX=Math.max(f.maxX,r.x),f.minY=Math.min(f.minY,r.y),f.maxY=Math.max(f.maxY,r.y);f.maxX<-1||f.minX>1||f.maxY<-1||f.minY>1||s.push({planes:d,area:u.area,bounds:f})}s.sort((e,t)=>t.area-e.area),s.length=Math.min(s.length,128);let E=e=>Math.max(0,Math.min(15,Math.floor((e+1)*.5*16)));for(let e of s){let n=e.bounds;for(let r=E(n.minY);r<=E(n.maxY);r++)for(let i=E(n.minX);i<=E(n.maxX);i++)t[r*16+i].push(e)}g=s.length?`ready`:h?`no-covering-triangles`:`no-eligible-materials`},rejects:e=>S(e.center.x,e.center.y,e.center.z,e.radius),rejectsXYZ:S,stats:()=>({enabled:o,occluderMeshes:a.length,eligibleMeshes:h,sourceTriangles:c.length,proofTriangles:s.length,tested:l,rejected:u,planeTests:d,screenBins:t.length,reason:g,policy:`actual opaque triangle cone; 16x16 candidate grid; precomputed canopy bounds; main view only`})}}function ve(e,t,n,r=new B.Sphere){e.boundingSphere||e.computeBoundingSphere(),r.copy(e.boundingSphere).applyMatrix4(n),e.boundingBox||e.computeBoundingBox();let i=Math.max(0,e.boundingBox.max.y),a=Math.abs(t.s);return r.radius+=.04*i*i/12.5*a+.1,r}var q=Object.freeze({size:1024,tiles:[{grid:4,leaves:6,width:.34},{grid:4,leaves:8,width:.2},{grid:3,leaves:6,width:.45},{grid:3,leaves:8,width:.22}],source:`src/world/vegetation/LeafTextures.js`,sourceSHA256:`ec7d3f71a78c9d2f9e40c75cd655151219a6f203d66be9c0cb2f8a30821228f9`,pixelSHA256:`37c59cfbbeedeb4c263991d8f1a7857cf49c9c72989fa7d01d72fd71ed4fbe0e`,pngSHA256:`fcb0975f2f0e30986022e2e37e8aebc2800632045500e50723e2e97657e5bf10`,orientation:`row 0 = v 0; tree tiles 0/1 bottom; shrub tiles 2/3 top`,precision:`CPU reference port; float32 hash, double precision trigonometry; not GPU pixel-equivalence qualified`}),ye=`
varying vec4 vNativePart;varying vec2 vNativeUv;varying float vNativeSeed;varying float vNativeHeight;
uniform sampler2D nativeLeafAtlas;
float vegSat(float x){return clamp(x,0.0,1.0);}
// GLSL smoothstep has undefined results for reversed edges; the source uses them deliberately.
float vegSmooth(float a,float b,float x){float t=clamp((x-a)/(b-a),0.0,1.0);return t*t*(3.0-2.0*t);}
float vegLuminance(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
float vegHash12(vec2 p){vec3 p3=fract(vec3(p.x,p.y,p.x)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float vegNoise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(f*-2.0+3.0);return mix(mix(vegHash12(i),vegHash12(i+vec2(1,0)),u.x),mix(vegHash12(i+vec2(0,1)),vegHash12(i+vec2(1,1)),u.x),u.y);}
struct VegBroad { float w; bool cut; };
VegBroad vegBroadShape( float part, float y, float x, float age, float W, float fseed, float seed ) {
	float ax = abs( x );
	float w = 0.0;
	bool cut = false;
	// ragged, slightly irregular margin on every leaf (more on old ones)
	float rag = 1.0 - ( vegNoise( vec2( y * 38.0 + (( x > 0.0 ) ? ( 17.0) : ( 0.0)), fseed * 31.0 ) ) * 0.05 + age * age * 0.12 * vegNoise( vec2( y * 11.0, fseed * 7.0 + x ) ) );
	if ( part < 6.5 ) {
		// monstera: cordate blade, basal lobes behind the petiole, V sinus; mature leaves are split
		// from the margin between the primary veins, with a row of holes (fenestrations) inside
		float yb = 0.16;
		float g = ( y - yb ) / ( 1.0 - yb );
		if ( y >= yb ) {
			w = pow( max( sin( 3.14159 * min( 1.0, 0.4 + 0.6 * g ) ), 0.0 ), 0.8 ) * ( 1.0 - 0.15 * vegSmooth( 0.8, 1.0, g ) );
		} else {
			float q = ( yb - y ) / yb;
			w = sqrt( max( 1.0 - q * q * q, 0.0 ) ) * 0.96;
			cut = ax < 0.3 * ( 1.0 - y / yb );
		}
		w *= rag;
		float matK = vegSmooth( 0.28, 0.45, age );
		if ( matK > 0.0 && y > yb * 0.4 && y < 0.93 ) {
			float L = W / 0.47;
			float X = ax * W;
			float Y = ( y - yb ) * L;
			float p = ( Y - 0.55 * X ) / ( L * 0.8 / 5.5 ) + fseed * 0.37;
			float k = floor( p + 0.5 );
			float e = abs( p - k ); // 0 on the gap between two primary veins
			float hk = vegHash12( vec2( k + (( x > 0.0 ) ? ( 50.0) : ( 0.0)), fseed * 19.3 ) );
			float r = ax / max( w, 0.05 );
			float depth = mix( 0.42, 0.75, hk ) + ( 1.0 - matK ) * 0.4;
			// slits widen toward the margin, their inner end rounded
			bool slit = e < 0.035 + 0.1 * vegSmooth( depth, 1.0, r ) && r > depth - 0.03;
			// fenestrations: one or two elongated holes along the gap line, inside the slit
			float r0 = 0.14; float r1 = depth - 0.1;
			float qh = ( r - r0 ) / max( r1 - r0, 0.05 );
			float nh = (( hk > 0.45 ) ? ( 2.0) : ( 1.0));
			float qq = fract( qh * nh );
			bool hole = qh > 0.0 && qh < 1.0 && e < 0.16 * pow( sin( 3.14159 * qq ), 0.6 ) * matK && hk > 0.12;
			cut = cut || slit || hole;
		}
	} else if ( part < 7.5 ) {
		// elephant ear: peltate blade (petiole joins inside it), rounded basal lobes, acute tip
		float yb = 0.3;
		float g = ( y - yb ) / ( 1.0 - yb );
		if ( y >= yb ) {
			w = pow( max( sin( 3.14159 * min( 1.0, 0.5 + 0.5 * g ) ), 0.0 ), 0.85 );
		} else {
			float q = ( yb - y ) / yb;
			w = sqrt( max( 1.0 - pow( q, 1.6 ), 0.0 ) ) * 0.98;
			cut = y < 0.1 && ax < 0.2 * ( 1.0 - y / 0.1 );
		}
		w *= rag;
	} else if ( part < 8.5 || ( part > 9.5 && part < 10.5 ) ) {
		// heliconia / bird of paradise: paddle blade, torn along the lateral veins (more on old leaves)
		w = pow( max( sin( 3.14159 * min( y * 1.02, 1.0 ) ), 0.0 ), 0.5 ) * ( 1.0 - 0.3 * vegSmooth( 0.75, 1.0, y ) ) * rag;
		float xl = y * 22.0 + ax * 1.2 + sin( y * 31.0 + fseed * 10.0 ) * 0.3;
		float k = floor( xl );
		float r1 = vegHash12( vec2( k + (( x > 0.0 ) ? ( 40.0) : ( 0.0)), fseed * 7.7 ) );
		float r2 = vegHash12( vec2( k + 0.5, fseed * 3.3 + seed ) );
		float fx = abs( fract( xl ) - 0.5 );
		cut = r1 < (( part > 9.5 ) ? ( 0.2) : ( 0.12)) + age * 0.45 && ax / max( w, 0.05 ) > mix( 0.25, 0.8, r2 ) && fx > 0.44;
	} else if ( part < 9.5 ) {
		// bract: boat-shaped, pointed
		w = sin( 3.14159 * min( 1.0, 0.15 + y * 0.9 ) ) * ( 1.0 - 0.4 * vegSmooth( 0.7, 1.0, y ) );
	} else {
		// bird of paradise flower pieces: pointed
		w = sin( 3.14159 * min( 1.0, 0.1 + y * 0.9 ) ) * ( 1.0 - 0.5 * vegSmooth( 0.6, 1.0, y ) );
	}
	if ( part < 7.5 ) {
		float dmg = vegNoise( vec2( y * 26.0 + fseed * 17.0, x * 11.0 + seed * 9.0 ) );
		cut = cut || dmg > 0.95 - age * 0.08;
	}
	VegBroad o;
	o.w = w;
	o.cut = cut;
	return o;
}

vec3 vegBroadAlbedo( float part, float y, float x, float age, float W, float fseed, float seed, float iv, float hGround ) {
	float ax = abs( x );
	float fr = vegHash12( vec2( fseed * 51.3, seed * 17.9 ) );
	float n1 = vegNoise( vec2( y * 9.0 + fseed * 13.0, x * 4.0 ) );
	float n2 = vegNoise( vec2( y * 37.0 + fseed * 3.0, x * 17.0 + seed * 5.0 ) );
	vec3 c = vec3( 0.0 );
	if ( part < 6.5 ) {
		// monstera: deep glossy green, juvenile leaves lighter yellow-green, old ones yellowing
		vec3 g = mix( vec3( 0.015996, 0.043735, 0.007499 ), vec3( 0.031896, 0.078187, 0.012286 ), iv * 0.6 + fr * 0.4 );
		g = mix( vec3( 0.078187, 0.158961, 0.021219 ), g, vegSmooth( 0.1, 0.35, age ) );
		g = mix( g, vec3( 0.323143, 0.283149, 0.048172 ), vegSmooth( 0.85, 0.97, age ) * ( 0.6 + 0.4 * n1 ) );
		c = g * ( n1 * 0.16 + 0.92 );
		// primary veins a touch paler, midrib pale
		float L = W / 0.47;
		float p = ( ( y - 0.16 ) * L - 0.55 * ax * W ) / ( L * 0.8 / 5.5 ) + fseed * 0.37;
		float rib = vegSmooth( 0.1, 0.0, abs( fract( p ) - 0.5 ) ) * step( 0.16, y );
		c = c * ( 1.0 + rib * 0.12 );
		c = mix( c, vec3( 0.215861, 0.318547, 0.068478 ), vegSmooth( 0.03, 0.0, ax * W ) * 0.7 );
	} else if ( part < 7.5 ) {
		// elephant ear: mid green, pale veins radiating from where the petiole joins
		vec3 g = mix( vec3( 0.033105, 0.097587, 0.012983 ), vec3( 0.068478, 0.165132, 0.021219 ), iv * 0.6 + fr * 0.4 );
		g = mix( g, vec3( 0.313989, 0.283149, 0.049707 ), vegSmooth( 0.85, 0.97, age ) * ( 0.6 + 0.4 * n1 ) );
		float ang = atan( ax * W, ( y - 0.3 ) * W / 0.4 );
		float vein = vegSmooth( 0.1, 0.0, abs( fract( ang * 2.6 ) - 0.5 ) - 0.38 ) * 0.7;
		c = g * ( n1 * 0.14 + 0.93 );
		c = mix( c, vec3( 0.212231, 0.304987, 0.097587 ), vein * 0.35 + vegSmooth( 0.025, 0.0, ax * W ) * step( 0.3, y ) * 0.5 );
	} else if ( part > 10.5 ) {
		// bird of paradise flower: beak green-grey with a purple-red keel, orange sepals, blue tongue
		vec3 beak = mix( mix( vec3( 0.104616, 0.147027, 0.068478 ), vec3( 0.147027, 0.028426, 0.042311 ), vegSmooth( 0.3, 0.9, ax ) * 0.7 ), vec3( 0.527115, 0.162029, 0.042311 ), vegSmooth( 0.8, 1.0, y ) * 0.4 );
		vec3 sepal = mix( vec3( 0.745404, 0.174647, 0.011612 ), vec3( 0.871367, 0.323143, 0.023153 ), n1 );
		vec3 tongue = mix( vec3( 0.025187, 0.049707, 0.323143 ), vec3( 0.051269, 0.097587, 0.479320 ), n1 );
		return (( age > 0.75 ) ? ( tongue) : ( (( age > 0.25 ) ? ( sepal) : ( beak))));
	} else if ( part > 9.5 ) {
		// bird of paradise leaf: glaucous grey-green, pale midrib
		vec3 g = mix( vec3( 0.048172, 0.102242, 0.036889 ), vec3( 0.078187, 0.144128, 0.056128 ), iv * 0.6 + fr * 0.4 );
		g = mix( g, vec3( 0.274677, 0.254152, 0.068478 ), vegSmooth( 0.8, 0.95, age ) );
		c = g * ( n1 * 0.1 + 0.95 );
		c = mix( c, vec3( 0.366253, 0.391572, 0.187821 ), vegSmooth( 0.015, 0.0, ax * W ) * 0.6 );
	} else if ( part < 8.5 ) {
		vec3 g = mix( vec3( 0.036889, 0.109462, 0.014444 ), vec3( 0.070360, 0.168269, 0.022174 ), iv * 0.6 + fr * 0.4 );
		g = mix( g, vec3( 0.274677, 0.254152, 0.042311 ), vegSmooth( 0.8, 0.95, age ) );
		c = g * ( ( sin( y * 180.0 + ax * 30.0 ) * 0.5 + 0.5 ) * 0.06 + 0.95 ) * ( n1 * 0.12 + 0.94 );
		c = mix( c, vec3( 0.401978, 0.479320, 0.155926 ), vegSmooth( 0.02, 0.0, ax * W ) * 0.7 );
	} else {
		// heliconia bract: scarlet, yellow lip, green tip on the youngest (top) bracts
		c = mix( vec3( 0.270498, 0.010330, 0.006049 ), vec3( 0.508881, 0.023153, 0.010330 ), n1 * 0.6 + fr * 0.4 );
		c = mix( c, vec3( 0.768151, 0.508881, 0.039546 ), vegSmooth( 0.62, 0.9, ax ) );
		c = mix( c, vec3( 0.149960, 0.254152, 0.027321 ), vegSmooth( 0.8, 1.0, y ) * vegSmooth( 0.6, 1.0, age ) * 0.7 );
		return c;
	}
	// weathering: browned dry margins and tips, fungal spots, splashed soil on low leaves
	float edge = vegSmooth( 0.8, 1.0, ax + n2 * 0.25 - 0.1 ) * ( 0.25 + age * 0.9 );
	c = mix( c, mix( vec3( 0.198069, 0.132868, 0.040915 ), vec3( 0.102242, 0.059511, 0.021219 ), n2 ), vegSat( edge ) * 0.85 );
	float spot = vegNoise( vec2( y * 14.0 + fseed * 9.0, x * 6.0 + seed * 3.0 ) );
	c = mix( c, vec3( 0.111932, 0.088656, 0.033105 ), vegSmooth( 0.86, 0.93, spot ) * 0.5 * ( 0.4 + age ) );
	c = mix( c, vec3( 0.149960, 0.107023, 0.059511 ), vegSmooth( 0.55, 0.0, hGround ) * vegSmooth( 0.5, 0.75, n2 ) * 0.5 );
	// dead leaves: brown and papery
	c = mix( c, mix( vec3( 0.155926, 0.093059, 0.034340 ), vec3( 0.274677, 0.194618, 0.076185 ), n1 ), vegSmooth( 0.93, 0.99, age ) );
	return c;
}

vec3 vegBroadStem( float part, float a, float f, float seed, float age ) {
	float n = vegNoise( vec2( a * 6.0, f * 30.0 + seed * 11.0 ) );
	if ( part < 6.5 ) { return mix( vec3( 0.068478, 0.144128, 0.023153 ), vec3( 0.107023, 0.201556, 0.033105 ), n ) * mix( 1.0, 0.8, vegSmooth( 0.7, 1.0, age ) ); }
	if ( part < 7.5 ) { return mix( vec3( 0.093059, 0.144128, 0.034340 ), vec3( 0.109462, 0.068478, 0.045186 ), n * 0.5 ); }
	if ( part < 8.5 ) { return mix( mix( vec3( 0.068478, 0.147027, 0.027321 ), vec3( 0.119538, 0.184475, 0.042311 ), n ), vec3( 0.102242, 0.068478, 0.029557 ), vegSmooth( 0.6, 0.8, vegNoise( vec2( a * 3.0, f * 8.0 + seed * 5.0 ) ) ) * 0.6 ); }
	if ( part > 9.5 ) { return mix( vec3( 0.090842, 0.132868, 0.068478 ), vec3( 0.152926, 0.181164, 0.097587 ), n ); }
	return vec3( 0.270498, 0.010330, 0.006049 );
}

bool vegPlantMask() {
	vec2 st = vNativeUv;
	float s = st.x;
	float t = st.y;
	float fwS = fwidth( s ); // evaluated in uniform control flow, before the branches
	vec4 aMat = vNativePart;
	float part = aMat.x; float age = aMat.y; float Ll = aMat.z; float fseed = aMat.w;
	float seed = vNativeSeed;
	float m = 1.0;
	if ( part > 0.5 && part < 1.5 ) {
		// coconut frond: ~95 narrow leaflets per side (100-125 on a real frond), separated by gaps
		// that show the sky; leaflets bunch and spread irregularly, some are short, split or torn
		// away (runs of missing leaflets, more on old fronds)
		float N = 95.0;
		float x = s * N + ( vegNoise( vec2( s * 7.0, fseed * 23.0 + seed * 3.0 ) ) - 0.5 ) * 2.2;
		float k = floor( x );
		float r1 = vegHash12( vec2( k, fseed * 91.7 ) );
		float r2 = vegHash12( vec2( k * 1.37 + 3.1, fseed * 17.3 + seed * 5.0 ) );
		float fx = fract( x ) - 0.5 - ( r1 - 0.5 ) * 0.35;
		float tEnd = mix( 0.72, 1.0, r2 ) * (( r1 < 0.06 ) ? ( 0.45) : ( 1.0));
		float tt = t / tEnd;
		float hw = pow( max( 1.0 - tt, 0.0 ), 0.6 ) * 0.22 * ( vegSmooth( 0.0, 0.1, tt ) * 0.4 + 0.6 );
		// split leaflets: a slit from the tip back along the midvein
		bool split = r2 > 0.9 && tt > mix( 0.35, 0.7, r1 ) && abs( fx ) < hw * 0.3;
		// torn-out runs of leaflets
		bool torn = vegNoise( vec2( k * 0.21 + seed * 17.0, fseed * 37.0 ) ) > 0.83 - age * 0.2 && s > 0.3;
		// sub-pixel leaflets widen instead of aliasing (fronds turn solid in the distance)
		float hwE = max( hw, min( fwS * ( N * 0.6 ), 0.5 ) * (( tt < 1.0 ) ? ( 1.0) : ( 0.0)) );
		bool leaf = abs( fx ) < hwE && tt < 1.0 && s > 0.06 && ! split && ! torn;
		bool rachis = t * Ll < 0.026;
		m = (( leaf || rachis ) ? ( 1.0) : ( 0.0));
	} else if ( part > 1.5 && part < 2.5 ) {
		// fern: rounded pinnae
		float N = 26.0;
		float x = s * N;
		float k = floor( x );
		float r2 = vegHash12( vec2( k, fseed * 31.1 ) );
		float fx = fract( x ) - 0.5;
		float tt = t / mix( 0.8, 1.0, r2 );
		float hw = sqrt( max( 1.0 - tt * tt, 0.0 ) ) * 0.34;
		float hwE = max( hw, min( fwS * ( N * 0.6 ), 0.5 ) * (( tt < 1.0 ) ? ( 1.0) : ( 0.0)) );
		bool leaf = abs( fx ) < hwE && tt < 1.0 && s > 0.04;
		bool rachis = t * Ll < 0.006;
		m = (( leaf || rachis ) ? ( 1.0) : ( 0.0));
	} else if ( part > 2.5 && part < 3.5 && s >= 0.0 ) {
		// banana: full blade, torn along lateral veins, ragged edge
		float x = s * 13.0 + sin( s * 31.0 + fseed * 10.0 ) * 0.35;
		float k = floor( x );
		float r1 = vegHash12( vec2( k, fseed * 7.7 ) );
		float r2 = vegHash12( vec2( k + 0.5, fseed * 3.3 + seed ) );
		float fx = abs( fract( x ) - 0.5 );
		// dead leaves are shredded
		float dead = step( 0.8, age );
		// wind-torn strips: most tears start at the margin and run in along the veins, more on older
		// leaves; dead leaves are shredded
		bool tear = r1 < mix( 0.45 + age * 0.6, 0.95, dead ) && t > mix( 0.12, 0.75, r2 ) * mix( 1.0, 0.4, dead ) && fx > mix( 0.45, 0.37, r2 ) - dead * 0.12;
		bool edge = t < 0.985 - vegNoise( vec2( s * 60.0, fseed * 9.0 ) ) * 0.07;
		m = (( ! tear && edge ) ? ( 1.0) : ( 0.0));
	} else if ( part > 5.5 && s >= 0.0 ) {
		// broadleaf blades (petioles, s < 0, are kept whole)
		VegBroad sh = vegBroadShape( part, s, t, age, Ll, fseed, seed );
		m = (( abs( t ) < sh.w && ! sh.cut ) ? ( 1.0) : ( 0.0));
	}
	return m > 0.5;
}

vec3 vegPlantAlbedo() {
	vec2 st = vNativeUv;
	float s = st.x;
	float t = st.y;
	vec4 aMat = vNativePart;
	float part = aMat.x; float age = aMat.y; float Ll = aMat.z; float fseed = aMat.w;
	float seed = vNativeSeed;
	
	vec3 col = vec3( 0.0 );
	float iv = vegHash12( vec2( seed * 37.1, 1.7 ) );
	if ( part < 1.5 ) {
		// age (aMat.y): 0 young upper fronds (lighter yellow-green) .. 0.55 old lower fronds (olive,
		// yellowing); 1 = the two hanging fronds, whose state is picked per tree and frond (one crown
		// mesh is shared): still olive, yellowing or dead brown
		float fr = vegHash12( vec2( fseed * 51.3, seed * 17.9 ) );
		float a = vegSat( age / 0.55 );
		vec3 g = mix( vec3( 0.168269, 0.262251, 0.033105 ), vec3( 0.057805, 0.114435, 0.020289 ), vegSmooth( 0.0, 0.35, a ) );
		g = mix( g, vec3( 0.141263, 0.162029, 0.028426 ), vegSmooth( 0.55, 1.0, a ) );
		// per tree: yellower or bluer greens; per frond: value
		g = mix( g, g * vec3( 1.12, 1.02, 0.78 ), iv * 0.8 );
		g = mix( g, g * vec3( 0.86, 0.98, 1.08 ), ( 1.0 - iv ) * 0.5 );
		g = g * mix( 0.82, 1.1, fr );
		// leaflets: darker toward their tips, paler at the base, each a little different
		float kL = floor( s * 95.0 );
		float perLeaf = vegHash12( vec2( kL, fseed * 13.1 ) );
		vec3 c = g * mix( 1.08, 0.86, vegSmooth( 0.2, 1.0, t ) ) * ( perLeaf * 0.22 + 0.9 );
		// browned, dried tips on some leaflets (more on old fronds)
		float tipK = vegSmooth( 0.72, 0.97, t ) * step( 0.55 - a * 0.35, vegHash12( vec2( kL * 1.7, fseed * 5.3 + seed ) ) );
		c = mix( c, mix( vec3( 0.262251, 0.194618, 0.068478 ), vec3( 0.155926, 0.104616, 0.040915 ), perLeaf ), tipK * 0.85 );
		// hanging fronds
		float hangK = vegSmooth( 0.8, 0.95, age );
		float state = vegHash12( vec2( fseed * 7.1, seed * 29.3 ) );
		vec3 yellowing = mix( vec3( 0.274677, 0.254152, 0.045186 ), vec3( 0.351533, 0.254152, 0.059511 ), perLeaf );
		vec3 deadC = mix( vec3( 0.194618, 0.127438, 0.051269 ), vec3( 0.107023, 0.068478, 0.029557 ), perLeaf );
		vec3 hangC = (( state > 0.62 ) ? ( deadC) : ( (( state > 0.35 ) ? ( yellowing) : ( c * 0.9))));
		c = mix( c, hangC, hangK );
		// midrib: pale yellow on young fronds, straw on old, brown when dead
		bool rachis = t * Ll < 0.026;
		vec3 rib = mix( mix( vec3( 0.450786, 0.381326, 0.116971 ), vec3( 0.313989, 0.250158, 0.076185 ), a ), vec3( 0.158961, 0.102242, 0.042311 ), hangK * step( 0.62, state ) );
		col = (( rachis ) ? ( rib) : ( c));
	} else if ( part < 2.5 ) {
		vec3 c = mix( vec3( 0.034340, 0.107023, 0.014444 ), vec3( 0.090842, 0.215861, 0.025187 ), vegSmooth( 0.1, 1.0, s ) * 0.6 + iv * 0.4 );
		col = c * mix( 0.85, 1.1, vegHash12( vec2( floor( s * 26.0 ), fseed ) ) );
	} else if ( part < 3.5 ) {
		if ( s < 0.0 ) {
			// banana pseudostem: overlapping sheaths (vertical streaks), brown / purple-black blotches,
			// dry brown sheath fibre peeling low down
			float f = ( s + 1.0 ) * 2.0;
			float a = t;
			float streakS = vegNoise( vec2( a * 26.0, f * 3.0 + fseed * 7.0 ) );
			float blotch = vegNoise( vec2( a * 9.0, f * 6.0 + fseed * 13.0 ) );
			vec3 gS = mix( vec3( 0.090842, 0.135633, 0.027321 ), vec3( 0.155926, 0.205079, 0.042311 ), streakS * 0.7 + iv * 0.3 );
			gS = mix( gS, vec3( 0.042311, 0.023153, 0.021219 ), vegSmooth( 0.6, 0.8, blotch ) * 0.6 );
			float dry = vegSmooth( 0.45, 0.7, vegNoise( vec2( a * 14.0 + 3.0, f * 2.5 + fseed * 19.0 ) ) ) * vegSmooth( 0.8, 0.2, f );
			col = mix( gS, mix( vec3( 0.144128, 0.084376, 0.033105 ), vec3( 0.270498, 0.194618, 0.084376 ), streakS ), dry * 0.9 );
		} else {
			// blade: muted green (per plant and leaf), paler midrib, faint lateral veins; dried, browned
			// margins and torn strip edges; old leaves yellowing; dead ones brown and papery
			float lf = vegHash12( vec2( fseed * 23.1, seed * 3.7 ) );
			vec3 base = mix( vec3( 0.049707, 0.114435, 0.017642 ), vec3( 0.090842, 0.174647, 0.026241 ), iv * 0.55 + lf * 0.45 );
			base = mix( base, vec3( 0.201556, 0.205079, 0.035601 ), vegSmooth( 0.35, 0.6, age ) * 0.55 );
			float vein = ( sin( s * 260.0 ) * 0.5 + 0.5 ) * 0.07;
			float mott = vegNoise( vec2( s * 11.0 + fseed * 3.0, t * 4.0 ) );
			vec3 c = base * ( vein + 0.94 ) * ( mott * 0.14 + 0.93 );
			c = mix( c, vec3( 0.396755, 0.434154, 0.155926 ), vegSmooth( 0.05, 0.0, t ) * 0.75 ); // midrib
			float xs = s * 13.0 + sin( s * 31.0 + fseed * 10.0 ) * 0.35;
			float stripEdge = vegSmooth( 0.36, 0.47, abs( fract( xs ) - 0.5 ) ) * vegSmooth( 0.4, 0.8, t ) * ( 0.3 + age );
			float dryEdge = vegSmooth( 0.72, 1.0, t + ( vegNoise( vec2( s * 25.0, fseed * 4.0 ) ) - 0.5 ) * 0.3 ) * ( 0.45 + age * 0.8 );
			vec3 brownC = mix( vec3( 0.147027, 0.090842, 0.030713 ), vec3( 0.274677, 0.194618, 0.064803 ), mott );
			c = mix( c, brownC, vegSat( max( dryEdge, stripEdge * 0.6 ) ) * 0.85 );
			vec3 deadC = mix( vec3( 0.111932, 0.068478, 0.025187 ), vec3( 0.238398, 0.162029, 0.068478 ), vegNoise( vec2( s * 18.0, t * 3.0 + fseed * 5.0 ) ) );
			c = mix( c, deadC, vegSmooth( 0.85, 0.95, age ) );
			col = c;
		}
	} else if ( part > 5.5 ) {
		float hGround = vNativeHeight;
		if ( s < 0.0 ) {
			col = vegBroadStem( part, t, ( s + 1.0 ) * 2.0, fseed, age );
		} else {
			col = vegBroadAlbedo( part, s, t, age, Ll, fseed, seed, iv, hGround );
		}
	} else {
		// coconuts: green -> yellow -> brown
		col = mix( mix( vec3( 0.138432, 0.181164, 0.023153 ), vec3( 0.332452, 0.254152, 0.034340 ), vegSmooth( 0.3, 0.7, age ) ), vec3( 0.107023, 0.052861, 0.015996 ), vegSmooth( 0.82, 0.95, age ) );
	}
	return col;
}
vec3 vegPick4( float s4, vec3 a, vec3 b, vec3 c, vec3 d ) { return (( s4 < 0.5 ) ? ( a) : ( (( s4 < 1.5 ) ? ( b) : ( (( s4 < 2.5 ) ? ( c) : ( d)))))); }
vec3 vegPick3( float s3, vec3 a, vec3 b, vec3 c ) { return (( s3 < 0.5 ) ? ( a) : ( (( s3 < 1.5 ) ? ( b) : ( c)))); }
float vegTreeSpecies( float seed ) { return floor( fract( seed * 5.31 ) * 4.0 ); }
// shrubs: 0 sea grape 45 %, 1 croton 15 %, 2 hibiscus 40 %
float vegShrubSpecies( float seed ) {
	float h = fract( seed * 3.17 );
	return (( h < 0.45 ) ? ( 0.0) : ( (( h < 0.6 ) ? ( 1.0) : ( 2.0))));
}

// base leaf colour of an instance (species, per-card random cr, per-instance tint)
vec3 vegCanopyLeafColor( float seed, float cr, bool isShrub ) {
	float spT = vegTreeSpecies( seed ); float spS = vegShrubSpecies( seed );
	// tree species: dark glossy (bronze flush), fresh mid green, yellow-green, blue-green
	// (Caribbean hillside forest: deep, olive and yellow-greens, muted, with a few dry / bronze
	// and flowering crowns)
	vec3 t0 = mix( mix( vec3( 0.021219, 0.042311, 0.010960 ), vec3( 0.036889, 0.068478, 0.016807 ), cr ), vec3( 0.111932, 0.068478, 0.027321 ), vegSmooth( 0.96, 0.995, cr ) * 0.5 );
	vec3 t1 = mix( vec3( 0.034340, 0.066626, 0.013702 ), vec3( 0.064803, 0.107023, 0.020289 ), cr );
	vec3 t2 = mix( vec3( 0.078187, 0.102242, 0.020289 ), vec3( 0.127438, 0.144128, 0.030713 ), cr );
	vec3 t3 = mix( vec3( 0.023153, 0.043735, 0.023153 ), vec3( 0.042311, 0.068478, 0.036889 ), cr );
	vec3 s0 = mix( vec3( 0.049707, 0.090842, 0.015996 ), vec3( 0.084376, 0.132868, 0.023153 ), cr );
	vec3 s1 = mix( vec3( 0.025187, 0.054480, 0.012983 ), vec3( 0.057805, 0.093059, 0.013702 ), cr );
	vec3 s2 = mix( vec3( 0.034340, 0.084376, 0.011612 ), vec3( 0.061246, 0.132868, 0.017642 ), cr );
	float iv = vegHash12( vec2( seed * 17.3, 4.1 ) );
	float iv2 = vegHash12( vec2( seed * 5.9, 8.3 ) );
	vec3 c = (( isShrub ) ? ( vegPick3( spS, s0, s1, s2 )) : ( vegPick4( spT, t0, t1, t2, t3 ))) * ( iv * 0.36 + 0.74 );
	// a few trees dry / dropping leaves (brown-olive), or flowering (flamboyant, orange-red)
	float treeK = (( isShrub ) ? ( 0.0) : ( 1.0));
	float dry = step( iv2, 0.035 ) * treeK;
	c = mix( c, mix( vec3( 0.107023, 0.084376, 0.034340 ), vec3( 0.155926, 0.102242, 0.042311 ), cr ), dry * 0.5 );
	float flower = step( 0.988, iv2 ) * treeK * step( 0.5, cr );
	c = mix( c, vec3( 0.254152, 0.068478, 0.025187 ), flower * 0.5 );
	return mix( vec3( vegLuminance( c ) ), c, 0.85 );
}

vec3 vegBarkColor( float n, float n2 ) {
	return mix( mix( vec3( 0.029557, 0.023153, 0.015996 ), vec3( 0.107023, 0.090842, 0.066626 ), n * 0.6 + n2 * 0.4 ), vec3( 0.198069, 0.198069, 0.144128 ), vegSmooth( 0.64, 0.8, n2 ) * 0.3 );
}

// leaf-cluster tile of a card: trees broad / narrow leaves by species, shrubs round / narrow
float vegLeafTile( float seed, bool isShrub ) {
	float spT = vegTreeSpecies( seed ); float spS = vegShrubSpecies( seed );
	return (( isShrub ) ? ( (( spS == 1.0 ) ? ( 3.0) : ( 2.0))) : ( (( fract( spT * 0.5 ) > 0.25 ) ? ( 1.0) : ( 0.0))));
}

// alpha-test threshold compensating the coverage loss of the minified (mipmapped) leaf texture
float vegCoverageThreshold( vec2 st ) {
	float lod = log2( max( max( fwidth( st.x ), fwidth( st.y ) ) * 256.0, 1e-4 ) );
	return mix( 0.5, 0.3, vegSat( lod / 4.0 ) );
}


`,be=`./`+m;async function xe(){let e=await fetch(be);if(!e.ok)throw Error(`Native leaf atlas could not be loaded.`);let t=await createImageBitmap(await e.blob(),{colorSpaceConversion:`none`,premultiplyAlpha:`none`,imageOrientation:`none`});if(t.width!==q.size||t.height!==q.size)throw t.close(),Error(`Native leaf atlas dimensions differ.`);let n=new B.Texture(t);return n.name=`native-source-leaf-clusters`,n.colorSpace=B.NoColorSpace,n.flipY=!1,n.wrapS=n.wrapT=B.RepeatWrapping,n.magFilter=B.LinearFilter,n.minFilter=B.LinearMipmapLinearFilter,n.generateMipmaps=!0,n.anisotropy=8,n.needsUpdate=!0,n.addEventListener(`dispose`,()=>t.close()),n}var J=e=>`vec3(${new B.Color(e).toArray().map(e=>e.toFixed(6)).join(`,`)})`,Se=`
 bool isShrub=vNativePart.x>2.5;
 float tile=vegLeafTile(vNativeSeed,isShrub);
 vec2 atlasUv=(vec2(fract(tile*.5)*2.0,floor(tile*.5))+clamp(vNativeUv,vec2(.004),vec2(.996)))*.5;
 // The offline PNG's first row is logical v=0; no render-target inversion is needed.
 vec4 L=texture2D(nativeLeafAtlas,atlasUv);
 vec3 face=cross(dFdx(-vViewPosition),dFdy(-vViewPosition));
 float facing=abs(dot(normalize(face),normalize(vViewPosition)));
 float threshold=vegCoverageThreshold(vNativeUv)+(1.0-vegSmooth(.08,.35,facing))*.45;
 if(L.r<=threshold)discard;
 float cell=L.b,ao=vNativePart.y,spS=vegShrubSpecies(vNativeSeed);
 vec3 c=vegCanopyLeafColor(vNativeSeed,vNativePart.z,isShrub)*(L.g*1.4);
 c=mix(c,${J(8010274)},vegSmooth(.86,.98,cell)*.55*((isShrub&&spS<.5)?1.0:0.0));
 vec3 vari=fract(cell*7.3)>.5?${J(10127920)}:${J(8010274)};
 c=mix(c,vari,vegSmooth(.72,.9,cell)*.55*((isShrub&&spS==1.0)?1.0:0.0));
 if(isShrub&&spS>1.5&&cell>.92)c=${J(11740702)};
 c=mix(c,mix(${J(9075258)},${J(8273442)},step(.992,fract(cell*3.7))),step(.984,fract(cell*3.7))*(isShrub?0.0:1.0)*.6);
 c=mix(c,c*vec3(1.16,1.22,.92),vegSmooth(.62,1.0,ao)*.7);
 diffuseColor.rgb*=c*mix(.55,1.0,ao);
`,Ce=(e,t)=>e-t;function we(e,t){if(e.length<256||!Number.isFinite(t)||t<=0||t>140)return null;let n=new Map,r=[];for(let r=0;r<e.length;r++){let i=e[r],a=Math.floor(i.x/t),o=Math.floor(i.z/t);if(!Number.isSafeInteger(a)||!Number.isSafeInteger(o))return null;let s=n.get(a);s||n.set(a,s=new Map);let c=s.get(o);c||s.set(o,c=[]),c.push(r)}return{query(e,i){let a=2**-52*Math.max(1,Math.abs(e),Math.abs(i),t)*4,o=Math.floor((e-t-a)/t),s=Math.floor((e+t+a)/t),c=Math.floor((i-t-a)/t),l=Math.floor((i+t+a)/t);if(!Number.isSafeInteger(o)||!Number.isSafeInteger(s)||!Number.isSafeInteger(c)||!Number.isSafeInteger(l))return null;r.length=0;for(let e=o;e<=s;e++){let t=n.get(e);if(t)for(let e=c;e<=l;e++){let n=t.get(e);if(n)for(let e=0;e<n.length;e++)r.push(n[e])}}return r.sort(Ce),r}}}var Te=Object.freeze({backend:`webgl2`,backendQualification:`unqualified-optical-equivalence`,waterModel:`source-parameter analytic swell with broken-up shore foam and detail normals`,limitations:[`Original FFT, refraction, swash simulation and underwater optics are not reproduced.`,`Near plants use original source geometry and exact records; distant crowns use reduced source card geometry, not the original octahedral atlases.`,`Leaf alpha, wind and terrain microshading are GLSL approximations; grass density is applied to the ground without individual grass blades.`]}),Ee=e=>e-Math.floor(e),De=new B.Vector3(0,1,0);function Y(e,t=new B.Matrix4,n=!1){return t.compose(new B.Vector3(e.x,e.y,e.z),new B.Quaternion().setFromAxisAngle(De,e.yaw),new B.Vector3(e.s,e.s*(n?Math.abs(e.sy??1):1),e.s))}function Oe(e,{leafStride:t=1}={}){let n=new B.BufferGeometry;for(let t of[`position`,`normal`,`uv`,`aVeg`,`aMat`]){let r=e.getAttribute(t);if(!r)continue;let i=new Float32Array(r.count*r.itemSize);for(let e=0;e<r.count;e++)for(let t=0;t<r.itemSize;t++)i[e*r.itemSize+t]=r.getComponent(e,t);n.setAttribute(t,new B.BufferAttribute(i,r.itemSize))}let r=[],i=n.getAttribute(`aMat`),a=0;for(let n=0;n<e.index.count;n+=3){let o=e.index.getX(n);(i.getX(o)===1||i.getX(o)===4)&&t>1&&Math.floor(a++/2)%t!==0||r.push(o,e.index.getX(n+1),e.index.getX(n+2))}return n.setIndex(r),n.computeBoundingSphere(),n}function X(e,t,n,r=!1,i=!1){let a=e.attributes.position.array,o=e.attributes.normal;o||(o=new B.BufferAttribute(new Float32Array(a.length),3),e.setAttribute(`normal`,o));let s=o.array,c=(e,t,n,r=-1)=>{let i=e*3,o=t*3,c=n*3,l=a[c]-a[o],u=a[c+1]-a[o+1],d=a[c+2]-a[o+2],f=a[i]-a[o],p=a[i+1]-a[o+1],m=a[i+2]-a[o+2],h=u*m-d*p,g=d*f-l*m,_=l*p-u*f;if(r>=0){let e=r*3;s[e]+=h,s[e+1]+=g,s[e+2]+=_}else s[i]+=h,s[i+1]+=g,s[i+2]+=_,s[o]+=h,s[o+1]+=g,s[o+2]+=_,s[c]+=h,s[c+1]+=g,s[c+2]+=_},l=e=>{let t=e*3,n=s[t],r=s[t+1],i=s[t+2],a=1/(Math.sqrt(n*n+r*r+i*i)||1);s[t]=n*a,s[t+1]=r*a,s[t+2]=i*a};if(!r&&!i){s.fill(0);for(let e=0;e<n-1;e++)for(let n=0;n<t-1;n++){let r=e*t+n;c(r,r+t,r+1),c(r+1,r+t,r+t+1)}for(let e=0;e<t*n;e++)l(e)}else for(let e=0;e<n;e++){let a=i&&e>=n-2?0:r?Math.max(0,t-2):t;for(let r=a;r<t;r++){let i=e*t+r,a=i*3;s[a]=s[a+1]=s[a+2]=0;for(let a=Math.max(0,e-1);a<=Math.min(n-2,e);a++)for(let e=Math.max(0,r-1);e<=Math.min(t-2,r);e++){let n=a*t+e,r=n+t,o=n+1,s=r+1;(i===n||i===r||i===o)&&c(n,r,o,i),(i===o||i===r||i===s)&&c(o,r,s,i)}l(i)}}o.needsUpdate=!0}function ke(e,t,n=1){let r=Math.ceil(t.width/n)+1,i=Math.ceil(t.height/n)+1,a=new Float32Array(r*i*3),o=new Float32Array(r*i*2),s=new(r*i-1>=65535?Uint32Array:Uint16Array)((r-1)*(i-1)*6),c=0;for(let l=0;l<i;l++)for(let u=0;u<r;u++){let d=Math.min(e.res-1,t.x+Math.min(t.width,u*n)),f=Math.min(e.res-1,t.z+Math.min(t.height,l*n)),p=l*r+u;a[p*3]=e.origin+(d+.5)*e.texel,a[p*3+1]=e.heights[f*e.res+d],a[p*3+2]=e.origin+(f+.5)*e.texel,o[p*2]=u/(r-1),o[p*2+1]=l/(i-1),u<r-1&&l<i-1&&(s[c++]=p,s[c++]=p+r,s[c++]=p+1,s[c++]=p+1,s[c++]=p+r,s[c++]=p+r+1)}let l=new B.BufferGeometry;return l.setAttribute(`position`,new B.BufferAttribute(a,3)),l.setAttribute(`uv`,new B.BufferAttribute(o,2)),l.setIndex(new B.BufferAttribute(s,1)),X(l,r,i),l}function Ae(e,t,n,r){if(t.id===r.id||t.x>r.x+r.width-1||t.z>r.z+r.height-1||t.x+t.width<r.x||t.z+t.height<r.z)return!1;let i=t.width+1,a=t.height+1,o=n.attributes.position,s=o.array,c=!1,l=!1,u=!1,d=(n,o)=>{let d=Math.min(e.res-1,t.x+n),f=Math.min(e.res-1,t.z+o);if(d<r.x||d>=r.x+r.width||f<r.z||f>=r.z+r.height)return;let p=(o*i+n)*3+1,m=e.heights[f*e.res+d];s[p]!==m&&(s[p]=m,c=!0,l||=n===i-1,u||=o===a-1)};for(let e=0;e<a-1;e++)d(i-1,e);for(let e=0;e<i;e++)d(e,a-1);return c?(o.needsUpdate=!0,X(n,i,a,l,u),n.boundingBox!==null&&n.computeBoundingBox(),n.boundingSphere!==null&&n.computeBoundingSphere(),!0):!1}function Z(e,t,n=4,r=B.UnsignedByteType){let i=new B.DataTexture(e,t,t,n===4?B.RGBAFormat:B.RedFormat,r);return i.magFilter=i.minFilter=r===B.FloatType?B.NearestFilter:B.LinearFilter,i.generateMipmaps=!1,i.flipY=!1,i.needsUpdate=!0,i}async function je(e){let t=[],n={palm:{},tree:{}};try{let r=(await Promise.allSettled([`palm`,`tree`].flatMap(r=>[[`albedo`,`map`],[`normal`,`normalMap`],[`orm`,`orm`]].map(async([i,a])=>{let o=e.vegetationTextures?.[r]?.[i],s=e.barkAssets?.find(e=>e.id===o);if(!s||s.mediaType!==`image/jpeg`)throw Error(`Missing portable WebGL bark resource.`);let c=await e.readAsset(o),l=await createImageBitmap(new Blob([c],{type:`image/jpeg`}));if(l.width!==s.width||l.height!==s.height)throw l.close(),Error(`WebGL bark dimensions differ.`);let u=new B.Texture(l);u.wrapS=u.wrapT=B.RepeatWrapping,u.colorSpace=i===`albedo`?B.SRGBColorSpace:B.NoColorSpace,u.needsUpdate=!0,u.addEventListener(`dispose`,()=>l.close()),t.push(u),n[r][a]=u})))).find(e=>e.status===`rejected`);if(r)throw r.reason;return{...n,dispose(){for(let e of t)e.dispose()}}}catch(e){for(let e of t)e.dispose();throw e}}var Me=`
attribute vec4 aVeg;attribute vec4 aMat;attribute vec4 iPlant;attribute vec4 iRecord;
uniform float nativeTime;uniform vec2 nativeWind;uniform vec2 nativeGust;uniform float nativeWindStrength;uniform sampler2D nativeDetail;
varying vec4 vNativePart;varying vec2 vNativeUv;
vec3 nativeRotate(vec3 v,vec3 axis){vec3 k=vec3(axis.z,0.0,-axis.x);vec3 c=cross(k,v);return v+c+cross(k,c)/(axis.y+1.0);}
vec3 nativePlantPosition(vec3 P){
 float u=aVeg.x,H=iPlant.z,seed=iPlant.w;vec3 leanDir=vec3(cos(iPlant.x),0.0,sin(iPlant.x));
 vec2 base=instanceMatrix[3].xz;vec2 gp=base-nativeGust;float g=smoothstep(.46,.6,texture2D(nativeDetail,gp/140.0).a*.62+texture2D(nativeDetail,gp/61.0+.37).a*.38);
 float w=nativeWindStrength,phase=seed*6.2832;vec2 wd=vec2(cos(iRecord.x)*nativeWind.x-sin(iRecord.x)*nativeWind.y,sin(iRecord.x)*nativeWind.x+cos(iRecord.x)*nativeWind.y);
 float sway=w*w*.014*(g*.9+.3)+sin(nativeTime*.83+phase)*w*.0065*(g+.45);float side=sin(nativeTime*.61+phase*1.7)*w*.0028;vec3 wind=vec3(wd.x,0.0,wd.y)*sway+vec3(-wd.y,0.0,wd.x)*side;
 if(iRecord.z>.5){P.xz+=vec2(wind.x,wind.z)*pow(max(P.y/12.5,0.0),2.0)*12.5;return P;}
 float c=fract(seed*7.31),fc=mix(u,u*(2.0-u),c),df=mix(1.0,2.0*(1.0-u),c);vec3 tangent=normalize(vec3(0,1,0)+leanDir*(iPlant.y*df)+wind*(u*2.0));
 vec3 stem=vec3(0,u*H,0)+(leanDir*(iPlant.y*fc)+wind*u*u)*H+nativeRotate(vec3(P.x,0,P.z),tangent);
 vec3 tip=normalize(vec3(0,1,0)+leanDir*(iPlant.y*(1.0-c))+wind*2.0),tilt=normalize(vec3(0,1,0)+tip);vec3 centre=vec3(0,H,0)+(leanDir*iPlant.y+wind)*H;vec3 crown=nativeRotate(P,tilt);
 float s=aVeg.y,ph=aVeg.w;float bend=s*s*4.5*(w*w*.16*(g*.8+.35)+sin(nativeTime*(ph*.5+1.3)+ph*23.0+phase)*w*.075*(g+.3));
 vec3 disp=vec3(wd.x,0,wd.y)*bend+vec3(0,sin(nativeTime*(ph+2.1)+ph*41.0)*s*s*w*.1-bend*.3,0);vec3 moved=normalize(crown+disp+vec3(0,.00001,0))*length(crown);return aMat.x<.5?stem:centre+moved;
}`;function Ne(e,t,n,r,i,a,o){let s=new B.MeshStandardMaterial({color:`#ffffff`,side:B.DoubleSide,roughness:.86});return s.alphaTest=.35,s.userData.nativeWindStrength=1,s.userData.nativeWindVector=n.value,s.onBeforeCompile=s=>{Object.assign(s.uniforms,{nativeTime:t,nativeWind:n,nativeGust:r,nativeWindStrength:{value:1},nativeDetail:{value:i},nativeBark:{value:a.map},nativeBarkNormal:{value:a.normalMap},nativeOrm:{value:a.orm},nativeLeafAtlas:{value:o}}),s.vertexShader=Me+`
`+s.vertexShader,s.vertexShader=s.vertexShader.replace(`#include <common>`,`#include <common>
varying float vNativeSeed;varying float vNativeHeight;`).replace(`#include <begin_vertex>`,`#include <begin_vertex>
 vNativePart=aMat;vNativeUv=uv;transformed=nativePlantPosition(transformed);vNativeSeed=iPlant.w;vNativeHeight=transformed.y*iRecord.y;`),s.fragmentShader=ye+`uniform sampler2D nativeBark;uniform sampler2D nativeBarkNormal;uniform sampler2D nativeOrm;
`+s.fragmentShader,s.fragmentShader=s.fragmentShader.replace(`#include <color_fragment>`,`#include <color_fragment>
 bool bark=vNativePart.x<.5${e===`tree`?` || vNativePart.x>4.5`:``};
 if(bark){diffuseColor.rgb*=texture2D(nativeBark,vNativeUv).rgb*texture2D(nativeOrm,vNativeUv).r;}else{
 ${e===`tree`?Se:`if(!vegPlantMask())discard;diffuseColor.rgb*=vegPlantAlbedo();`}
 }`),s.fragmentShader=s.fragmentShader.replace(`#include <roughnessmap_fragment>`,`#include <roughnessmap_fragment>\n if(vNativePart.x<.5${e===`tree`?` || vNativePart.x>4.5`:``})roughnessFactor=clamp(texture2D(nativeOrm,vNativeUv).g,.6,1.0);`),s.fragmentShader=s.fragmentShader.replace(`#include <normal_fragment_maps>`,`#include <normal_fragment_maps>\n if(vNativePart.x<.5${e===`tree`?` || vNativePart.x>4.5`:``}){vec3 barkN=texture2D(nativeBarkNormal,vNativeUv).xyz*2.0-1.0;vec3 p1=dFdx(-vViewPosition),p2=dFdy(-vViewPosition);vec2 t1=dFdx(vNativeUv),t2=dFdy(vNativeUv);vec3 tangent=normalize(p1*t2.y-p2*t1.y),bitangent=normalize(-p1*t2.x+p2*t1.x);normal=normalize(tangent*barkN.x*.65+bitangent*barkN.y*.65+normal*barkN.z);}`)},s.customProgramCacheKey=()=>`native-source-plants-webgl/2:`+e,s}function Pe(e,t,n,r,i){let o=_e(i),c=new B.Sphere,l=new B.Group,u=[],d=new B.Matrix4,f=0,p=new B.Vector3(1/0,1/0,1/0),m=new B.Vector3,_=null,y={palms:[ee,120,2800,!1],youngPalms:[g,0,140,!1],ferns:[v,0,58,!1],bananas:[T,0,120,!1],monsteras:[te,0,105,!1],elephantEars:[w,0,105,!1],heliconias:[R,0,105,!1],strelitzias:[a,0,105,!1],trees:[z,65,2800,!0],shrubs:[h,45,2800,!0]};for(let[t,[n,i,a,o]]of Object.entries(y)){let c=o?t===`trees`?3:2:t===`bananas`?2:1;for(let d=0;d<c;d++){let f=e.records[t].filter(e=>o?Math.floor(Ee(e.seed*7.77)*c)===d:t!==`bananas`||(e.seed<.5?0:1)===d);if(!f.length)continue;let p={poses:null,bounds:null},m=!o&&a<=140?we(f,a):null,h=t===`bananas`?n(d?23:9):n(),g=o?s(h.geometry,A,(d+(t===`shrubs`?3:0))*8):h.geometry;for(let e of i?[!1,!0]:[!1]){let n=t===`palms`&&e?b().geometry:null,s=Oe(n??g,{leafStride:e&&o?8:1}),c=f.length;n&&n.dispose(),s.setAttribute(`iPlant`,new B.InstancedBufferAttribute(new Float32Array(c*4),4)),s.setAttribute(`iRecord`,new B.InstancedBufferAttribute(new Float32Array(c*4),4));let d=new B.InstancedMesh(s,r[o?`tree`:`palm`],c);d.count=0,d.frustumCulled=!1,d.userData.mediaOcclusionPlant=o?`native-canopy-v1`:`native-palm-v1`,d.userData.nativePlantSpecies=t,d.userData.nativePlantDistant=e,l.add(d),u.push({mesh:d,records:f,occlusionCache:p,understoryIndex:m,species:t,canopy:o,distant:e,near:i,far:a})}g!==h.geometry&&g.dispose(),h.geometry.dispose()}}let x=null,S=!1,C=!1,E=new B.Matrix4,D=new B.Matrix4,O=new B.Matrix4,k=new B.Matrix4,j=new B.Vector3,M=new B.Frustum,N=new B.Matrix4,P=new B.Sphere;return{root:l,setOccluders(e){o.setOccluders(e),_=null},setOcclusionEnabled(e){o.setEnabled(e),_=null},updateView(e){e.getWorldDirection(j),e.updateMatrixWorld(),N.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),o.prepare(e,l),l.updateWorldMatrix(!0,!1);let t=r.tree.userData.nativeWindStrength===1&&Math.abs(r.tree.userData.nativeWindVector.length()-1)<1e-6,n=o.active&&t;if(_===e&&S===t&&O.equals(l.matrixWorld)&&(n&&C&&E.equals(N)&&x===o.signature||!n&&!C&&(i&&e!==i?E.equals(N):D.equals(e.projectionMatrix)&&p.distanceToSquared(e.position)<16&&m.dot(j)>.998)))return;_=e,p.copy(e.position),m.copy(j),E.copy(N),D.copy(e.projectionMatrix),O.copy(l.matrixWorld),x=o.signature,S=t,C=n,M.setFromProjectionMatrix(N),o.resetCounters(),f=0;let a=l.matrixWorld.equals(k);for(let t of u){let{mesh:r,occlusionCache:i}=t,s=r.geometry.getAttribute(`iPlant`),u=r.geometry.getAttribute(`iRecord`),p=0;if(t.canopy&&n&&!i.poses){let e=t.records.length;i.poses=new Float32Array(e*16),i.bounds=new Float64Array(e*4);for(let n=0;n<e;n++)Y(t.records[n],d,!0),d.toArray(i.poses,n*16),ve(r.geometry,t.records[n],d,c),i.bounds.set([c.center.x,c.center.y,c.center.z,c.radius],n*4)}let m=i.poses,h=i.bounds,g=t.understoryIndex?.query(e.position.x,e.position.z);for(let i=0,f=g?.length??t.records.length;i<f;i++){let f=g?g[i]:i,_=t.records[f],v=Math.hypot(_.x-e.position.x,_.z-e.position.z);if(!(v>t.far||t.near&&(t.distant?v<t.near:v>=t.near))&&(P.center.set(_.x,_.y+(_.H??5)*.5,_.z),P.radius=Math.max(4,_.H??0)*_.s+4,M.intersectsSphere(P))){if(t.canopy&&n){let e=f*4;if(a){if(o.rejectsXYZ(h[e],h[e+1],h[e+2],h[e+3]))continue}else if(c.center.fromArray(h,e),c.radius=h[e+3],c.applyMatrix4(l.matrixWorld),o.rejects(c))continue}m?d.fromArray(m,f*16):Y(_,d,t.canopy),r.setMatrixAt(p,d),s.setXYZW(p,(_.la??0)-_.yaw,_.l??0,(t.species===`bananas`?.02:_.H??1)/Math.max(.001,_.s),_.seed),u.setXYZW(p,_.yaw,_.s,+!!t.canopy,0),p++}}r.count=p,r.instanceMatrix.needsUpdate=!0,s.needsUpdate=u.needsUpdate=!0,f+=p}},stats:()=>({records:Object.values(e.records).filter(Array.isArray).reduce((e,t)=>e+t.length,0),displayed:f,batches:u.length,occlusion:{...o.stats(),retainedBytes:[...new Set(u.map(e=>e.occlusionCache))].reduce((e,t)=>e+(t.poses?.byteLength??0)+(t.bounds?.byteLength??0),0)},farPolicy:`every eighth distant leaf card; unqualified atlas equivalence`}),dispose(){for(let e of u)e.mesh.geometry.dispose();l.removeFromParent()}}}function Fe({normal:e,splat:t,rect:n,domain:r,detail:i,shore:a,grass:o,ready:s,coarse:c,time:l,windDirection:u=0}){let d=new B.MeshStandardMaterial({color:`#ffffff`,roughness:.9,side:B.DoubleSide});return d.onBeforeCompile=d=>{Object.assign(d.uniforms,{nativeNormal:{value:e},nativeSplat:{value:t},nativeRect:{value:new B.Vector4(...n)},nativeDomain:{value:new B.Vector2(r.origin,r.size)},nativeDetail:{value:i},nativeShore:{value:a},nativeGrass:{value:o},nativeReady:{value:s},nativeTime:l}),d.uniforms.nativeTerrainWind={value:new B.Vector2(Math.sin(u),Math.cos(u))},d.vertexShader=`varying vec3 vNativeWorld;
`+d.vertexShader,d.vertexShader=d.vertexShader.replace(`#include <begin_vertex>`,`#include <begin_vertex>
 vNativeWorld=(modelMatrix*vec4(transformed,1.0)).xyz;`),d.fragmentShader=`varying vec3 vNativeWorld;uniform sampler2D nativeNormal,nativeSplat,nativeDetail,nativeShore,nativeGrass,nativeReady;uniform vec4 nativeRect;uniform vec2 nativeDomain,nativeTerrainWind;uniform float nativeTime;
 // TerrainShading.js surface-gradient bump; bounded at grazing/degenerate facets.
 vec3 nativeTerrainBump(vec3 P,vec3 N,float hd){
  vec3 dx=dFdx(P),dy=dFdy(P),r1=cross(dy,N),r2=cross(N,dx);
  float det=dot(dx,r1),ad=abs(det),area=length(cross(dx,dy));
  vec3 grad=(r1*dFdx(hd)+r2*dFdy(hd))*sign(det);
  float frame=area/max(length(dx)*length(dy),1e-20),facet=ad/max(area,1e-20);
  grad*=min(1.0,ad*1.4/max(length(grad),1e-20))*smoothstep(.12,.35,frame)*smoothstep(.3,.6,facet);
  // Divide before normalization to avoid a near-zero vector on collapsed facets.
  return normalize(N-grad/max(ad,1e-20));
 }
`+d.fragmentShader,d.fragmentShader=d.fragmentShader.replace(`#include <color_fragment>`,`#include <color_fragment>
 vec2 domainUv=(vNativeWorld.xz-nativeDomain.x)/nativeDomain.y;
 ${c?`if(texture2D(nativeReady,domainUv).r>.5)discard;`:``}
 vec2 mapUv=(vNativeWorld.xz-nativeRect.xy)/nativeRect.zw;vec4 masks=texture2D(nativeSplat,mapUv),nr=texture2D(nativeNormal,mapUv);float h=vNativeWorld.y;
 vec4 a=texture2D(nativeDetail,vNativeWorld.xz/1.9),b=texture2D(nativeDetail,mat2(.2675,.9636,-.9636,.2675)*vNativeWorld.xz/6.7+.21),macro=texture2D(nativeDetail,vNativeWorld.xz/34.0+.13);
 vec4 fine=texture2D(nativeDetail,mat2(-.7374,.6755,-.6755,-.7374)*vNativeWorld.xz/.63+.53);
 // Captured normal RG = normal XZ, B = rockiness, A = baked AO.
 vec2 nxz=nr.rg*2.0-1.0;vec3 terrainN=normalize(vec3(nxz.x,sqrt(max(1.0-dot(nxz,nxz),.0025)),nxz.y));
 float slope=1.0-terrainN.y;
 float rock=smoothstep(.2,.65,nr.b+(a.r-.5)*.3+slope*.38);float sand=smoothstep(.3,.72,masks.r+(b.b-.5)*.5+(macro.a-.5)*.35)*(1.0-rock);float path=smoothstep(.2,.7,masks.g)*(1.0-rock);
 vec3 soil=mix(vec3(.10,.15,.035),vec3(.21,.26,.07),b.g);soil=mix(soil,vec3(.19,.12,.065),path);
 float grain=(min(a.b,.62)-.45)*.30+(min(fine.b,.62)-.45)*.20+(macro.a-.5)*.16;
 // Source Terrain.js: fixed 10.5 cm wind-ripple wavelength, smoothly warped;
 // filter by phase footprint instead of varying wavelength in world space.
 float phase=dot(vNativeWorld.xz,nativeTerrainWind)*(6.2832/.105)+b.a*24.0+a.a*7.0+macro.a*30.0;
 float rip=pow(sin(phase)*.5+.5,1.6);
 float trod=smoothstep(.52,.7,a.g+(b.g-.5)*.6)*smoothstep(.8,3.0,h);
 float windK=(1.0-smoothstep(.6,2.2,fwidth(phase)))*smoothstep(1.5,2.2,h)*(1.0-path)*(1.0-trod*.7)*smoothstep(.2,.5,macro.a+b.a*.3);
 float ripple=(rip-.5)*.12*windK;
 // Pale coral sand source palette, converted from source sRGB to linear.
 vec3 beach=mix(vec3(.656,.523,.319),vec3(.787,.674,.477),smoothstep(.3,.72,macro.a+smoothstep(.8,3.0,h)*.2));
 vec3 ground=mix(soil,beach*(1.0+grain+ripple)*(1.0-trod*.07)*(1.0-path*.07),sand);
 // Source TerrainShading.js: plates on cliff faces, height-warped strata and
 // dry upper-face lichen. One triplanar level reuses the existing detail map.
 vec3 w=pow(abs(terrainN),vec3(4.0));w/=max(dot(w,vec3(1.0)),1e-5);
 vec4 plates=texture2D(nativeDetail,vNativeWorld.zy/6.1)*w.x+texture2D(nativeDetail,vNativeWorld.xz/6.1+.37)*w.y+texture2D(nativeDetail,vNativeWorld.xy/6.1+.71)*w.z;
 float steep=1.0-smoothstep(.55,.85,terrainN.y),bandY=h+plates.a*2.5+macro.a*6.0;
 float strata=texture2D(nativeDetail,vec2(bandY/14.0,.13)).a;
 float strataAA=1.0-smoothstep(.15,.6,fwidth(bandY));
 float tone=plates.r*.65+a.r*.35+(macro.a-.5)*.7+(strata-.5)*.8*steep*strataAA;
 vec3 stone=mix(vec3(.0196,.0185,.0164),vec3(.0732,.0660,.0571),smoothstep(.1,.5,tone));
 stone=mix(stone,vec3(.1960,.1746,.1473),smoothstep(.5,.85,tone));
 stone*=smoothstep(.05,.25,plates.r)*.15+.85;
 float dryRock=smoothstep(2.6,4.0,h);
 float lichen=smoothstep(.6,.78,plates.g)*smoothstep(.2,.7,terrainN.y)*dryRock*smoothstep(.45,.65,macro.a);
 stone=mix(stone,vec3(.4480,.4480,.3672),lichen*.45);
 stone=mix(stone,vec3(.5705,.2140,.0331),smoothstep(.8,.88,plates.g)*dryRock*smoothstep(.5,.8,terrainN.y)*.3);
 float rockWet=1.0-smoothstep(.25,1.0,h+plates.a*.3);stone*=mix(1.0,.55,rockWet);
 ground=mix(ground,stone,rock);
 ground=mix(ground,vec3(.29,.34,.21),1.0-smoothstep(-8.0,-.2,h));
 vec4 grassCover=texture2D(nativeGrass,domainUv);ground=mix(ground,ground*vec3(.72,.96,.57)*(macro.g*.24+.88),clamp(grassCover.r,0.0,1.0)*.36*(1.0-sand)*(1.0-rock));
 // Original static fallback damp band; this is not live swash/history wetness.
 float land=smoothstep(-.6,.12,h),wet=(1.0-smoothstep(.05,.65,h))*land;
 float dampMottle=smoothstep(.3,.7,b.a+(a.g-.45)*.6+(macro.a-.5)*.4);
 float damp=(1.0-smoothstep(.5,1.7,h+b.a*.3))*mix(.22,.5,dampMottle);
 float wetK=max(wet,damp)*sand*land;
 diffuseColor.rgb*=ground*mix(1.0,.53,wetK)*mix(.55,1.0,nr.a);
 float terrainRough=mix(mix(.88,.93,sand),mix(mix(.88,.8,steep),.45,rockWet),rock);
 terrainRough=mix(terrainRough,mix(.42,.16,wet),wetK);
 terrainRough=mix(terrainRough,.75,1.0-land);
 float px=max(length(dFdx(vNativeWorld)),length(dFdy(vNativeWorld)));
 float fineK=1.0-smoothstep(.006,.02,px),midK=1.0-smoothstep(.03,.1,px);
 float sandH=(min(a.b,.62)*.004+min(fine.b,.62)*.003+rip*.005*windK)*(1.0-wet*.6);
 float groundH=mix(a.g*.035+b.g*.045+fine.g*.012,a.b*.012+a.g*.01,path);
 float rockH=plates.r*.07*(midK*.6+.4)+a.r*.012*fineK*(1.0-rockWet*.6);
 float terrainHeight=mix(mix(groundH,sandH,sand),rockH,rock);
 `),d.fragmentShader=d.fragmentShader.replace(`#include <roughnessmap_fragment>`,`#include <roughnessmap_fragment>
 roughnessFactor=clamp(terrainRough,.16,1.0);`),d.fragmentShader=d.fragmentShader.replace(`#include <normal_fragment_maps>`,`#include <normal_fragment_maps>
 normal=normalize(mat3(viewMatrix)*nativeTerrainBump(vNativeWorld,terrainN,terrainHeight));`)},d.customProgramCacheKey=()=>`native-field-terrain-webgl/2:`+c,d}function Ie(e,t,n,r,i){let a=e.geometry,o=a.attributes.position,s=a.index,c={geometryInspections:1,facetPlaneEvaluations:0,containmentChecks:0,byteComparisonChecks:0,uploadNotifications:0,compileNotifications:0},l=e=>({attribute:e,constructor:e.constructor,array:e.array,buffer:e.array.buffer,byteOffset:e.array.byteOffset,byteLength:e.array.byteLength,itemSize:e.itemSize,count:e.count,normalized:e.normalized,version:e.version,usage:e.usage,gpuType:e.gpuType,bytes:new Uint8Array(e.array.buffer,e.array.byteOffset,e.array.byteLength).slice()}),u=l(o),d=l(s),f=JSON.stringify(a.groups),p={...a.drawRange},m=t.version,h=t.glslVersion,g=JSON.stringify(t.extensions),_=t.defines,v=Object.keys(i).sort().join(`|`),y=Object.fromEntries(Object.entries(i)),b=1/0;for(let e=0;e<s.count;e+=3){let[t,n,r]=[s.array[e],s.array[e+1],s.array[e+2]].map(e=>e*3),i=o.array,a=i[t],l=i[t+1],u=i[t+2],d=i[n]-a,f=i[n+1]-l,p=i[n+2]-u,m=i[r]-a,h=i[r+1]-l,g=i[r+2]-u,_=f*g-p*h,v=p*m-d*g,y=d*h-f*m,x=Math.hypot(_,v,y),S=Math.abs(_*a+v*l+y*u)/x;if(c.facetPlaneEvaluations++,!Number.isFinite(S)||x<=0){b=NaN;break}b=Math.min(b,S)}let x=Math.max(.001,b*1e-5),S=b-x,C=new B.Matrix4,w=new B.Vector3,T=Object.fromEntries([`onBeforeRender`,`onAfterRender`,`onBeforeShadow`,`onAfterShadow`].map(e=>[e,B.Object3D.prototype[e]])),E={onBeforeRender:B.Material.prototype.onBeforeRender,customProgramCacheKey:B.Material.prototype.customProgramCacheKey},D=!1,O=null,k=!1,A=e=>{D=!0,O??=e},j=o.onUploadCallback,M=s.onUploadCallback,N=t.onBeforeCompile;function P(...e){c.uploadNotifications++;try{this===o&&R(u,o)||A(`position-upload-mismatch`);let t=j.apply(this,e);return R(u,o)||A(`position-upload-callback-mismatch`),t}catch(e){throw A(`position-upload-error`),e}}function F(...e){c.uploadNotifications++;try{this===s&&R(d,s)||A(`index-upload-mismatch`);let t=M.apply(this,e);return R(d,s)||A(`index-upload-callback-mismatch`),t}catch(e){throw A(`index-upload-error`),e}}let I=e=>e?.vertexShader===n&&e.fragmentShader===r&&Object.keys(e.defines??{}).length===0&&e.uniforms===i&&Object.keys(i).sort().join(`|`)===v;function L(...e){c.compileNotifications++;try{this===t&&I(e[0])||A(`sky-compile-input-mismatch`);let n=N.apply(this,e);return I(e[0])||A(`sky-compiled-shader-mismatch`),n}catch(e){throw A(`sky-compile-error`),e}}o.onUploadCallback=P,s.onUploadCallback=F,t.onBeforeCompile=L;function R(e,t){if(t!==e.attribute||t.constructor!==e.constructor||t.isBufferAttribute!==!0||t.isGLBufferAttribute||t.isInterleavedBufferAttribute||t.isInstancedBufferAttribute||t.array!==e.array||t.array.buffer!==e.buffer||t.array.byteOffset!==e.byteOffset||t.array.byteLength!==e.byteLength||t.itemSize!==e.itemSize||t.count!==e.count||t.normalized!==e.normalized||t.version!==e.version||t.usage!==e.usage||t.gpuType!==e.gpuType)return!1;let n=new Uint8Array(t.array.buffer,t.array.byteOffset,t.array.byteLength);for(let t=0;t<n.length;t++)if(n[t]!==e.bytes[t])return!1;return!0}function z(){if(D||k||o.onUploadCallback!==P||s.onUploadCallback!==F||t.onBeforeCompile!==L||e.geometry!==a||e.material!==t||a.constructor!==B.SphereGeometry||e.isSkinnedMesh||e.isInstancedMesh||e.instanceMatrix||e.morphTargetInfluences?.length||Object.keys(a.morphAttributes??{}).length||JSON.stringify(a.groups)!==f||a.drawRange.start!==p.start||a.drawRange.count!==p.count||t.type!==`ShaderMaterial`||t.isShaderMaterial!==!0||t.glslVersion!==h||JSON.stringify(t.extensions)!==g||t.version!==m||t.vertexShader!==n||t.fragmentShader!==r||t.customProgramCacheKey!==E.customProgramCacheKey||t.onBeforeRender!==E.onBeforeRender||t.displacementMap||t.skinning||t.morphTargets||t.morphNormals||t.defines!==_||Object.keys(_??{}).length||t.uniforms!==i||Object.keys(i).sort().join(`|`)!==v)return!1;for(let e of Object.keys(y)){let t=Object.getOwnPropertyDescriptor(i,e),n=t&&`value`in t&&t.value===y[e]?Object.getOwnPropertyDescriptor(t.value,`value`):null;if(!n||!(`value`in n)||typeof n.value!=`number`||!Number.isFinite(n.value))return!1}for(let t=e;t;t=t.parent)if(t.onBeforeRender!==T.onBeforeRender||t.onAfterRender!==T.onAfterRender||t.onBeforeShadow!==T.onBeforeShadow||t.onAfterShadow!==T.onAfterShadow)return!1;return c.byteComparisonChecks++,R(u,a.attributes.position)&&R(d,a.index)}return{contains(t,n){if(c.containmentChecks++,!Number.isFinite(S)||S<=0||!Array.isArray(n)||n.length!==4||!z())return!1;let r=e.matrixWorld,i=r?.elements,a=t?.matrixWorld?.elements;if(!i||!a||![...i,...a].every(Number.isFinite)||i[3]!==0||i[7]!==0||i[11]!==0||i[15]!==1||a[3]!==0||a[7]!==0||a[11]!==0||a[15]!==1)return!1;let o=r.determinant(),s=Math.hypot(i[0],i[1],i[2])*Math.hypot(i[4],i[5],i[6])*Math.hypot(i[8],i[9],i[10]);if(!Number.isFinite(o)||!Number.isFinite(s)||s<=0||Math.abs(o)<=s*1e-12||(C.copy(r).invert(),!C.elements.every(Number.isFinite)))return!1;let l=[a[12],a[13],a[14]];for(let e of[l,...n])if(!Array.isArray(e)||e.length!==3||!e.every(Number.isFinite)||(w.fromArray(e).applyMatrix4(C),![w.x,w.y,w.z].every(Number.isFinite)||w.length()>=S))return!1;return!0},diagnostics:()=>({...c,innerRadius:S,facetRadius:b,margin:x,snapshotBytes:u.byteLength+d.byteLength,invalidated:D,invalidationReason:O,released:k,geometryPolicy:`one-time actual facet-plane inspection plus bounded private byte comparisons at each proof and observed upload`,lifecycleScope:`normal owner-held Three upload/compile callbacks; current callback replacement fails closed; arbitrary malicious hidden raw-GL lifecycle bypasses are outside this proof`}),release(){k||(k=!0,o.onUploadCallback===P&&(o.onUploadCallback=j),s.onUploadCallback===F&&(s.onUploadCallback=M),t.onBeforeCompile===L&&(t.onBeforeCompile=N))}}}function Le(e={}){let t={nativeTime:{value:0},nativeHour:{value:e.timeOfDay??14},nativeCoverage:{value:e.cloudCoverage??.49},nativeStorm:{value:+(e.weather===`storm`)},nativeWind:{value:e.windSpeed??6}},n=`varying vec3 skyDirection; void main(){ skyDirection=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,r=`uniform float nativeTime,nativeHour,nativeCoverage,nativeStorm,nativeWind;
 varying vec3 skyDirection;
 float skyHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float skyNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(skyHash(i),skyHash(i+vec2(1.0,0.0)),f.x),mix(skyHash(i+vec2(0.0,1.0)),skyHash(i+vec2(1.0,1.0)),f.x),f.y);}
 void main(){
  vec3 d=normalize(skyDirection);float daylight=max(0.0,sin((nativeHour-6.0)*3.14159265/12.0));
  vec3 horizon=mix(vec3(.26,.18,.26),vec3(.54,.73,.81),daylight);
  vec3 zenith=mix(vec3(.025,.035,.09),vec3(.17,.42,.65),daylight);
  vec3 color=mix(horizon,zenith,smoothstep(-.07,.8,d.y));
  float cover=clamp(nativeCoverage,0.0,1.0)*smoothstep(-.035,.14,d.y);
  if(cover>.001){
   vec2 uv=d.xz/max(.11,d.y+.27),flow=vec2(nativeTime*nativeWind*.00055,nativeTime*nativeWind*.00018);
   float a=skyNoise(uv*2.5+flow),b=skyNoise(uv*5.0-flow*.7),c=skyNoise(uv*10.0+flow*1.3);
   float cloud=smoothstep(mix(.79,.35,cover),mix(.87,.48,cover),a*.55+b*.30+c*.15);
   vec3 cloudColor=mix(vec3(.16,.19,.24),vec3(.91,.92,.88),daylight*(1.0-nativeStorm*.55));
   color=mix(color,cloudColor,cloud*cover*.9);
  }
  gl_FragColor=vec4(color,1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`,i=new B.ShaderMaterial({uniforms:t,vertexShader:n,fragmentShader:r,side:B.BackSide,depthWrite:!1,fog:!1,toneMapped:!1}),a=new B.SphereGeometry(4200,24,16),o=new B.Mesh(a,i);o.name=`native-island-webgl-sky`,o.frustumCulled=!1,o.renderOrder=-1e3;let s=Ie(o,i,n,r,t),c=!1,l,u={mesh:o,mediaOcclusionDiagnostics:s.diagnostics,setEnvironment(e={}){t.nativeHour.value=e.timeOfDay??14,t.nativeCoverage.value=e.cloudCoverage??.49,t.nativeStorm.value=+(e.weather===`storm`),t.nativeWind.value=e.windSpeed??6},update(e,n){t.nativeTime.value=e,o.position.copy(n.position)},dispose(){c||(c=!0,l(),s.release(),o.removeFromParent(),a.dispose(),i.dispose())}};return l=D(u,o,(e,t)=>!c&&s.contains(e,t)),Object.freeze(u)}function Re(e,t,n,r,i=r){let a=L(e.ocean.surfaceExclusions??[]),o=S(a,`vSeaWorld`,`glsl`),s=e.ocean,c=s.shore.period,l=9.81*c*c/(2*Math.PI),u=new B.Vector2(e.appearance.swellDir.x,e.appearance.swellDir.y).normalize(),d=[],f=[];for(let e=0;e<=96;e++)for(let t=0;t<=192;t++){let n=7e3*(e/96)**2,r=t/192*Math.PI*2;if(d.push(Math.cos(r)*n,0,Math.sin(r)*n),e<96&&t<192){let n=e*193+t;f.push(n,n+192+1,n+1,n+1,n+192+1,n+192+2)}}let p=new B.BufferGeometry;p.setAttribute(`position`,new B.Float32BufferAttribute(d,3)),p.setIndex(f),p.computeVertexNormals();let m=new B.MeshStandardMaterial({color:`#1b697a`,roughness:.17,metalness:.15,transparent:!0,opacity:.92,side:B.DoubleSide});m.onBeforeCompile=e=>{Object.assign(e.uniforms,{nativeTime:n,nativeShore:{value:r},nativeDepth:{value:i},nativeSwell:{value:u},nativeWave:{value:new B.Vector4(s.level,s.shore.amplitude,2*Math.PI/l,2*Math.PI/c)}}),e.vertexShader=`uniform float nativeTime;uniform vec2 nativeSwell;uniform vec4 nativeWave;varying vec3 vSeaWorld;
`+e.vertexShader,e.vertexShader=e.vertexShader.replace(`#include <begin_vertex>`,`#include <begin_vertex>
 float phase=dot(position.xz,nativeSwell)*nativeWave.z-nativeTime*nativeWave.w;transformed.y=nativeWave.x+nativeWave.y*sin(phase);vSeaWorld=(modelMatrix*vec4(transformed,1.0)).xyz;`),e.fragmentShader=`uniform float nativeTime;uniform sampler2D nativeShore,nativeDepth;uniform vec2 nativeSwell;uniform vec4 nativeWave;varying vec3 vSeaWorld;
`+e.fragmentShader,e.fragmentShader=e.fragmentShader.replace(`#include <color_fragment>`,`#include <color_fragment>
 vec2 shoreUV=(vSeaWorld.xz-(${t.origin.toFixed(1)}))/${t.size.toFixed(1)};
 vec4 shore=texture2D(nativeShore,clamp(shoreUV,vec2(0.0),vec2(1.0)));
 float inDomain=step(0.0,shoreUV.x)*step(shoreUV.x,1.0)*step(0.0,shoreUV.y)*step(shoreUV.y,1.0);
 float waterDepth=max(nativeWave.x-texture2D(nativeDepth,clamp(shoreUV,vec2(0.0),vec2(1.0))).r,0.0);
 float shoreline=(1.0-smoothstep(1.0,18.0,waterDepth))*(1.0-step(9000.0,shore.x))*clamp(length(shore.yz),0.0,1.0)*inDomain;
 float phase=dot(vSeaWorld.xz,nativeSwell)*nativeWave.z-nativeTime*nativeWave.w;
 float breakup=.5+.27*sin(vSeaWorld.x*.24+nativeTime*.35)*sin(vSeaWorld.z*.19-nativeTime*.21)+.23*sin(vSeaWorld.x*.67+vSeaWorld.z*.41+nativeTime*.48);
 float front=abs(fract(shore.x/max(${c.toFixed(6)},.01)-nativeTime/${c.toFixed(6)}+breakup*.035)-.5);
 float foam=(1.0-smoothstep(.012,.055+fwidth(front),front))*smoothstep(.48,.82,breakup)*shoreline*.72;
 vec3 seaN=normalize(vec3(-nativeSwell.x*nativeWave.y*nativeWave.z*cos(phase),1.0,-nativeSwell.y*nativeWave.y*nativeWave.z*cos(phase)));
 float fresnel=pow(1.0-max(dot(seaN,normalize(cameraPosition-vSeaWorld)),0.0),3.0);
 vec3 deep=vec3(.018,.19,.24),shallow=vec3(.09,.38,.40);
 diffuseColor.rgb=mix(deep,shallow,shoreline*.7)*(.87+.13*breakup);
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.36,.54,.57),fresnel*.5);
 float ripple=sin(dot(vSeaWorld.xz,vec2(.37,.13))+nativeTime*.9)*sin(dot(vSeaWorld.xz,vec2(-.18,.43))-nativeTime*.63);
 float rippleFade=1.0-smoothstep(.5,2.0,fwidth(dot(vSeaWorld.xz,vec2(.37,.13))));
 diffuseColor.rgb*=1.0+ripple*.07*rippleFade;
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.79,.87,.82),foam);`),e.fragmentShader=e.fragmentShader.replace(`#include <normal_fragment_maps>`,`#include <normal_fragment_maps>
 float wavePhase=dot(vSeaWorld.xz,nativeSwell)*nativeWave.z-nativeTime*nativeWave.w;
 float waveSlope=nativeWave.y*nativeWave.z*cos(wavePhase);
 vec3 seaNormal=normalize(vec3(-nativeSwell.x*waveSlope+.045*sin(dot(vSeaWorld.xz,vec2(.37,.13))+nativeTime*.9),1.0,-nativeSwell.y*waveSlope+.045*cos(dot(vSeaWorld.xz,vec2(-.18,.43))-nativeTime*.63)));
 normal=normalize(mat3(viewMatrix)*seaNormal);`),e.fragmentShader=e.fragmentShader.replace(/}\s*$/,`if(`+o+`){discard;}
}`)},m.customProgramCacheKey=()=>`native-analytic-sea-webgl/2:`+JSON.stringify(a);let h=new B.Mesh(p,m);h.frustumCulled=!1,h.userData.repositoryWater=!0;let g=new B.MeshDepthMaterial({side:B.DoubleSide});g.onBeforeCompile=e=>{let t={uniforms:{},vertexShader:B.ShaderLib.standard.vertexShader,fragmentShader:B.ShaderLib.standard.fragmentShader};m.onBeforeCompile(t),Object.assign(e.uniforms,t.uniforms),e.vertexShader=t.vertexShader.slice(0,t.vertexShader.indexOf(`#define STANDARD`))+e.vertexShader;let n=t.vertexShader.match(/#include <begin_vertex>([\s\S]*?)#include <morphtarget_vertex>/)?.[1];if(!n)throw Error(`Native sea depth displacement unavailable`);e.vertexShader=e.vertexShader.replace(`#include <begin_vertex>`,`#include <begin_vertex>`+n),e.fragmentShader=`varying vec3 vSeaWorld;
`+e.fragmentShader,e.fragmentShader=e.fragmentShader.replace(/}\s*$/,`if(`+o+`){discard;}
}`)},g.customProgramCacheKey=()=>`native-analytic-sea-depth-webgl/1:`+JSON.stringify(a),h.customDepthMaterial=g;let _=new Float32Array(4),v=0,y=0,b=()=>s.level+s.shore.amplitude*Math.sin((v*u.x+y*u.y)*2*Math.PI/l-n.value*2*Math.PI/c);return{mesh:h,query:{cpu:_,cpuValid:!0,allocate:()=>0,setPoint(e,t,n){v=t,y=n,_[0]=b()},setTime(e){n.value=e,_[0]=b()}},seaLevel:s.level,surfaceExclusionsEnforced:!0,surfaceExclusions:a,getSurfaceExclusions:()=>a,dispose(){p.dispose(),m.dispose(),g.dispose(),h.removeFromParent()}}}async function ze({project:e,root:t,camera:n,options:r={}}){if(typeof r.readNativeIsland!=`function`)throw Error(`WebGL native island needs its verified source reader.`);let i=await r.readNativeIsland(e),a=new N({...i.domain,coarse:i.coarse}),s=new B.Group,c={value:0};t.add(s);let l=!1,u,d,f,p,m,h,g=[],_=new Map,v=new Set,y=()=>{if(!l){l=!0;for(let e of v)e();if(m?.dispose(),i.dispose?.(),d?.dispose(),f?.dispose(),p?.dispose(),u?.dispose(),h)for(let e of Object.values(h))e.dispose();for(let e of _.values())e.geometry.dispose(),e.material.dispose(),e.userData.nativeTextures.forEach(e=>e.dispose());_.clear(),s.traverse(e=>{e.userData.nativeBase&&(e.geometry.dispose(),e.material.dispose())}),s.removeFromParent();for(let e of g)e.dispose()}};try{u=await(r.prepareVegetationAssets??je)(i);let t=await(r.prepareLeafAtlas??xe)();g.push(t);let l=o({upload:!1}),b=Z(l.image.data,l.width);b.wrapS=b.wrapT=B.RepeatWrapping,b.generateMipmaps=!0,b.minFilter=B.LinearMipmapLinearFilter,g.push(b);let x=Z(i.grassMask.data,i.grassMask.res),S=Z(i.shore.data,i.shore.res,4,B.FloatType),w=Z(i.coarse.heights,i.coarse.res,1,B.FloatType),T=Z(i.coarse.normal,i.coarse.res),E=Z(i.coarse.splat,i.coarse.res),D=Math.ceil(i.domain.res/128),O=new Uint8Array(D*D),k=Z(O,D,1);k.magFilter=k.minFilter=B.NearestFilter,g.push(x,S,w,T,E,k);let A=i.ocean.fft.local.windDirection*Math.PI/180,j=(e,t,n,r)=>Fe({normal:e,splat:t,rect:n,domain:i.domain,detail:b,shore:S,grass:x,ready:k,coarse:r,time:c,windDirection:A}),M=new B.Mesh(ke(a,{x:0,z:0,width:a.res-1,height:a.res-1},Math.round(a.res/i.coarse.res)),j(T,E,[a.origin,a.origin,a.size,a.size],!0));M.userData.nativeBase=!0,s.add(M),m=new C({tiles:i.tiles,readTile:i.readTile,maxBytes:r.maxBytes,maxConcurrency:r.maxConcurrency,onLoad(e,t){let n=t.fields??t;a.apply(e,t);let r=Z(n.normal,e.width),o=Z(n.splat,e.width),c=new B.Mesh(ke(a,e),j(r,o,[a.origin+e.x,a.origin+e.z,e.width,e.height],!1));c.userData.nativeTextures=[r,o],_.set(e.id,c),s.add(c),O[Math.floor(e.z/128)*D+Math.floor(e.x/128)]=255,k.needsUpdate=!0;for(let t of i.tiles){let n=_.get(t.id);n&&Ae(a,t,n.geometry,e)}},onEvict(e){let t=_.get(e.id);t&&(t.removeFromParent(),t.geometry.dispose(),t.material.dispose(),t.userData.nativeTextures.forEach(e=>e.dispose()),_.delete(e.id)),O[Math.floor(e.z/128)*D+Math.floor(e.x/128)]=0,k.needsUpdate=!0}}),a.cache=m;let N={value:new B.Vector2(Math.sin(A),Math.cos(A))},P={value:new B.Vector2};d=Pe(i,c,b,h={palm:Ne(`palm`,c,N,P,b,u.palm,t),tree:Ne(`tree`,c,N,P,b,u.tree,t)},r.mainCamera??n),s.add(d.root),f=Re(i,a,c,S,w),s.add(f.mesh),p=Le(e.environment),s.add(p.mesh);let F=new B.Frustum,I=new B.Matrix4,L=new B.Box3,R=e=>{p.update(c.value,e),e.updateMatrixWorld(),I.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),F.setFromProjectionMatrix(I);let{x:t,z:n}=e.position;m.requestView(t,n,2400,e=>(L.min.set(e.bounds[0],e.minHeight??-90,e.bounds[1]),L.max.set(e.bounds[2],e.maxHeight??200,e.bounds[3]),F.intersectsBox(L)||Math.hypot((e.bounds[0]+e.bounds[2])/2-t,(e.bounds[1]+e.bounds[3])/2-n)<180)),d.updateView(e)};return{data:a,water:f,sky:p,query:f.query,setPlantOccluders:d.setOccluders,setPlantOcclusionEnabled:d.setOcclusionEnabled,setEnvironment(e){p.setEnvironment(e)},async ensureArrival(e){let t=await m.ensureAt(e[0],e[2],3);return v.add(t),()=>{v.delete(t),t()}},canOccupy(e,t,n=1){return[[e-n,t-n],[e+n,t-n],[e-n,t+n],[e+n,t+n]].every(([e,t])=>m.readyAt(e,t))},bindView:R,update(t,n){c.value+=t,P.value.addScaledVector(N.value,(.7*(e.environment.windSpeed??7)+1.5)*t),R(n)},stats:()=>({...Te,...m.stats(),plants:d.stats(),source:i.sourceStats?.(),terrainPolicy:`exact fine cell heights and captured normal/splat; approximate GLSL surface shading`,grassPolicy:`captured density field; blades not implemented`}),dispose:y}}catch(e){throw y(),e}}var Be=[[`1`,`2`,`3`,`4`,`5`,`6`,`7`,`8`,`9`,`0`,`-`,`=`,`DEL`],[`Q`,`W`,`E`,`R`,`T`,`Y`,`U`,`I`,`O`,`P`,`[`,`]`,`\\`,`TAB`],[`A`,`S`,`D`,`F`,`G`,`H`,`J`,`K`,`L`,`;`,`"`,`RETURN`,`CTRL`],[`SHIFT`,`Z`,`X`,`C`,`V`,`B`,`N`,`M`,`,`,`.`,`/`,`SHIFT`]],Ve=I(),He=new Map(Ve.objects.map((e,t)=>[`warehouse:object:`+String(t).padStart(4,`0`),e]));function Ue(e,t,n){let r=He.get(n.id);if(e!==`elsemesh.world:2842c4f2-93a0-4492-b942-e53e524de319`||!r||n.kind!==`glb`||n.collisionOnly||n.materialOverrides?.length||n.ambientBehaviour||t?.source!==`ElseMesh PortalInteriorRecipe.js @ f91cabbd4bac784076095b73ac45ec1ffc5da9f0; recipe SHA256 efb73bea8e5e81cb7cccc6b8a5449c51b31137a73044d132b91dfaf499f1666c`||n.name!==r.name||t.id!==`warehouse:${r.shape}-${r.material}`)return null;let i=/^(c64|bbc|sun) (?:key r(\d) k(\d+)|(space|left shift|return) key|function key (\d+))$/.exec(r.name);if(i){let[,e,t,n,r,a]=i,o;return o=t===void 0?a===void 0?r===`space`?`SPACE`:r===`return`?`RETURN`:`SHIFT`:`F`+(Number(a)+1):Be[Number(t)]?.[Number(n)]??`ESC`,{label:o,machine:e,face:`top`,color:e===`sun`?`#342b46`:e===`c64`?`#efe0bb`:`#f4e8cf`}}return/^(COMMODORE 64|BBC MODEL B|SUN SPARCSTATION) nameplate$/.test(r.name)?{label:r.name.replace(` nameplate`,``),face:`front`,color:`#211d18`}:null}function We(e,t=()=>document.createElement(`canvas`)){let n=t();n.width=1024,n.height=512;let r=n.getContext(`2d`);r.clearRect(0,0,1024,512),r.fillStyle=`#ffffff`,r.textAlign=`center`,r.textBaseline=`middle`;let i=new Map,a=[...new Set(e.filter(e=>e.face===`top`).map(e=>e.label))],o=[...new Set(e.filter(e=>e.face===`front`).map(e=>e.label))];if(a.length>80||o.length>3)throw Error(`Warehouse lettering atlas budget exceeded`);return a.forEach((e,t)=>{let n=t%10*96,a=Math.floor(t/10)*40;r.font=`bold 28px monospace`,r.fillText(e,n+48,a+20,80),i.set(e,[n/1024,1-(a+40)/512,96/1024,40/512])}),o.forEach((e,t)=>{let n=320+t*64;r.font=`bold 48px monospace`,r.fillText(e,512,n+32,960),i.set(e,[0,1-(n+64)/512,1,64/512])}),{canvas:n,rects:i}}function Ge(e,t,n,{createCanvas:r}={}){if(e!==`elsemesh.world:2842c4f2-93a0-4492-b942-e53e524de319`)return null;let i=new Map(t.assets.map(e=>[e.id,e])),a=[];for(let r of t.objects){let o=Ue(e,i.get(r.assetId),r);o&&n.has(r.id)&&H(t.objects,r.id).visible&&a.push({object:r,spec:o})}if(!a.length)return null;let{canvas:o,rects:s}=We(a.map(e=>e.spec),r),c=new B.CanvasTexture(o);c.colorSpace=B.SRGBColorSpace,c.generateMipmaps=!0,c.minFilter=B.LinearMipmapLinearFilter,c.magFilter=B.LinearFilter,c.anisotropy=4;let l=new B.PlaneGeometry;l.setIndex([0,1,2,2,1,3]),l.getAttribute(`normal`).array.fill(0);for(let e=0;e<4;e++)l.getAttribute(`normal`).setZ(e,-1);let u=new Float32Array(a.length*4);l.setAttribute(`warehouseGlyphRect`,new B.InstancedBufferAttribute(u,4));let f=new B.MeshBasicMaterial({map:c,alphaTest:.12,transparent:!1,depthWrite:!1,side:B.FrontSide,polygonOffset:!0,polygonOffsetFactor:-1,polygonOffsetUnits:-1,toneMapped:!1});f.name=`warehouse-original-key-and-nameplate-lettering`,f.onBeforeCompile=e=>{e.vertexShader=`attribute vec4 warehouseGlyphRect;
`+e.vertexShader,e.vertexShader=e.vertexShader.replace(`#include <uv_vertex>`,`#include <uv_vertex>
 vMapUv=warehouseGlyphRect.xy+vMapUv*warehouseGlyphRect.zw;`)},f.customProgramCacheKey=()=>`warehouse-lettering/1`;let p=new B.InstancedMesh(l,f,a.length);p.name=`warehouse-physical-key-and-front-nameplate-lettering`,p.userData.editorObjectIds=a.map(e=>e.object.id);let m=new B.Matrix4,h=new B.Matrix4,g=new B.Matrix4;return a.forEach(({object:e,spec:t},r)=>{let i=new B.Vector3().setFromMatrixScale(n.get(e.id)),a=t.face===`top`;if(h.makeTranslation(0,a?.5+35e-5/i.y:0,a?0:-.5-35e-5/i.z),g.makeScale(.9,.72,1),m.copy(n.get(e.id)).multiply(h),a){let e=new B.Matrix4().set(.85,0,0,0,0,0,-1,0,0,.72,0,0,0,0,0,1);m.multiply(e)}else m.multiply(g);p.setMatrixAt(r,m),p.setColorAt(r,new B.Color(t.color)),u.set(s.get(t.label),r*4)}),p.instanceMatrix.needsUpdate=!0,p.instanceColor.needsUpdate=!0,p.computeBoundingSphere(),p.userData.warehouseLettering={instances:a.length,drawCalls:1,atlas:[1024,512],source:d},p}var Ke=e({buildWebGLNeon:()=>Ze,buildWebGLRepositoryScene:()=>nt,buildWebGLRetroMaterial:()=>Xe,disposeWebGLRepositoryScene:()=>$}),Q=(e,t={})=>new B.MeshStandardMaterial({color:e,roughness:.85,side:B.DoubleSide,...t}),qe=new Set([`warehouse:box-brick`,`warehouse:box-brickDark`]),Je=`elsemesh.world:2842c4f2-93a0-4492-b942-e53e524de319`,Ye=new Map(I().screens.map(e=>[e.id,e]));function Xe(e){let t=Ye.get(e);if(!t)throw Error(`Unsupported repository terminal `+e);let n=j(t),r=n.bindings.retroDisplay.texture;try{if(!r.pendingData)throw Error(`Installed retro artwork has no CPU pixels.`);let t=new B.DataTexture(new Uint8Array(r.pendingData),r.width,r.height,B.RGBAFormat,B.UnsignedByteType);t.flipY=!0,t.colorSpace=B.SRGBColorSpace,t.needsUpdate=!0;let n=new B.MeshBasicMaterial({map:t,side:B.DoubleSide});return n.name=`repository-retro:`+e,n}finally{n.dispose(),r.destroy()}}function Ze(e){let t=se(e),n=t.value,r=new B.Group,i=[],a=(e,t)=>{let n=new B.Mesh(e.clone(),t);return r.add(n),n};try{for(let t of e.effect.mode===`sequence`?n.glyphs:[{geometry:n.geometry,index:-1}]){let n=Q(e.color,{emissive:e.color,roughness:.35}),r=a(t.geometry,n);i.push({item:r,material:n,index:t.index})}n.backingGeometry&&a(n.backingGeometry,Q(e.backingColor)),n.mountingGeometry&&a(n.mountingGeometry,Q(`#555b61`,{metalness:.7})),n.frameGeometry&&a(n.frameGeometry,Q(`#343b40`,{metalness:.65}))}finally{t.release()}return r.userData.updateNeon=(t,a,o=e.powered)=>{let s=re({...e,powered:o},t,a);for(let t of i){let n=s.litGlyphs===void 0||t.index<s.litGlyphs?s.brightness:0;t.material.color.set(s.color).multiplyScalar(n>0?.6:.055),t.material.emissive.set(s.color).multiplyScalar(n*(1+e.glow*2))}r.userData.neonState={text:e.text,powered:o,brightness:s.brightness,color:s.color,glyphs:n.glyphs.length}},r.userData.updateNeon(0,14),r}function $(e){if(!e||e.disposed)return;e.disposed=!0,e.defenderPlayer?.dispose(),e.defenderCabinet?.dispose(),e.snooker?.dispose(),e.textureTiers?.dispose(),e.disposeNeonInstances?.(),e.disposeNeonInstances=null,e.splatScene?.dispose(),e.nativeIsland?.dispose(),e.root?.removeFromParent();let t=new Set,n=new Set,r=new Set;e.root?.traverse(e=>{e.userData.disposePresentationLOD?.(),e.geometry&&t.add(e.geometry);for(let t of Array.isArray(e.material)?e.material:[e.material])if(t){n.add(t);for(let e of Object.values(t))e?.isTexture&&r.add(e)}});for(let e of t)e.dispose();for(let e of n)e.dispose();for(let e of r)e.userData.warehouseSurfaceOwned||e.dispose();e.warehouseSurfaces?.dispose();for(let t of e.loadedAssets??[])V(t.scene);e.loadedAssets?.clear()}function Qe(e){let{width:t,depth:n,resolution:r,heights:i,materials:a}=e.terrain,o=[],s=[],c=[],l=[[.38,.49,.32],[.54,.39,.27],[.48,.5,.48],[.7,.63,.43]];for(let e=0;e<r;e++)for(let u=0;u<r;u++){let d=e*r+u,f=i[d];o.push(u*t/(r-1)-t/2,f,e*n/(r-1)-n/2),s.push(...l[a[d]].map(e=>e*Math.max(.68,Math.min(1.22,.88+f/55)))),u<r-1&&e<r-1&&c.push(d,d+r,d+1,d+1,d+r,d+r+1)}let u=new B.BufferGeometry;return u.setAttribute(`position`,new B.Float32BufferAttribute(o,3)),u.setAttribute(`color`,new B.Float32BufferAttribute(s,3)),u.setIndex(c),u.computeVertexNormals(),u}async function $e(e,t){let n=Q(`#ffffff`,{vertexColors:!0,roughness:.92});if(!e.terrainImagery)return await M(e,n),n;let r=e.terrainImagery,i=e.geography;if(!i||r.crs!==`EPSG:27700`||i.crs!==`EPSG:27700`)throw Error(`Imagery and terrain must use EPSG:27700.`);let a=await fetch(r.dataUrl);if(!a.ok)throw Error(`Terrain imagery failed`);let o=await createImageBitmap(await a.blob());if(o.width>8192||o.height>8192||o.width*o.height>32e6)throw o.close(),Error(`Terrain imagery decoded budget exceeded.`);let s=new B.Texture(o);s.colorSpace=B.SRGBColorSpace,s.needsUpdate=!0;let c=r.bounds.west-i.center.easting,l=i.center.northing-r.bounds.north,u=r.bounds.east-r.bounds.west,d=r.bounds.north-r.bounds.south,f=t.getAttribute(`position`),p=[];for(let e=0;e<f.count;e++)p.push((f.getX(e)-c)/u,1-(f.getZ(e)-l)/d);return t.setAttribute(`uv`,new B.Float32BufferAttribute(p,2)),n.map=s,n.onBeforeCompile=e=>{e.fragmentShader=e.fragmentShader.replace(`#include <map_fragment>`,`#ifdef USE_MAP
 if(all(greaterThanEqual(vMapUv,vec2(0.0)))&&all(lessThanEqual(vMapUv,vec2(1.0)))){vec4 sampledDiffuseColor=texture2D(map,vMapUv);diffuseColor*=sampledDiffuseColor;}
#endif`)},n.customProgramCacheKey=()=>`repository-geographic-imagery/1`,s.addEventListener(`dispose`,()=>o.close()),await M(e,n),n}function et(e,t,n){let r=new B.Group,i=new Map;for(let t of e.objects.filter(t=>t.kind===`tree`&&H(e.objects,t.id).visible)){let e=(t.treeSpecies??`broadleaf`)+`:`+(t.landscapeOrigin?`p`+t.treeSeed:((t.treeSeed??7319)>>>0)%4);i.has(e)||i.set(e,[]),i.get(e).push(t)}for(let[e,a]of i){let[i,o]=e.split(`:`),s=ce(i,o.startsWith(`p`)?Number(o.slice(1)):7319+Number(o)*113);for(let e of[`bark`,`foliage`]){let o=new B.BufferGeometry;o.setAttribute(`position`,new B.Float32BufferAttribute(s[e].positions,3)),o.setIndex(s[e].indices),o.computeVertexNormals();let c=Q(e===`bark`?a[0].landscapeOrigin?i===`palm`?`#897156`:`#66503a`:`#594633`:`#ffffff`);c.onBeforeCompile=e=>{e.uniforms.repositoryTime=n,e.vertexShader=`uniform float repositoryTime;
`+e.vertexShader,e.vertexShader=e.vertexShader.replace(`#include <begin_vertex>`,`#include <begin_vertex>
 transformed.x += sin(repositoryTime*0.85+position.y*.17)*pow(max(position.y/7.0,0.0),2.0)*.09;`)},c.customProgramCacheKey=()=>`repository-tree-wind/1`;let l=new B.InstancedMesh(o,c,a.length);l.userData.editorObjectIds=a.map(e=>e.id);for(let n=0;n<a.length;n++)l.setMatrixAt(n,t.get(a[n].id)),e===`foliage`&&l.setColorAt(n,new B.Color(a[n].color));l.instanceMatrix.needsUpdate=!0,l.frustumCulled=!1,r.add(l)}}return r.userData.updateTreeLOD=()=>{},r.userData.treePreviewStats=()=>({sourceTrees:[...i.values()].reduce((e,t)=>e+t.length,0),batches:r.children.length,policy:`four shared variants per species`}),r}function tt(e,t){let n=e.water;if(!n)return null;let r=new B.PlaneGeometry(n.extent,n.extent,128,128);r.rotateX(-Math.PI/2);let i=Q(`#13627c`,{roughness:.16,metalness:.12,transparent:!0,opacity:.94});i.onBeforeCompile=e=>{e.uniforms.repositoryTime=t,e.vertexShader=`uniform float repositoryTime;
`+e.vertexShader,e.vertexShader=e.vertexShader.replace(`#include <begin_vertex>`,`#include <begin_vertex>
 transformed.y = ${n.level.toFixed(8)} + ${n.waveAmplitude.toFixed(8)} * sin(position.x*.04+position.z*.03+repositoryTime*${n.waveSpeed.toFixed(8)});`)},i.customProgramCacheKey=()=>`repository-sea:`+JSON.stringify(n);let a=new B.Mesh(r,i);return a.userData.repositoryWater=!0,a}async function nt(e,a,o={}){let s=e.project,d=new B.Group,m={root:d,descriptor:e,terrain:e.terrain,colliders:new n,query:O(s.water,s),assets:[],loadedAssets:new Set};m.project=s,d.name=`repository-world:`+e.worldId;let h={value:0};d.userData.updateWebGL=e=>{h.value=e},m.depthOccluders=[],m.textureTiers=he({read:o.loaded?.source?.textureTierRead,onLoaded:e=>m.loadedAssets.add(e)});try{s.splatScene&&(m.splatScene=await _(s,{...o.splatScene,camera:a}),m.terrain=m.splatScene.terrain,m.colliders=m.splatScene.colliders,m.clearance=m.splatScene.clearance,m.query=O(null,null),Object.defineProperty(m,"backendQualification",{enumerable:!0,get:()=>m.splatScene.diagnostics()}),d.add(m.splatScene.root));for(let n of e.boxes)m.colliders.addBox(new t(...n.center),new t(...n.half),0,{walkable:n.walkable,solid:n.solid,tag:n.id});if(s.nativeIsland){m.nativeIsland=await ze({project:s,root:d,camera:a,options:o.nativeIsland??{}}),m.terrain=m.nativeIsland.data,m.query=m.nativeIsland.query,m.backendQualification=m.nativeIsland.stats();let e=d.userData.updateWebGL;d.userData.updateWebGL=t=>{e(t),m.nativeIsland.query.setTime(t)}}else if(!s.splatScene){let e=Qe(s);d.add(new B.Mesh(e,await $e(s,e)))}let n=F(s),g=[...s.objects,...n],v=ie(g);m.matrices=v;let b=(e,t,n,r)=>{let i=new B.Mesh(t,Q(n));e.add(i),r&&f(i,r,{api:B})};for(let e of s.objects){if(e.collisionOnly||[`group`,`tree`,`glb`].includes(e.kind)||!H(s.objects,e.id).visible)continue;let t=new B.Group;if(t.userData.editorObjectId=e.id,t.matrixAutoUpdate=!1,t.matrix.copy(v.get(e.id)),d.add(t),e.kind===`media-screen`)t.add(r(e.mediaScreen,{api:B,material:e=>new B.MeshStandardMaterial(e)}));else if(e.kind===`computer`){let n=le();try{for(let r of n.parts){let n=r.emissive?e.computer.screenColor:r.color;t.add(new B.Mesh(r.geometry.clone(),r.emissive?new B.MeshBasicMaterial({color:n,side:B.DoubleSide}):Q(n)))}}finally{ae(n)}}else if(e.kind===`neon-sign`){let n=Ze(e.neon);n.userData.neonObjectId=e.id,t.add(n)}else if(e.kind===`building`)b(t,new B.BoxGeometry(3.6,2.2,3).translate(0,1.1,0),e.color),b(t,new B.ConeGeometry(2.7,1.1,4).rotateY(Math.PI/4).translate(0,2.55,0),`#574e42`);else if([`box`,`sphere`,`cylinder`,`cone`].includes(e.kind))b(t,e.kind===`sphere`?new B.SphereGeometry(.8,24,16):e.kind===`cylinder`?new B.CylinderGeometry(.65,.65,1.6,24):e.kind===`cone`?new B.ConeGeometry(.8,1.6,24):new B.BoxGeometry(1.6,1.6,1.6),e.color,e.kind);else throw Error(`Unsupported WebGL repository object `+e.kind)}let S=P(s,{terrain:m.terrain});m.ambient=S;let C=new Map,w=new Map,T=new Map,D=new Map((s.terminals??[]).filter(e=>e.screenObjectId).map(e=>[e.screenObjectId,e.kind]));m.warehouseSurfaces=p();for(let t of g.filter(e=>e.kind===`glb`&&H(g,e.id).visible)){let n=D.get(t.id),r=u(e.worldId,s.assets.find(e=>e.id===t.assetId),t,n),i=t.assetId+JSON.stringify(t.materialOverrides??[])+(n??``)+(n===`sun`?t.id:``)+(t.landscapeChunk??``)+`|surface:`+(r?r.material+`:`+l(r,v.get(t.id)):`none`);C.has(i)||C.set(i,{objects:[],kind:n,surface:r}),C.get(i).objects.push(t)}for(let{objects:t,kind:n,surface:r}of C.values()){let a=t[0],l=s.assets.find(e=>e.id===a.assetId);if(!l)throw Error(`Missing asset `+a.assetId);let u=w.get(l.id);if(!u){let t=await fetch(l.dataUrl);if(!t.ok)throw Error(`Asset read failed`);let n=new Uint8Array(await t.arrayBuffer());u=await U(n.buffer),m.loadedAssets.add(u),u.furnitureSurface=await c(e.worldId,l.id,n,W),o.loaded?.source?.textureTierRead&&G(l).length&&T.set(l.id,n),w.set(l.id,u)}n||m.textureTiers.register(l,T.get(l.id),u,t.map(e=>v.get(e.id).elements.slice(12,15)));let f=!n&&!a.materialOverrides?.length&&!a.ambientBehaviour&&u.furnitureSurface,p=r?.family||f?.family,h=p?await m.warehouseSurfaces.ready(p):null;u.scene.updateMatrixWorld(!0);let g=new Map,_=n?Xe(n):null,y=0;u.scene.traverse(o=>{if(o.isMesh&&o.visible){if(o.isSkinnedMesh||o.morphTargetInfluences?.length)throw Error(`Animated GLB repository meshes are unsupported.`);for(let c of k(o)){let o=u.materialIndices.get(c.material)??-1,p=_??g.get(c.material);if(!p){p=c.material.clone();let e=a.materialOverrides?.find(e=>e.materialIndex===o);e?.color!==void 0&&p.color.set(e.color),e?.roughness!==void 0&&(p.roughness=e.roughness),e?.metalness!==void 0&&(p.metalness=e.metalness),g.set(c.material,p)}let b=r??(o===0&&c.material.name===f?.material?f:null);b&&m.warehouseSurfaces.apply(b,c.geometry,p,v.get(a.id),h,t.length);let x=new B.InstancedMesh(c.geometry,p,t.length);x.userData.editorObjectIds=t.map(e=>e.id),n===`sun`&&(x.userData.updateSunScreen=e=>{if(p.map.image!==e){let t=p.map;p.map=new B.CanvasTexture(e),p.map.colorSpace=B.SRGBColorSpace,p.needsUpdate=!0,t.dispose()}else p.map.needsUpdate=!0});for(let e=0;e<t.length;e++)x.setMatrixAt(e,v.get(t[e].id)),t[e].landscapeTint&&x.setColorAt(e,new B.Color().fromArray(t[e].landscapeTint));x.instanceMatrix.needsUpdate=!0,x.instanceColor&&(x.instanceColor.needsUpdate=!0),S.register(x,t,v),d.add(x),y++,e.worldId===Je&&s.nativeIsland&&qe.has(l.id)&&!n&&t.every(e=>!e.ambientBehaviour&&!e.materialOverrides?.length)&&i(x)&&m.depthOccluders.push(x)}}});for(let e of t)m.assets.push({objectId:e.id,primitives:y,kind:n,backend:`webgl2`})}m.warehouseLettering=Ge(e.worldId,s,v),m.warehouseLettering&&d.add(m.warehouseLettering),m.nativeIsland?.setPlantOccluders(o.warehousePlantOcclusionAdmitted===!0&&e.worldId===Je?m.depthOccluders:[]),m.assetBatchCount=C.size,s.nativeIsland||(m.forest=et(s,v,h),d.add(m.forest));let A=s.nativeIsland||s.splatScene?null:tt(s,h);A&&d.add(A);for(let e of s.features??[])if(e.visible!==!1)for(let t of oe(e,s)){let e=[`water`,`foam`].includes(t.semantic);d.add(new B.Mesh(t.geometry,Q(t.color,e?{roughness:.22,transparent:!0,opacity:.9,metalness:.1}:{})))}let j=y(s);d.add(j),m.landscape=j,m.landscapeCollisions=E(s,m.colliders);let M=d.userData.updateWebGL;return d.userData.updateWebGL=(e,t=a)=>{M(e),j.userData.updateLandscape(e),S.update(e),m.textureTiers.update(t)},m.traffic=await x(s,m),d.updateMatrixWorld(!0),m}catch(e){throw $(m),e}}export{$ as n,Ke as t};