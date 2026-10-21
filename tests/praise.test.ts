import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {preparePraise,setSoundEnabled,praiseText,stopPraise} from '../src/lib/praise'
import {BIRD_CALLS,chooseBirdCall} from '../src/lib/birdSounds'
let audios:Array<{muted:boolean;play:ReturnType<typeof vi.fn>;pause:ReturnType<typeof vi.fn>;currentTime:number;volume:number;preload:string;onended?:()=>void}>
beforeEach(()=>{localStorage.clear();audios=[];vi.stubGlobal('Audio',vi.fn(function(){const audio={muted:false,play:vi.fn().mockResolvedValue(undefined),pause:vi.fn(),currentTime:0,volume:1,preload:''};audios.push(audio);return audio}))})
afterEach(()=>{stopPraise();vi.unstubAllGlobals();localStorage.clear()})
describe('鸟叫反馈',()=>{
 it('鼓励文字带姓名和任务，连续两句不同',()=>{const text=praiseText('全全','穿拖鞋');expect(text).toContain('全全，你完成了穿拖鞋');expect(praiseText('全全','穿拖鞋')).not.toBe(text)})
 it('即使旧设置是模拟人声也只播放鸟叫',async()=>{localStorage.setItem('xiaobu.bird.sound-mode','speech');const speak=vi.fn();vi.stubGlobal('speechSynthesis',{speak,cancel:vi.fn()});expect(await preparePraise({name:'全全',title:'跳绳'})()).toBe(true);expect(speak).not.toHaveBeenCalled();expect(Audio).toHaveBeenCalledWith(expect.stringMatching(/bird\/celebrate-[12]\.mp3$/))})
 it('同一分类随机选择且相邻不重复，三类各有两段',()=>{expect(BIRD_CALLS).toHaveLength(6);for(const mood of ['hello','happy','celebrate'] as const){let previous='';for(let n=0;n<20;n++){const call=chooseBirdCall(mood);expect(call.mood).toBe(mood);expect(call.id).not.toBe(previous);previous=call.id}}})
 it('用户点击时静音解锁，记录成功回调才出声，结束后通知音乐恢复',async()=>{const states:boolean[]=[];const listen=(e:Event)=>states.push((e as CustomEvent).detail.speaking);window.addEventListener('xiaobu:bird-speech',listen);const play=preparePraise();expect(audios[0].muted).toBe(true);await play();expect(audios[0].muted).toBe(false);expect(audios[0].play).toHaveBeenCalledTimes(2);audios[0].onended?.();expect(states.slice(-2)).toEqual([true,false]);window.removeEventListener('xiaobu:bird-speech',listen)})
 it('关闭后不创建播放器，并停止现有声音',async()=>{preparePraise();setSoundEnabled(false);expect(audios[0].pause).toHaveBeenCalled();expect(await preparePraise()()).toBe(false);expect(audios).toHaveLength(1)})
 it('连续点击替换上次声音，旧回调不会再播放',async()=>{const first=preparePraise();const second=preparePraise();expect(await first()).toBe(false);expect(await second()).toBe(true);expect(audios[0].pause).toHaveBeenCalled()})
 it('浏览器禁止播放时返回失败，不影响打卡',async()=>{const play=preparePraise();audios[0].play.mockRejectedValue(new Error('NotAllowedError'));expect(await play()).toBe(false)})
})
