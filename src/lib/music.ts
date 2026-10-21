const KEY='xiaobu.music.enabled'
export const MUSIC_EVENT='xiaobu:music-settings'
export function musicEnabled(){try{return localStorage.getItem(KEY)!=='false'}catch{return true}}
export function musicVolume(){try{const value=Number(localStorage.getItem('xiaobu.music.volume')??.18);return Number.isFinite(value)&&value>=0&&value<=.5?value:.18}catch{return .18}}
export function setMusicEnabled(value:boolean){try{localStorage.setItem(KEY,String(value))}catch{/* 设置仍通知当前页面 */}window.dispatchEvent(new Event(MUSIC_EVENT))}
export function setMusicVolume(value:number){try{localStorage.setItem('xiaobu.music.volume',String(Math.max(0,Math.min(.5,value))))}catch{/* 无存储权限时保留默认值 */}window.dispatchEvent(new Event(MUSIC_EVENT))}
