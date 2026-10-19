import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useApp } from '../app/AppProvider'
import { repo } from '../db/repo'
import type { AdventureRun } from '../db/types'
import { birdInventory, BIRD_ITEMS } from '../lib/birdCompanion'
import { birdStage, uniqueAdventures } from '../lib/adventure'
import { preparePraise, stopPraise, soundEnabled } from '../lib/praise'
import { BuddyBird } from './GrowthJourney'
import { BirdItemPicture } from './BirdItemPicture'

function useBirdSpeech() {
  const [speech, setSpeech] = useState({ speaking: false, text: '' })
  useEffect(() => {
    const listen = (event: Event) => setSpeech((event as CustomEvent<{ speaking: boolean; text: string }>).detail)
    window.addEventListener('xiaobu:bird-speech', listen)
    return () => window.removeEventListener('xiaobu:bird-speech', listen)
  }, [])
  return speech
}

/** 全局说话气泡，打卡按钮在页面下方时仍能看到是谁在鼓励。 */
export function BirdSpeaker() {
  const speech = useBirdSpeech()
  const { profile } = useApp()
  const runs = useLiveQuery(() => profile ? repo.listAdventures(profile.id) : Promise.resolve([]), [profile?.id])
  const { pathname } = useLocation()
  useEffect(() => { stopPraise() }, [pathname])
  if (!speech.speaking || !pathname.startsWith('/child')) return null
  return <aside className="bird-speaker" aria-label="小步在说话"><BuddyBird stage={birdStage(uniqueAdventures(runs ?? []).length).key} speaking /><div><strong>小步说</strong><p>{speech.text}</p><button className="btn btn-sm" type="button" onClick={stopPraise}>停止声音</button></div></aside>
}

export function BirdCompanion({ stage, runs, wardrobe = false }: { stage: string; runs: AdventureRun[]; wardrobe?: boolean }) {
  const { profile } = useApp()
  const speech = useBirdSpeech()
  const [message, setMessage] = useState('')
  const [audioError, setAudioError] = useState('')
  const [action, setAction] = useState(0)
  const [busy, setBusy] = useState(false)
  const inventory = birdInventory(runs)
  const accessory = inventory.some(i => i.key === profile?.buddyAccessory) ? profile?.buddyAccessory ?? '' : ''
  const egg = stage === 'egg' || stage === 'crack'
  function interact(item?: typeof BIRD_ITEMS[number]) {
    const actions = egg ? ['我听到你啦！我在蛋里轻轻动一动。', '谢谢你来看我！我们一起慢慢长大。', '咚咚！我也想和你一起看看世界。'] : ['啾啾！击个掌，今天也要一起玩！', '看我的翅膀！扑扑，我在和你打招呼！', '歪歪头，看见你真高兴！']
    const toy = item ?? (action % 3 === 2 ? BIRD_ITEMS.find(i => i.key === accessory) : undefined)
    const text = `${profile?.nickname || profile?.name || '全全'}，${egg ? actions[action % actions.length] : toy?.action ?? actions[action % actions.length]}`
    setAction(a => a + 1); setMessage(text); setAudioError('')
    void preparePraise({ name: profile?.name ?? '全全', title: '', text })().then(ok => { if (!ok && soundEnabled()) setAudioError('声音暂时没有播出来，可以在声音设置中试听；仍然可以和小步玩。') })
  }
  async function equip(key: string) {
    if (!profile || busy) return
    setBusy(true)
    try {
      await repo.updateProfile(profile.id, { buddyAccessory: key || null })
      if (key) interact(BIRD_ITEMS.find(i => i.key === key))
      else setMessage('小步换回轻轻松松的样子啦。')
    } catch { setMessage('这次没有保存好，请再选一次。') }
    finally { setBusy(false) }
  }
  return <div className="bird-companion">
    <button type="button" className={`bird-touch bird-action-${action % 3} ${action ? 'bird-touched' : ''}`} aria-label={egg ? '轻轻和小蛋打招呼' : '和虎皮鹦鹉小步互动'} onClick={() => interact()}><span key={action} className="bird-motion"><BuddyBird stage={stage} accessory={accessory} speaking={speech.speaking} /></span><span>{egg ? '轻轻点我，打个招呼' : '点点我，一起玩'}</span></button>
    <p className="bird-chat" role="status">{speech.speaking ? speech.text : message || (egg ? '我还在蛋里，也能听见你！' : '我是小步，你的虎皮鹦鹉搭档！')}</p>
    {audioError && <p className="muted" role="status">{audioError}</p>}
    {wardrobe && <section className="bird-wardrobe" aria-label="小步的玩具和装备"><h3>小步的百宝箱</h3><p>每次冒险带回一件小玩意，不花星星。点已获得的物品，换上它一起玩。</p><div className="bird-items">{BIRD_ITEMS.map(item => {
      const owned = inventory.find(i => i.key === item.key)
      return <button key={item.key} type="button" disabled={!owned || busy} aria-pressed={accessory === item.key} onClick={() => void equip(item.key)}><BirdItemPicture kind={item.key} /><strong>{item.name}</strong><small>{owned ? accessory === item.key ? `正在用 · ${owned.count}件` : `已获得 ${owned.count}件 · 换上` : '冒险中可以发现'}</small></button>
    })}</div><button type="button" className="btn" disabled={!accessory || busy} onClick={() => void equip('')}>收好装备</button><p className="muted">可能再次遇到同一件物品，不影响星星；蛋里时先把玩具摆在旁边。</p></section>}
  </div>
}
