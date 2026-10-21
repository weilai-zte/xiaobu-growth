import { useParams } from 'react-router-dom'
import { useState, type ReactNode } from 'react'
import { useApp } from '../app/AppProvider'
import { Card, Errors, TextField } from './ui'

/** 儿童视图下挡住健康、冲突、复盘、数据设置等敏感内容 */
export function ParentGate({ children }: { children: ReactNode }) {
  const { parentUnlocked, signingPactId, unlockParent, pin } = useApp()
  const {pactId}=useParams()
  const [input, setInput] = useState('')
  const [errors, setErrors] = useState<string[]>([])

  if (parentUnlocked || (pactId && signingPactId === pactId)) return <>{children}</>

  return (
    <Card title="这部分需要家长查看">
      <p className="muted">
        睡眠与身体记录、家庭冲突复盘、数据与隐私设置默认不展示给孩子和其他家庭成员。
      </p>
      {pin.enabled ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!unlockParent(input)) setErrors(['密码不正确'])
            else setErrors([])
          }}
        >
          <Errors errors={errors} />
          <TextField
            label="家长密码"
            type="password"
            value={input}
            onChange={setInput}
            hint="4 位数字，只保存在这台设备上"
          />
          <button type="submit" className="btn btn-primary">
            进入家长模式
          </button>
        </form>
      ) : (
        <>
          <p className="muted">当前没有设置家长密码，可以直接进入家长模式。</p>
          <button type="button" className="btn btn-primary" onClick={() => unlockParent('')}>
            进入家长模式
          </button>
        </>
      )}
    </Card>
  )
}
