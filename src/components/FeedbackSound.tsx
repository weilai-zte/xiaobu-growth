import {useState} from 'react'
import {setSoundEnabled,soundEnabled,preparePraise,stopPraise} from '../lib/praise'
import {MusicControls} from './BirdMusic'
import {BIRD_MOODS,type BirdMood} from '../lib/birdSounds'

export function FeedbackSound(){
 const [enabled,setEnabled]=useState(soundEnabled),[message,setMessage]=useState('')
 return <div className="feedback-sound"><div className="row"><button type="button" className="btn btn-sm" aria-pressed={enabled} onClick={()=>{setSoundEnabled(!enabled);setEnabled(!enabled)}}>鸟叫反馈：{enabled?'开':'关'}</button><button className="btn btn-sm" type="button" onClick={stopPraise}>停止鸟叫</button></div><p>小步只用鸟叫回应，鼓励的话显示在气泡里。</p><div className="row">{(Object.keys(BIRD_MOODS) as BirdMood[]).map(mood=><button type="button" className="btn btn-sm" key={mood} disabled={!enabled} onClick={async()=>{setMessage(`${BIRD_MOODS[mood]} · 啾啾！`);if(!await preparePraise({name:'小步',title:'',text:`${BIRD_MOODS[mood]} · 啾啾！`,mood})())setMessage('鸟叫暂时没有播出来，可以再试一次。')}}>试听{BIRD_MOODS[mood]}</button>)}</div><p className="muted">打招呼、开心和庆祝会随机换一段，相邻两次不重复。</p>{message&&<p role="status">{message}</p>}<MusicControls/></div>
}
