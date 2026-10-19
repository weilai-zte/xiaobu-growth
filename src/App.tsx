import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider, useApp } from './app/AppProvider'
import { SyncProvider, useSync } from './app/SyncProvider'
import { AppNav, TopBar } from './components/Nav'
import { ParentGate } from './components/ParentGate'
import { SyncBanner } from './components/SyncBanner'
import { Setup } from './pages/Setup'
import { Today } from './pages/Today'
import { Sleep } from './pages/Sleep'
import { SleepPrint } from './pages/SleepPrint'
import { Study } from './pages/Study'
import { Rules } from './pages/Rules'
import { More } from './pages/More'
import { Conflicts } from './pages/Conflicts'
import { Strengths } from './pages/Strengths'
import { Weekly } from './pages/Weekly'
import { Experiments } from './pages/Experiments'
import { Settings } from './pages/Settings'
import { ChildToday } from './pages/ChildToday'
import { ChildRules } from './pages/ChildRules'
import { ChildProgress } from './pages/ChildProgress'
import { CloudConnect } from './pages/CloudConnect'
import { IS_GITHUB_PAGES } from './db/sync'

function Shell() {
  const { loading, profile } = useApp()
  const { bootstrapped } = useSync()

  if (loading) {
    return (
      <main className="app-main">
        <p className="muted">正在读取这台设备上的数据…</p>
      </main>
    )
  }

  // 本地还没数据、也还没问过云端时不急着让人建档，换设备第一次打开要能看到线上数据
  if (!profile && !bootstrapped) {
    return (
      <main className="app-main">
        <p className="muted">正在从云端读取数据…</p>
      </main>
    )
  }

  if (!profile && IS_GITHUB_PAGES) {
    return <main className="app-main"><CloudConnect /></main>
  }

  if (!profile) {
    return (
      <main className="app-main">
        <SyncBanner />
        <Setup />
      </main>
    )
  }

  return (
    <div className="app">
      <TopBar />
      {/* 导航要排在内容之前：平板档它是吸顶的横向导航，排在后面就会掉到页面底部 */}
      <AppNav />
      <main className="app-main">
        <SyncBanner />
        <Routes>
          <Route path="/rewards" element={<ParentGate><ChildProgress parent /></ParentGate>} />
          <Route path="/" element={<Today />} />
          <Route
            path="/sleep"
            element={
              <ParentGate>
                <Sleep />
              </ParentGate>
            }
          />
          <Route path="/study" element={<Study />} />
          <Route path="/rules" element={<Rules />} />
          <Route
            path="/more"
            element={
              <ParentGate>
                <More />
              </ParentGate>
            }
          />
          <Route
            path="/conflicts"
            element={
              <ParentGate>
                <Conflicts />
              </ParentGate>
            }
          />
          <Route path="/strengths" element={<Strengths />} />
          <Route
            path="/weekly"
            element={
              <ParentGate>
                <Weekly />
              </ParentGate>
            }
          />
          <Route
            path="/experiments"
            element={
              <ParentGate>
                <Experiments />
              </ParentGate>
            }
          />
          <Route
            path="/settings"
            element={
              <ParentGate>
                <Settings />
              </ParentGate>
            }
          />
          <Route
            path="/print/sleep"
            element={
              <ParentGate>
                <SleepPrint />
              </ParentGate>
            }
          />
          <Route path="/child" element={<ChildToday />} />
          <Route path="/child/rules" element={<ChildRules />} />
          <Route path="/child/progress" element={<ChildProgress />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <SyncProvider>
      <AppProvider>
        <HashRouter>
          <Shell />
        </HashRouter>
      </AppProvider>
    </SyncProvider>
  )
}
