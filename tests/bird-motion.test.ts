import {expect,it} from 'vitest'
import {ballPush} from '../src/lib/birdContact'
import {damping,createBirdClock} from '../src/lib/birdMotion'
it('球的循环接缝连续，接触之前不移动',()=>{
 expect(ballPush(.49)).toBe(0)
 expect(Math.abs(ballPush(.999999)-ballPush(1))).toBeLessThan(.001)
 expect(ballPush(.8)).toBeGreaterThan(ballPush(.6))
 expect(ballPush(1.1)).toBe(0)
})
it('相同一秒经过30或60帧到达相同位置',()=>{
 const run=(fps:number)=>{let x=0;for(let i=0;i<fps;i++)x+=(1-x)*damping(8,1/fps);return x}
 expect(Math.abs(run(30)-run(60))).toBeLessThan(1e-9)
 expect(damping(8,0)).toBe(0)
})
it('后台和离屏时冻结动作，恢复时不会跳过动作',()=>{
 const clock=createBirdClock();clock.tick(0,true);clock.tick(100,true)
 const before=clock.action;clock.tick(5000,false);clock.tick(10000,false);clock.tick(10016,true)
 expect(clock.action-before).toBe(0)
 expect(clock.delta).toBe(0)
 clock.tick(10032,true)
 expect(clock.action-before).toBeCloseTo(.016)
})
it('再次互动从动作起点开始，环境时间保持连续',()=>{
 const clock=createBirdClock();clock.tick(0,true);clock.tick(100,true);clock.restart();
 expect(clock.action).toBe(0);expect(clock.time).toBeCloseTo(.1)
 clock.tick(116,true);expect(clock.action).toBeCloseTo(.016)
})
it('减少动态偏好将渲染插值直接落位',()=>{
 expect(damping(8,.016,true)).toBe(1)
 expect(ballPush(55,true)).toBe(0)
})

it('离屏期间帧回调完全停下，恢复首帧也不会补算间隔',()=>{
 const clock=createBirdClock();clock.tick(0,true);clock.tick(100,true);clock.tick(101,false)
 const paused=clock.action;clock.tick(60000,true)
 expect(clock.action).toBe(paused);expect(clock.delta).toBe(0)
 clock.tick(60016,true);expect(clock.action-paused).toBeCloseTo(.016)
})
