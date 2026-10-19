import { useState } from 'react'
import { useToday } from '../app/hooks'
import { repo } from '../db/repo'
import { ActionCard, Celebration } from '../components/PlayCards'
import { FeedbackSound } from '../components/FeedbackSound'
import { PRAISE_TEXT } from '../lib/praise'

export function ChildRules() {
  const { childId, date, rules, checks } = useToday()
  const [message, setMessage] = useState('')
  return <div className="play-world"><header><h1>我的生活图卡</h1><p className="page-intro">做一个，亮一个。慢慢来。</p></header>
    <Celebration message={message} />
    <FeedbackSound />
    <div className="action-grid">{rules.filter(r => r.active).map(rule => <div key={rule.id}>
      <ActionCard title={rule.title} done={checks.some(c => c.ruleId === rule.id && c.status === 'done')} onComplete={async () => {
        try { await repo.setCheck(childId!, rule.id, date, 'done'); setMessage(`${PRAISE_TEXT} 你把「${rule.title}」做好了！`); return true }
        catch { setMessage('这次没记上，请再点一下。'); return false }
      }} />
      {rule.steps.length > 0 && <details className="play-steps"><summary>看看怎么做</summary><ol>{rule.steps.map((step, i) => <li key={i}>{step}</li>)}</ol></details>}
    </div>)}</div>
  </div>
}
