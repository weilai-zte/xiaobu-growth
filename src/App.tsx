import { HonorNotice } from './components/HonorNotice'
import { HashRouter, Navigate, Route, Routes, Outlet, useLocation } from 'react-router-dom'
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
import { ChildGrowth } from './pages/ChildGrowth'
import { ChildBuddy } from './pages/ChildBuddy'
import { ChildProgress } from './pages/ChildProgress'
import { ChildStudy } from './pages/ChildStudy'
import { Family } from './pages/Family'
import { CloudConnect } from './pages/CloudConnect'
import { IS_GITHUB_PAGES } from './db/sync'
import { ParentHome, ParentRecords } from './pages/ParentHome'
import { Bank } from './components/Bank'
import { PactSigning } from './pages/PactSigning'
import { BirdSpeaker } from './components/BirdCompanion'

function Shell() {
  const { loading, profile, childView, parentUnlocked } = useApp()
  const { bootstrapped } = useSync()
  const signing = useLocation().pathname.startsWith('/sign/')

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
      <BirdSpeaker />
      {/* 导航要排在内容之前：平板档它是吸顶的横向导航，排在后面就会掉到页面底部 */}
      {!signing && (childView || parentUnlocked) && <AppNav />}
      <main className="app-main">
        <SyncBanner />
        <HonorNotice />
        <Routes>
          <Route path="/" element={<Navigate to="/child" replace />} />
          <Route path="/child" element={<ChildToday />} />
          <Route path="/child/buddy" element={<ChildBuddy />} />
          <Route path="/child/rules" element={<Navigate to="/child" replace />} />
          <Route path="/child/family" element={<Navigate to="/parent/family" replace />} />
          <Route path="/child/study" element={<ChildStudy />} />
          <Route path="/child/growth" element={<ChildGrowth />} />
          <Route path="/child/progress" element={<ChildProgress />} />
          <Route path="/sign/:pactId" element={<ParentGate><PactSigning /></ParentGate>} />
          <Route path="/parent" element={<ParentGate><Outlet /></ParentGate>}>
            <Route index element={<ParentHome />} />
            <Route path="today" element={<Today />} />
            <Route path="checkins" element={<Rules />} />
            <Route path="family" element={<Family parent />} />
            <Route path="rewards" element={<ChildProgress parent />} />
            <Route path="bank" element={<Bank parent />} />
            <Route path="records" element={<ParentRecords />} />
            <Route path="settings" element={<Settings />} />
            <Route path="more" element={<More />} />
            <Route path="sleep" element={<Sleep />} />
            <Route path="study" element={<Study />} />
            <Route path="conflicts" element={<Conflicts />} />
            <Route path="strengths" element={<Strengths />} />
            <Route path="weekly" element={<Weekly />} />
            <Route path="experiments" element={<Experiments />} />
            <Route path="print/sleep" element={<SleepPrint />} />
          </Route>
          {Object.entries({family:'family',rewards:'rewards',rules:'checkins',settings:'settings',more:'more',sleep:'sleep',study:'study',conflicts:'conflicts',strengths:'strengths',weekly:'weekly',experiments:'experiments','print/sleep':'print/sleep'}).map(([old,next]) => <Route key={old} path={`/${old}`} element={<Navigate to={`/parent/${next}`} replace />} />)}
          <Route path="*" element={<Navigate to="/child" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <SyncProvider>
      <HashRouter>
        <AppProvider><Shell /></AppProvider>
      </HashRouter>
    </SyncProvider>
  )
}
