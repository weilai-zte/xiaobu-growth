import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSync } from './SyncProvider'
import { repo } from '../db/repo'
import type { ChildProfile } from '../db/types'
import {
  DEFAULT_PIN_SETTING,
  SETTINGS_KEYS,
  hashPin,
  type PinSetting,
} from '../lib/settings'

interface AppContextValue {
  habitPlanReady: boolean
  habitPlanError: string
  retryHabitPlan: () => void
  loading: boolean
  profile: ChildProfile | undefined
  refreshProfile: () => void
  childView: boolean
  setChildView: (value: boolean) => Promise<void>
  pin: PinSetting
  setPin: (value: PinSetting) => Promise<void>
  parentUnlocked: boolean
  unlockParent: (pin: string) => boolean
  lockParent: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const { bootstrapped } = useSync()
  const [planChild, setPlanChild] = useState('')
  const [habitPlanError, setPlanError] = useState('')
  const [planRetry, setPlanRetry] = useState(0)
  const [version, setVersion] = useState(0)
  const refreshProfile = useCallback(() => setVersion((v) => v + 1), [])
  // 默认锁上：家长模式下不生效，儿童视图下需要先通过家长门锁
  const [parentUnlocked, setParentUnlocked] = useState(false)

  const profile = useLiveQuery(() => repo.getPrimaryProfile(), [version])
  useEffect(() => {
    if (!profile?.id || !bootstrapped) return
    let cancelled = false
    setPlanError('')
    void repo.ensureHabitPlan(profile.id).then(() => { if (!cancelled) setPlanChild(profile.id) }).catch(() => { if (!cancelled) setPlanError('打卡图卡没有准备好，请重试。原记录仍然保留。') })
    return () => { cancelled = true }
  }, [profile?.id, bootstrapped, planRetry])
  const settings = useLiveQuery(
    async () => ({
      childView: await repo.getSetting<boolean>(SETTINGS_KEYS.childView, false),
      pin: await repo.getSetting<PinSetting>(SETTINGS_KEYS.pin, DEFAULT_PIN_SETTING),
    }),
    [],
  )

  const setChildView = useCallback(async (value: boolean) => {
    await repo.setSetting(SETTINGS_KEYS.childView, value)
    setParentUnlocked(!value)
  }, [])

  const setPin = useCallback(async (value: PinSetting) => {
    await repo.setSetting(SETTINGS_KEYS.pin, value)
  }, [])

  const pin = settings?.pin ?? DEFAULT_PIN_SETTING

  const unlockParent = useCallback(
    (input: string) => {
      if (!pin.enabled) {
        setParentUnlocked(true)
        return true
      }
      const ok = hashPin(input, pin.salt) === pin.hash
      if (ok) setParentUnlocked(true)
      return ok
    },
    [pin],
  )

  const value = useMemo<AppContextValue>(
    () => ({
      habitPlanReady: planChild === profile?.id,
      habitPlanError,
      retryHabitPlan: () => setPlanRetry(v => v + 1),
      loading: profile === undefined && settings === undefined,
      profile: profile ?? undefined,
      refreshProfile,
      childView: settings?.childView ?? false,
      setChildView,
      pin,
      setPin,
      parentUnlocked,
      unlockParent,
      lockParent: () => setParentUnlocked(false),
    }),
    [
      planChild,
      habitPlanError,
      profile,
      settings,
      refreshProfile,
      setChildView,
      pin,
      setPin,
      parentUnlocked,
      unlockParent,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp 必须在 AppProvider 内使用')
  return ctx
}

/** 需要家长模式的页面用它包一层 */
export function useActiveChildId(): string | undefined {
  return useApp().profile?.id
}
