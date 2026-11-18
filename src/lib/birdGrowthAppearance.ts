import * as T from 'three'
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js'
import {posturePoint} from '../preview/birdPosture'
import {birdSection} from '../preview/birdShape'
import type {createXiaobuModel} from '../preview/xiaobuModel'
type Model=ReturnType<typeof createXiaobuModel>

function prepareAppearance(model:Model){
 const bone=(name:string)=>model.bones.find(b=>b.name===name)!
 const softness={value:0},geometry=model.mesh.geometry,skin=geometry.getAttribute('skinIndex')
 const soft=new Float32Array(skin.count)
 for(let i=0;i<skin.count;i++){
  const name=model.bones[skin.getX(i)]?.name??''
  soft[i]=name.startsWith('Wing')?1:name.startsWith('Tail')?.65:0
 }
 geometry.setAttribute('growthSoft',new T.Float32BufferAttribute(soft,1))
 const material=(model.mesh.material as T.MeshStandardMaterial[])[0]
 material.onBeforeCompile=shader=>{
  shader.uniforms.growthSoftness=softness
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float growthSoft; varying float vGrowthSoft;').replace('#include <begin_vertex>','#include <begin_vertex>\nvGrowthSoft = growthSoft;')
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float growthSoftness; varying float vGrowthSoft;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.64, 0.77, 0.32), vGrowthSoft * growthSoftness);')
 }
 material.customProgramCacheKey=()=> 'xiaobu-age-feathers-v1'
 material.needsUpdate=true
 const downMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:1})
 function downMesh(name:string,parent:T.Bone,points:Array<{x:number;y:number;z:number;color:string}>,region:'head'|'body'){
  const pieces=points.map(p=>{
   const point=parent.worldToLocal(model.mesh.localToWorld(posturePoint(new T.Vector3(p.x,p.y,p.z),region)))
   const g=new T.SphereGeometry(1,8,6);g.scale(.085,region==='head'?.18:.12,.075);g.translate(point.x,point.y,point.z)
   const color=new T.Color(p.color),values=new Float32Array(g.getAttribute('position').count*3)
   for(let i=0;i<values.length;i+=3){values[i]=color.r;values[i+1]=color.g;values[i+2]=color.b}
   g.setAttribute('color',new T.Float32BufferAttribute(values,3));return g
  })
  const merged=mergeGeometries(pieces)!,mesh=new T.Mesh(merged,downMaterial);mesh.name=name;parent.add(mesh);pieces.forEach(g=>g.dispose());return mesh
 }
 const crown=downMesh('HatchCrown',bone('Head'),[-1,0,1].map(i=>({x:i*.13,y:i===0?2.81:2.75,z:.12,color:'#f5e797'})),'head')
 const tufts=[]
 for(let row=0;row<5;row++)for(const sign of [-1,1]){
  const y=.65+row*.2,s=birdSection(y)
  tufts.push({x:sign*(s.x+.025),y,z:s.centerZ+.1,color:row>2?'#d5df85':'#bace78'})
 }
 const down=downMesh('HatchDown',bone('Body'),tufts,'body')
 const root=bone('Root'),rootPosition=root.position.clone()
 const footHeight=model.mesh.worldToLocal(model.contacts.foot.getWorldPosition(new T.Vector3())).y
 const dispose=model.dispose
 model.dispose=()=>{crown.geometry.dispose();down.geometry.dispose();downMaterial.dispose();dispose()}
 return {softness,crown,down,rootPosition,footHeight}
}

/** 改变轮廓、羽毛与站姿；所有尺度从基线重设，阶段切换不会累积形变。 */
export function applyRiggedGrowth(model:Model,stage:string){
 const appearance=model.mesh.userData.growthAppearance??=prepareAppearance(model)
 const hatch=stage==='hatch',young=stage==='young'
 const bone=(name:string)=>model.bones.find(b=>b.name===name)!
 for(const b of model.bones){b.scale.setScalar(1);b.rotation.set(0,0,0)}
 bone('Root').position.copy(appearance.rootPosition)
 bone('Body').scale.set(...(hatch?[1.15,.85,1.1]:young?[1.04,.96,1.02]:[.88,1.1,.91]) as [number,number,number])
 bone('Head').scale.set(...(hatch?[1.14,1.4,1.14]:young?[1.04,1.04,1.04]:[.9,.9,.9]) as [number,number,number])
 for(const name of ['WingL','WingR'])bone(name).scale.set(...(hatch?[.42,.48,.48]:young?[.84,.95,.86]:[1.02,1.06,1]) as [number,number,number])
 bone('Tail').scale.set(...(hatch?[.22,.22,.22]:young?[.75,.72,.7]:[1.12,1.15,1.28]) as [number,number,number])
 appearance.crown.visible=hatch;appearance.down.visible=hatch
 appearance.softness.value=hatch?.82:young?.24:0
 model.mesh.userData.growthStage=stage
 model.mesh.updateMatrixWorld(true)
 const foot=model.mesh.worldToLocal(model.contacts.foot.getWorldPosition(new T.Vector3())).y
 bone('Root').position.y+=appearance.footHeight-foot
 model.mesh.updateMatrixWorld(true);model.mesh.skeleton.update()
 return hatch?.9:young?1.2:1.5
}
