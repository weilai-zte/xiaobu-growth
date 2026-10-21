import { FeedbackSound } from '../components/FeedbackSound'
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ENTITY_LABELS, ENTITY_NAMES, type EntityName } from '../db/db'
import { repo } from '../db/repo'
import { useApp } from '../app/AppProvider'
import { useSync } from '../app/SyncProvider'
import { DEFAULT_ENDPOINT, SYNC_KEYS, type SyncStatus } from '../db/sync'
import {
  Card,
  ConfirmDialog,
  EmptyState,
  Errors,
  InputField,
  LiveMessage,
  Notice,
  OptionChips,
  PageHeader,
  SelectField,
  TextAreaField,
  TextField,
  useToastState,
} from '../components/ui'
import { formatDateTime, todayKey } from '../lib/date'
import {
  SETTINGS_KEYS,
  hashPin,
  makeSalt,
  type PinSetting,
} from '../lib/settings'
import { validateChildProfile, validatePin } from '../lib/validate'
import {
  buildExportBundle,
  bundleToJson,
  csvFileName,
  importBundle,
  jsonFileName,
  parseBundle,
  rowsToCsv,
  summarizeBundle,
  type ImportReport,
} from '../lib/transfer'

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

const SYNC_STATUS_LABEL: Record<SyncStatus, string> = {
  idle: '已连接',
  syncing: '正在同步',
  error: '同步失败',
  offline: '当前离线',
}

function recordSummary(entity: EntityName, row: Record<string, unknown>): string {
  const text = (key: string) => (row[key] === null || row[key] === undefined ? '' : `${row[key]}`)
  switch (entity) {
    case 'childProfiles':
      return text('name')
    case 'dailyLogs':
      return `${text('date')} 入睡 ${text('sleepTime') || '—'} 起床 ${text('wakeTime') || '—'}`
    case 'taskTemplates':
      return text('name')
    case 'taskRecords':
      return `${text('date')} ${text('name')}`
    case 'routineRules':
      return text('title')
    case 'routineChecks':
      return `${text('date')} ${text('status')}`
    case 'conflictLogs':
      return `${formatDateTime(text('occurredAt'))} ${text('childDescription').slice(0, 20)}`
    case 'strengthMoments':
      return `${text('date')} ${text('event').slice(0, 20)}`
    case 'weeklyReviews':
      return `${text('weekStart')} 起的一周`
    case 'experiments':
      return text('problem')
    default:
      return ''
  }
}

export function Settings() {
  const { profile, refreshProfile, pin, setPin, childView, setChildView } = useApp()
  const { snapshot, engine } = useSync()
  const toast = useToastState()
  const [errors, setErrors] = useState<string[]>([])
  const [endpointDraft, setEndpointDraft] = useState(snapshot.endpoint)
  const [familyKeyDraft, setFamilyKeyDraft] = useState('')
  const [syncing, setSyncing] = useState(false)

  const [name, setName] = useState(profile?.name ?? '')
  const [nickname, setNickname] = useState(profile?.nickname ?? '')
  const [birthDate, setBirthDate] = useState(profile?.birthDate ?? '')
  const [gradeLabel, setGradeLabel] = useState(profile?.gradeLabel ?? '')
  const [profileNote, setProfileNote] = useState(profile?.note ?? '')

  const [pinDraft, setPinDraft] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')

  const [csvEntity, setCsvEntity] = useState<EntityName>('dailyLogs')
  const [importReport, setImportReport] = useState<ImportReport | null>(null)
  const [pendingImport, setPendingImport] = useState<{
    text: string
    summary: string
  } | null>(null)
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge')
  const [deleteEntity, setDeleteEntity] = useState<EntityName>('dailyLogs')
  const [deleteTarget, setDeleteTarget] = useState<Record<string, unknown> | null>(null)
  const [clearOpen, setClearOpen] = useState(false)
  const [clearWord, setClearWord] = useState('')

  const counts = useLiveQuery(() => repo.countAll(), [])
  const rows = useLiveQuery(
    async () =>
      ((await repo.db[deleteEntity].toArray()) as unknown as Record<string, unknown>[]).filter(
        (row) => !row.deleted,
      ),
    [deleteEntity],
  )
  const lastBackup = useLiveQuery(
    () => repo.getSetting<string>(SETTINGS_KEYS.lastBackupAt, ''),
    [],
  )
  const lastImport = useLiveQuery(
    () => repo.getSetting<string>(SETTINGS_KEYS.lastImportAt, ''),
    [],
  )

  const storedDays = useMemo(
    () =>
      Object.entries(counts ?? {})
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${ENTITY_LABELS[k as EntityName] ?? k} ${v} 条`),
    [counts],
  )

  async function exportJson() {
    const bundle = await buildExportBundle(repo.db)
    const stamp = bundle.exportedAt
    download(jsonFileName(stamp), bundleToJson(bundle), 'application/json')
    await repo.setSetting(SETTINGS_KEYS.lastBackupAt, stamp)
    toast.show(`已导出 JSON 备份（${summarizeBundle(bundle)}）`)
  }

  async function exportCsv() {
    const bundle = await buildExportBundle(repo.db)
    const entityRows = bundle.data[csvEntity] ?? []
    download(
      csvFileName(csvEntity, bundle.exportedAt),
      rowsToCsv(entityRows, csvEntity),
      'text/csv;charset=utf-8',
    )
    toast.show(`已导出 ${ENTITY_LABELS[csvEntity]} 的 CSV（${entityRows.length} 行）`)
  }

  return (
    <>
      <LiveMessage message={toast.message} clear={toast.clear} />
      <PageHeader
        title="数据与隐私设置"
        intro="记录保存在你自己部署的在线数据表里，换设备、换浏览器打开看到的是同一份数据；这台设备同时还留一份本地镜像，断网时照常使用，联网后自动补传。"
      />
      <Errors errors={errors} />

      <Card title="小步的声音"><FeedbackSound /></Card>
      <Card title="在线同步">
        <div className="row-between">
          <div>
            <strong>{SYNC_STATUS_LABEL[snapshot.status]}</strong>
            <p className="muted">
              最近一次同步：
              {snapshot.lastSyncAt ? formatDateTime(snapshot.lastSyncAt) : '还没有同步过'}
              {snapshot.pending > 0 ? ` · 待同步 ${snapshot.pending} 条` : ' · 没有待同步的改动'}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={syncing}
            onClick={async () => {
              setSyncing(true)
              const ok = await engine.syncNow()
              setSyncing(false)
              toast.show(ok ? '已同步' : '同步没有成功，请稍后再试')
            }}
          >
            {syncing ? '同步中…' : '立即同步'}
          </button>
        </div>

        {snapshot.lastError && <Notice variant="warn">{snapshot.lastError}</Notice>}
        {snapshot.pending > 0 && (
          <Notice>
            有 {snapshot.pending} 条改动已经存在这台设备上，还没写回云端。
            它们会一直排队重试，不会丢。
          </Notice>
        )}

        <TextField
          label="数据接口地址"
          value={endpointDraft}
          onChange={setEndpointDraft}
          hint={`页面和数据服务在同一处时保持 ${DEFAULT_ENDPOINT} 即可；分开部署就填完整地址，例如 http://192.168.1.10:8788/api`}
        />
        <TextField type="password" label="家庭连接码（云端部署时填写）" value={familyKeyDraft} onChange={setFamilyKeyDraft} hint="手机和电脑使用同一个码；留空保留已有连接码。本地服务无需填写。" />
        <div className="row">
          <button
            type="button"
            className="btn"
            onClick={async () => {
              if (familyKeyDraft.trim()) await repo.setSetting(SYNC_KEYS.familyKey, familyKeyDraft.trim())
              await engine.setEndpoint(endpointDraft)
              toast.show('接口地址已保存，正在重新同步')
            }}
          >
            保存地址并重试
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setEndpointDraft(DEFAULT_ENDPOINT)}
          >
            恢复默认
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={async () => {
              await engine.pullEverything()
              refreshProfile()
              toast.show('已按云端重新对齐')
            }}
          >
            从云端整体重拉
          </button>
        </div>
        <p className="muted">
          同步水位线：这台设备 {snapshot.localSeq} · 服务端 {snapshot.serverSeq}。
          两者接近说明数据已经对齐。
        </p>
      </Card>

      <Card title="儿童档案">
        <TextField label="名字或称呼" value={name} onChange={setName} />
        <TextField label="小名（可选）" value={nickname} onChange={setNickname} />
        <InputField
          label="出生日期（可选）"
          type="date"
          value={birthDate ?? ''}
          onChange={setBirthDate}
        />
        <TextField label="年级（可选）" value={gradeLabel ?? ''} onChange={setGradeLabel} />
        <TextAreaField
          label="备注（可选）"
          value={profileNote ?? ''}
          onChange={setProfileNote}
          rows={2}
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={async () => {
            if (!profile) return
            const check = validateChildProfile({ name, birthDate: birthDate || null })
            if (!check.ok) {
              setErrors(check.errors)
              return
            }
            await repo.updateProfile(profile.id, {
              name,
              nickname: nickname || null,
              birthDate: birthDate || null,
              gradeLabel: gradeLabel || null,
              note: profileNote || null,
            })
            setErrors([])
            refreshProfile()
            toast.show('档案已更新')
          }}
        >
          保存档案
        </button>
      </Card>

      <Card title="家长模式与隐私">
        <div className="row-between">
          <div>
            <strong>儿童视图</strong>
            <p className="muted">
              默认打开儿童端，提供打卡、星空和心愿。所有定制设置在家长端。
            </p>
          </div>
          <button
            type="button"
            className={childView ? 'btn btn-primary' : 'btn'}
            onClick={async () => {
              await setChildView(!childView)
              toast.show(childView ? '已回到家长模式' : '已切换到儿童视图')
            }}
          >
            返回儿童端并锁定设置
          </button>
        </div>

        <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '16px 0' }} />

        <p className="muted">
          家长密码：{pin.enabled ? '已开启（4 位数字）' : '未开启'}
          。它只用于挡住儿童视图下的敏感页面，密码本身只保存在这台设备上，没有联网校验，
          也不具备加密作用；请把它理解成一道防误触的门，而不是安全边界。
        </p>
        <TextField
          label="设置或修改家长密码（4 位数字）"
          type="password"
          value={pinDraft}
          onChange={setPinDraft}
        />
        <TextField
          label="再输入一次确认"
          type="password"
          value={pinConfirm}
          onChange={setPinConfirm}
        />
        <div className="row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={async () => {
              const check = validatePin(pinDraft)
              if (!check.ok) {
                setErrors(check.errors)
                return
              }
              if (pinDraft !== pinConfirm) {
                setErrors(['两次输入的密码不一致'])
                return
              }
              const salt = makeSalt()
              const next: PinSetting = { enabled: true, salt, hash: hashPin(pinDraft, salt) }
              await setPin(next)
              setPinDraft('')
              setPinConfirm('')
              setErrors([])
              toast.show('家长密码已保存')
            }}
          >
            保存密码
          </button>
          {pin.enabled && (
            <button
              type="button"
              className="btn"
              onClick={async () => {
                await setPin({ enabled: false, salt: '', hash: '' })
                toast.show('家长密码已关闭')
              }}
            >
              关闭密码
            </button>
          )}
        </div>
      </Card>

      <Card title="导出数据">
        <p className="muted">
          上次导出 JSON 备份：{lastBackup ? formatDateTime(lastBackup) : '还没有导出过'}
        </p>
        <div className="row">
          <button type="button" className="btn btn-primary" onClick={exportJson}>
            导出全部数据（JSON）
          </button>
        </div>
        <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '16px 0' }} />
        <SelectField
          label="导出哪张表（CSV）"
          value={csvEntity}
          onChange={(value) => value && setCsvEntity(value)}
          options={ENTITY_NAMES.map((value) => ({
            value,
            label: `${ENTITY_LABELS[value]}（${counts?.[value] ?? 0} 条）`,
          }))}
          hint="CSV 用 UTF-8 编码并带 BOM，Excel、Numbers 都能直接打开中文"
        />
        <button type="button" className="btn" onClick={exportCsv}>
          导出这张表（CSV）
        </button>
      </Card>

      <Card title="从备份恢复">
        <p className="muted">
          上次恢复：{lastImport ? formatDateTime(lastImport) : '还没有恢复过'}
        </p>
        <label className="field-label" htmlFor="import-file">
          选择备份文件（.json）
        </label>
        <input
          id="import-file"
          type="file"
          accept="application/json,.json"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            try {
              const text = await file.text()
              const bundle = parseBundle(text)
              setPendingImport({ text, summary: summarizeBundle(bundle) })
              setErrors([])
            } catch (err) {
              setErrors([(err as Error).message])
            } finally {
              e.target.value = ''
            }
          }}
        />
        {importReport && (
          <Notice>
            已导入：新增 {importReport.added} 条，跳过重复 {importReport.skippedDuplicate} 条，
            跳过无效 {importReport.skippedInvalid} 条。
            {importReport.invalidMessages.length > 0 && (
              <ul>
                {importReport.invalidMessages.slice(0, 5).map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}
          </Notice>
        )}
      </Card>

      <Card title="删除单条记录">
        <SelectField
          label="选择表格"
          value={deleteEntity}
          onChange={(value) => value && setDeleteEntity(value)}
          options={ENTITY_NAMES.map((value) => ({
            value,
            label: `${ENTITY_LABELS[value]}（${counts?.[value] ?? 0} 条）`,
          }))}
        />
        {(rows ?? []).length === 0 ? (
          <EmptyState text="这张表里还没有记录。" />
        ) : (
          <ul className="list">
            {(rows ?? []).slice(0, 50).map((row) => (
              <li className="list-item" key={`${row.id}`}>
                <div className="row-between">
                  <span>{recordSummary(deleteEntity, row)}</span>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => setDeleteTarget(row)}
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {(rows ?? []).length > 50 && (
          <p className="muted">只显示最近 50 条，需要更多请导出 CSV 后在本机处理。</p>
        )}
      </Card>

      <Card title="清空全部数据">
        <Notice variant="warn">
          清空会删除云端数据表里的所有记录，这台设备上的镜像跟着一起清掉，
          其他设备下次同步时也会同步为空。操作无法撤销，请先导出 JSON 备份。
          清空后孩子档案需要重新创建。
        </Notice>
        <button type="button" className="btn btn-danger" onClick={() => setClearOpen(true)}>
          清空全部数据
        </button>
      </Card>

      <Card title="数据存储位置与备份说明">
        <ul className="list">
          <li className="list-item">
            主要存储：你自己部署的在线数据表（服务端 SQLite，默认 data/sync.db）。
            换设备、换浏览器打开同一地址，看到的都是这份数据。
          </li>
          <li className="list-item">
            本地镜像：这台设备的浏览器数据库（IndexedDB，数据库名 xiaobu-growth）。
            它保证断网也能用；清掉它不会丢数据，下次同步会重新拉回来。
          </li>
          <li className="list-item">
            备份方式：数据已经在云端，仍建议定期点「导出全部数据（JSON）」存一份到自己的网盘。
            恢复时用「从备份恢复」选择同一个文件。
          </li>
          <li className="list-item">
            当前设备上的数据量：{storedDays.length > 0 ? storedDays.join('，') : '暂无记录'}
          </li>
          <li className="list-item">
            隐私：健康信息和冲突记录只进你自己的数据表，不会发给任何第三方；
            应用没有接入广告、统计 SDK，也没有第三方 AI 服务。
          </li>
          <li className="list-item">
            iPhone 上长期使用：请用 Safari 打开后「添加到主屏幕」，安装成网页 App 后数据和离线缓存都更稳妥。
          </li>
        </ul>
        <p className="muted">导出时间参考：今天 {todayKey()}</p>
      </Card>

      <ConfirmDialog
        open={pendingImport !== null}
        title="恢复这份备份？"
        description={
          <div>
            <p>备份内容：{pendingImport?.summary}。</p>
            <OptionChips
              legend="恢复方式"
              options={[
                { value: 'merge' as const, label: '合并（保留现有数据，跳过重复）' },
                { value: 'replace' as const, label: '覆盖（先清空再导入）' },
              ]}
              value={importMode}
              onChange={setImportMode}
            />
          </div>
        }
        confirmLabel={importMode === 'replace' ? '清空并导入' : '合并导入'}
        cancelLabel="取消"
        danger={importMode === 'replace'}
        onCancel={() => setPendingImport(null)}
        onConfirm={async () => {
          if (!pendingImport) return
          const bundle = parseBundle(pendingImport.text)
          const report = await importBundle(repo.db, bundle, importMode)
          setImportReport(report)
          setPendingImport(null)
          await repo.setSetting(SETTINGS_KEYS.lastImportAt, new Date().toISOString())
          refreshProfile()
          toast.show(`恢复完成：新增 ${report.added} 条`)
        }}
      />

      <ConfirmDialog
        open={clearOpen}
        title="清空全部数据？"
        description={
          <div>
            <p>这个操作无法撤销。请先确认已经导出 JSON 备份。</p>
            <TextField
              label="请输入「清空」两个字确认"
              value={clearWord}
              onChange={setClearWord}
            />
          </div>
        }
        confirmLabel="确认清空"
        danger
        onCancel={() => {
          setClearOpen(false)
          setClearWord('')
        }}
        onConfirm={async () => {
          if (clearWord.trim() !== '清空') {
            toast.show('请先输入「清空」两个字')
            return
          }
          try {
            // 先清云端再清本地：云端没清掉就整体放弃，免得本地空了又被拉回来
            await engine.clearEverything()
          } catch (error) {
            toast.show(
              `云端清空没有成功，本地数据没有动：${
                error instanceof Error ? error.message : '未知错误'
              }`,
            )
            return
          }
          setClearOpen(false)
          setClearWord('')
          refreshProfile()
          toast.show('云端和本地的数据都已清空')
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除这条记录？"
        description={
          <p>
            将删除：{deleteTarget ? recordSummary(deleteEntity, deleteTarget) : ''}。删除后无法恢复。
          </p>
        }
        confirmLabel="删除"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return
          await repo.deleteRecord(deleteEntity, `${deleteTarget.id}`)
          setDeleteTarget(null)
          toast.show('这条记录已删除')
        }}
      />
    </>
  )
}
