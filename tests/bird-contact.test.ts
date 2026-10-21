import {expect,it} from 'vitest'
import {ballPush,frameSize} from '../src/lib/birdContact'
it('透明留白不同但轮廓相同时，待机和动作具有相同大小；弯腰不被重新放大',()=>{
 expect(frameSize(200,270,270)).toEqual(frameSize(400,540,540))
 expect(frameSize(200,180,270).height).toBeLessThan(frameSize(200,270,270).height)
})
it('抬脚接触前球保持原位，接触后滚远；新一轮重新靠近',()=>{
 expect(ballPush(.49)).toBe(0)
 expect(ballPush(.5)).toBe(0)
 expect(ballPush(.8)).toBeGreaterThan(ballPush(.6))
 expect(ballPush(1.1)).toBe(0)
 expect(ballPush(NaN)).toBe(0)
 expect(ballPush(100,true)).toBe(0)
})
