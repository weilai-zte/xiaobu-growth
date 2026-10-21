import {posturePoint,boneRegion} from './birdPosture'
import {continuousBirdSurface,faceSurface,birdSection} from './birdShape'
import * as T from 'three'
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js'

/** A real, self-contained skinned mesh. No sprites, image planes, or pose atlases. */
export function createXiaobuModel(plumage?:T.Texture){
 const bones:T.Bone[]=[],rest:T.Vector3[]=[],pieces:T.BufferGeometry[]=[]
 function bone(name:string,parent:number,x:number,y:number,z:number){
  const b=new T.Bone();b.name=name;const p=posturePoint(new T.Vector3(x,y,z),boneRegion(name))
  b.position.copy(parent<0?p:p.clone().sub(rest[parent]));if(parent>=0)bones[parent].add(b)
  bones.push(b);rest.push(p);return bones.length-1
 }
 const root=bone('Root',-1,0,0,0),body=bone('Body',root,0,.9,0),chest=bone('Chest',body,0,1.35,0)
 const neck=bone('Neck',chest,0,1.84,.04),head=bone('Head',neck,0,2.08,.08),jaw=bone('Jaw',head,0,2.02,.64)
 const leftWing=bone('WingL',chest,.53,1.55,-.03),leftTip=bone('WingTipL',leftWing,.68,1.05,-.25)
 const rightWing=bone('WingR',chest,-.53,1.55,-.03),rightTip=bone('WingTipR',rightWing,-.68,1.05,-.25)
 const tail=bone('Tail',body,0,.8,-.36),tailTip=bone('TailTip',tail,0,.42,-1.2)
 const leftLeg=bone('LegL',body,.25,.4,.02),leftFoot=bone('FootL',leftLeg,.25,.14,.2)
 const rightLeg=bone('LegR',body,-.25,.4,.02),rightFoot=bone('FootR',rightLeg,-.25,.14,.2)
 for(const [side,foot,x] of [['L',leftFoot,.25],['R',rightFoot,-.25]] as const)for(let i=0;i<3;i++)bone(`Toe${side}${i}`,foot,x+(i-1)*.075,.08,.43)
 const beak=new T.Object3D();beak.name='BeakContact';beak.position.copy(posturePoint(new T.Vector3(0,1.905,.92),'head').sub(rest[head]));bones[head].add(beak)
 const footContact=new T.Object3D();footContact.name='FootContact';footContact.position.set(0,-.05,.23);bones[leftFoot].add(footContact)
 function add(geometry:T.BufferGeometry,index:number,color:T.ColorRepresentation,gloss=false,gradient?:T.ColorRepresentation,headUV=false){
  const p=geometry.getAttribute('position'),colors:number[]=[],indices:number[]=[],weights:number[]=[]
  const c=new T.Color(color),other=gradient?new T.Color(gradient):c
  for(let i=0;i<p.count;i++){
   const mix=gradient?T.MathUtils.clamp((p.getY(i)-.5)/2,0,1):0,cc=c.clone().lerp(other,mix)
   colors.push(cc.r,cc.g,cc.b);if(geometry.userData.continuousBody){
    const y=p.getY(i),chain=y<1.55?[body,chest,1.35,1.7]:y<1.9?[chest,neck,1.55,1.95]:[neck,head,1.9,2.15],w=T.MathUtils.smoothstep(y,chain[2],chain[3]);indices.push(chain[0],chain[1],0,0);weights.push(1-w,w,0,0)
   }else{indices.push(index,0,0,0);weights.push(1,0,0,0)}
  }
  for(let i=0;i<p.count;i++){const posed=posturePoint(new T.Vector3(p.getX(i),p.getY(i),p.getZ(i)),geometry.userData.continuousBody?'surface':boneRegion(bones[index].name));p.setXYZ(i,posed.x,posed.y,posed.z)}
  geometry.computeVertexNormals()
  if(!geometry.hasAttribute('color'))geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3))
  geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4))
  const featherUV=geometry.userData.featherUV,wingUV=geometry.userData.wingUV,bodyUV=geometry.userData.bodyUV
  if(geometry.index)geometry=geometry.toNonIndexed()
  const originalUV=geometry.getAttribute('uv'),uv:number[]=[];for(let i=0;i<geometry.getAttribute('position').count;i++){
   const u=originalUV?.getX(i)??.5,v=originalUV?.getY(i)??.5
   uv.push(headUV?.51+u*.48:(bodyUV||wingUV||featherUV)?.01+u*.48:.75,headUV||bodyUV?.51+v*.48:wingUV?.01+v*.48:featherUV?.51+v*.48:.25)
  }geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.clearGroups();geometry.addGroup(0,geometry.getAttribute('position').count,gloss?1:0)
  pieces.push(geometry)
 }
 function ellipsoid(index:number,color:T.ColorRepresentation,x:number,y:number,z:number,sx:number,sy:number,sz:number,gloss=false,segments=14){
  const g=new T.SphereGeometry(1,segments,segments>=24?18:10);g.scale(sx,sy,sz);g.translate(x,y,z);add(g,index,color,gloss)
 }
 function rod(index:number,color:T.ColorRepresentation,a:T.Vector3,b:T.Vector3,r:number){
  const d=b.clone().sub(a),g=new T.CylinderGeometry(r*.84,r,d.length(),7,1)
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());add(g,index,color)
 }
 // The head, neck and breast share vertices and smoothly blended skin weights.
 add(continuousBirdSurface(),body,'#ffffff')
 // Raised feather vanes with camber, a central ridge and colored scalloped edges.
 function feather(index:number,center:T.Vector3,length:number,width:number,axis:T.Vector3,normal:T.Vector3,base:string,edge:string){
  const positions:number[]=[],colors:number[]=[],featherUV:number[]=[],idx:number[]=[],rows=6,columns=5
  const down=axis.clone().normalize(),out=normal.clone().normalize(),side=new T.Vector3().crossVectors(down,out).normalize()
  const dark=new T.Color(base),light=new T.Color(edge),patterned=base.startsWith('#2')
  for(let r=0;r<=rows;r++){
   const t=r/rows,span=Math.max(.008,Math.sqrt(Math.sin(Math.PI*t)))*width*.5
   for(let c=0;c<columns;c++){
    const across=(c-2)/2
    const v=center.clone().addScaledVector(down,t*length).addScaledVector(side,across*span).addScaledVector(out,Math.max(0,1-across*across)*Math.sin(Math.PI*t)*width*.065)
    positions.push(v.x,v.y,v.z);featherUV.push(c/(columns-1),1-t)
    const border=patterned?T.MathUtils.smoothstep(Math.abs(across),.5,1):.3+Math.abs(across)*.14
    const tip=T.MathUtils.smoothstep(t,.72,.99)
    const col=dark.clone().lerp(light,Math.max(border,tip*.75));colors.push(col.r,col.g,col.b)
   }
  }
  for(let r=0;r<rows;r++)for(let c=0;c<columns-1;c++){const a=r*columns+c,b=a+columns;idx.push(a,b,a+1,b,b+1,a+1)}
  const g=new T.BufferGeometry();g.userData.featherUV=index===body||index===chest;g.setAttribute('uv',new T.Float32BufferAttribute(featherUV,2));g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(idx);g.computeVertexNormals();add(g,index,base)
 }
 // Low-relief, curved down feathers only soften the outline; never an opaque fur shell.
 for(let row=0;row<7;row++)for(const sign of [-1,1]){
  const y=1.62-row*.155,section=birdSection(y),yellow=false
  feather(y>1.8?neck:body,new T.Vector3(sign*(section.x-.025),y,section.centerZ-.01),.135,.10,new T.Vector3(sign*.13,-1,-.1),new T.Vector3(sign,.1,.1),yellow?'#e8d958':'#7cae3f',yellow?'#f4e580':'#9cbe57')
 }
 // Distinctive black scallops edged in yellow on both folded wings.
 for(const [sign,wing,tip] of [[1,leftWing,leftTip],[-1,rightWing,rightTip]]){
  const wingShape=new T.SphereGeometry(1,20,14);wingShape.scale(.245,.69,.43);wingShape.translate(sign*.57,1.22,-.08);wingShape.userData.wingUV=true;add(wingShape,wing,'#ffffff')
  for(let i=0;i<5;i++)feather(tip,new T.Vector3(sign*(.52+i*.025),.8,-.2-i*.04),.92,.15,new T.Vector3(sign*.12,-.95,-.85),new T.Vector3(sign*.8,.15,.6),'#195d64','#7fbb51')
 }
 // Layered tapered cobalt tail; real thickness and back silhouette.
 for(let i=-4;i<=4;i++)feather(Math.abs(i)>1?tail:tailTip,new T.Vector3(i*.07,.78,-.29),1.85-Math.abs(i)*.15,.20,new T.Vector3(i*.08,-.24,-1),new T.Vector3(0,1,.15),'#12668d','#42a3b1')
 // Wavy dark budgie markings remain predominantly on the crown/back, leaving a clean face.
 // Glossy black eyes with ivory rims and tiny highlights, on both sides of a 3D face.
 function faceOval(sign:number,color:string,y:number,x:number,z:number,sx:number,sy:number,sz:number,gloss=false){
  const g=new T.SphereGeometry(1,color==='#181c20'?20:14,color==='#181c20'?12:10);g.scale(sx,sy,sz);g.rotateY(sign*.48);g.translate(sign*x,y,z);add(g,head,color,gloss)
 }
 for(const sign of [-1,1]){
  const x=.337,y=2.275,surface=faceSurface(x,y)
  faceOval(sign,'#cdb244',y,x,surface+.003,.137,.181,.009)
  faceOval(sign,'#fff3cf',y,x+.004,surface+.011,.126,.168,.008,true)
  faceOval(sign,'#59432c',y-.002,x+.008,surface+.019,.114,.156,.013,true)
  faceOval(sign,'#181c20',y-.002,x+.011,surface+.026,.104,.147,.015,true)
  faceOval(sign,'#ffffff',y+.051,x-.018,surface+.048,.031,.043,.007,true)
  faceOval(sign,'#77858b',y-.054,x+.044,surface+.045,.013,.018,.004,true)
  const cheekX=.435,cheekY=2.025
  faceOval(sign,'#7260c9',cheekY,cheekX,faceSurface(cheekX,cheekY)+.014,.095,.055,.007)
  for(let i=0;i<2;i++){const spotX=.31+i*.065,spotY=1.91-i*.064;faceOval(sign,'#3b422d',spotY,spotX,faceSurface(spotX,spotY)+.008,.023,.032,.005)}
 }
 const cereZ=faceSurface(0,2.155)+.023
 ellipsoid(head,'#b8d2d8',0,2.155,cereZ,.14,.070,.039)
 for(const sign of [-1,1])ellipsoid(head,'#455f69',sign*.058,2.169,cereZ+.039,.014,.011,.005,false,10)
 // Curved beak sculpted from rings: broad base, tapering hooked tip.
 const bp:number[]=[],bi:number[]=[],rings=[[2.12,cereZ+.02,.123],[2.065,cereZ+.105,.12],[1.99,cereZ+.14,.092],[1.93,cereZ+.12,.043],[1.905,cereZ+.085,.015]]
 for(const [y,z,r] of rings)for(let i=0;i<12;i++){const a=i*Math.PI/6;bp.push(Math.cos(a)*r,y+Math.sin(a)*r*.3,z+Math.sin(a)*r*.32)}
 for(let r=0;r<rings.length-1;r++)for(let i=0;i<12;i++){const a=r*12+i,b=r*12+(i+1)%12;bi.push(a,a+12,b,b,a+12,b+12)}
 const bg=new T.BufferGeometry();bg.setAttribute('position',new T.Float32BufferAttribute(bp,3));bg.setIndex(bi);bg.computeVertexNormals();add(bg,head,'#ecb33e')
 ellipsoid(jaw,'#813f2d',0,1.978,cereZ+.025,.08,.082,.035)
 ellipsoid(jaw,'#e9b64b',0,1.905,cereZ+.02,.063,.030,.025)
 // Pink gripping feet, separate toe bones and small curved ivory claws.
 for(const [sign,leg,foot] of [[1,leftLeg,leftFoot],[-1,rightLeg,rightFoot]]){
  const x=sign*.25;rod(leg,'#d59e86',new T.Vector3(x,.37,.035),new T.Vector3(x,.12,.16),.058)
  ellipsoid(foot,'#dbab92',x,.11,.18,.095,.065,.11)
  for(let i=0;i<3;i++){
   const toe=bones.findIndex(b=>b.name===`Toe${sign===1?'L':'R'}${i}`),end=new T.Vector3(x+(i-1)*.095,.065,.44-Math.abs(i-1)*.035)
   rod(toe,'#dba78b',new T.Vector3(x+(i-1)*.025,.11,.2),end,.034)
   rod(toe,'#eee0b4',end,end.clone().add(new T.Vector3((i-1)*.01,-.026,.055)),.021)
  }
  rod(foot,'#d39a82',new T.Vector3(x,.11,.16),new T.Vector3(x+sign*.08,.055,-.04),.032)
 }
 const geometry=mergeGeometries(pieces,true)!
 // mergeGeometries groups are per piece; retain the two material slots.
 geometry.clearGroups();let offset=0;for(const g of pieces){geometry.addGroup(offset,g.getAttribute('position').count,g.groups[0].materialIndex);offset+=g.getAttribute('position').count;g.dispose()}
 const materials=[new T.MeshStandardMaterial({map:plumage??null,vertexColors:true,roughness:.88,metalness:0,side:T.DoubleSide}),new T.MeshStandardMaterial({vertexColors:true,roughness:.12,metalness:.05})]
 const mesh=new T.SkinnedMesh(geometry,materials);mesh.name='Xiaobu_Skinned';mesh.add(bones[0]);mesh.bind(new T.Skeleton(bones));mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false
 // Repack groups by material to avoid hundreds of draw calls.
 const vertexCount=geometry.getAttribute('position').count,attrs=['position','normal','uv','color','skinIndex','skinWeight'];const reordered:T.BufferGeometry[]=[]
 for(let material=0;material<2;material++){
  const g=new T.BufferGeometry()
  for(const name of attrs){const attr=geometry.getAttribute(name),values:number[]=[];for(const group of geometry.groups)if(group.materialIndex===material)for(let i=group.start;i<group.start+group.count;i++)for(let c=0;c<attr.itemSize;c++)values.push(attr.array[i*attr.itemSize+c]);g.setAttribute(name,name==='skinIndex'?new T.Uint16BufferAttribute(values,attr.itemSize):new T.Float32BufferAttribute(values,attr.itemSize))}
  if(g.getAttribute('position').count)reordered.push(g)
 }
 const joined=mergeGeometries(reordered,true)!;const packed=mergeVertices(joined);joined.dispose();reordered.forEach(g=>g.dispose());mesh.geometry=packed;geometry.dispose()
 function track(name:string,axis:'y'|'z',times:number[],angles:number[]){
  const vector=axis==='y'?new T.Vector3(0,1,0):new T.Vector3(0,0,1)
  return new T.QuaternionKeyframeTrack(`${name}.quaternion`,times,angles.flatMap(a=>{const q=new T.Quaternion().setFromAxisAngle(vector,a);if(name==='Head')q.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),-.13));return q.toArray()}))
 }
 const idle=new T.AnimationClip('GentleIdle',4,[track('Chest','z',[0,1,2,3,4],[0,.008,0,-.008,0]),track('Head','y',[0,1,2,3,4],[0,.08,0,-.06,0])])
 const wave=new T.AnimationClip('WingRigPreview',2,[track('WingL','z',[0,.4,.8,1.2,1.6,2],[0,.65,.2,.65,.2,0]),track('WingR','z',[0,.4,.8,1.2,1.6,2],[0,-.65,-.2,-.65,-.2,0]),track('WingTipL','z',[0,.5,1,1.5,2],[0,.35,.1,.35,0]),track('WingTipR','z',[0,.5,1,1.5,2],[0,-.35,-.1,-.35,0])])
 // Contact markers follow actual head and foot bones for later scene integration.
 return {mesh,bones,clips:[idle,wave],contacts:{beak,foot:footContact},stats:{triangles:(packed.index?.count??packed.getAttribute('position').count)/3,bones:bones.length,materials:materials.length,drawCalls:packed.groups.length,vertices:packed.getAttribute('position').count,sourceVertices:vertexCount},dispose(){packed.dispose();materials.forEach(m=>m.dispose())}}
}
