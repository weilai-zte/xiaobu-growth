import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { repo } from '../db/repo'
import { useApp } from '../app/AppProvider'
import { Card, InputField, Notice, PageHeader, TextAreaField } from '../components/ui'
import { LABELS, type DailyLog } from '../db/types'
import {
  addDays,
  formatDay,
  formatDuration,
  sleepDurationMinutes,
  todayKey,
} from '../lib/date'

function cell(value: string | null | undefined): string {
  return value ?? '—'
}

export function SleepPrint() {
  const { profile } = useApp()
  const childId = profile?.id
  const [from, setFrom] = useState(addDays(todayKey(), -13))
  const [to, setTo] = useState(todayKey())
  const [questions, setQuestions] = useState('')

  const logs = useLiveQuery(
    async () => (childId ? repo.listDailyLogs(childId, from, to) : []),
    [childId, from, to],
  )

  const rows: DailyLog[] = logs ?? []
  const durations = rows
    .map((l) => sleepDurationMinutes(l.sleepTime, l.wakeTime))
    .filter((v): v is number => v !== null)
  const avg = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null

  return (
    <>
      <div className="no-print">
        <PageHeader
          title="就医摘要"
          intro="把这段时间的记录整理成一页纸，打印或截图后带给医生，减少口头回忆的遗漏。"
        />
        <Card title="选择时间范围">
          <InputField
            label="开始日期"
            type="date"
            value={from}
            max={to}
            onChange={setFrom}
          />
          <InputField label="结束日期" type="date" value={to} max={todayKey()} onChange={setTo} />
          <div className="row">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setFrom(addDays(todayKey(), -29))
                setTo(todayKey())
              }}
            >
              最近 30 天
            </button>
            <button type="button" className="btn btn-primary" onClick={() => window.print()}>
              打印 / 存为 PDF
            </button>
            <Link className="btn btn-ghost" to="/sleep">
              返回记录
            </Link>
          </div>
        </Card>
        <Card title="想请医生一起看的疑问（只出现在这一页）">
          <TextAreaField
            label=""
            value={questions}
            onChange={setQuestions}
            hint="这段文字不会写入数据库，只在当前页面显示，刷新后就没了"
            placeholder="例如：夜间张口呼吸是否需要进一步检查？"
          />
        </Card>
      </div>

      <Card title="小步成长 · 睡眠与身体情况记录">
        <p className="muted">
          孩子：{profile?.name}
          {profile?.birthDate ? `（出生日期 ${profile.birthDate}）` : ''} · 记录区间：{from} 至 {to} ·
          共 {rows.length} 天记录 · 生成时间：{formatDay(todayKey())}
        </p>
        <div className="metrics">
          <div className="metric">
            <span className="metric-label">平均夜间时长</span>
            <span className="metric-value">{formatDuration(avg)}</span>
          </div>
          <div className="metric">
            <span className="metric-label">夜间咳嗽天数</span>
            <span className="metric-value">
              {rows.filter((l) => l.nightCough && l.nightCough !== 'none').length} 天
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">鼻塞天数</span>
            <span className="metric-value">
              {rows.filter((l) => l.nightCongestion && l.nightCongestion !== 'none').length} 天
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">打鼾/张口呼吸天数</span>
            <span className="metric-value">
              {rows.filter((l) => l.snoring && l.snoring !== 'no').length} 天
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">晨起较累天数</span>
            <span className="metric-value">
              {
                rows.filter((l) => l.morningState === 'tired' || l.morningState === 'very_tired')
                  .length
              }{' '}
              天
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">白天困倦天数</span>
            <span className="metric-value">
              {rows.filter((l) => l.daytimeSleepiness && l.daytimeSleepiness !== 'none').length} 天
            </span>
          </div>
        </div>

        <div style={{ overflowX: 'auto', marginTop: 16 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85rem' }}>
            <caption className="muted" style={{ textAlign: 'left', paddingBottom: 6 }}>
              逐日记录
            </caption>
            <thead>
              <tr>
                {[
                  '日期',
                  '入睡',
                  '起床',
                  '夜间时长',
                  '鼻塞',
                  '咳嗽',
                  '打鼾/张口',
                  '夜醒',
                  '晨起',
                  '白天困倦',
                  '备注',
                ].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    style={{ borderBottom: '1px solid var(--line)', padding: '6px 8px', textAlign: 'left' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((log) => (
                <tr key={log.id}>
                  <td style={{ padding: '6px 8px' }}>{log.date}</td>
                  <td style={{ padding: '6px 8px' }}>{cell(log.sleepTime)}</td>
                  <td style={{ padding: '6px 8px' }}>{cell(log.wakeTime)}</td>
                  <td style={{ padding: '6px 8px' }}>
                    {formatDuration(sleepDurationMinutes(log.sleepTime, log.wakeTime))}
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    {log.nightCongestion ? LABELS.nightCongestion[log.nightCongestion] : '—'}
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    {log.nightCough ? LABELS.nightCough[log.nightCough] : '—'}
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    {log.snoring ? LABELS.snoring[log.snoring] : '—'}
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    {log.nightWaking ? LABELS.nightWaking[log.nightWaking] : '—'}
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    {log.morningState ? LABELS.morningState[log.morningState] : '—'}
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    {log.daytimeSleepiness ? LABELS.daytimeSleepiness[log.daytimeSleepiness] : '—'}
                  </td>
                  <td style={{ padding: '6px 8px' }}>{log.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {questions.trim() && (
          <>
            <h3 style={{ marginTop: 16 }}>家长想请医生一起看的疑问</h3>
            <p className="summary-text">{questions}</p>
          </>
        )}

        <p className="muted" style={{ marginTop: 16 }}>
          本页内容由家庭自行记录生成，只描述观察到的情况，不包含任何诊断判断或用药建议。
        </p>
      </Card>

      <div className="no-print">
        <Notice>打印时顶部导航会自动隐藏；手机上可以用「分享 → 打印」选择存成 PDF。</Notice>
      </div>
    </>
  )
}
