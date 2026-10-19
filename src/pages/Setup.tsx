import { useState } from 'react'
import { repo } from '../db/repo'
import { useApp } from '../app/AppProvider'
import { Card, Errors, InputField, Notice, TextField } from '../components/ui'
import { validateChildProfile } from '../lib/validate'

export function Setup() {
  const { refreshProfile } = useApp()
  const [name, setName] = useState('')
  const [nickname, setNickname] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [gradeLabel, setGradeLabel] = useState('')
  const [errors, setErrors] = useState<string[]>([])

  return (
    <>
      <h1>先建立孩子档案</h1>
      <p className="page-intro">
        一个家庭只需要一个主要儿童档案。记录先保存在这台设备上，再同步到家长配置的在线数据服务。
      </p>
      <Card title="儿童档案">
        <Errors errors={errors} />
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const result = validateChildProfile({
              name,
              birthDate: birthDate || null,
            })
            if (!result.ok) {
              setErrors(result.errors)
              return
            }
            setErrors([])
            await repo.createProfile({
              name,
              nickname: nickname || null,
              birthDate: birthDate || null,
              gradeLabel: gradeLabel || null,
            })
            refreshProfile()
          }}
        >
          <TextField
            label="名字或称呼"
            value={name}
            onChange={setName}
            hint="例如：小满"
            maxLength={20}
          />
          <TextField label="小名（可选）" value={nickname} onChange={setNickname} />
          <InputField label="出生日期（可选）" type="date" value={birthDate} onChange={setBirthDate} />
          <TextField
            label="年级（可选）"
            value={gradeLabel}
            onChange={setGradeLabel}
            hint="例如：二年级"
          />
          <button type="submit" className="btn btn-primary btn-block">
            建好档案，开始使用
          </button>
        </form>
      </Card>
      <Notice>
        这个工具不做诊断，也不给孩子打分。它记录发生过的事，帮助家长看见孩子的困难在哪里、什么方式有效。
      </Notice>
    </>
  )
}
