import type { CSSProperties } from 'react'
import { HONORS } from '../lib/honors'
import { HONOR_GROUPS } from '../../server/honor-catalog.mjs'

export function HonorMedal({honorId,mystery=false}:{honorId:string;mystery?:boolean}) {
 const honor=HONORS.find(h=>h.id===honorId)
 const index=Math.max(0,HONOR_GROUPS.findIndex(g=>g[0]===honor?.metric))
 const tier=HONORS.filter(h=>h.metric===honor?.metric).findIndex(h=>h.id===honorId)+1
 return <span className={`honor-medal ${mystery?'mystery':''}`} aria-hidden="true" style={{'--medal-art':`url(${import.meta.env.BASE_URL}images/zodiac/card-${index}.webp)`} as CSSProperties}><span className="medal-ribbon left"/><span className="medal-ribbon right"/><span className="medal-disc"><span className="medal-portrait"/>{mystery&&<span className="medal-question">?</span>}<span className="medal-laurel">❧</span><span className="medal-tier">{['I','II','III','IV','V'][tier-1]??'I'}</span></span><span className="medal-spark one">✦</span><span className="medal-spark two">✧</span></span>
}
