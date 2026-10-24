/** Merge monotonic collections without adding XP twice for the same daily action. */
const ACTIONS = ['feed', 'play', 'groom', 'sleep']
function care(value) {
  if (!value || typeof value !== 'object' || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) return null
  const completed = ACTIONS.filter(action => Array.isArray(value.completed) && value.completed.includes(action))
  return {...value, completed, xp: Number.isSafeInteger(value.xp) ? Math.max(0, value.xp) : 0}
}
export function mergeBuddyCare(existing, incoming, incomingNewer = true) {
  const a = care(existing), b = care(incoming)
  if (!a) return b
  if (!b) return a
  if (a.date !== b.date) return {...(a.date > b.date ? a : b), xp: Math.max(a.xp, b.xp)}
  const completed = ACTIONS.filter(action => a.completed.includes(action) || b.completed.includes(action))
  const prior = Math.max(0, a.xp - a.completed.length, b.xp - b.completed.length)
  return {...(incomingNewer ? b : a), completed, xp: Math.max(a.xp, b.xp, prior + completed.length)}
}
export function mergeProfileCollections(existing, incoming, incomingNewer = true) {
  const base = incomingNewer ? incoming : existing
  const merged = {...base, starClaims: {...existing.starClaims, ...incoming.starClaims}, honorClaims: {...existing.honorClaims, ...incoming.honorClaims}}
  if (existing.buddyCare || incoming.buddyCare) merged.buddyCare = mergeBuddyCare(existing.buddyCare, incoming.buddyCare, incomingNewer)
  const seen = [existing.honorsSeenAt, incoming.honorsSeenAt].filter(value => typeof value === 'string' && Number.isFinite(Date.parse(value))).sort()
  if (seen.length) merged.honorsSeenAt = seen.at(-1)
  return merged
}
