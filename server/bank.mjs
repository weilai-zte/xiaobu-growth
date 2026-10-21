// 星星是应用奖励积分。按账户的完整七天周期结息，日历统一为北京时间。
const DAY = 86400000
export const bankToday = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date())
const plusWeek = date => new Date(Date.parse(`${date}T00:00:00Z`) + 7 * DAY).toISOString().slice(0,10)
export function newBankAccount(childId, today) {
  return { id: `bank:${childId}`, childId, balance: 0, eligibleBalance: 0, remainder: 0, enabled: false, weeklyRateBps: 100, configuredRateBps: 100, nextInterestDate: plusWeek(today) }
}
export function settleBank(account, today) {
  const next = { ...account }, entries = []
  if (!next.enabled || next.balance === 0) return { account: next, entries }
  while (next.nextInterestDate <= today) {
    const numerator = next.eligibleBalance * next.weeklyRateBps + next.remainder
    if (!Number.isSafeInteger(numerator)) throw new Error('存款数额过大，请联系家长处理')
    const amount = Math.floor(numerator / 10000)
    next.remainder = numerator % 10000
    next.balance += amount
    entries.push({ id: `interest:${next.childId}:${next.nextInterestDate}`, childId: next.childId, kind: 'interest', amount, date: next.nextInterestDate, rateBps: next.weeklyRateBps, eligibleBalance: next.eligibleBalance })
    next.eligibleBalance = next.balance
    next.weeklyRateBps = next.configuredRateBps
    next.nextInterestDate = plusWeek(next.nextInterestDate)
  }
  return { account: next, entries }
}
export function bankChange(account, action, input, available, today) {
  const settled = settleBank(account, today), next = settled.account
  if (action === 'configure') {
    if (typeof input.enabled !== 'boolean' || !Number.isInteger(input.rateBps) || input.rateBps < 0 || input.rateBps > 2000) throw new Error('每周利率请填写0至20%，最多两位小数')
    if (next.enabled !== input.enabled) { next.nextInterestDate = plusWeek(today); next.eligibleBalance = next.balance; next.weeklyRateBps = input.rateBps }
    next.enabled = input.enabled; next.configuredRateBps = input.rateBps
    if (!next.balance) next.weeklyRateBps = input.rateBps
  } else if (action === 'deposit' || action === 'withdraw') {
    const amount = input.amount
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1000000) throw new Error('存取星数请填写1至1000000的整数')
    if (action === 'deposit') {
      if (!next.enabled) throw new Error('请家长先开启星星银行')
      if (amount > available) throw new Error('可用星星不足，预留兑换或已经存入的星星不能重复存入')
      if (!next.balance) { next.nextInterestDate = plusWeek(today); next.eligibleBalance = amount; next.weeklyRateBps = next.configuredRateBps }
      next.balance += amount
    } else {
      if (amount > next.balance) throw new Error('存款不足，请减少取出星数')
      next.balance -= amount; next.eligibleBalance = Math.min(next.eligibleBalance, next.balance)
    }
  } else if (action !== 'settle') throw new Error('未知银行操作')
  return { account: next, entries: settled.entries }
}
export function bankWalletDelta(entries) {
  return entries.filter(e => !e.deleted).reduce((sum,e) => sum + (e.kind === 'deposit' ? -e.amount : e.kind === 'withdraw' ? e.amount : 0),0)
}
