import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react'
import {BirdMusic,MusicControls} from '../src/components/BirdMusic'
import {FeedbackSound} from '../src/components/FeedbackSound'
import {setMusicEnabled,musicEnabled} from '../src/lib/music'
import {BuddyBird} from '../src/components/GrowthJourney'
beforeEach(()=>{localStorage.clear();vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{})})
afterEach(()=>{cleanup();vi.restoreAllMocks();localStorage.clear()})
it('音乐默认开启，儿童端不显示设置，家长可关闭和调音量',async()=>{
 const play=vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue(undefined);const {container}=render(<><BirdMusic/><MusicControls/></>);const audio=container.querySelector('audio')!;expect(musicEnabled()).toBe(true);expect(play).toHaveBeenCalledOnce();expect(audio.volume).toBeCloseTo(.18);expect(audio.loop).toBe(true);expect(screen.getByRole('button',{name:'森林音乐：开'})).toHaveAttribute('aria-pressed','true');fireEvent.click(screen.getByRole('button',{name:'森林音乐：开'}));expect(musicEnabled()).toBe(false);expect(audio.pause).toHaveBeenCalled();fireEvent.change(screen.getByRole('slider',{name:/音乐音量/}),{target:{value:'10'}});expect(audio.volume).toBeCloseTo(.1)
})
it('自动播放被阻止后等待手势重试，关闭状态不会因点击再开启',async()=>{
 const play=vi.spyOn(HTMLMediaElement.prototype,'play').mockRejectedValueOnce(new Error('blocked')).mockResolvedValue(undefined);render(<BirdMusic/>);await waitFor(()=>expect(play).toHaveBeenCalledOnce());fireEvent.pointerDown(window);expect(play).toHaveBeenCalledTimes(2);setMusicEnabled(false);fireEvent.pointerDown(window);expect(play).toHaveBeenCalledTimes(2);expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
it('鸟叫压低音乐，后台和卸载暂停，单词学习期间不因手势重启',()=>{
 vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue(undefined);const {container,unmount}=render(<BirdMusic/>);const audio=container.querySelector('audio')!;fireEvent(window,new CustomEvent('xiaobu:bird-speech',{detail:{speaking:true}}));expect(audio.volume).toBeCloseTo(.04);fireEvent(window,new CustomEvent('xiaobu:bird-speech',{detail:{speaking:false}}));expect(audio.volume).toBeCloseTo(.18);vi.spyOn(document,'hidden','get').mockReturnValue(true);fireEvent(document,new Event('visibilitychange'));expect(audio.pause).toHaveBeenCalled();fireEvent(window,new Event('xiaobu:study-audio'));const calls=vi.mocked(audio.play).mock.calls.length;fireEvent.pointerDown(window);expect(audio.play).toHaveBeenCalledTimes(calls);unmount();expect(audio.pause).toHaveBeenCalled()
})
it('家长仅显示三类鸟叫试听和音乐控制，不再提供人声音色',()=>{render(<FeedbackSound/>);for(const name of ['打招呼','开心','庆祝'])expect(screen.getByRole('button',{name:`试听${name}`})).toBeInTheDocument();expect(screen.queryByRole('combobox')).not.toBeInTheDocument();expect(screen.queryByText('设备中文朗读')).not.toBeInTheDocument()})
it('扑翅使用四个分解姿态，并保留单独的静止姿态',()=>{const {container,rerender}=render(<BuddyBird stage="adult" flapping/>);expect(container.querySelectorAll('.bird-frame')).toHaveLength(4);expect(container.querySelector('.bird-flapping')).toBeInTheDocument();rerender(<BuddyBird stage="adult"/>);expect(container.querySelector('.bird-flapping')).toBeNull();expect(container.querySelector('.bird-frame-0')).toBeInTheDocument()})
