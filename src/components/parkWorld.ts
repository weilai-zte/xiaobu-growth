import {createBirdEgg} from './birdEgg'
import {createBirdClock,damping} from '../lib/birdMotion'
import {createXiaobuModel} from '../preview/xiaobuModel'
import {createPlumageTexture} from '../preview/plumageTexture'
import {posturePoint} from '../preview/birdPosture'
import {faceSurface} from '../preview/birdShape'
import {poseRiggedBird,riggedFoodPoint,riggedBallTravel} from '../lib/riggedBirdMotion'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import * as T from 'three'
import type { BuddyActivity } from '../db/types'
import type { ParkArea } from '../lib/park'
export interface ParkState {stage:string;count:number;activity:BuddyActivity;area:ParkArea;flapping:boolean;accessory:string;decor:string;interactionId?:number}
export function createParkWorld(canvas:HTMLCanvasElement,initial:ParkState,onLost:()=>void) {
 const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'low-power'})
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap
 renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(38,1,.1,80)
 scene.fog=new T.Fog('#c8e9e0',20,40)
 camera.position.set(10,9,15);camera.lookAt(0,.6,0)
 scene.add(new T.HemisphereLight('#fff7dc','#729580',3))
 const sun=new T.DirectionalLight('#fff2ce',4);sun.position.set(-5,10,7);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-9,right:9,top:9,bottom:-9});sun.shadow.bias=-.001;scene.add(sun)
 const fill=new T.DirectionalLight('#b9dfff',1.3);fill.position.set(7,4,-4);scene.add(fill)
 const root=new T.Group();scene.add(root)
 const materials=new Map<string,T.MeshStandardMaterial>()
 const mat=(color:string,roughness=.5,metalness=0)=>{
  const key=`${color}:${roughness}:${metalness}`
  if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color,roughness,metalness}))
  return materials.get(key)!
 }
 function mesh(g:T.BufferGeometry,color:string,parent:T.Object3D=root,x=0,y=0,z=0){const m=new T.Mesh(g,mat(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
 const sphereGeometry=new T.SphereGeometry(1,16,12)
 function orb(color:string,x:number,y:number,z:number,sx:number,sy=sx,sz=sx,parent:T.Object3D=root){const m=mesh(sphereGeometry,color,parent,x,y,z);m.scale.set(sx,sy,sz);m.castShadow=Math.max(sx,sy,sz)>.28;return m}
 function box(color:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,parent:T.Object3D=root){return mesh((Math.min(sx,sy,sz)<.13?new T.BoxGeometry(sx,sy,sz):new RoundedBoxGeometry(sx,sy,sz,2,Math.min(sx,sy,sz)*.16)),color,parent,x,y,z)}

 const ground=mesh(new T.CylinderGeometry(6.5,5.9,.65,64),'#83b58b',root,0,-.35,0);ground.scale.z=.76
 const lawn=mesh(new T.CylinderGeometry(6.45,6.45,.1,64),'#bcda9b',root,0,.02,0);lawn.scale.z=.76
 for(let i=0;i<12;i++){const a=i*.53;orb('#d4dfb2',Math.cos(a)*5.7,-.2,Math.sin(a)*4.1,.65,.25,.48)}
 // 青石小径与边缘树丛，让建筑和角色处于同一空间。
 for(let i=0;i<7;i++){const m=orb(i%2?'#e7dfc6':'#f1e8d0',-.6+i*.58,.12,1.5-i*.12,.32,.07,.24);m.rotation.y=i*.3}
 function tree(x:number,z:number,s:number){const group=new T.Group();root.add(group);group.position.set(x,0,z);group.scale.setScalar(s);mesh(new T.CylinderGeometry(.14,.22,1.5,10),'#ad8658',group,0,.65,0);orb('#80b78d',0,1.8,0,.85,.92,.78,group);orb('#b7d69c',-.4,2,.2,.6,.65,.6,group);orb('#669b7e',.45,1.7,-.1,.6,.7,.6,group)}
 tree(-4,-2.2,1.25);tree(4.2,-1.8,1.1);tree(-5.1,.2,.7)
 const nest=new T.Group();nest.position.set(-2.6,.14,-.9);root.add(nest)
 for(let i=0;i<4;i++){const ring=mesh(new T.TorusGeometry(.76-i*.05,.075,8,36),'#ba8d56',nest,0,.08+i*.09,0);ring.rotation.x=Math.PI/2;ring.scale.y=.83}
 // Crossed twig courses, a recessed lining and separate soft cushions.
 for(let layer=0;layer<2;layer++)for(let i=0;i<24;i++){
  const a=i*Math.PI/12+layer*.11,b=a+.38,r=.82-layer*.025
  const from=new T.Vector3(Math.cos(a)*r,.15+layer*.15,Math.sin(a)*r*.83)
  const to=new T.Vector3(Math.cos(b)*r,.28+layer*.10,Math.sin(b)*r*.83)
  const d=to.clone().sub(from),twig=mesh(new T.CylinderGeometry(.022,.03,d.length(),5),i%2?'#c69c67':'#a87d4c',nest)
  twig.position.copy(from.add(to).multiplyScalar(.5));twig.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize())
 }
 orb('#ac8658',0,.14,0,.66,.08,.54,nest)
 orb('#eee1b3',0,.21,0,.57,.06,.45,nest)
 for(let i=0;i<5;i++){const a=i*1.3;const cushion=orb(i%2?'#dce4aa':'#e8edbf',Math.cos(a)*.24,.25,Math.sin(a)*.2,.27,.035,.11,nest);cushion.rotation.y=-a}

 const sleepMat=orb('#c4bc85',-2.6,.16,-.9,1.6,.12,1.25);sleepMat.visible=false
 nest.scale.setScalar(1.8)
 const house=new T.Group();house.position.set(1.6,0,-1.6);house.rotation.y=-.12;root.add(house)
 box('#a27b58',0,.2,0,2.7,.35,2.5,house);box('#f4dca9',0,1.3,0,2.2,2.1,1.9,house)
 const roof=mesh(new T.ConeGeometry(1.95,1.35,4),'#9d819f',house,0,2.9,0);roof.rotation.y=Math.PI/4;roof.scale.z=.95
 for(const x of [-.85,.85]){box('#c8a77e',x,1.2,1.01,.12,2,.08,house)}
 box('#8c6d58',0,.95,1.01,.68,1.4,.12,house);orb('#f8daa0',.2,.97,1.1,.055,.055,.055,house)
 const window=mesh(new T.CircleGeometry(.37,32),'#ffe4a1',house,.72,1.65,1.02);window.material=new T.MeshStandardMaterial({color:'#ffe4a1',emissive:'#ffcc64',emissiveIntensity:.3})
 mesh(new T.TorusGeometry(.38,.06,8,32),'#c69d74',house,.72,1.65,1.04)
 box('#c69d74',.72,1.65,1.07,.05,.7,.03,house);box('#c69d74',.72,1.65,1.07,.7,.05,.03,house)
 box('#d8bd91',0,.3,1.3,1.2,.2,.7,house);box('#ead5aa',0,.13,1.7,1.5,.12,.5,house)
 const garden=new T.Group();garden.position.set(-3,.1,1.25);root.add(garden)
 function flower(x:number,z:number,color:string,parent:T.Group){mesh(new T.CylinderGeometry(.025,.035,.4,6),'#689a67',parent,x,.25,z);for(let k=0;k<5;k++){const a=k*Math.PI*2/5;orb(color,x+Math.cos(a)*.13,.5,z+Math.sin(a)*.13,.12,.07,.12,parent)}orb('#ffe8a4',x,.54,z,.075,.06,.075,parent)}
 for(let i=0;i<7;i++){flower(-3.8+i*.42,2.25+Math.sin(i)*.35,['#f4c3b6','#fff0bd','#c4bbdf'][i%3],root)}
 for(let i=0;i<6;i++){orb('#bdd398',-4+i*1.45,.2,-3.15,.35,.18,.32)}
 for(let i=0;i<14;i++){const a=i*2.4,r=.3+Math.sqrt(i)*.27;flower(Math.cos(a)*r,Math.sin(a)*r,['#f6adc5','#dac7ee','#fff0bb'][i%3],garden)}
 for(let i=0;i<5;i++){box('#f5e5c5',-1.1+i*.5,.25,-1.2,.08,.6,.08,garden)}box('#e2d0b3',0,.4,-1.2,2.4,.08,.08,garden)
 const butterfly=new T.Group();garden.add(butterfly);const butterflyWings=[orb('#f5c3d2',-.13,0,0,.17,.03,.23,butterfly),orb('#f5c3d2',.13,0,0,.17,.03,.23,butterfly)]
 const pool=new T.Group();pool.position.set(3.4,.13,1.5);root.add(pool)
 const poolWall=mesh(new T.CylinderGeometry(1.35,1.45,.35,48),'#f1e4d1',pool,0,.1,0);poolWall.scale.z=.72
 const water=mesh(new T.CylinderGeometry(1.18,1.18,.06,48),'#6bcce1',pool,0,.31,0);water.scale.z=.72;water.material=new T.MeshStandardMaterial({color:'#70d7e6',roughness:.18,metalness:.25,transparent:true,opacity:.86})
 const waves:T.Mesh[]=[]
 for(let i=0;i<3;i++){const m=mesh(new T.TorusGeometry(.3+i*.25,.013,4,32),'#d0f6f6',pool,0,.36,0);m.rotation.x=Math.PI/2;waves.push(m)}
 const duck=new T.Group();pool.add(duck);orb('#ffe49b',.7,.49,.25,.17,.12,.18,duck);orb('#ffe49b',.72,.65,.32,.12,.12,.12,duck);orb('#f1a55c',.72,.64,.43,.06,.03,.07,duck)
 // V5 shares the exact mesh, proportions and feather atlas with the reviewed preview.
 const bird=new T.Group();root.add(bird);bird.position.set(-1.1,.13,.25)
 const body=new T.Group();bird.add(body)
 const plumage=createPlumageTexture(),model=createXiaobuModel(plumage);body.add(model.mesh)
 const headBone=model.bones.find(b=>b.name==='Head')!
 const lids=[-1,1].map(sign=>{
  const point=posturePoint(new T.Vector3(sign*.348,2.273,faceSurface(.337,2.275)+.058),'head')
  const lid=orb('#edda64',0,0,0,.118,.158,.025,headBone)
  lid.position.copy(headBone.worldToLocal(model.mesh.localToWorld(point)))
  lid.rotation.set(Math.PI/22.5,sign*.48,0);lid.visible=false;return lid
 })
 const foodLocal=riggedFoodPoint(model)
 const footLocal=model.mesh.worldToLocal(model.contacts.foot.getWorldPosition(new T.Vector3()))
 const eggModel=createBirdEgg(),egg=eggModel.group;bird.add(egg)
 const ball=orb('#e7a9ba',.3,.3,1.3,.28);const ballRing=mesh(new T.TorusGeometry(.282,.015,5,32),'#fff0c5',ball);ballRing.rotation.x=.8
 const bowl=new T.Group();bowl.position.set(-.8,.18,1);root.add(bowl);mesh(new T.CylinderGeometry(.35,.24,.18,32),'#e3bb90',bowl);for(let k=0;k<8;k++)orb('#f1d08c',Math.sin(k*2)*.22,.12,Math.cos(k*2)*.22,.045,.025,.04,bowl)
 const foodStand=mesh(new T.CylinderGeometry(.07,.11,1,10),'#b4936c');foodStand.visible=false
 const foodBase=orb('#cba97a',0,.15,0,.32,.06,.29);foodBase.visible=false
 const brush=new T.Group();root.add(brush);box('#d9b58a',0,0,0,.15,.08,.65,brush);for(let k=0;k<5;k++)box('#f0e3d4',0,-.07,-.2+k*.08,.13,.13,.03,brush)
 const charm=mesh(new T.OctahedronGeometry(.22),'#90cfe8',root,2.5,.7,-.5);charm.material=mat('#8ac8e5',.2,.25)
 const scarf=new T.Group();model.bones.find(b=>b.name==='Neck')!.add(scarf);const collar=mesh(new T.TorusGeometry(.34,.075,8,32),'#dd9485',scarf,0,0,.05);collar.rotation.x=Math.PI/2;const end=box('#dd9485',.15,-.18,.35,.14,.36,.08,scarf);end.rotation.z=-.25
 const backpack=orb('#d9ba83',0,0,-.4,.32,.36,.16,model.bones.find(b=>b.name==='Chest')!)
 const pin=mesh(new T.OctahedronGeometry(.075),'#ffe4a0',model.bones.find(b=>b.name==='Chest')!,.23,-.1,.48)
 const toy=orb('#edc976',-.4,.45,1.7,.12)
 const decorObjects:Record<string,T.Group>={}
 for(const key of ['honey','berry','gem','shell','acorn','mushroom','chime','flower']){const g=new T.Group();g.position.set(2.7,.22,-.3);root.add(g);decorObjects[key]=g
  if(key==='gem'){mesh(new T.OctahedronGeometry(.28),'#8dcfe6',g,0,.28,0)}
  else if(key==='honey'){mesh(new T.CylinderGeometry(.2,.22,.4,20),'#dfb663',g,0,.2,0);mesh(new T.CylinderGeometry(.23,.23,.07,20),'#b49161',g,0,.44,0)}
  else if(key==='berry'){for(let k=0;k<5;k++)orb('#b694b6',Math.sin(k*2)*.17,.2,Math.cos(k*2)*.17,.13,.12,.13,g)}
  else if(key==='mushroom'){mesh(new T.CylinderGeometry(.09,.12,.4,12),'#eee0b5',g,0,.2,0);orb('#ddbca0',0,.47,0,.32,.18,.3,g)}
  else if(key==='flower'){flower(0,0,'#edb7cd',g)}
  else if(key==='chime'){box('#b4c6be',0,.68,0,.6,.07,.08,g);for(let k=0;k<3;k++)mesh(new T.CylinderGeometry(.035,.035,.4+k*.04,8),'#e5d3a4',g,(k-1)*.17,.38,0)}
  else{orb(key==='shell'?'#dfc3d9':'#b99463',0,.25,0,.23,.28,.2,g)}
 }
 let renderedActivity:BuddyActivity|'pending'='pending'
 const clock=createBirdClock()
 let renderDelta=0
 let state=initial,visible=true,frame=0,disposed=false,angle=0,last=0
 const reduce=matchMedia('(prefers-reduced-motion: reduce)')
 function sync(){nest.visible=state.count>=14;house.visible=state.count>=21;garden.visible=state.count>=28;pool.visible=state.count>=35;egg.visible=['egg','crack'].includes(state.stage);body.visible=!egg.visible;eggModel.crack.visible=state.stage==='crack';charm.visible=false;scarf.visible=state.accessory==='scarf';backpack.visible=state.accessory==='backpack';pin.visible=state.accessory==='pin';toy.visible=['bell','ball','swing'].includes(state.accessory);Object.entries(decorObjects).forEach(([key,g])=>{g.visible=key===state.decor});bird.scale.setScalar(['hatch','young'].includes(state.stage)?1.35:1.5);brush.visible=state.activity==='groom';bowl.visible=state.activity==='feed';foodStand.visible=bowl.visible;foodBase.visible=bowl.visible;ball.visible=state.activity==='play';}
 sync()
 const resize=new ResizeObserver(()=>{const {width,height}=canvas.getBoundingClientRect();if(width&&height){renderer.setSize(width,height,false);camera.aspect=width/height;camera.position.set(width<500?7:9,width<500?6:8,width<500?11:14);camera.lookAt(0,1,0);camera.updateProjectionMatrix()}});resize.observe(canvas)
 const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;pauseClock()});observer.observe(canvas)
 function animate(now:number){if(disposed)return;frame=requestAnimationFrame(animate);const active=visible&&!document.hidden;clock.tick(now,active);if(!active){renderDelta=0;return}renderDelta+=clock.delta;if(now-last<(reduce.matches?180:33))return;last=now;const dt=renderDelta;renderDelta=0;const t=reduce.matches?0:clock.time,moving=!reduce.matches
  const sleeping=state.activity==='sleep',fly=state.activity==='adventure'||state.flapping
  const gardenPlay=state.area==='garden'&&state.activity==='idle',swim=state.area==='pool'&&state.activity==='idle'
  const elapsed=clock.action
  const target=sleeping||state.area==='nest'?new T.Vector3(-2.6,state.count>=14?.45:.25,-.9):swim?new T.Vector3(3.2,.45,1.5):gardenPlay?new T.Vector3(-3.1,.35,1.1):new T.Vector3(-1.1,.13,.25)
  if(moving)target.y+=fly?(.7+Math.sin(elapsed*4)*.2)*(1-Math.exp(-elapsed*8)):gardenPlay?.25+Math.sin(t*3)*.16:0
  bird.position.lerp(target,damping(8,dt,reduce.matches))
  sleepMat.visible=sleeping&&state.count<14
  egg.rotation.z=moving&&egg.visible?(state.stage==='crack'?.025:.012)*Math.sin(elapsed*7)*Math.exp(-elapsed*.5):0
  body.scale.y=1
  const previous=model.bones.map(b=>b.quaternion.clone())
  poseRiggedBird(model,state.activity,elapsed,fly||swim||gardenPlay,reduce.matches)
  model.bones.forEach((b,i)=>b.quaternion.copy(previous[i].slerp(b.quaternion,damping(18,dt,reduce.matches))))
  model.mesh.updateMatrixWorld(true);model.mesh.skeleton.update()
  const close=sleeping?(reduce.matches?1:T.MathUtils.smoothstep(elapsed,1.4,2.1)):0
  lids.forEach(lid=>{lid.visible=close>0;lid.scale.y=.158*close})
  root.updateMatrixWorld(true)
  // All props use actual skeleton/model coordinates, independent of the camera.
  const inPark=(point:T.Vector3)=>root.worldToLocal(model.mesh.localToWorld(point.clone()))
  bowl.position.copy(inPark(foodLocal));bowl.position.y-=.12;bowl.scale.setScalar(.85)
  foodStand.position.set(bowl.position.x,bowl.position.y/2,bowl.position.z);foodStand.scale.y=Math.max(.1,bowl.position.y-.08)
  foodBase.position.set(bowl.position.x,.15,bowl.position.z)
  const kickPoint=footLocal.clone().add(new T.Vector3(.26,.08,.07))
  kickPoint.x+=riggedBallTravel(elapsed,reduce.matches)
  ball.position.copy(inPark(kickPoint));ball.rotation.z=-riggedBallTravel(elapsed,reduce.matches)/.28
  if(moving){brush.position.copy(inPark(new T.Vector3(.5,1.5,1.1)));brush.position.x+=Math.sin(t*3)*.15;brush.rotation.z=Math.sin(t*3)*.3;butterfly.position.set(Math.cos(t)*.7,1.3+Math.sin(t*2)*.15,Math.sin(t)*.5);butterflyWings.forEach((w,i)=>w.rotation.z=(i?1:-1)*Math.sin(t*12)*.7);waves.forEach((w,i)=>{w.scale.setScalar(.8+((t*.3+i*.3)%1)*.5)});duck.rotation.y=Math.sin(t*.7)*.2;charm.rotation.y=t*.5}
  const night=sleeping?.32:1;sun.intensity=T.MathUtils.lerp(sun.intensity,4*night,damping(5,dt,reduce.matches));fill.intensity=T.MathUtils.lerp(fill.intensity,sleeping?1.4:1.3,damping(8,dt,reduce.matches))
  root.rotation.y=T.MathUtils.lerp(root.rotation.y,angle,damping(7,dt,reduce.matches));renderer.render(scene,camera);renderedActivity=state.activity
 }
 frame=requestAnimationFrame(animate)
 function pauseClock(){clock.tick(performance.now(),false);renderDelta=0}
 document.addEventListener('visibilitychange',pauseClock)
 const lost=(event:Event)=>{event.preventDefault();onLost()};canvas.addEventListener('webglcontextlost',lost)
 return {captureCharacter(){
  const saved=root.children.map(o=>o.visible),position=camera.position.clone(),quaternion=camera.quaternion.clone()
  root.children.forEach(o=>o.visible=o===bird);const center=bird.position.clone().add(new T.Vector3(0,egg.visible?1:1.65,.15))
  camera.position.copy(center).add(new T.Vector3(3.3,1,6.3));camera.lookAt(center);renderer.render(scene,camera)
  const image=canvas.toDataURL('image/png');root.children.forEach((o,i)=>o.visible=saved[i]);camera.position.copy(position);camera.quaternion.copy(quaternion);return image
 },update(next:ParkState){if(next.activity!==state.activity||next.interactionId!==state.interactionId||(!state.flapping&&next.flapping))clock.restart();state=next;sync()},rotate(delta:number){angle=T.MathUtils.clamp(angle+delta,-.55,.55)},dispose(){disposed=true;cancelAnimationFrame(frame);resize.disconnect();observer.disconnect();canvas.removeEventListener('webglcontextlost',lost);document.removeEventListener('visibilitychange',pauseClock);scene.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose())}});materials.forEach(m=>m.dispose());plumage.dispose();renderer.dispose();renderer.forceContextLoss()},info(){return {triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls,house:house.visible,garden:garden.visible,pool:pool.visible,activity:state.activity,renderedActivity,actionElapsed:clock.action,environmentElapsed:clock.time,reducedMotion:reduce.matches,character:'rigged-v5',birdSize:bird.scale.toArray(),birdPosition:bird.position.toArray(),food:bowl.position.toArray(),ball:ball.position.toArray(),nest:nest.visible,sleepMat:sleepMat.visible,bones:model.stats.bones,characterTriangles:model.stats.triangles,beak:root.worldToLocal(model.contacts.beak.getWorldPosition(new T.Vector3())).toArray()}}}
}
