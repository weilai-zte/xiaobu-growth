import {expect,it} from 'vitest'
import {birdPose} from '../src/lib/birdPose'
it('睡觉逐步闭眼并停在熟睡帧，不循环摇动',()=>{
 expect(birdPose('sleep',0)).toEqual({sheet:'actions',column:0,row:0})
 expect(birdPose('sleep',.4).column).toBe(1)
 expect(birdPose('sleep',1).column).toBe(3)
 expect(birdPose('sleep',100).column).toBe(3)
})
it('吃东西、玩球各自使用独立动作行，醒来恢复原来的小布',()=>{
 expect(birdPose('feed',.45)).toEqual({sheet:'actions',column:2,row:1})
 expect(birdPose('play',.55)).toEqual({sheet:'actions',column:2,row:2})
 expect(birdPose('idle',0)).toEqual({sheet:'original',column:0,row:0})
 expect(birdPose('idle',.25,true).sheet).toBe('original')
})
it('减少动态效果时保持对应动作静帧，非法时间不产生越界',()=>{
 expect(birdPose('sleep',0,false,true).column).toBe(3)
 expect(birdPose('feed',100,false,true).column).toBe(0)
 expect(birdPose('play',NaN)).toEqual({sheet:'actions',column:0,row:2})
})
