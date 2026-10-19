import { useEffect, useState } from 'react'
import { useSync } from '../app/SyncProvider'
import type { AdventureRun, AdventureRoute, RoutineCheck, TaskRecord } from '../db/types'
import { adventureDay, adventureStory, dailyActionStars, MATERIAL_NAMES, ROUTES, uniqueAdventures } from '../lib/adventure'
import { Celebration, PlayPicture, TinyStar } from './PlayCards'
import { preparePraise } from '../lib/praise'

export function useAdventureDay() {
  const [date, setDate] = useState(adventureDay)
  useEffect(() => { const timer = setInterval(() => setDate(adventureDay()), 30000); return () => clearInterval(timer) }, [])
  return date
}

export function Adventure({ childId, date, tasks, checks, runs }: { childId: string; date: string; tasks: TaskRecord[]; checks: RoutineCheck[]; runs: AdventureRun[] }) {
  const { engine } = useSync()
  const [choosing, setChoosing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [received, setReceived] = useState<AdventureRun>()
  const history = uniqueAdventures(runs)
  const current = history.find(r => r.date === date) ?? (received?.date === date ? received : undefined)
  const stars = dailyActionStars(tasks, checks, date)
  const ready = stars >= 5
  async function travel(route: AdventureRoute) {
    const play = preparePraise()
    setBusy(true); setError('')
    try {
      const result = await engine.claimAdventure(childId, date, route)
      setReceived(result); setChoosing(false)
      setFeedback(`冒险记好啦！带回 ${result.bonusStars} 颗星和一份${MATERIAL_NAMES[result.material]}。`)
      void play()
    } catch (err) { setError(err instanceof Error ? err.message : '没有连上，请重试；不会重复领奖。') }
    finally { setBusy(false) }
  }
  return <section className="adventure-card" aria-labelledby="adventure-title">
    <div className="adventure-heading"><div><span className="journey-kicker">每天一小段故事 · 不花星星</span><h2 id="adventure-title">{current ? '今天的冒险收好啦' : history.length < 2 ? '带小蛋去看看世界' : '和小步去冒险'}</h2></div><PlayPicture kind={current?.material ?? 'map'} /></div>
    {current ? <div className="adventure-result"><p>{adventureStory(current)}</p><div className="adventure-loot"><span><TinyStar /> +{current.bonusStars} 星</span><span><PlayPicture kind={current.material} /> {MATERIAL_NAMES[current.material]} × 1</span></div><p className="muted">已经保存，手机和电脑看的是同一段故事。今天可以歇一歇啦。</p></div> : <>
      <div className="adventure-energy" role="progressbar" aria-label="今日冒险准备进度" aria-valuemin={0} aria-valuemax={5} aria-valuenow={Math.min(stars, 5)}><span style={{ width: `${Math.min(stars / 5, 1) * 100}%` }} /></div>
      <p>{ready ? '小背包准备好啦！选一条路，带回今天的小发现。' : `今天任务已攒 ${stars} / 5 星，再攒 ${Math.max(0, 5 - stars)} 星就可以出发。`}</p>
      {!choosing ? <button className="btn btn-primary adventure-start" disabled={!ready} onClick={() => { setChoosing(true); setError('') }}>{ready ? '出发冒险' : '慢慢准备，不着急'}</button> : <div className="adventure-routes" role="group" aria-label="选择今天的冒险路线">{ROUTES.map(route => <button key={route.key} type="button" disabled={busy} onClick={() => void travel(route.key)}><PlayPicture kind={route.picture} /><strong>{route.name}</strong></button>)}</div>}
      {choosing && !busy && <button type="button" className="btn" onClick={() => setChoosing(false)}>待会儿再去</button>}
    </>}
    {busy && <p role="status">正在探索，也在把故事和礼物收好…</p>}
    {error && <p role="alert" className="adventure-error">{error} 请点路线重试。</p>}
    <Celebration message={feedback} />
    <details><summary>家长看看冒险规则</summary><p>每日任务完成满5星可冒险一次，不扣除星星；兑换礼物不影响资格。每次随机获得2、3或5星（各约三分之一），另得一份叶子、树枝或石头（各约三分之一）。没有空奖、大额奖或付费重抽。奖励不计入当天5星门槛。</p><p>累计1次冒险裂壳、2次出生、5次练飞、9次长大、14次有小窝、21次有小家。材料自动用于搭窝，不需购买或手动消耗。不要求连续，休息不会退回。按北京时间分日，不补抽往日；冒险需要联网，打卡仍可离线。</p></details>
  </section>
}
