import { useId, useState } from 'react'
import type { DayKey, RoutineCheck } from '../db/types'
import { buildHeatmap } from '../lib/heatmap'
import { Card } from './ui'

const COLORS = ['#f1f0f7', '#dcd6f4', '#a78bfa', '#6b46c1']
const DAYS = ['一', '二', '三', '四', '五', '六', '日']

export function CheckinHeatmap({ checks, date }: { checks: RoutineCheck[]; date: DayKey }) {
  const id = useId()
  const cells = buildHeatmap(checks, date)
  const [selected, setSelected] = useState(date)
  const active = cells.find(c => c.date === selected)
  const days = cells.filter(c => c.stars > 0).length
  const total = cells.reduce((sum, c) => sum + c.stars, 0)
  return <Card title="我的打卡星图">
    <div className="checkin-heatmap">
      <p className="muted">最近12周 · {cells[0].date} 至 {date} · 每行一周</p>
      <p>{days ? `留下了 ${days} 天的小脚印，收集了 ${total} 颗打卡星星。` : '小小的脚印，从今天开始慢慢留下。'}</p>
      <svg viewBox="0 0 350 632" role="grid" aria-labelledby={`${id}-title`}>
        <title id={`${id}-title`}>最近12周打卡星图</title>
        <desc>周一到周日，每行一周。点击或聚焦格子查看当天星数。</desc>
        {DAYS.map((day, i) => <text key={day} x={i * 50 + 25} y="22" textAnchor="middle" aria-hidden="true">{day}</text>)}
        {Array.from({ length: 12 }, (_, week) => <g role="row" key={week}>
          {cells.slice(week * 7, week * 7 + 7).map((cell, column) => {
            const future = cell.date > date
            return <g key={cell.date}>
              <rect x={column * 50 + 4} y={week * 50 + 32} width="42" height="42" rx="10"
                fill={COLORS[cell.bucket]} role="gridcell" tabIndex={0}
                aria-label={`${cell.date}, ${cell.stars} 星`} aria-selected={selected === cell.date}
                className={future ? 'heatmap-future' : ''}
                onFocus={() => setSelected(cell.date)} onClick={() => setSelected(cell.date)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(cell.date); return }
                  const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key]
                  if (offset !== undefined) {
                    event.preventDefault()
                    const nodes = event.currentTarget.ownerSVGElement?.querySelectorAll<SVGRectElement>('[role="gridcell"]')
                    nodes?.[Math.max(0, Math.min(83, week * 7 + column + offset))]?.focus()
                  }
                }}>
                <title>{cell.date} · {future ? '还没到这一天' : `${cell.stars} 颗星`}</title>
              </rect>
              <text x={column * 50 + 25} y={week * 50 + 59} textAnchor="middle" pointerEvents="none" aria-hidden="true" fill={cell.bucket === 3 ? '#fff' : '#46365f'}>{future ? '·' : cell.stars || '—'}</text>
            </g>
          })}
        </g>)}
      </svg>
      <p role="status">{active ? `${active.date} · ${active.date > date ? '还没到这一天' : `${active.stars} 颗星`}` : '点一个格子，看看那天的小脚印。'}</p>
      <div className="heatmap-legend">{['0星', '1星', '2星', '3星及以上'].map((label, i) => <span key={label}><i style={{ background: COLORS[i] }} />{label}</span>)}</div>
      <p className="muted">只统计已完成打卡中记录的1星、2星奖励；不含冒险奖励。空格表示没有计入星星，不代表没有努力。</p>
      <details><summary>查看每日星星明细</summary><table><caption>最近12周打卡星星</caption><thead><tr><th scope="col">日期</th><th scope="col">星星</th></tr></thead><tbody>{cells.filter(c => c.date <= date).map(c => <tr key={c.date}><th scope="row">{c.date}</th><td>{c.stars}</td></tr>)}</tbody></table></details>
    </div>
  </Card>
}
