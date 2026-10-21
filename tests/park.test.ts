import {expect,it} from 'vitest'
import {parkProgress} from '../src/lib/park'
it('小窝、小屋、花园和泳池按成长次序解锁，房子不会提前出现',()=>{
 expect(parkProgress(0).filter(a=>a.unlocked).map(a=>a.key)).toEqual(['meadow'])
 expect(parkProgress(14).filter(a=>a.unlocked).map(a=>a.key)).toEqual(['meadow','nest'])
 expect(parkProgress(20).find(a=>a.key==='home')?.unlocked).toBe(false)
 expect(parkProgress(21).find(a=>a.key==='home')?.unlocked).toBe(true)
 expect(parkProgress(28).find(a=>a.key==='garden')?.unlocked).toBe(true)
 expect(parkProgress(34).find(a=>a.key==='pool')?.unlocked).toBe(false)
 expect(parkProgress(35).every(a=>a.unlocked)).toBe(true)
 expect(parkProgress(NaN)[0].unlocked).toBe(true)
})
