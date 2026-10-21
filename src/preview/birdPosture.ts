import * as T from 'three'
export type BirdRegion='body'|'surface'|'head'|'tail'|'leg'|'foot'
const pivot=new T.Vector3(0,.18,0),headBase=new T.Vector3(0,1.95,.22),tailBase=new T.Vector3(0,.8,-.36)
function pitched(p:T.Vector3,angle:number){return p.clone().applyAxisAngle(new T.Vector3(1,0,0),angle)}
function body(p:T.Vector3){return pitched(p.clone().sub(pivot).multiply(new T.Vector3(1,1.10,1)),Math.PI/5).add(pivot)}
/** Rest anatomy: planted toes, inclined breast, raised head, trailing tail. */
export function posturePoint(p:T.Vector3,region:BirdRegion):T.Vector3{
 if(region==='foot')return p.clone()
 if(region==='head')return pitched(p.clone().sub(headBase).multiplyScalar(.86),Math.PI/22.5).add(body(headBase))
 if(region==='tail')return p.clone().sub(tailBase).add(body(tailBase))
 const inclined=body(p)
 if(region==='leg')return p.clone().lerp(inclined,T.MathUtils.smoothstep(p.y,.14,.38))
 if(region==='surface')return inclined.lerp(posturePoint(p,'head'),T.MathUtils.smoothstep(p.y,1.67,2.02))
 return inclined
}
export function boneRegion(name:string):BirdRegion{
 if(name==='Root'||name.startsWith('Foot')||name.startsWith('Toe'))return 'foot'
 if(name==='Head'||name==='Jaw')return 'head'
 if(name.startsWith('Tail'))return 'tail'
 if(name.startsWith('Leg'))return 'leg'
 if(name==='Neck')return 'surface'
 return 'body'
}
