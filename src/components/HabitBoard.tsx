import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../app/AppProvider'
import type { RoutineCheck, RoutineRule, TaskRecord, HabitCategory } from '../db/types'
import { repo } from '../db/repo'
import { HABIT_CATEGORIES, habitDefinition, recordStars } from '../lib/habits'
import { preparePraise } from '../lib/praise'
import { ActionCard, Celebration, PlayPicture, TinyStar } from './PlayCards'

function HabitCard({ rule, done, date, onSaved }: { rule: RoutineRule; done: boolean; date: string; onSaved: (message: string) => void }) {
  const definition = habitDefinition(rule)!
  const [open, setOpen] = useState(false)
  const [steps, setSteps] = useState<number[]>([])
  const [minutes, setMinutes] = useState(String(rule.minMinutes ?? 5))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save() {
    const play = preparePraise()
    setBusy(true); setError('')
    try {
      await repo.setCheck(rule.childId, rule.id, date, 'done', null, rule.category === 'sport' ? { minutes: Number(minutes) } : { stepsDone: rule.steps.slice() })
      setOpen(false); onSaved(`你做到了：${rule.title}！收下 ${rule.rewardStars} 颗星。`); void play()
    } catch (e) { setError(e instanceof Error ? e.message : '这次没有记好，请重试。') }
    finally { setBusy(false) }
  }
  return <article className={`habit-card ${done ? 'habit-done' : ''}`}>
    {rule.category === 'study' ? <Link className="habit-launch" to="/child/study"><PlayPicture kind={definition.picture} /><div><span className="habit-grade">学习 · 2星</span><h3>{rule.title}</h3><p>{done ? '今天已得2星，还可以练习' : '看图片 · 选单词 · 点词听发音'}</p><strong>{done ? '再练一组' : '开始看图选词'} →</strong></div><span className="habit-stars"><TinyStar />{done ? '已点亮' : '+2'}</span></Link> : <>
      <button type="button" className="habit-launch" disabled={done} aria-expanded={done ? undefined : open} aria-label={`${rule.title}，${done ? '已完成' : `查看步骤，完成得${rule.rewardStars}星`}`} onClick={() => setOpen(v => !v)}><PlayPicture kind={definition.picture} /><div><span className="habit-grade">{rule.category === 'life' ? '基础 · 1星' : `运动 · 2星 · ${rule.minMinutes}分钟`}</span><h3>{rule.title}</h3><p>{done ? '做到了，星星收好啦' : rule.category === 'life' ? '点开图片，一小步一小步做' : '运动结束后，回来记录'}</p></div><span className="habit-stars"><TinyStar />{done ? '已点亮' : `+${rule.rewardStars}`}</span></button>
      {open && !done && <div className="habit-checklist">
        {rule.category === 'life' ? <div role="group" aria-label={`${rule.title}的步骤`}>{rule.steps.map((step, i) => <label key={step}><input type="checkbox" checked={steps.includes(i)} onChange={() => setSteps(values => values.includes(i) ? values.filter(v => v !== i) : [...values, i])} /><PlayPicture kind={rule.habitKey === 'body' && i === 0 ? 'slippers' : definition.picture} /><span>{step}</span></label>)}</div> : <><p>可以分段完成、休息后继续。{rule.steps.join('。')}。</p><label>我实际运动了几分钟<input aria-label={`${rule.title}的实际分钟数`} type="number" min={rule.minMinutes} max="600" value={minutes} onChange={e => setMinutes(e.target.value)} /></label><div className="minute-choices">{[rule.minMinutes!, rule.minMinutes! + 5, rule.minMinutes! + 10].map(m => <button type="button" className="btn" key={m} aria-pressed={Number(minutes) === m} onClick={() => setMinutes(String(m))}>{m}分钟</button>)}</div></>}
        {error && <p role="alert">{error}</p>}
        <button type="button" className="btn btn-primary" disabled={busy || (rule.category === 'life' && !rule.steps.every((_, i) => steps.includes(i)))} onClick={() => void save()}>{busy ? '正在收好…' : `我做到了，收下${rule.rewardStars}星`}</button>
      </div>}
    </>}
  </article>
}

export function HabitBoard({ rules, tasks, checks, date, limit = 5 }: { rules: RoutineRule[]; tasks: TaskRecord[]; checks: RoutineCheck[]; date: string; limit?: number }) {
  const { habitPlanReady, habitPlanError, retryHabitPlan } = useApp()
  const [category, setCategory] = useState<HabitCategory>('life')
  const [chosen, setChosen] = useState('')
  const [message, setMessage] = useState('')
  const active = rules.filter(r => r.active && habitDefinition(r))
  const cards = active.filter(r => r.category === category).map(rule => ({ id: rule.id, title: rule.title, done: checks.some(c => c.ruleId === rule.id && c.status === 'done'), rule }))
  const sorted = cards.sort((a, b) => Number(a.done) - Number(b.done) || Number(b.id === chosen) - Number(a.id === chosen)).slice(0, limit)
  return <section className="habit-board"><div className="habit-category-picker" role="group" aria-label="打卡分类">{HABIT_CATEGORIES.map(c => <button type="button" key={c.key} aria-pressed={category === c.key} onClick={() => setCategory(c.key)}><PlayPicture kind={c.picture} /><strong>{c.label}</strong><small>{c.key === 'life' ? '每项1星' : '每项2星'}</small></button>)}</div>
    <Celebration message={message} />
    {!habitPlanReady ? <div>{habitPlanError ? <><p role="alert">{habitPlanError}</p><button className="btn" onClick={retryHabitPlan}>重新准备图卡</button></> : <p role="status">正在准备生活、运动和学习图卡…</p>}</div> : <><div className="journey-section-heading"><h2>{HABIT_CATEGORIES.find(c => c.key === category)!.label}</h2><small>{category === 'life' ? '三件生活小事，做一组亮一星' : category === 'sport' ? '选喜欢的一项，也可以两项都做' : '适合自己的难度，完成就得星'}</small></div>
      <div className="habit-grid">{sorted.map(card => <div key={`${card.id}:${date}`} className={chosen === card.id ? 'habit-choice chosen' : 'habit-choice'}><HabitCard rule={card.rule} date={date} done={card.done} onSaved={setMessage} />{!card.done && <button className="choose-task" type="button" aria-label={`我先做：${card.title}`} aria-pressed={chosen === card.id} onClick={() => setChosen(value => value === card.id ? '' : card.id)}>{chosen === card.id ? '先做这一件' : '我先做这个'}</button>}</div>)}</div>
      {category === 'study' && tasks.length > 0 && <><h3>家长安排的其他学习任务</h3><div className="action-grid">{tasks.slice(0, Math.max(0, limit - sorted.length)).map(task => <ActionCard key={task.id} title={task.name} stars={recordStars(task)} done={task.completion === 'independent'} onComplete={async () => { try { await repo.updateTaskRecord(task.id, { completion: 'independent', status: 'finished', timer: null }); setMessage(`你完成了：${task.name}！`); return true } catch { setMessage('这次没记上，请重试。'); return false } }} />)}</div></>}
      {active.length === 0 && <p>请家长先启用几张打卡图卡。</p>}
      {category === 'life' && rules.some(r => r.active && !r.builtinKey) && <><h3>家长补充的生活图卡</h3><div className="action-grid">{rules.filter(r => r.active && !r.builtinKey).slice(0, Math.max(0, limit - sorted.length)).map(rule => <ActionCard key={rule.id} title={rule.title} stars={rule.rewardStars ?? 1} done={checks.some(c => c.ruleId === rule.id && c.status === 'done')} onComplete={async () => { try { await repo.setCheck(rule.childId, rule.id, date, 'done'); setMessage(`你做到了：${rule.title}！`); return true } catch { setMessage('这次没记上，请重试。'); return false } }} />)}</div></>}
    </>}
  </section>
}
