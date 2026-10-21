import {expect,it} from 'vitest'
import {Vector3} from 'three'
import {posturePoint} from '../src/preview/birdPosture'
it('胸腹轴线更平缓，头部向前且保持抬起',()=>{
 const low=new Vector3(0,.9,0),high=new Vector3(0,1.55,.08)
 const axis=posturePoint(high,'body').sub(posturePoint(low,'body'))
 const angle=Math.atan2(axis.y,axis.z)*180/Math.PI
 expect(angle).toBeGreaterThan(40);expect(angle).toBeLessThan(55)
 const top=posturePoint(new Vector3(0,2.79,.125),'head')
 expect(top.y).toBeLessThan(2.5);expect(top.z).toBeGreaterThan(1)
 const headAxis=posturePoint(new Vector3(0,2.4,.22),'head').sub(posturePoint(new Vector3(0,2,.22),'head'))
 expect(Math.atan2(headAxis.y,headAxis.z)).toBeGreaterThan(Math.atan2(axis.y,axis.z))
})
it('前倾不改变脚爪接地点，尾羽依然向后且不穿地',()=>{
 const foot=new Vector3(.25,.065,.44);expect(posturePoint(foot,'foot').toArray()).toEqual(foot.toArray())
 const tail=posturePoint(new Vector3(0,.45,-1.6),'tail'),root=posturePoint(new Vector3(0,.8,-.36),'body')
 expect(tail.z).toBeLessThan(root.z);expect(tail.y).toBeGreaterThan(0)
})
it('头颈过渡是连续的，微小高度变化不会造成几何断层',()=>{
 for(const y of [1.67,1.84,1.95,2.02]){
  const a=posturePoint(new Vector3(.2,y-.00001,.4),'surface'),b=posturePoint(new Vector3(.2,y+.00001,.4),'surface')
  expect(a.distanceTo(b)).toBeLessThan(.0001)
 }
})
