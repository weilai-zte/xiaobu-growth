import {createBirdEgg} from './birdEgg'
import {createBirdClock,damping} from '../lib/birdMotion'
import {createXiaobuModel} from '../preview/xiaobuModel'
import {createPlumageTexture} from '../preview/plumageTexture'
import {posturePoint} from '../preview/birdPosture'
import {faceSurface} from '../preview/birdShape'
import {applyRiggedGrowth,poseRiggedBird,riggedFoodPoint,riggedBallTravel} from '../lib/riggedBirdMotion'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import * as T from 'three'
import type { BuddyActivity } from '../db/types'
import type { ParkArea } from '../lib/park'
import {parkCollection,treasurePlacement} from '../lib/parkCollection'
export interface ParkState {stage:string;count:number;activity:BuddyActivity;area:ParkArea;flapping:boolean;accessory:string;decor:string;treasures?:string[];items?:string[];interactionId?:number}
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

 // 叶棚、枝灯与软垫让小窝成为独立的休息角落。
 for(const x of [-1,1])mesh(new T.CylinderGeometry(.045,.075,1.7,8),'#aa8053',nest,x,.85,-.65)
 const canopy=orb('#9cbb75',0,1.75,-.65,1.3,.12,.65,nest);canopy.rotation.z=.08
 for(let i=-2;i<=2;i++){const vein=box('#cee0a2',i*.4,1.85,-.65,.025,.025,.85,nest);vein.rotation.y=i*.16}
 orb('#ffe0a1',-1.04,1.2,-.6,.12,.18,.12,nest)

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
 // 门廊、花盆、烟囱和小灯串随小屋建成，留出门前活动空间。
 box('#af947b',.7,3.1,-.35,.32,.85,.36,house)
 const awning=box('#b7c991',0,2.05,1.25,1.3,.10,.55,house);awning.rotation.x=.15
 for(let i=-2;i<=2;i++)orb('#ffe7a6',i*.4,2.35-Math.cos(i*.5)*.13,1.08,.075,.10,.075,house)
 for(const x of [-1.35,1.35]){
  mesh(new T.CylinderGeometry(.24,.17,.35,12),'#bd987a',house,x,.35,1.05)
  for(let i=0;i<3;i++){orb('#91b77e',x+(i-1)*.12,.66+Math.sin(i)*.12,1.05,.14,.19,.12,house);orb(i%2?'#efc4cc':'#ffe5aa',x+(i-1)*.12,.85+Math.sin(i)*.12,1.05,.12,.08,.12,house)}
 }
 for(let i=0;i<6;i++)box('#f2dfb8',-1.5+i*.6,.44,-1.35,.12,.8,.1,house)
 box('#d8bd91',0,.58,-1.35,3.2,.10,.1,house)
 box('#d4c59e',0,.46,1.45,.75,.025,.38,house)

 const garden=new T.Group();garden.position.set(-3,.1,1.25);root.add(garden)
 function flower(x:number,z:number,color:string,parent:T.Group){mesh(new T.CylinderGeometry(.025,.035,.4,6),'#689a67',parent,x,.25,z);for(let k=0;k<5;k++){const a=k*Math.PI*2/5;orb(color,x+Math.cos(a)*.13,.5,z+Math.sin(a)*.13,.12,.07,.12,parent)}orb('#ffe8a4',x,.54,z,.075,.06,.075,parent)}
 for(let i=0;i<7;i++){flower(-3.8+i*.42,2.25+Math.sin(i)*.35,['#f4c3b6','#fff0bd','#c4bbdf'][i%3],root)}
 for(let i=0;i<6;i++){orb('#bdd398',-4+i*1.45,.2,-3.15,.35,.18,.32)}
 for(let i=0;i<14;i++){const a=i*2.4,r=.3+Math.sqrt(i)*.27;flower(Math.cos(a)*r,Math.sin(a)*r,['#f6adc5','#dac7ee','#fff0bb'][i%3],garden)}
 for(let i=0;i<5;i++){box('#f5e5c5',-1.1+i*.5,.25,-1.2,.08,.6,.08,garden)}box('#e2d0b3',0,.4,-1.2,2.4,.08,.08,garden)
 const butterfly=new T.Group();garden.add(butterfly);butterfly.scale.setScalar(1.7);butterfly.rotation.x=.65;butterfly.position.set(1.2,2.8,.2);const butterflyWings=[orb('#f5c3d2',-.13,0,0,.17,.03,.23,butterfly),orb('#f5c3d2',.13,0,0,.17,.03,.23,butterfly)]
 // 开花拱门和高低花丛，让花园不只是一小块地面摆件。
 for(const x of [-1.3,1.3])mesh(new T.CylinderGeometry(.06,.08,2.5,8),'#b7c18c',garden,x,1.25,-.9)
 mesh(new T.TorusGeometry(1.3,.07,8,32,Math.PI),'#b7c18c',garden,0,2.5,-.9)
 for(let i=0;i<7;i++){const a=i*Math.PI/6;orb(i%2?'#e8b3cb':'#f7e5af',Math.cos(a)*1.3,2.5+Math.sin(a)*1.3,-.9,.22,.19,.13,garden)}
 const extraButterflies=[['#b3dced',-1.4,3.05,.3],['#edd18e',1.1,3.6,.5]].map(([color,x,y,z])=>{
  const g=new T.Group();garden.add(g);g.position.set(Number(x),Number(y),Number(z));g.rotation.x=.65
  for(const sign of [-1,1])orb(String(color),sign*.18,0,0,.23,.045,.3,g)
  orb('#807683',0,0,0,.035,.05,.16,g);return g
 })

 const pool=new T.Group();pool.position.set(3.4,.13,1.5);pool.scale.setScalar(1.45);root.add(pool)
 const poolWall=mesh(new T.CylinderGeometry(1.35,1.45,.35,48),'#f1e4d1',pool,0,.1,0);poolWall.scale.z=.72
 const water=mesh(new T.CylinderGeometry(1.18,1.18,.06,48),'#6bcce1',pool,0,.31,0);water.scale.z=.72;water.material=new T.MeshStandardMaterial({color:'#70d7e6',roughness:.18,metalness:.25,transparent:true,opacity:.86})
 const waves:T.Mesh[]=[]
 for(let i=0;i<3;i++){const m=mesh(new T.TorusGeometry(.3+i*.25,.013,4,32),'#d0f6f6',pool,0,.36,0);m.rotation.x=Math.PI/2;waves.push(m)}
 const duck=new T.Group();pool.add(duck);orb('#ffe49b',.7,.49,.25,.17,.12,.18,duck);orb('#ffe49b',.72,.65,.32,.12,.12,.12,duck);orb('#f1a55c',.72,.64,.43,.06,.03,.07,duck)
 // 池畔遮阳伞、救生圈和入水台阶，形成完整的玩水角落。
 mesh(new T.CylinderGeometry(.025,.04,2.4,8),'#c7aa85',pool,1.35,1.2,-.55)
 const umbrella=mesh(new T.ConeGeometry(.82,.45,8),'#afa8d4',pool,1.35,2.55,-.55)
 umbrella.rotation.y=Math.PI/8
 const floatRing=mesh(new T.TorusGeometry(.28,.085,10,28),'#f0b8bf',pool,-.65,.42,.55);floatRing.rotation.x=Math.PI/2
 for(let i=0;i<3;i++)box('#e8d5b3',-.8+i*.3,.12+i*.06,1.15,.4,.12,.3,pool)
 box('#c9b18b',1.35,.28,.65,.6,.12,.65,pool)
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
 let foodLocal=riggedFoodPoint(model)
 let footLocal=model.mesh.worldToLocal(model.contacts.foot.getWorldPosition(new T.Vector3()))
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
 // 百宝箱物品均由拥有记录驱动，每种显示一件。
 const toyObjects:Record<string,T.Group>={}
 for(const key of ['bell','ball','swing']){const g=new T.Group();root.add(g);toyObjects[key]=g
  if(key==='bell'){
   g.position.set(-.2,.12,3.5)
   mesh(new T.CylinderGeometry(.035,.055,1,8),'#b79a70',g,-.2,.5,0);box('#b79a70',.03,1,0,.55,.06,.06,g)
   mesh(new T.TorusGeometry(.055,.018,6,12),'#d2ae62',g,.22,.88,0)
   mesh(new T.CylinderGeometry(.10,.19,.25,16),'#e6bf68',g,.22,.68,0);orb('#b68b45',.22,.53,0,.04,.055,.04,g)
  }else if(key==='ball'){
   g.position.set(.8,.3,3.5);orb('#ba9bd9',0,0,0,.24,.24,.24,g)
   mesh(new T.TorusGeometry(.241,.012,6,24),'#fff1c7',g).rotation.x=.8
  }else{
   g.position.set(-4.6,.12,1.15)
   for(const x of [-.6,.6])mesh(new T.CylinderGeometry(.055,.08,1.8,8),'#b38c63',g,x,.9,0)
   box('#b38c63',0,1.8,0,1.4,.09,.09,g)
   for(const x of [-.4,.4])mesh(new T.CylinderGeometry(.015,.015,1.15,6),'#e0cf9c',g,x,1.15,0)
   box('#c9a16e',0,.56,0,1,.1,.38,g)
  }
 }
 const decorObjects:Record<string,T.Group>={}
 for(const key of ['honey','berry','gem','shell','acorn','mushroom','chime','flower']){const g=new T.Group();root.add(g);decorObjects[key]=g
  if(key==='gem'){
   mesh(new T.CylinderGeometry(.25,.29,.1,12),'#d5c3a1',g,0,.05,0)
   const jewel=mesh(new T.OctahedronGeometry(.28),'#8dcfe6',g,0,.37,0);jewel.material=mat('#8dcfe6',.2,.3)
  }else if(key==='honey'){
   mesh(new T.CylinderGeometry(.2,.22,.4,20),'#dfb663',g,0,.2,0);mesh(new T.CylinderGeometry(.23,.23,.07,20),'#b49161',g,0,.44,0)
   box('#fff0b6',0,.22,.214,.19,.17,.02,g)
  }else if(key==='berry'){
   mesh(new T.CylinderGeometry(.29,.22,.24,16),'#b99669',g,0,.12,0)
   mesh(new T.TorusGeometry(.24,.025,6,20,Math.PI),'#98754e',g,0,.25,0)
   for(let k=0;k<5;k++)orb(k%2?'#b496ce':'#8389c1',Math.sin(k*2)*.17,.28,Math.cos(k*2)*.17,.10,.10,.10,g)
  }else if(key==='shell'){
   orb('#edbdba',0,.3,0,.29,.29,.12,g)
   for(let i=0;i<5;i++){const a=(i+.5)*Math.PI/5;const rib=box('#ffe3d2',Math.cos(a)*.11,.28+Math.sin(a)*.09,.12,.018,.31,.018,g);rib.rotation.z=-Math.cos(a)*.65}
  }else if(key==='acorn'){
   orb('#d1a15c',0,.25,0,.21,.27,.21,g);orb('#a4814d',0,.43,0,.24,.10,.24,g)
   mesh(new T.CylinderGeometry(.035,.035,.13,6),'#8d724b',g,0,.55,0);const leaf=orb('#93b774',.12,.55,0,.15,.025,.06,g);leaf.rotation.z=.3
  }else if(key==='mushroom'){
   mesh(new T.CylinderGeometry(.09,.12,.4,12),'#eee0b5',g,0,.2,0);const cap=orb('#a99acb',0,.47,0,.32,.18,.3,g);cap.material=new T.MeshStandardMaterial({color:'#a99acb',emissive:'#6d5c9b',emissiveIntensity:.25})
   for(let i=0;i<5;i++){const a=i*1.3;orb('#fff0c8',Math.cos(a)*.18,.59,Math.sin(a)*.16,.045,.018,.04,g)}
  }else if(key==='chime'){
   mesh(new T.CylinderGeometry(.025,.045,1.1,8),'#ad956c',g,-.35,.55,0);box('#b4c6be',0,1.1,0,.8,.06,.08,g)
   for(let k=0;k<3;k++){mesh(new T.CylinderGeometry(.01,.01,.22,6),'#e2d1a8',g,(k-1)*.17,.97,0);mesh(new T.CylinderGeometry(.035,.035,.4+k*.04,8),'#e5d3a4',g,(k-1)*.17,.65,0)}
   mesh(new T.OctahedronGeometry(.10),'#f8dc8e',g,0,.32,0)
  }else{
   mesh(new T.CylinderGeometry(.21,.15,.23,12),'#ccaa91',g,0,.12,0);flower(0,0,'#edb7cd',g)
  }
 }
 const favoriteRing=mesh(new T.TorusGeometry(.45,.025,6,32),'#f4d486');favoriteRing.rotation.x=Math.PI/2
 let renderedActivity:BuddyActivity|'pending'='pending'
 const clock=createBirdClock()
 let renderDelta=0
 let state=initial,visible=true,frame=0,disposed=false,angle=0,last=0,viewportWidth=800
 let growthStage=''
 const focus=new T.Vector3()
 const areaFocus:Record<ParkArea,[number,number,number]>={meadow:[-.7,1.4,0],nest:[-2.2,1.3,-.7],home:[.7,1.4,-.5],garden:[-2.7,1.4,1.1],pool:[2.8,1.4,1.3]}
 const areaColors:Record<ParkArea,[string,string,string]>={meadow:['#bcda9b','#83b58b','#fff2ce'],nest:['#d9ce9c','#a99a70','#ffe1a3'],home:['#cfdbac','#91a67f','#ffe0a2'],garden:['#bbd6a7','#819f87','#ffe0ed'],pool:['#a6cbd3','#749eaf','#c7ddff']}
 focus.set(...areaFocus[state.area])
 const starLights=new T.Group();pool.add(starLights)
 for(let i=0;i<12;i++){const a=i*Math.PI/6;const star=mesh(new T.OctahedronGeometry(i%3===0?.095:.06),'#fff2a3',starLights,Math.cos(a)*1.5,.85+(i%3)*.6,Math.sin(a)*1.05);star.material=new T.MeshStandardMaterial({color:'#fff0ab',emissive:'#ffe28a',emissiveIntensity:1.2})}
 const reduce=matchMedia('(prefers-reduced-motion: reduce)')
 function sync(){nest.visible=state.count>=14;house.visible=state.count>=21;garden.visible=state.count>=28;pool.visible=state.count>=35;egg.visible=['egg','crack'].includes(state.stage);body.visible=!egg.visible;eggModel.crack.visible=state.stage==='crack';charm.visible=false;scarf.visible=state.accessory==='scarf';backpack.visible=state.accessory==='backpack';pin.visible=state.accessory==='pin';const collection=parkCollection(state.treasures,state.items,state.decor);Object.entries(toyObjects).forEach(([key,g])=>{g.visible=collection.toys.some(item=>item===key)&&!(key==='ball'&&state.activity==='play');g.scale.setScalar(key===state.accessory?1.12:1)});Object.entries(decorObjects).forEach(([key,g])=>{g.visible=collection.treasures.some(item=>item===key);const placement=treasurePlacement(key,state.count,state.area,key===collection.favorite);g.position.set(...placement.position);g.scale.setScalar(placement.scale)});favoriteRing.visible=!!collection.favorite;if(collection.favorite){const position=treasurePlacement(collection.favorite,state.count,state.area,true).position;favoriteRing.position.set(position[0],.14,position[2])}if(growthStage!==state.stage){growthStage=state.stage;bird.scale.setScalar(applyRiggedGrowth(model,state.stage));foodLocal=riggedFoodPoint(model);footLocal=model.mesh.worldToLocal(model.contacts.foot.getWorldPosition(new T.Vector3()))}const colors=areaColors[state.area];(lawn.material as T.MeshStandardMaterial).color.set(colors[0]);(ground.material as T.MeshStandardMaterial).color.set(colors[1]);sun.color.set(colors[2]);starLights.visible=state.area==='pool';brush.visible=state.activity==='groom';bowl.visible=state.activity==='feed';foodStand.visible=bowl.visible;foodBase.visible=bowl.visible;ball.visible=state.activity==='play';}
 sync()
 const resize=new ResizeObserver(()=>{const {width,height}=canvas.getBoundingClientRect();if(width&&height){renderer.setSize(width,height,false);camera.aspect=width/height;viewportWidth=width;camera.updateProjectionMatrix()}});resize.observe(canvas)
 const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;pauseClock()});observer.observe(canvas)
 function animate(now:number){if(disposed)return;frame=requestAnimationFrame(animate);const active=visible&&!document.hidden;clock.tick(now,active);if(!active){renderDelta=0;return}renderDelta+=clock.delta;if(now-last<(reduce.matches?180:33))return;last=now;const dt=renderDelta;renderDelta=0;const t=reduce.matches?0:clock.time,moving=!reduce.matches
  const sleeping=state.activity==='sleep',eggStage=['egg','crack'].includes(state.stage)
  const practice=state.stage==='young'&&state.activity==='idle'&&state.area==='meadow'&&!reduce.matches&&(t%7)>2&&(t%7)<4.5
  const soaring=state.stage==='adult'&&state.activity==='idle'&&state.area==='meadow'&&!reduce.matches&&(t%11)>4&&(t%11)<8
  const fly=!eggStage&&(state.activity==='adventure'||state.flapping||practice||soaring)
  const gardenPlay=state.area==='garden'&&state.activity==='idle',swim=state.area==='pool'&&state.activity==='idle'
  const elapsed=clock.action
  const target=sleeping||state.area==='nest'?new T.Vector3(-2.6,state.count>=14?.45:.25,-.9):state.area==='pool'?new T.Vector3(3.2,.45,1.5):state.area==='garden'?new T.Vector3(-3.1,.35,1.1):state.area==='home'?new T.Vector3(.3,.13,.65):new T.Vector3(-1.1,.13,.25)
  if(moving)target.y+=fly?(state.stage==='hatch'?.16:practice?.28:1.05)+Math.sin(t*4)*.12:gardenPlay?.35+Math.sin(t*3)*.18:0
  if(soaring){target.x+=Math.sin(t*1.4)*.65;target.z+=Math.cos(t*1.4)*.35}
  bird.position.lerp(target,damping(8,dt,reduce.matches))
  sleepMat.visible=sleeping&&state.count<14
  egg.rotation.z=moving&&egg.visible?(state.stage==='crack'?.025:.012)*Math.sin(elapsed*7)*Math.exp(-elapsed*.5):0
  body.scale.y=1
  const previous=model.bones.map(b=>b.quaternion.clone())
  poseRiggedBird(model,state.activity,practice||soaring?t:elapsed,fly||swim||gardenPlay,reduce.matches)
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
  if(moving){extraButterflies.forEach((g,i)=>{g.rotation.y=Math.sin(t*1.4+i)*.3;g.children.slice(0,2).forEach((w,k)=>{w.rotation.z=(k?1:-1)*Math.sin(t*10+i)*.55})});brush.position.copy(inPark(new T.Vector3(.5,1.5,1.1)));brush.position.x+=Math.sin(t*3)*.15;brush.rotation.z=Math.sin(t*3)*.3;butterfly.position.set(Math.cos(t)*1.5,2.8+Math.sin(t*2)*.3,Math.sin(t)*.7);butterflyWings.forEach((w,i)=>w.rotation.z=(i?1:-1)*Math.sin(t*12)*.7);waves.forEach((w,i)=>{w.scale.setScalar(.8+((t*.3+i*.3)%1)*.5)});duck.rotation.y=Math.sin(t*.7)*.2;charm.rotation.y=t*.5}
  const night=sleeping?.32:1;sun.intensity=T.MathUtils.lerp(sun.intensity,4*night,damping(5,dt,reduce.matches));fill.intensity=T.MathUtils.lerp(fill.intensity,sleeping?1.4:1.3,damping(8,dt,reduce.matches))
  const frameArea=sleeping&&state.count>=14?'nest':state.area
  const localFocus=new T.Vector3(...areaFocus[frameArea]);root.updateMatrixWorld(true);const worldFocus=root.localToWorld(localFocus)
  focus.lerp(worldFocus,damping(6,dt,reduce.matches));const distance=viewportWidth<500?1.22:1
  camera.position.copy(focus).add(new T.Vector3(6.2,4.8,9.2).multiplyScalar(distance));camera.lookAt(focus)
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
 },update(next:ParkState){if(next.activity!==state.activity||next.interactionId!==state.interactionId||(!state.flapping&&next.flapping))clock.restart();state=next;sync()},rotate(delta:number){angle=T.MathUtils.clamp(angle+delta,-.55,.55)},dispose(){disposed=true;cancelAnimationFrame(frame);resize.disconnect();observer.disconnect();canvas.removeEventListener('webglcontextlost',lost);document.removeEventListener('visibilitychange',pauseClock);scene.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose())}});materials.forEach(m=>m.dispose());plumage.dispose();renderer.dispose();renderer.forceContextLoss()},info(){return {triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls,house:house.visible,garden:garden.visible,pool:pool.visible,activity:state.activity,renderedActivity,actionElapsed:clock.action,environmentElapsed:clock.time,reducedMotion:reduce.matches,character:'rigged-v5',stage:state.stage,area:state.area,displayedTreasures:Object.entries(decorObjects).filter(([,g])=>g.visible).map(([key])=>key),displayedToys:Object.entries(toyObjects).filter(([,g])=>g.visible).map(([key])=>key),favorite:parkCollection(state.treasures,state.items,state.decor).favorite,headScale:headBone.scale.x,wingScale:model.bones.find(b=>b.name==='WingL')!.scale.x,tailScale:model.bones.find(b=>b.name==='Tail')!.scale.x,cameraFocus:focus.toArray(),birdSize:bird.scale.toArray(),birdPosition:bird.position.toArray(),food:bowl.position.toArray(),ball:ball.position.toArray(),nest:nest.visible,sleepMat:sleepMat.visible,bones:model.stats.bones,characterTriangles:model.stats.triangles,beak:root.worldToLocal(model.contacts.beak.getWorldPosition(new T.Vector3())).toArray()}}}
}
