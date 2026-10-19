import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { repo } from '../db/repo'
import { createSyncEngine, type SyncEngine, type SyncSnapshot } from '../db/sync'

interface SyncContextValue {
  snapshot: SyncSnapshot
  engine: SyncEngine
  /** 首次同步尝试已经结束（成功或失败都算），用来区分「还在读云端」和「确实没数据」 */
  bootstrapped: boolean
}

const SyncContext = createContext<SyncContextValue | null>(null)

export function SyncProvider({
  children,
  engine: injected,
}: {
  children: ReactNode
  engine?: SyncEngine
}) {
  const engine = useMemo(() => injected ?? createSyncEngine({ repo }), [injected])
  const [bootstrapped, setBootstrapped] = useState(false)

  useEffect(() => {
    let cancelled = false
    void engine.start().finally(() => {
      if (!cancelled) setBootstrapped(true)
    })
    return () => {
      cancelled = true
      engine.stop()
    }
  }, [engine])

  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot)
  const value = useMemo<SyncContextValue>(
    () => ({ snapshot, engine, bootstrapped }),
    [snapshot, engine, bootstrapped],
  )

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext)
  if (!ctx) throw new Error('useSync 必须在 SyncProvider 内使用')
  return ctx
}
