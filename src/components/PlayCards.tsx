import { useState, type CSSProperties } from 'react'
import { preparePraise } from '../lib/praise'

export function pictureFor(text: string): string {
  if (/睡|书包/.test(text)) return 'bag'
  if (/衣|穿/.test(text)) return 'shirt'
  if (/垃圾|清洁/.test(text)) return 'bin'
  if (/吃|餐/.test(text)) return 'meal'
  if (/手机|视频/.test(text)) return 'phone'
  if (/运动|球|跑/.test(text)) return 'ball'
  if (/画|创|手工/.test(text)) return 'paint'
  return 'book'
}

function shortTitle(text: string): string {
  if (/睡|书包/.test(text)) return '准备好书包'
  if (/衣物.*固定位置/.test(text)) return '收好衣服'
  if (/垃圾.*垃圾桶/.test(text)) return '垃圾进桶'
  if (/进餐|吃饭/.test(text)) return '好好吃饭'
  if (/手机.*视频/.test(text)) return '按约定看视频'
  return text
}

export function TinyStar() {
  return <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" fill="currentColor" /></svg>
}

export function PlayPicture({ kind, className = '' }: { kind: string; className?: string }) {
  return <svg viewBox="0 0 180 150" className={`play-picture ${className}`} aria-hidden="true" focusable="false">
    <ellipse cx="90" cy="134" rx="54" ry="7" fill="currentColor" opacity=".10" />
    <circle cx="90" cy="72" r="58" fill="currentColor" opacity=".09" />
    <g stroke="#454165" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      {kind === 'shirt' ? <><path d="m64 29-29 22 16 24 14-8v57h51V67l14 8 16-24-29-22-17 8H81Z" fill="#a7d9c7"/><path d="M78 31q12 25 25 0" fill="#fff"/><path d="m78 81 9 9 19-22" fill="none"/></>
      : kind === 'bin' ? <><path d="m57 52 7 73h53l7-73" fill="#b3d8f5"/><path d="M51 48h80M75 45V33h32v12M81 68v39m20-39v39" fill="none"/><path d="m67 24 10-11 14 12-10 10Z" fill="#f8d998"/></>
      : kind === 'meal' ? <><circle cx="90" cy="79" r="42" fill="#fff"/><circle cx="90" cy="79" r="29" fill="#fae0a2"/><path d="M34 38v35m-8-35v22q8 15 16 0V38m-8 35v51m111-86q-17 29-3 38v48m3-86v38" fill="none"/><path d="m75 80 13 10 22-25" fill="none" stroke="#438975"/></>
      : kind === 'bag' ? <><path d="M72 43V29q18-17 36 0v14" fill="none"/><rect x="52" y="40" width="77" height="88" rx="22" fill="#bfb1ef"/><path d="M54 73h73" fill="none"/><rect x="67" y="88" width="47" height="27" rx="8" fill="#f6cd91"/><path d="M82 55h17" fill="none"/></>
      : kind === 'phone' ? <><rect x="57" y="23" width="68" height="108" rx="14" fill="#b9b3ee"/><rect x="65" y="39" width="52" height="72" rx="7" fill="#faf9ff"/><path d="m85 60 20 14-20 14Z" fill="#91cfba"/><path d="M86 121h10M82 31h18" fill="none"/></>
      : kind === 'ball' ? <><circle cx="90" cy="77" r="49" fill="#f9c78d"/><path d="M41 77h98M90 28v98M56 43q56 31 0 69m68-69q-56 31 0 69" fill="none"/></>
      : kind === 'paint' ? <><path d="M125 36c-49-31-99 12-79 61 8 21 39 32 50 21 9-9-9-19 3-25 15-6 52-32 26-57Z" fill="#f8d89e"/><circle cx="69" cy="57" r="8" fill="#c1b1ef"/><circle cx="101" cy="49" r="8" fill="#eaa6aa"/><circle cx="59" cy="84" r="8" fill="#8ccdb8"/><path d="m111 98 24-41 8 5-24 42-13 10Z" fill="#b6d9f3"/></>
      : kind === 'star' ? <path d="m90 22 17 33 37 6-27 27 6 38-33-18-34 18 7-38-28-27 38-6Z" fill="#f6cf75"/>
      : kind === 'rocket' ? <><path d="M70 100Q53 56 108 22q33 52-4 90Z" fill="#bfb1ef"/><circle cx="99" cy="58" r="13" fill="#c3edee"/><path d="m68 81-22 24 28-1m36-16 13 29-23-13" fill="#a4d7c5"/><path d="m76 114-5 19m19-14-2 18" stroke="#d39a3d"/></>
      : ['sprout', 'flower', 'tree'].includes(kind) ? <><path d="M90 121V69" fill="none" stroke="#478c73"/><path d="M88 89Q43 91 51 57q38-7 37 32Zm4-14q-2-41 37-38 7 35-37 38Z" fill="#9fd9b3"/>{kind === 'tree' && <circle cx="88" cy="48" r="29" fill="#99cfa5"/>}{kind === 'flower' && <><path d="M68 43q-4-28 20-20 22-18 29 5 24 12 3 27-3 27-26 13-25 12-27-12-19-7 1-13Z" fill="#eab6cf"/><circle cx="93" cy="43" r="12" fill="#f7d77d"/></>}<path d="M67 126h46" fill="none"/></>
      : kind === 'gift' ? <><rect x="48" y="64" width="85" height="63" rx="6" fill="#bdb0ed"/><rect x="42" y="52" width="97" height="23" rx="5" fill="#cfbff5"/><path d="M90 53v74M90 52q-51-2-30-25 19-12 30 25Zm0 0q51-2 30-25-19-12-30 25Z" fill="#f7d28c"/></>
      : <><path d="M90 46Q65 30 34 42v76q31-12 56 5 26-17 57-5V42q-31-12-57 4Z" fill="#b8d7f1"/><path d="M90 46v77M48 61l27 2M48 76l27 2m31-15 26-2m-26 17 26-2" fill="none"/><path d="m117 30 9-17m10 24 15-8" stroke="#d6aa4a"/></>}
    </g>
    <path d="m27 28 3 7 8 2-8 3-3 7-3-7-7-3 7-2Zm123 70 2 5 6 2-6 2-2 6-2-6-6-2 6-2Z" fill="currentColor" opacity=".5" />
  </svg>
}

export function ActionCard({ title, done, picture, onComplete }: { title: string; done: boolean; picture?: string; onComplete: () => Promise<boolean> }) {
  const [busy, setBusy] = useState(false)
  return <button type="button" className={`action-tile ${done ? 'is-done' : ''}`} disabled={busy || done}
    aria-label={`${title}，${done ? '已完成' : '点一下完成，获得5颗星'}`}
    onClick={async () => {
      setBusy(true)
      const play = preparePraise()
      try { if (await onComplete()) void play() } finally { setBusy(false) }
    }}>
    <span className="tile-reward">{done ? <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5L20 6" stroke="currentColor" strokeWidth="3" fill="none" /></svg> : <>+5 <TinyStar /></>}</span>
    <PlayPicture kind={picture ?? pictureFor(title)} />
    <strong>{shortTitle(title)}</strong><span className="tile-caption">{busy ? '正在记…' : done ? '做到了！' : '做完点这里'}</span>
  </button>
}

export function Celebration({ message }: { message: string }) {
  return <div className="play-feedback" role="status" aria-live="polite">{message && <><span key={message} className="star-burst" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ '--i': i } as CSSProperties} />)}</span><PlayPicture kind="star" /><strong>{message}</strong></>}</div>
}
