import {expect,it} from 'vitest'
import * as T from 'three'
import {createXiaobuModel} from '../src/preview/xiaobuModel'
it('交付真实蒙皮网格，权重有效、骨架完整，角色成本受控',()=>{
 const m=createXiaobuModel();expect(m.mesh.isSkinnedMesh).toBe(true);expect(m.stats.bones).toBeGreaterThanOrEqual(20);expect(m.stats.triangles).toBeLessThanOrEqual(18000);expect(m.stats.drawCalls).toBe(2)
 const g=m.mesh.geometry,indices=g.getAttribute('skinIndex'),weights=g.getAttribute('skinWeight');for(let i=0;i<indices.count;i++){expect(indices.getX(i)).toBeLessThan(m.bones.length);expect(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)).toBeCloseTo(1)}
 let sprites=0;m.mesh.traverse(o=>{if(o instanceof T.Sprite)sprites++});expect(sprites).toBe(0);m.dispose()
})
it('骨骼运动实际改变蒙皮顶点与嘴挂点，不只是移动完整图片',()=>{
 const m=createXiaobuModel();m.mesh.updateMatrixWorld(true);m.mesh.skeleton.update();const g=m.mesh.geometry,index=g.getAttribute('skinIndex');const head=m.bones.find(b=>b.name==='Head')!,hi=m.bones.indexOf(head);let vi=0;for(let i=0;i<index.count;i++)if(index.getX(i)===hi&&g.getAttribute('position').getZ(i)>.6){vi=i;break}
 const before=m.mesh.getVertexPosition(vi,new T.Vector3()).clone(),mouth=m.contacts.beak.getWorldPosition(new T.Vector3());head.rotation.y=.4;m.mesh.updateMatrixWorld(true);m.mesh.skeleton.update();expect(before.distanceTo(m.mesh.getVertexPosition(vi,new T.Vector3()))).toBeGreaterThan(.01);expect(mouth.distanceTo(m.contacts.beak.getWorldPosition(new T.Vector3()))).toBeGreaterThan(.1);m.dispose()
})
it('提供连续动作轨道，起止姿态相同可回归待机',()=>{
 const m=createXiaobuModel();for(const clip of m.clips){expect(clip.validate()).toBe(true);for(const t of clip.tracks){expect(Array.from(t.values.slice(0,4))).toEqual(Array.from(t.values.slice(-4)))}}
 const mixer=new T.AnimationMixer(m.mesh),action=mixer.clipAction(m.clips[1]);action.play();mixer.update(.4);expect(Math.abs(m.bones.find(b=>b.name==='WingL')!.rotation.z)).toBeGreaterThan(.5);m.dispose()
})

it('头纹和翼纹有各自的有效UV，避免蒙皮合并后变成空白白翅膀',()=>{
 const m=createXiaobuModel(),g=m.mesh.geometry,uv=g.getAttribute('uv'),skin=g.getAttribute('skinIndex'),wing=m.bones.findIndex(b=>b.name==='WingL');const sampled=new Set<string>();for(let i=0;i<uv.count;i++)if(skin.getX(i)===wing&&uv.getX(i)<.45&&uv.getY(i)<.5)sampled.add(`${uv.getX(i).toFixed(3)},${uv.getY(i).toFixed(3)}`);expect(sampled.size).toBeGreaterThan(100);m.dispose()
})

it('头颈使用混合蒙皮，改变头部时接缝区域保持连续过渡',()=>{
 const m=createXiaobuModel(),g=m.mesh.geometry,p=g.getAttribute('position'),w=g.getAttribute('skinWeight'),skin=g.getAttribute('skinIndex'),chest=m.bones.findIndex(b=>b.name==='Chest'),neck=m.bones.findIndex(b=>b.name==='Neck'),head=m.bones.findIndex(b=>b.name==='Head');let blended=0
 for(let i=0;i<p.count;i++)if(((skin.getX(i)===neck&&skin.getY(i)===head)||(skin.getX(i)===chest&&skin.getY(i)===neck))&&w.getX(i)>.05&&w.getY(i)>.05)blended++
 expect(blended).toBeGreaterThan(200);m.dispose()
})
