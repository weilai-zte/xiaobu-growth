import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../app/AppProvider'
import { useToday } from '../app/hooks'
import { repo } from '../db/repo'
import { ActionCard, Celebration, PlayPicture } from '../components/PlayCards'
import { FeedbackSound } from '../components/FeedbackSound'
import { PRAISE_TEXT } from '../lib/praise'

export function ChildToday() {
  const { profile } = useApp()
  const { tasks, rules, checks, childId, date, loading } = useToday()
  const [message, setMessage] = useState('')
  const cards = [
    ...tasks.map(task => ({ id: task.id, title: task.name, done: task.completion === 'independent', save: () => repo.updateTaskRecord(task.id, { completion: 'independent', status: 'finished', timer: null }) })),
    ...rules.filter(r => r.active).map(rule => ({ id: rule.id, title: rule.title, done: checks.some(c => c.ruleId === rule.id && c.status === 'done'), save: () => repo.setCheck(childId!, rule.id, date, 'done') })),
  ].sort((a, b) => Number(a.done) - Number(b.done)).slice(0, 5)
  return <div className="play-world">
    <section className="play-hero"><div><span className="play-eyebrow">今天的小冒险</span><h1>{profile?.nickname || profile?.name}，出发！</h1><p>选一张，做到了就点亮它。</p></div><PlayPicture kind="rocket" /></section>
    <Celebration message={message} />
    <FeedbackSound />
    {loading ? <p role="status">正在准备你的任务卡…</p> : cards.length === 0 ? <p>请爸爸妈妈帮你选几个小任务吧。</p> : <div className="action-grid">{cards.map(card => <ActionCard key={card.id} {...card} onComplete={async () => {
      try { await card.save(); setMessage(`${PRAISE_TEXT} 你做到了：${card.title}！`); return true }
      catch { setMessage('这次没记上，请再点一下。'); return false }
    }} />)}</div>}
    <Link to="/child/progress" className="play-destination"><PlayPicture kind="gift" /><span><strong>去心愿小屋</strong><small>看看星星和我想要的礼物</small></span><span aria-hidden="true">→</span></Link>
    <Link to="/child/rules" className="btn">看看全部生活图卡</Link>
  </div>
}
