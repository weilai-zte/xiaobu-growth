import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export function Card({
  title,
  actions,
  children,
  id,
}: {
  title?: ReactNode
  actions?: ReactNode
  children: ReactNode
  id?: string
}) {
  return (
    <section className="card" id={id}>
      {(title || actions) && (
        <div className="card-head">
          {typeof title === 'string' ? <h2>{title}</h2> : title}
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}

export function PageHeader({ title, intro }: { title: string; intro?: ReactNode }) {
  return (
    <header>
      <h1 className="page-title">{title}</h1>
      {intro ? <p className="page-intro">{intro}</p> : null}
    </header>
  )
}

export function Errors({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null
  return (
    <div className="errors" role="alert">
      <strong>还差一点：</strong>
      <ul>
        {errors.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
    </div>
  )
}

export function Notice({
  children,
  variant = 'info',
}: {
  children: ReactNode
  variant?: 'info' | 'warn'
}) {
  return (
    <div className={variant === 'warn' ? 'notice notice-warn' : 'notice'}>{children}</div>
  )
}

export function EmptyState({ text }: { text: string }) {
  return <p className="muted">{text}</p>
}

export function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
    </div>
  )
}

export function InsufficientData({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null
  return (
    <div className="insufficient">
      <strong>数据不足，暂不做结论</strong>
      <ul>
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </div>
  )
}

export interface Option<T extends string> {
  value: T
  label: string
}

export function OptionChips<T extends string>({
  legend,
  options,
  value,
  onChange,
  hint,
}: {
  legend: string
  options: Option<T>[]
  value: T | null
  onChange: (value: T) => void
  hint?: string
}) {
  const name = useId()
  return (
    <fieldset>
      <legend>{legend}</legend>
      <div className="chips">
        {options.map((option) => (
          <label className="chip" key={option.value}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
      {hint ? <span className="hint">{hint}</span> : null}
    </fieldset>
  )
}

export function MultiChips<T extends string>({
  legend,
  options,
  values,
  onChange,
  hint,
}: {
  legend: string
  options: Option<T>[]
  values: T[]
  onChange: (values: T[]) => void
  hint?: string
}) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      <div className="chips">
        {options.map((option) => {
          const checked = values.includes(option.value)
          return (
            <label className="chip" key={option.value}>
              <input
                type="checkbox"
                value={option.value}
                checked={checked}
                onChange={() =>
                  onChange(
                    checked
                      ? values.filter((v) => v !== option.value)
                      : [...values, option.value],
                  )
                }
              />
              {option.label}
            </label>
          )
        })}
      </div>
      {hint ? <span className="hint">{hint}</span> : null}
    </fieldset>
  )
}

export function TextField({
  label,
  value,
  onChange,
  hint,
  placeholder,
  maxLength,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: string
  placeholder?: string
  maxLength?: number
  type?: 'text' | 'password'
}) {
  const id = useId()
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  )
}

export function NumberField({
  label,
  value,
  onChange,
  hint,
  min,
  max,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: string
  min?: number
  max?: number
}) {
  const id = useId()
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  )
}

export function TextAreaField({
  label,
  value,
  onChange,
  hint,
  rows = 3,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: string
  rows?: number
  placeholder?: string
}) {
  const id = useId()
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  )
}

const dateInputTypes = {
  date: 'date',
  time: 'time',
  datetime: 'datetime-local',
} as const

export function InputField({
  label,
  type,
  value,
  onChange,
  hint,
  max,
  min,
}: {
  label: string
  type: keyof typeof dateInputTypes
  value: string
  onChange: (value: string) => void
  hint?: string
  max?: string
  min?: string
}) {
  const id = useId()
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type={dateInputTypes[type]}
        value={value}
        max={max}
        min={min}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  )
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  placeholder,
  hint,
}: {
  label: string
  value: T | ''
  onChange: (value: T | '') => void
  options: Option<T>[]
  placeholder?: string
  hint?: string
}) {
  const id = useId()
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T | '')}
      >
        <option value="">{placeholder ?? '请选择'}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  )
}

export function StepsField({
  label,
  steps,
  onChange,
  hint,
}: {
  label: string
  steps: string[]
  onChange: (steps: string[]) => void
  hint?: string
}) {
  const id = useId()
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        rows={Math.max(3, steps.length)}
        value={steps.join('\n')}
        onChange={(e) => onChange(e.target.value.split('\n'))}
      />
      <span className="hint">{hint ?? '每行一个步骤，孩子可以照着一步步做'}</span>
    </div>
  )
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '确认',
  cancelLabel = '取消',
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) cancelRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="modal">
        <h2 id="confirm-title">{title}</h2>
        <div>{description}</div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel} ref={cancelRef}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function LiveMessage({
  message,
  clear,
}: {
  message: string
  clear: () => void
}) {
  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(clear, 4000)
    return () => window.clearTimeout(timer)
  }, [message, clear])

  return (
    <div aria-live="polite" role="status">
      {message ? <div className="toast">{message}</div> : null}
    </div>
  )
}

export function useToastState(): {
  message: string
  show: (message: string) => void
  clear: () => void
} {
  const [message, setMessage] = useState('')
  return {
    message,
    show: setMessage,
    clear: () => setMessage(''),
  }
}
