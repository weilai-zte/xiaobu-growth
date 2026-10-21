import {useEffect,useRef,useState} from 'react'
import {MUSIC_EVENT,musicEnabled,musicVolume,setMusicEnabled,setMusicVolume} from '../lib/music'

/** 儿童页只播放，控制全部放在家长端。浏览器拦截时等待首次手势。 */
export function BirdMusic() {
  const audio=useRef<HTMLAudioElement>(null)
  useEffect(()=>{
    const media=audio.current!
    let disposed=false,ducked=false,studying=false,request=0
    const volume=()=>{media.volume=ducked?Math.min(musicVolume(),.04):musicVolume()}
    const pause=()=>{request++;media.pause()}
    const start=async()=>{
      if(disposed||document.hidden||studying||!musicEnabled()||!media.paused)return
      const id=++request;volume()
      try{await media.play();if(disposed||!musicEnabled()||document.hidden||studying){if(id===request)pause()}}
      catch{/* 浏览器限制自动播放，下一次用户手势时再试。 */}
    }
    const settings=()=>{volume();if(musicEnabled())void start();else pause()}
    const speech=(event:Event)=>{ducked=Boolean((event as CustomEvent).detail.speaking);volume()}
    const visibility=()=>{if(document.hidden)pause();else void start()}
    const study=()=>{studying=true;pause()}
    const gesture=(event:Event)=>{if(event.type==='keydown'&&(['Shift','Control','Alt','Meta','Tab'].includes((event as KeyboardEvent).key)))return;void start()}
    volume();void start()
    window.addEventListener(MUSIC_EVENT,settings);window.addEventListener('storage',settings)
    window.addEventListener('pointerdown',gesture);window.addEventListener('keydown',gesture)
    window.addEventListener('xiaobu:bird-speech',speech);window.addEventListener('xiaobu:study-audio',study)
    document.addEventListener('visibilitychange',visibility)
    return ()=>{disposed=true;pause();window.removeEventListener(MUSIC_EVENT,settings);window.removeEventListener('storage',settings);window.removeEventListener('pointerdown',gesture);window.removeEventListener('keydown',gesture);window.removeEventListener('xiaobu:bird-speech',speech);window.removeEventListener('xiaobu:study-audio',study);document.removeEventListener('visibilitychange',visibility)}
  },[])
  return <audio ref={audio} src={`${import.meta.env.BASE_URL}audio/forest-playtime.mp3`} loop preload="none" aria-hidden="true"/>
}

export function MusicControls(){
  const [enabled,setEnabled]=useState(musicEnabled),[volume,setVolume]=useState(musicVolume)
  return <div className="parent-music-controls"><h3>森林背景音乐</h3><button className="btn btn-sm" type="button" aria-pressed={enabled} onClick={()=>{setMusicEnabled(!enabled);setEnabled(!enabled)}}>森林音乐：{enabled?'开':'关'}</button><label>音乐音量<input type="range" min="0" max="50" value={Math.round(volume*100)} onChange={e=>{const value=Number(e.target.value)/100;setMusicVolume(value);setVolume(value)}}/>{Math.round(volume*100)}%</label><small>默认开启，在小步的家轻声播放。浏览器限制时，孩子首次点击后开始。切到后台或学习单词时暂停。</small><a href={`${import.meta.env.BASE_URL}audio/credits.html`} target="_blank" rel="noreferrer">音乐与鸟叫来源</a></div>
}
