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
it('幼鸟的短翼短尾与成年有明显差异，切换阶段后完整恢复比例',async()=>{
 const {applyRiggedGrowth}=await import('../src/lib/riggedBirdMotion')
 const m=createXiaobuModel(),bone=(name:string)=>m.bones.find(b=>b.name===name)!
 expect(applyRiggedGrowth(m,'hatch')).toBe(.9)
 expect(bone('Head').scale.x).toBeGreaterThan(1.15)
 expect(bone('WingL').scale.x).toBeLessThan(.7)
 expect(bone('Tail').scale.x).toBeLessThan(.5)
 expect(applyRiggedGrowth(m,'young')).toBe(1.2)
 expect(bone('WingL').scale.x).toBe(.85)
 expect(applyRiggedGrowth(m,'adult')).toBe(1.5)
 expect(m.bones.every(b=>b.scale.x===1&&b.scale.y===1&&b.scale.z===1)).toBe(true)
 m.dispose()
})
