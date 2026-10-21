import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { repo } from '../db/repo'
import { useApp } from '../app/AppProvider'
import { Card, Notice, PageHeader } from '../components/ui'
import { IconChart, IconChat, IconFlask, IconHeart, IconShield } from '../components/icons'
import { ENTITY_LABELS, type EntityName } from '../db/db'
import { SETTINGS_KEYS } from '../lib/settings'
import { diffDays, todayKey } from '../lib/date'

export function More() {
  const { profile } = useApp()
  const lastBackup = useLiveQuery(
    () => repo.getSetting<string>(SETTINGS_KEYS.lastBackupAt, ''),
    [],
  )
  const counts = useLiveQuery(() => repo.countAll(), [])

  const daysSinceBackup =
    lastBackup && lastBackup.slice(0, 10)
      ? diffDays(todayKey(), lastBackup.slice(0, 10))
      : null

  return (
    <>
      <PageHeader title="更多" intro="冲突复盘、优势事例、每周复盘、实验和数据设置都收在这里。" />
      <Card title="功能入口"><div className="quick-links"><Link className="quick-link" to="/parent/today"><strong>原有今日与记录</strong><span>保留原来的完整首页</span></Link><Link className="quick-link" to="/parent/sleep"><strong>睡眠与身体</strong></Link><Link className="quick-link" to="/parent/study"><strong>学习管理</strong></Link><Link className="quick-link" to="/parent/records"><strong>成长记录</strong></Link><Link className="quick-link" to="/parent/bank"><strong>星星银行设置</strong></Link></div>
        <div className="quick-links">
          <Link className="quick-link" to="/rules"><strong>原有家庭规则</strong><span>维护日常打卡图卡与步骤</span></Link>
          <Link className="quick-link" to="/family"><strong>家庭成员与成长公约</strong><span>一起制定约定，签订和双向打卡</span></Link>
          <Link className="quick-link" to="/rewards"><span className="quick-link-icon" aria-hidden="true"><IconHeart size={19} /></span><strong>星星与心愿礼物</strong><span>确认心愿星数，兑现孩子的礼物</span></Link>
          <Link className="quick-link" to="/conflicts">
            <span className="quick-link-icon" aria-hidden="true">
              <IconChat size={19} />
            </span>
            <strong>家庭冲突复盘</strong>
            <span>记录冲突情境与下次办法</span>
          </Link>
          <Link className="quick-link" to="/strengths">
            <span className="quick-link-icon" aria-hidden="true">
              <IconHeart size={19} />
            </span>
            <strong>优势与成长事例</strong>
            <span>记下具体做过的好事</span>
          </Link>
          <Link className="quick-link" to="/weekly">
            <span className="quick-link-icon" aria-hidden="true">
              <IconChart size={19} />
            </span>
            <strong>每周复盘</strong>
            <span>本周事实与家长复盘表</span>
          </Link>
          <Link className="quick-link" to="/experiments">
            <span className="quick-link-icon" aria-hidden="true">
              <IconFlask size={19} />
            </span>
            <strong>家庭改进实验</strong>
            <span>一次只试一件事</span>
          </Link>
          <Link className="quick-link" to="/settings">
            <span className="quick-link-icon" aria-hidden="true">
              <IconShield size={19} />
            </span>
            <strong>数据与隐私设置</strong>
            <span>档案、密码、导出与恢复</span>
          </Link>
        </div>
      </Card>

      <Card title="数据概览">
        <ul className="list">
          {(Object.entries(counts ?? {}) as Array<[string, number]>)
            .filter(([, value]) => value > 0)
            .map(([key, value]) => (
              <li className="list-item" key={key}>
                {ENTITY_LABELS[key as EntityName] ?? key}：{value} 条
              </li>
            ))}
        </ul>
        <p className="muted">
          孩子档案：{profile?.name ?? '—'} · 记录存在你自己的在线数据表里，这台设备同时留一份本地镜像
        </p>
      </Card>

      <Notice variant="warn">
        {daysSinceBackup === null
          ? '还没有导出过备份。建议现在就导出一次 JSON 备份，存到自己的网盘或电脑里。'
          : daysSinceBackup >= 7
            ? `上次导出备份是 ${daysSinceBackup} 天前，建议再导出一次。数据虽然在线上，留一份离线备份才踏实。`
            : `最近一次备份在 ${lastBackup?.slice(0, 10)}，数据是安全的。`}
      </Notice>
    </>
  )
}
