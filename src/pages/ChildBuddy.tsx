import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useApp } from '../app/AppProvider'
import { useToday } from '../app/hooks'
import { repo } from '../db/repo'
import type { BuddyActivity, BuddyCareAction } from '../db/types'
import { Adventure, useAdventureDay } from '../components/Adventure'
import { BirdCompanion } from '../components/BirdCompanion'
import { BirdGrowth } from '../components/GrowthJourney'
import {
  buddyBond,
  normalizeBuddyCare,
  type BuddyCareCommand,
} from '../lib/birdCompanion'
import { birdStage, dailyActionStars, uniqueAdventures } from '../lib/adventure'
import { preparePraise, stopPraise } from '../lib/praise'

const CARE_ACTIONS: Array<{
  key: BuddyCareAction
  label: string
  hint: string
  message: string
  mood: 'hello' | 'happy' | 'celebrate'
}> = [
  { key: 'feed', label: '喂食', hint: '森林小点心', message: '小步啄着小点心，开心地啾了一声！', mood: 'happy' },
  { key: 'play', label: '一起玩', hint: '小球和躲猫猫', message: '接住小球啦！小步扑扑翅膀，还想再玩一次。', mood: 'celebrate' },
  { key: 'groom', label: '理羽毛', hint: '轻轻梳顺羽毛', message: '羽毛被梳得顺顺的，小步舒服地眯起了眼睛。', mood: 'happy' },
  { key: 'sleep', label: '睡一会', hint: '闭眼收翅休息', message: '小布收好翅膀，闭上眼睛，睡一个甜甜的觉。', mood: 'hello' },
]

export function ChildBuddy() {
  const { profile } = useApp()
  const childId = profile?.id
  const date = useAdventureDay()
  const { tasks, checks } = useToday(date)
  const runs = useLiveQuery(
    () => childId ? repo.listAdventures(childId) : Promise.resolve([]),
    [childId],
  ) ?? []
  const care = normalizeBuddyCare(profile?.buddyCare, date)
  const adventures = uniqueAdventures(runs)
  const stage = birdStage(adventures.length)
  const bond = buddyBond(adventures, care)
  const [activity, setActivity] = useState<BuddyActivity>(care.sleepingSince ? 'sleep' : 'idle')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const animationTimer = useRef<ReturnType<typeof setTimeout>>()
  const sleeping = Boolean(care.sleepingSince)
  const adventureStars = dailyActionStars(tasks, checks, date)
  const adventureHint = adventures.some(run => run.date === date)
    ? '今天已经冒险啦'
    : adventureStars >= 5
      ? '今天可以出发'
      : `还差 ${5 - adventureStars} 星出发`

  useEffect(() => {
    setActivity(current => care.sleepingSince ? 'sleep' : current === 'sleep' ? 'idle' : current)
  }, [care.sleepingSince])

  useEffect(() => () => clearTimeout(animationTimer.current), [])

  async function careFor(command: BuddyCareCommand) {
    if (!childId || busy || (sleeping && command !== 'wake')) return
    const item = CARE_ACTIONS.find(action => action.key === command)
    const text = command === 'wake'
      ? `${profile?.nickname || profile?.name || '小主人'}，早安！小步抖抖羽毛，已经醒过来啦。`
      : item?.message ?? ''
    const sound = command === 'wake' || item
      ? preparePraise({
          name: profile?.name ?? '全全',
          title: '',
          text,
          mood: command === 'wake' ? 'hello' : item?.mood,
        })
      : undefined
    setBusy(true)
    try {
      const next = await repo.recordBuddyCare(childId, command)
      const nextActivity: BuddyActivity = command === 'wake' ? 'idle' : command
      setActivity(nextActivity)
      setMessage(text)
      if (command === 'sleep') stopPraise()
      else void sound?.()
      clearTimeout(animationTimer.current)
      if (command !== 'sleep' && command !== 'wake') {
        animationTimer.current = setTimeout(() => setActivity('idle'), 4200)
      }
      return next
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '这次没有照顾好小步，请再试一次。')
    } finally {
      setBusy(false)
    }
  }

  const adventure = childId && (
    <Adventure
      key={date}
      childId={childId}
      childName={profile?.nickname || profile?.name}
      date={date}
      tasks={tasks}
      checks={checks}
      runs={runs}
      onTravel={state => {
        if (state === 'start') setActivity('adventure')
        else setActivity(normalizeBuddyCare(profile?.buddyCare, date).sleepingSince ? 'sleep' : 'idle')
      }}
    />
  )

  return <div className="play-world child-buddy-page">
    <header className="buddy-play-hero">
      <div>
        <span className="play-eyebrow">我的养成伙伴</span>
        <h1>小步乐园</h1>
        <p>陪小布慢慢长大，一起建起小窝、小屋、花园和泳池。</p>
      </div>
      <div className="buddy-bond-card">
        <span>亲密等级 {bond.level}</span>
        <strong>{bond.name}</strong>
        <progress
          aria-label={`与小步的亲密进度，当前 ${bond.totalXp} 点`}
          max={bond.nextAt ?? (bond.totalXp || 1)}
          value={bond.nextAt ? bond.totalXp : bond.totalXp || 1}
        />
        <small>{bond.nextName ? `再陪伴 ${bond.nextAt! - bond.totalXp} 点，成为${bond.nextName}` : '你们已经是永远的好朋友啦'}</small>
      </div>
    </header>

    <section className="buddy-home" aria-label="小步的家">
      <header className="buddy-home-heading">
        <div>
          <h2>小步的一天</h2>
          <p>{sleeping ? '嘘，小步正在睡觉。想一起玩就先叫醒它。' : '它精神很好，正等你选一个陪伴动作。'}</p>
        </div>
        <div className="buddy-xp-pill" aria-label={`累计亲密值 ${bond.totalXp} 点`}>
          <span>星愿亲密</span>
          <strong>{bond.totalXp}</strong>
          <small>点亲密值</small>
        </div>
      </header>
      <BirdCompanion
        stage={stage.key}
        runs={runs}
        wardrobe
        habitat
        activity={activity}
        adventureHint={adventureHint}
        carePanel={(
          <BuddyCarePanel
            care={care}
            activity={activity}
            busy={busy}
            sleeping={sleeping}
            message={message}
            onCare={careFor}
          />
        )}
      >
        {adventure}
      </BirdCompanion>
    </section>

    <details className="buddy-play-help"><summary>照料和冒险怎么玩？</summary><section className="buddy-play-guide" aria-labelledby="buddy-play-guide-title">
      <span className="journey-kicker">这是一个慢慢长大的小世界</span>
      <h2 id="buddy-play-guide-title">今天想和小步做什么？</h2>
      <div className="buddy-play-guide-grid">
        <article><span aria-hidden="true">01</span><strong>亲密陪伴</strong><p>每种照料每天第一次会留下 1 点亲密值。重复玩耍也欢迎，不会掉状态。</p></article>
        <article><span aria-hidden="true">02</span><strong>森林冒险</strong><p>完成 5 星任务后出发，带回星星、材料和随机发现。</p></article>
        <article><span aria-hidden="true">03</span><strong>建起乐园</strong><p>礼物收进百宝箱，冒险14次有小窝、21次有小屋，之后还有花园和泳池。</p></article>
      </div>
    </section>

    </details>
    <BirdGrowth count={adventures.length} runs={runs} />
  </div>
}

function BuddyCarePanel({
  care,
  activity,
  busy,
  sleeping,
  message,
  onCare,
}: {
  care: ReturnType<typeof normalizeBuddyCare>
  activity: BuddyActivity
  busy: boolean
  sleeping: boolean
  message: string
  onCare: (command: BuddyCareCommand) => void
}) {
  const completed = new Set(care.completed)
  return <section className="buddy-care" aria-labelledby="buddy-care-title">
    <div className="buddy-care-heading">
      <div>
        <span className="journey-kicker">今日照料</span>
        <h3 id="buddy-care-title">{sleeping ? '小步睡着啦' : completed.size >= 4 ? '今天被照顾得很开心' : '选一个动作陪陪它'}</h3>
      </div>
      <span className="buddy-care-count">{completed.size} / 4</span>
    </div>
    <div className="buddy-care-actions">
      {CARE_ACTIONS.map(action => {
        const isSleep = action.key === 'sleep'
        const label = isSleep && sleeping ? '叫醒小步' : action.label
        const command: BuddyCareCommand = isSleep && sleeping ? 'wake' : action.key
        const disabled = busy || (sleeping && !isSleep)
        return <button
          key={action.key}
          type="button"
          disabled={disabled}
          aria-pressed={isSleep ? sleeping : activity === action.key}
          onClick={() => onCare(command)}
        >
          <CareIcon action={isSleep && sleeping ? 'wake' : action.key}/>
          <span>
            <strong>{label}</strong>
            <small>{sleeping && !isSleep ? '先叫醒小步' : action.hint}</small>
          </span>
          {completed.has(action.key) && <i aria-label="今天已经完成">✓</i>}
        </button>
      })}
    </div>
    <p className="buddy-care-message" role="status">{message || (sleeping ? '不用着急，小步会一直在这里。' : '每种照料每天第一次会增加 1 点亲密值。')}</p>
  </section>
}

function CareIcon({ action }: { action: BuddyCareCommand | BuddyCareAction }): ReactNode {
  if (action === 'feed') {
    return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M9 21h30l-4 15H13Z"/><path d="M7 20q17-8 34 0l-4 5H11Z"/><circle cx="18" cy="16" r="2"/><circle cx="25" cy="13" r="2"/><circle cx="32" cy="16" r="2"/></svg>
  }
  if (action === 'play') {
    return <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="16"/><path d="M9 21q15 2 28 13M21 8q4 18 14 31"/></svg>
  }
  if (action === 'groom') {
    return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M35 7C20 8 11 19 15 33c13-1 22-12 20-26Z"/><path d="m15 38 17-25M20 29l-1-10M26 23l9 1"/></svg>
  }
  if (action === 'wake') {
    return <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="8"/><path d="M24 5v5M24 38v5M5 24h5M38 24h5M10.5 10.5l3.5 3.5M34 34l3.5 3.5M37.5 10.5 34 14M14 34l-3.5 3.5"/></svg>
  }
  return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M35 31A15 15 0 0 1 19 9a16 16 0 1 0 16 22Z"/><path d="M35 8v7M31.5 11.5h7"/></svg>
}
