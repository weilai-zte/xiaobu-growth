import {expect,it} from 'vitest'
import {Vector3} from 'three'
import {createXiaobuModel} from '../src/preview/xiaobuModel'
import {poseRiggedBird,riggedFoodPoint,riggedBallTravel} from '../src/lib/riggedBirdMotion'
it('啄食由头胸和下颌骨骼完成，嘴准确抵达固定食物点',()=>{
 const m=createXiaobuModel(),food=riggedFoodPoint(m),before=m.contacts.beak.getWorldPosition(new Vector3())
 poseRiggedBird(m,'feed',.55)
 const at=m.contacts.beak.getWorldPosition(new Vector3());expect(at.distanceTo(food)).toBeLessThan(.001);expect(at.y).toBeLessThan(before.y-.15)
 expect(m.bones.find(b=>b.name==='Jaw')!.rotation.x).toBeGreaterThan(.2)
 poseRiggedBird(m,'idle',0);expect(m.contacts.beak.getWorldPosition(new Vector3()).distanceTo(before)).toBeLessThan(.001);m.dispose()
})
it('推球先伸脚再滚动，扑翅改变左右翼骨而非整体图片',()=>{
 const m=createXiaobuModel();poseRiggedBird(m,'play',.325)
 expect(m.bones.find(b=>b.name==='LegL')!.rotation.x).toBeLessThan(-.4)
 expect(riggedBallTravel(.325)).toBe(0);expect(riggedBallTravel(1.5)).toBeCloseTo(.7)
 poseRiggedBird(m,'idle',.1,true)
 expect(m.bones.find(b=>b.name==='WingL')!.rotation.z).toBeGreaterThan(.3)
 expect(m.bones.find(b=>b.name==='WingR')!.rotation.z).toBeLessThan(-.3);m.dispose()
})
it('回窝后再收头休息，叫醒恢复骨骼；减少动态时不循环扑翅',()=>{
 const m=createXiaobuModel();poseRiggedBird(m,'sleep',0);expect(m.bones.find(b=>b.name==='Head')!.rotation.y).toBeCloseTo(0)
 poseRiggedBird(m,'sleep',2.2);expect(m.bones.find(b=>b.name==='Head')!.rotation.y).toBeLessThan(-.8)
 poseRiggedBird(m,'idle',0);expect(m.bones.find(b=>b.name==='Head')!.rotation.y).toBeCloseTo(0)
 poseRiggedBird(m,'idle',1,true,true);const wing=m.bones.find(b=>b.name==='WingL')!.rotation.z
 poseRiggedBird(m,'idle',2,true,true);expect(m.bones.find(b=>b.name==='WingL')!.rotation.z).toBe(wing);m.dispose()
})
it('三个阶段的轮廓和羽毛有独立差异，反复切换不累积形变',async()=>{
 const {applyRiggedGrowth}=await import('../src/lib/riggedBirdMotion')
 const m=createXiaobuModel(),bone=(name:string)=>m.bones.find(b=>b.name===name)!
 const foot=()=>m.mesh.worldToLocal(m.contacts.foot.getWorldPosition(new Vector3())).y
 const originalFoot=foot()
 applyRiggedGrowth(m,'hatch')
 expect(bone('Body').scale.x/bone('Body').scale.y).toBeGreaterThan(1.3)
 expect(bone('WingL').scale.y).toBeLessThan(.6)
 expect(bone('Tail').scale.z).toBeLessThan(.3)
 expect(m.mesh.getObjectByName('HatchCrown')?.visible).toBe(true)
 expect(foot()).toBeCloseTo(originalFoot,5)
 applyRiggedGrowth(m,'young');poseRiggedBird(m,'idle',0,false,true)
 expect(bone('WingL').rotation.z).toBeGreaterThan(.15)
 expect(m.mesh.getObjectByName('HatchCrown')?.visible).toBe(false)
 applyRiggedGrowth(m,'adult')
 expect(bone('Body').scale.y/bone('Body').scale.x).toBeGreaterThan(1.15)
 expect(bone('Tail').scale.z).toBeGreaterThan(1.1)
 const adultScales=m.bones.map(b=>b.scale.toArray())
 for(const stage of ['hatch','young','adult'])applyRiggedGrowth(m,stage)
 expect(m.bones.map(b=>b.scale.toArray())).toEqual(adultScales)
 expect(foot()).toBeCloseTo(originalFoot,5)
 m.dispose()
})
it.each(['hatch','young','adult'])('%s 阶段仍能准确啄到食物点并回到静止姿态',async stage=>{
 const {applyRiggedGrowth}=await import('../src/lib/riggedBirdMotion')
 const m=createXiaobuModel();applyRiggedGrowth(m,stage)
 const food=riggedFoodPoint(m),before=m.contacts.beak.getWorldPosition(new Vector3())
 poseRiggedBird(m,'feed',.55)
 expect(m.contacts.beak.getWorldPosition(new Vector3()).distanceTo(food)).toBeLessThan(.001)
 poseRiggedBird(m,'idle',0)
 expect(m.contacts.beak.getWorldPosition(new Vector3()).distanceTo(before)).toBeLessThan(.001)
 m.dispose()
})
