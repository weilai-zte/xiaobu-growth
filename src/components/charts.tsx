/**
 * 手写 SVG 图表。刻意不引入图表库：
 * 图小、样式简单，自己画反而更可控，也不用为几百 KB 的依赖买单。
 *
 * 无障碍上遵循「分层表达」：图形 + 一句话结论 + 可展开的数据表。
 * 颜色只是辅助，图例和表格都带文字，色觉差异不影响读数据。
 */
import { useId, type ReactNode } from 'react'
import {
  clockToMinutes,
  formatDay,
  formatDayShort,
  formatDuration,
  isClockTime,
  sleepDurationMinutes,
} from '../lib/date'
import { LABELS, type MorningState } from '../db/types'

/** 中深色调色板，浅色和深色背景下都能分辨 */
export const SERIES_COLORS = [
  '#4c8066',
  '#b0763a',
  '#4a7fa5',
  '#8a6ea8',
  '#7a9c4f',
  '#b06a5c',
  '#4f9595',
  '#9c7f3f',
]

export interface StackSeries {
  key: string
  label: string
  color?: string
}

export interface StackDay {
  date: string
  /** 这一天各系列的数值 */
  values: Record<string, number>
}

/**
 * 把扁平的 (日期, 分类, 数值) 三元组折成堆叠图需要的结构。
 * 分类太多时只保留总量最高的几个，其余并成「其余…」，免得柱子碎成一片。
 */
export function buildStacks(
  rows: Array<{ date: string; key: string; value: number }>,
  dates: string[],
  options: { maxSeries?: number; restLabel?: string } = {},
): { days: StackDay[]; series: StackSeries[] } {
  const maxSeries = options.maxSeries ?? 6
  const restLabel = options.restLabel ?? '其余'

  const totals = new Map<string, number>()
  for (const row of rows) {
    if (row.value <= 0) continue
    totals.set(row.key, (totals.get(row.key) ?? 0) + row.value)
  }

  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1])
  const kept = ranked.slice(0, maxSeries).map(([key]) => key)
  const folded = ranked.length > maxSeries ? restLabel : null

  const series: StackSeries[] = kept.map((key) => ({ key, label: key }))
  if (folded) series.push({ key: folded, label: folded })

  const buckets = new Map<string, Record<string, number>>()
  for (const date of dates) buckets.set(date, {})
  for (const row of rows) {
    if (row.value <= 0) continue
    const bucket = buckets.get(row.date)
    if (!bucket) continue
    const key = kept.includes(row.key) ? row.key : folded
    if (!key) continue
    bucket[key] = (bucket[key] ?? 0) + row.value
  }

  return {
    days: dates.map((date) => ({ date, values: buckets.get(date) ?? {} })),
    series,
  }
}

function niceCeil(value: number): number {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalized = value / magnitude
  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]
  const step = steps.find((candidate) => normalized <= candidate) ?? 10
  return step * magnitude
}

export function StackedBars({
  title,
  days,
  series,
  unit = '分钟',
  emptyText = '还没有可以画图的数据。',
  note,
}: {
  title: string
  days: StackDay[]
  series: StackSeries[]
  unit?: string
  emptyText?: string
  /** 关于口径的短说明，例如「没填分钟的记录不计入」 */
  note?: string
}) {
  const titleId = useId()
  const colorOf = (item: StackSeries, index: number) =>
    item.color ?? SERIES_COLORS[index % SERIES_COLORS.length]

  const totals = days.map((day) =>
    series.reduce((sum, item) => sum + Math.max(0, day.values[item.key] ?? 0), 0),
  )
  const rawMax = Math.max(0, ...totals)

  if (days.length === 0 || rawMax <= 0) {
    return (
      <figure className="chart-figure">
        <figcaption className="chart-caption">{title}</figcaption>
        <p className="chart-empty">{emptyText}</p>
        {note && <p className="muted">{note}</p>}
      </figure>
    )
  }

  const max = niceCeil(rawMax)
  const W = 620
  const H = 210
  const pad = { top: 16, right: 12, bottom: 32, left: 40 }
  const plotW = W - pad.left - pad.right
  const plotH = H - pad.top - pad.bottom
  const step = plotW / days.length
  const barW = Math.min(26, Math.max(6, step * 0.62))
  const scale = (value: number) => (value / max) * plotH
  const baseline = pad.top + plotH
  const ticks = [0, max / 2, max]

  const bestIndex = totals.indexOf(rawMax)
  const onlyOne = rawMax === totals[0] && totals.every((value) => value === totals[0])
  const summary = onlyOne
    ? `这 ${days.length} 天每天都是 ${rawMax} ${unit}。`
    : `这 ${days.length} 天合计 ${totals.reduce((a, b) => a + b, 0)} ${unit}，最多的一天是 ${formatDay(
        days[bestIndex].date,
      )}，${rawMax} ${unit}。`

  return (
    <figure className="chart-figure">
      <figcaption className="chart-caption">{title}</figcaption>
      <svg
        className="chart-svg"
        role="img"
        aria-labelledby={titleId}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
      >
        <title id={titleId}>{`${title}。${summary}`}</title>

        {ticks.map((tick) => {
          const y = baseline - scale(tick)
          return (
            <g key={tick}>
              <line
                x1={pad.left}
                x2={W - pad.right}
                y1={y}
                y2={y}
                stroke="var(--line)"
                strokeWidth={tick === 0 ? 1.4 : 1}
                strokeDasharray={tick === 0 ? undefined : '3 4'}
              />
              <text x={pad.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="var(--text-muted)">
                {Math.round(tick)}
              </text>
            </g>
          )
        })}

        {days.map((day, dayIndex) => {
          const x = pad.left + step * dayIndex + (step - barW) / 2
          let cursor = baseline
          const stacks: ReactNode[] = []
          for (let i = 0; i < series.length; i += 1) {
            const item = series[i]
            const value = Math.max(0, day.values[item.key] ?? 0)
            if (value <= 0) continue
            const height = Math.max(1.5, scale(value))
            cursor -= height
            stacks.push(
              <rect
                key={item.key}
                className="chart-bar"
                x={x}
                y={cursor}
                width={barW}
                height={height}
                rx={2}
                fill={colorOf(item, i)}
              >
                <title>{`${formatDay(day.date)}　${item.label}　${value} ${unit}`}</title>
              </rect>,
            )
          }
          return (
            <g key={day.date}>
              {stacks}
              {dayIndex % 2 === 0 && (
                <text
                  x={x + barW / 2}
                  y={H - 10}
                  textAnchor="middle"
                  fontSize="10"
                  fill="var(--text-muted)"
                >
                  {formatDayShort(day.date)}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      <div className="chart-legend">
        {series.map((item, index) => (
          <span key={item.key}>
            <i className="chart-swatch" style={{ background: colorOf(item, index) }} />
            {item.label}
          </span>
        ))}
      </div>

      <p className="chart-summary">{summary}</p>
      {note && <p className="muted">{note}</p>}

      <details className="chart-details">
        <summary>查看每天的数据</summary>
        <table className="chart-table">
          <caption>
            {title}，单位：{unit}
          </caption>
          <thead>
            <tr>
              <th scope="col">日期</th>
              {series.map((item) => (
                <th key={item.key} scope="col">
                  {item.label}
                </th>
              ))}
              <th scope="col">合计</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day, index) => (
              <tr key={day.date}>
                <th scope="row">{formatDay(day.date)}</th>
                {series.map((item) => (
                  <td key={item.key}>{day.values[item.key] ?? 0}</td>
                ))}
                <td>{totals[index]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

/* ---------- 睡眠时段图 ---------- */

/** 横轴固定覆盖 19:00 → 次日 11:00，够放下绝大多数作息 */
const SLEEP_WINDOW_START = 19 * 60
const SLEEP_WINDOW_MINUTES = 16 * 60

function offsetInWindow(clock: string | null | undefined): number | null {
  if (!isClockTime(clock)) return null
  let minutes = clockToMinutes(clock) - SLEEP_WINDOW_START
  if (minutes < 0) minutes += 1440
  if (minutes > SLEEP_WINDOW_MINUTES) return null
  return minutes
}

/**
 * 四档晨起状态用四个明显不同的色相，不能靠深浅区分 ——
 * 色觉差异的人也要一眼分得开。
 */
export const MORNING_COLOR: Record<MorningState, string> = {
  refreshed: '#2f7a55',
  ok: '#4a7fa5',
  tired: '#b0763a',
  very_tired: '#a8463f',
}

export interface SleepRow {
  date: string
  sleepTime: string | null
  wakeTime: string | null
  morningState: MorningState | null
  /** 夜间醒来情况的原始值，用来在条上标点 */
  nightWaking?: string | null
}

const WAKING_DOTS: Record<string, number> = {
  once: 1,
  twice: 2,
  three_plus: 3,
}

/**
 * 每天一行：横条从入睡画到起床，颜色表示晨起精神状态，条上的圆点表示夜醒。
 * 比单纯比高矮的柱状图更能看出「是几点睡的」。
 */
export function SleepTimeline({ rows }: { rows: SleepRow[] }) {
  const titleId = useId()
  const usable = rows.filter(
    (row) => offsetInWindow(row.sleepTime) !== null && offsetInWindow(row.wakeTime) !== null,
  )

  if (usable.length === 0) {
    return (
      <figure className="chart-figure">
        <figcaption className="chart-caption">入睡到起床的时段</figcaption>
        <p className="chart-empty">记录里还没有同时填好入睡和起床时间的那一天。</p>
      </figure>
    )
  }

  const W = 620
  const labelW = 54
  const padRight = 12
  const rowH = 24
  const rowGap = 8
  const padTop = 26
  const axisH = 26
  const plotW = W - labelW - padRight
  const H = padTop + usable.length * (rowH + rowGap) + axisH

  // 横轴按实际作息收窄：两边各留一小时余量再取整点，避免大片空白
  const offsets: number[] = []
  for (const row of usable) {
    const start = offsetInWindow(row.sleepTime)
    const end = offsetInWindow(row.wakeTime)
    if (start !== null) offsets.push(start)
    if (end !== null) offsets.push(end)
  }
  const startMin = Math.max(0, Math.floor(Math.min(...offsets) / 60) * 60 - 60)
  const endMin = Math.min(
    SLEEP_WINDOW_MINUTES,
    Math.ceil(Math.max(...offsets) / 60) * 60 + 60,
  )
  const span = Math.max(240, endMin - startMin)
  const xOf = (minutes: number) => labelW + ((minutes - startMin) / span) * plotW

  const clockOf = (offset: number) => {
    const total = (SLEEP_WINDOW_START + offset) % 1440
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:00`
  }
  const tickStep = span > 9 * 60 ? 120 : 60
  const firstTick = Math.ceil(startMin / tickStep) * tickStep
  const ticks: number[] = []
  for (let offset = firstTick; offset <= endMin; offset += tickStep) ticks.push(offset)

  const durations = usable
    .map((row) => sleepDurationMinutes(row.sleepTime, row.wakeTime))
    .filter((value): value is number => value !== null)
  const avg = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null

  return (
    <figure className="chart-figure">
      <figcaption className="chart-caption">入睡到起床的时段（颜色 = 晨起状态）</figcaption>
      <svg
        className="chart-svg"
        role="img"
        aria-labelledby={titleId}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
      >
        <title id={titleId}>
          {`最近 ${usable.length} 天的入睡与起床时段${avg === null ? '' : `，平均夜间时长 ${formatDuration(avg)}`}。完整数据见下方表格。`}
        </title>

        {ticks.map((offset) => {
          const x = xOf(offset)
          return (
            <g key={offset}>
              <line
                x1={x}
                x2={x}
                y1={padTop - 8}
                y2={H - axisH + 2}
                stroke="var(--line)"
                strokeWidth="1"
                strokeDasharray="3 5"
              />
              <text
                x={x}
                y={H - axisH + 16}
                textAnchor="middle"
                fontSize="10"
                fill="var(--text-muted)"
              >
                {clockOf(offset)}
              </text>
            </g>
          )
        })}

        {usable.map((row, index) => {
          const y = padTop + index * (rowH + rowGap)
          const start = offsetInWindow(row.sleepTime)
          const end = offsetInWindow(row.wakeTime)
          if (start === null || end === null) return null
          const x1 = xOf(start)
          const x2 = xOf(Math.max(end, start + 6))
          const color = row.morningState ? MORNING_COLOR[row.morningState] : 'var(--line-strong)'
          const dots = WAKING_DOTS[row.nightWaking ?? ''] ?? 0
          return (
            <g key={row.date}>
              <text x={0} y={y + rowH / 2 + 4} fontSize="10" fill="var(--text-muted)">
                {formatDayShort(row.date)}
              </text>
              <rect
                className="chart-bar"
                x={x1}
                y={y}
                width={Math.max(3, x2 - x1)}
                height={rowH}
                rx={rowH / 2}
                fill={color}
                opacity={0.9}
              >
                <title>
                  {`${formatDay(row.date)}　入睡 ${row.sleepTime}　起床 ${row.wakeTime}　夜间时长 ${formatDuration(
                    sleepDurationMinutes(row.sleepTime, row.wakeTime),
                  )}`}
                </title>
              </rect>
              {Array.from({ length: dots }).map((_, dotIndex) => (
                <circle
                  key={dotIndex}
                  cx={x1 + 16 + dotIndex * 11}
                  cy={y + rowH / 2}
                  r={3.2}
                  fill="var(--surface)"
                  stroke="var(--text)"
                  strokeWidth="1.2"
                />
              ))}
            </g>
          )
        })}
      </svg>

      <div className="chart-legend">
        {(['refreshed', 'ok', 'tired', 'very_tired'] as MorningState[]).map((state) => (
          <span key={state}>
            <i className="chart-swatch" style={{ background: MORNING_COLOR[state] }} />
            {LABELS.morningState[state]}
          </span>
        ))}
        <span>
          <i className="chart-swatch chart-swatch-dot" />
          圆点 = 夜醒次数
        </span>
      </div>

      {avg !== null && (
        <p className="chart-summary">
          最近 {usable.length} 天里，平均夜间时长 {formatDuration(avg)}。
        </p>
      )}

      <details className="chart-details">
        <summary>查看每天的数据</summary>
        <table className="chart-table">
          <caption>最近 {usable.length} 天的入睡、起床与晨起状态</caption>
          <thead>
            <tr>
              <th scope="col">日期</th>
              <th scope="col">入睡</th>
              <th scope="col">起床</th>
              <th scope="col">夜间时长</th>
              <th scope="col">晨起状态</th>
            </tr>
          </thead>
          <tbody>
            {usable.map((row) => (
              <tr key={row.date}>
                <th scope="row">{formatDay(row.date)}</th>
                <td>{row.sleepTime ?? '—'}</td>
                <td>{row.wakeTime ?? '—'}</td>
                <td>{formatDuration(sleepDurationMinutes(row.sleepTime, row.wakeTime))}</td>
                <td>{row.morningState ? LABELS.morningState[row.morningState] : '未记录'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
