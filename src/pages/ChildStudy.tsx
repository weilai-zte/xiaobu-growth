import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { useApp } from '../app/AppProvider'
import { useToday } from '../app/hooks'
import { useAdventureDay } from '../components/Adventure'
import { Celebration } from '../components/PlayCards'
import { WordPicture } from '../components/WordPicture'
import { newId, repo } from '../db/repo'
import type { Difficulty } from '../db/types'
import { WORDS, WORD_LEVELS, speakWord, stopWord, wordDeck, wordProgress } from '../lib/words'
import { preparePraise } from '../lib/praise'

export function ChildStudy() {
  const { profile, habitPlanReady, habitPlanError, retryHabitPlan } = useApp()
  const date = useAdventureDay()
  const { childId, rules, checks } = useToday(date)
  const rule = rules.find(r => r.habitKey === 'picture_words' && r.active)
  const done = checks.some(c => c.ruleId === rule?.id && c.status === 'done')
  const [level, setLevel] = useState<Difficulty>('easy')
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const [hintUsed, setHintUsed] = useState(false)
  const [plan, setPlan] = useState<{ key: string; words: string[] } | null>(null)
  const [planError, setPlanError] = useState('')
  const [planRetry, setPlanRetry] = useState(0)
  const history = useLiveQuery(() => childId ? repo.listChecks(childId) : Promise.resolve([]), [childId])
  const progress = useMemo(() => wordProgress(history ?? []), [history])
  const review = progress.filter(w => w.needsReview)
  const planKey = `${childId}:${rule?.id}:${date}`
  const planReady = plan?.key === planKey
  useEffect(() => {
    if (!childId || !rule || !habitPlanReady) return
    let cancelled = false
    setPlanError('')
    repo.ensureStudyPlan(childId, rule.id, date).then(words => { if (!cancelled) setPlan({ key: planKey, words }) }).catch(error => { if (!cancelled) setPlanError(error instanceof Error ? error.message : '今日词卡没准备好，请再试一次。') })
    return () => { cancelled = true }
  }, [childId, rule?.id, date, habitPlanReady, planKey, planRetry])
  const [notice, setNotice] = useState('')
  const [audioError, setAudioError] = useState('')
  const [busy, setBusy] = useState(false)
  const [finished, setFinished] = useState(false)
  const deck = useMemo(() => wordDeck(date, level, [], planReady ? plan!.words : []), [date, level, plan, planReady])
  const question = deck[index]
  useEffect(() => { setIndex(0); setAnswer(false); setFlipped(false); setHintUsed(false); setFinished(false); setNotice(''); stopWord(); return stopWord }, [childId, date, level])
  async function pronounce(word: string) { setAudioError(''); if (!await speakWord(word)) setAudioError('发音暂时没有播放出来，请再点一次。可以看着单词继续练习。') }
  async function flipCard() {
    if (busy || !childId || !rule || !question) return
    if (flipped) { setFlipped(false); return }
    setBusy(true)
    try {
      await repo.recordStudyHint(childId, rule.id, date, question.correct.word)
      setHintUsed(true); setFlipped(true)
    } catch (error) { setNotice(error instanceof Error ? error.message : '这次没记好，请再点一次翻卡。') }
    finally { setBusy(false) }
  }
  async function selectWord(selectedWord: string) {
    if (!childId || !rule || !question || busy || answer) return
    void pronounce(selectedWord)
    setBusy(true)
    try {
      await repo.recordStudyAttempt(childId, rule.id, date, { id: newId(), word: question.correct.word, selectedWord, revealed: hintUsed, answeredAt: new Date().toISOString() })
      if (selectedWord === question.correct.word) { setAnswer(true); setNotice(`找到了！${question.correct.word}，${question.correct.cn}。`) }
      else setNotice('再看看图片，也可以先听发音。这个词已放进复习小篮子，以后再练。')
    } catch (error) { setNotice(error instanceof Error ? error.message : '这次没记好，请再选一次。') }
    finally { setBusy(false) }
  }
  async function finish() {
    if (!childId || !rule) return
    const play = preparePraise({ name: profile?.name ?? '全全', title: rule.title })
    setBusy(true)
    try {
      await repo.setCheck(childId, rule.id, date, 'done', null, { studyLevel: level, studyWords: deck.map(q => q.correct.word) })
      setFinished(true); setNotice(done ? '这组也练完啦！今天的学习星星已经收好，不会重复增加。' : `这一组练完啦！收下${rule.rewardStars ?? 2}颗学习星星。` + (play.text ?? '')); void play()
    } catch (error) { setNotice(error instanceof Error ? error.message : '这次没有记好，请再点完成；不会重复加星。') }
    finally { setBusy(false) }
  }
  return <div className="play-world study-world"><header><span className="journey-kicker">学习打卡 · 英语图片词卡</span><h1>看一看，听一听，选一选</h1><p>完成一组得{rule?.rewardStars ?? 2}星，不按速度或答对次数加分。不会的可以再试。</p><p>共{WORDS.length}个图片词 · 每天先学新词，也复习还不熟的词。</p><Link className="btn" to="/child">回到我的打卡</Link></header>
    <div role="group" aria-label="学习难度" className="study-levels">{WORD_LEVELS.map(l => <button type="button" key={l.key} disabled={busy} aria-pressed={level === l.key} onClick={() => { setLevel(l.key); setIndex(0); setAnswer(false); setFlipped(false); setHintUsed(false); setFinished(false); setNotice(''); stopWord() }}><strong>{l.name}</strong><small>{l.count}张图 · {l.choices}个选项 · {rule?.rewardStars ?? 2}星</small></button>)}</div>
    <button type="button" className="btn" onClick={stopWord}>停止发音</button>
    <details className="study-review"><summary>复习小篮子 · {review.length}个词</summary><p>这里是还要多练一练的词。之后两个不同的日子，不翻答案、第一次就选对，它就会从小篮子里收好。</p>{review.length ? <ul>{review.map(p => { const item = WORDS.find(w => w.word === p.word)!; return <li key={p.word}><button type="button" className="btn" aria-label={`复习 ${p.word} 发音`} onClick={() => void pronounce(p.word)}><span lang="en">{p.word}</span> · {item.cn} · 听发音</button> <small>{p.cleanDays}/2次独立答对</small></li> })}</ul> : <p>暂时没有要复习的词，继续慢慢学。</p>}</details>
    {audioError && <p role="status">{audioError}</p>}
    <Celebration message={notice} />
    {!habitPlanReady ? <div>{habitPlanError ? <><p role="alert">{habitPlanError}</p><button className="btn" onClick={retryHabitPlan}>重新准备学习图卡</button></> : <p role="status">正在准备学习图卡…</p>}</div> : !rule ? <p>请家长先启用学习图卡。</p> : !planReady ? <div>{planError ? <><p role="alert">{planError}</p><button type="button" className="btn" onClick={() => setPlanRetry(v => v + 1)}>重新准备今日词卡</button></> : <p role="status">正在准备今日词卡…</p>}</div> : finished ? <section className="study-finished"><h2>这一组练完啦</h2><p>今天已收好{rule.rewardStars ?? 2}颗学习星星。</p><div className="word-reviewed">{deck.map(q => <button type="button" key={q.correct.word} onClick={() => void pronounce(q.correct.word)}><WordPicture item={q.correct} /><span lang="en">{q.correct.word}</span><small>{q.correct.cn} · 点词听发音</small></button>)}</div><Link className="btn btn-primary" to="/child/progress">看看星星和心愿</Link><Link className="btn" to="/child">回去选下一件事</Link></section> : <section className="picture-practice" aria-label="英语图片练习"><div className="study-progress">第 {index + 1} / {deck.length} 张 · {done ? `今天已得${rule.rewardStars ?? 2}星，可继续练习` : `完成整组得${rule.rewardStars ?? 2}星`}</div><button type="button" className={`word-flashcard ${flipped ? 'is-revealed' : ''}`} aria-label={flipped ? '收起答案，继续看图' : '翻卡看一眼答案'} aria-pressed={flipped} disabled={busy} onClick={() => void flipCard()}><WordPicture item={question.correct} />{flipped ? <><strong lang="en">{question.correct.word}</strong><span>{question.correct.cn}</span></> : <small>点图片，可以翻卡看一眼</small>}</button>
      <div className="word-options">{question.options.map(option => <div key={option.word} className={answer && option.word === question.correct.word ? 'word-option matched' : 'word-option'}><button type="button" className="word-select" disabled={answer || busy} aria-label={`选择 ${option.word}`} onClick={() => void selectWord(option.word)}><span lang="en">{option.word}</span>{answer && option.word === question.correct.word && <small>找到了</small>}</button><button type="button" className="word-sound" aria-label={`听 ${option.word} 发音`} onClick={() => void pronounce(option.word)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4Zm13-2q5 5 0 10m-1-7q2 2 0 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg><span>听发音</span></button></div>)}</div>
      <button type="button" className="btn btn-primary study-next" disabled={!answer || busy} onClick={() => { stopWord(); if (index === deck.length - 1) void finish(); else { setIndex(i => i + 1); setAnswer(false); setFlipped(false); setHintUsed(false); setNotice('') } }}>{busy ? '正在收好…' : index === deck.length - 1 ? `完成这一组，收下${rule.rewardStars ?? 2}星` : '下一张图片'}</button>
    </section>}
    <details><summary>给家长看的说明</summary><p>词卡交互参考原英语打卡项目，选取适合小学阶段的常用具象词，使用内联插画和随网页加载的英文音频。每天固定一份词卡；优先选没练过的词，错词次日起优先复习，并保留新词位置，词库学完后轮换最久没练的词。错误在选择后即保存，不必等整组完成；复习小篮子随原有打卡记录同步和备份。音频朗读内容就是按钮上的单词，点击才播放，可以停止。三个难度奖励相同，星数由家长设置，答错不扣星，每天只计一次。</p></details>
  </div>
}
