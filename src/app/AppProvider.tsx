import { useLocation, useNavigate } from 'react-router-dom'
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
  signingPactId: string | null
  startSigning: (pactId: string) => void
  parentUnlocked: boolean
  unlockParent: (pin: string) => boolean
  lockParent: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const { bootstrapped } = useSync()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const childView = !pathname.startsWith('/parent') && !pathname.startsWith('/sign/')
  useEffect(() => { if (childView) setParentUnlocked(false) }, [childView])
  const [planChild, setPlanChild] = useState('')
  const [habitPlanError, setPlanError] = useState('')
  const [planRetry, setPlanRetry] = useState(0)
  const [version, setVersion] = useState(0)
  const refreshProfile = useCallback(() => setVersion((v) => v + 1), [])
  // 家长解锁只存在当前页面会话；签订页面使用范围更小的单份公约授权。
  const [parentUnlocked, setParentUnlocked] = useState(false)
  const [signingPactId,setSigningPactId]=useState<string|null>(null)
  useEffect(()=>{if(!pathname.startsWith('/sign/'))setSigningPactId(null)},[pathname])
  const startSigning=useCallback((id:string)=>{if(!parentUnlocked)return;setSigningPactId(id);setParentUnlocked(false);navigate(`/sign/${id}`)},[parentUnlocked,navigate])

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
      pin: await repo.getSetting<PinSetting>(SETTINGS_KEYS.pin, DEFAULT_PIN_SETTING),
    }),
    [],
  )

  const setChildView = useCallback(async (value: boolean) => {
    if (value) setParentUnlocked(false)
    navigate(value ? '/child' : '/parent')
  }, [navigate])

  const setPin = useCallback(async (value: PinSetting) => {
    await repo.setSetting(SETTINGS_KEYS.pin, value)
  }, [])

  const pin = settings?.pin ?? DEFAULT_PIN_SETTING

  const unlockParent = useCallback(
    (input: string) => {
      if (!pin.enabled) {
        if(pathname.startsWith('/sign/'))setSigningPactId(decodeURIComponent(pathname.slice(6)));else setParentUnlocked(true)
        return true
      }
      const ok = hashPin(input, pin.salt) === pin.hash
      if (ok) {if(pathname.startsWith('/sign/'))setSigningPactId(decodeURIComponent(pathname.slice(6)));else setParentUnlocked(true)}
      return ok
    },
    [pin,pathname],
  )

  const value = useMemo<AppContextValue>(
    () => ({
      habitPlanReady: planChild === profile?.id,
      habitPlanError,
      retryHabitPlan: () => setPlanRetry(v => v + 1),
      loading: settings === undefined,
      profile: profile ?? undefined,
      refreshProfile,
      childView,
      setChildView,
      pin,
      setPin,
      signingPactId, startSigning,
      parentUnlocked,
      unlockParent,
      lockParent: () => setParentUnlocked(false),
    }),
    [
      childView,
      planChild,
      habitPlanError,
      profile,
      settings,
      refreshProfile,
      setChildView,
      pin,
      setPin,
      signingPactId,startSigning,
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
