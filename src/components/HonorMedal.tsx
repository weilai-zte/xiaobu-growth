import type { CSSProperties } from 'react'
import { HONORS } from '../lib/honors'

// 每种成长主题使用独立图案；颜色之外仍可通过图案与外框辨认。
const MEDAL_THEMES: Record<string, { icon: string; shape: string; color: string; light: string }> = {
 life: { icon: '🏠', shape: 'soft', color: '#33805b', light: '#b8efd2' },
 sport: { icon: '🏃', shape: 'shield', color: '#b34d22', light: '#ffcf96' },
 study: { icon: '📖', shape: 'square', color: '#3268ac', light: '#b5dcff' },
 total: { icon: '👣', shape: 'round', color: '#95652c', light: '#ffe0a3' },
 days: { icon: '📅', shape: 'square', color: '#7354a8', light: '#e2caff' },
 care: { icon: '🐦', shape: 'soft', color: '#a84473', light: '#ffc8df' },
 adventures: { icon: '🌲', shape: 'shield', color: '#397b44', light: '#c6eea9' },
 routes: { icon: '✉️', shape: 'square', color: '#317f91', light: '#b8edf2' },
 food: { icon: '🍓', shape: 'soft', color: '#af4545', light: '#ffd0bb' },
 gem: { icon: '💎', shape: 'gem', color: '#3a65ad', light: '#bdedff' },
 decor: { icon: '🪴', shape: 'shield', color: '#936636', light: '#f5e0a9' },
 collection: { icon: '🎁', shape: 'gem', color: '#8650a1', light: '#edc7ff' },
}

export function HonorMedal({honorId,mystery=false}:{honorId:string;mystery?:boolean}) {
 const honor=HONORS.find(h=>h.id===honorId)
 const theme=MEDAL_THEMES[honor?.metric??'']??MEDAL_THEMES.total
 const tier=HONORS.filter(h=>h.metric===honor?.metric).findIndex(h=>h.id===honorId)+1
 return <span className={`honor-medal medal-shape-${theme.shape} ${mystery?'mystery':''}`} aria-hidden="true" style={{'--medal-color':theme.color,'--medal-light':theme.light} as CSSProperties}><span className="medal-ribbon left"/><span className="medal-ribbon right"/><span className="medal-disc"><span className="medal-portrait"><span className="medal-emblem">{theme.icon}</span></span>{mystery&&<span className="medal-question">?</span>}<span className="medal-laurel">❧</span><span className="medal-tier">{['I','II','III','IV','V'][tier-1]??'I'}</span></span><span className="medal-spark one">✦</span><span className="medal-spark two">✧</span></span>
}
