import * as T from 'three'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {clone} from 'three/addons/utils/SkeletonUtils.js'
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js'
import {createPlumageTexture} from './plumageTexture'
import {createXiaobuModel} from './xiaobuModel'
const canvas=document.querySelector('canvas')!,viewport=document.querySelector('#viewport')!
const status=document.querySelector('#load')!,metrics=document.querySelector('#metrics')!
try{
 const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'low-power'})
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap
 renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05
 const scene=new T.Scene();scene.background=new T.Color('#e4ebdb');scene.fog=new T.Fog('#e4ebdb',12,24)
 const camera=new T.PerspectiveCamera(34,1,.1,40);camera.position.set(3.4,2.65,6.4)
 const controls=new OrbitControls(camera,canvas);controls.target.set(0,1.15,.35);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=4;controls.maxDistance=10;controls.maxPolarAngle=Math.PI*.52;controls.autoRotateSpeed=.75
 const hemi=new T.HemisphereLight('#fff7df','#738d74',2.3);scene.add(hemi)
 const key=new T.DirectionalLight('#fff1d6',3.6);key.position.set(-3,7,5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-3,right:3,top:4,bottom:-2});key.shadow.bias=-.001;scene.add(key)
 const rim=new T.DirectionalLight('#d2e9ff',2.3);rim.position.set(3,4,-4);scene.add(rim)
 const floor=new T.Mesh(new T.CircleGeometry(50,64),new T.MeshStandardMaterial({color:'#e4ebdb',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.035;floor.receiveShadow=true;scene.add(floor)
 const podium=new T.Mesh(new T.CylinderGeometry(1.95,2.05,.13,64),new T.MeshStandardMaterial({color:'#d2dfbd',roughness:.85}));podium.position.y=-.08;podium.receiveShadow=true;scene.add(podium)
 const plumage=createPlumageTexture(),model=createXiaobuModel(plumage);scene.add(model.mesh)
 const helper=new T.SkeletonHelper(model.mesh);helper.visible=false;scene.add(helper)
 const mixer=new T.AnimationMixer(model.mesh),idle=mixer.clipAction(model.clips[0]),wave=mixer.clipAction(model.clips[1]);idle.play();wave.setLoop(T.LoopOnce,1);wave.clampWhenFinished=true
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');if(reduced.matches)idle.paused=true
 let rigTest=false,active=true,disposed=false,last=performance.now(),frames=0,elapsed=0,lastCost=0,glbBytes=0
 const samples:number[]=[]
 const resize=new ResizeObserver(()=>{const r=viewport.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix()});resize.observe(viewport)
 const observer=new IntersectionObserver(entries=>active=entries[0].isIntersecting);observer.observe(viewport)
 document.addEventListener('visibilitychange',()=>last=performance.now())
 const viewAngles:Record<string,number>={reference:.65,front:0,side:Math.PI/2,back:Math.PI}
 function setView(view:string){const angle=viewAngles[view],distance=7;camera.position.set(Math.sin(angle)*distance,2.55,Math.cos(angle)*distance);controls.update();document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)))}
 document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view!))
 document.querySelector<HTMLButtonElement>('#spin')!.onclick=()=>{controls.autoRotate=!controls.autoRotate;document.querySelector('#spin')!.setAttribute('aria-pressed',String(controls.autoRotate))}
 document.querySelector<HTMLButtonElement>('#skeleton')!.onclick=()=>{helper.visible=!helper.visible;document.querySelector('#skeleton')!.setAttribute('aria-pressed',String(helper.visible))}
 document.querySelector<HTMLButtonElement>('#wave')!.onclick=()=>{rigTest=true;idle.fadeOut(.2);wave.reset().fadeIn(.2).play();document.querySelector('#wave')!.setAttribute('aria-pressed','true')}
 mixer.addEventListener('finished',()=>{rigTest=false;wave.fadeOut(.25);idle.reset().fadeIn(.25).play();document.querySelector('#wave')!.setAttribute('aria-pressed','false')})
 async function exportModel(){
  const exporter=new GLTFExporter(),copy=clone(model.mesh) as T.SkinnedMesh;copy.skeleton.pose();copy.updateMatrixWorld(true);return await exporter.parseAsync(copy,{binary:true,animations:model.clips,onlyVisible:false}) as ArrayBuffer
 }
 // No network calls or DB writes; bytes are measured from the actual exported artifact.
 document.querySelector<HTMLButtonElement>('#export')!.onclick=async()=>{
  const label=document.querySelector('#export-status')!;label.textContent='正在导出…'
  try{const data=await exportModel();glbBytes=data.byteLength;const url=URL.createObjectURL(new Blob([data],{type:'model/gltf-binary'}));const a=document.createElement('a');a.href=url;a.download='xiaobu-rigged-preview-v5.glb';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);label.textContent=`已导出 ${(glbBytes/1024).toFixed(0)} KB`}catch{label.textContent='导出失败，当前预览仍可查看。'}
 }
 function animate(now:number){if(disposed)return;requestAnimationFrame(animate);const wall=Math.max(0,(now-last)/1000),dt=Math.min(wall,.05);last=now;if(!active||document.hidden)return
  const start=performance.now();if(!reduced.matches||rigTest)mixer.update(dt);controls.update();renderer.render(scene,camera);lastCost=performance.now()-start
  frames++;elapsed+=wall;if(samples.length<3600)samples.push(wall*1000)
 }
 requestAnimationFrame(animate);setView('reference')
 status.textContent='';metrics.textContent=`${model.stats.triangles.toLocaleString()} 三角面 · ${model.stats.bones} 根骨骼 · ${model.stats.materials} 个材质 · ${model.stats.drawCalls} 次角色绘制`
 const debug={model,renderer,scene,camera,mixer,exportModel,info:()=>({...model.stats,drawCalls:renderer.info.render.calls,glbBytes,fps:elapsed?frames/elapsed:0,p95:samples.slice().sort((a,b)=>a-b)[Math.floor(samples.length*.95)]??0,lastCost,rigTest,sprites:scene.children.filter(o=>o.type==='Sprite').length})}
 ;(window as unknown as {xiaobuPreview:typeof debug}).xiaobuPreview=debug
 window.addEventListener('pagehide',()=>{disposed=true;resize.disconnect();observer.disconnect();controls.dispose();model.dispose();plumage.dispose();helper.dispose();floor.geometry.dispose();(floor.material as T.Material).dispose();podium.geometry.dispose();(podium.material as T.Material).dispose();renderer.dispose()},{once:true})
}catch(error){status.textContent='当前设备无法打开3D预览，请保留原画，换支持WebGL的浏览器查看。';metrics.textContent='3D预览未成功，不能据此判断模型。';console.error(error)}
