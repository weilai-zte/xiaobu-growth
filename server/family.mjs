/** 家庭共享存储的完整性校验。身份权限仍由设备家长门锁控制。 */
export const FAMILY_ENTITIES = ['familyMembers', 'growthPacts', 'pactSignatures', 'familyChecks', 'familyReactions']
const text = (v, max = 500) => typeof v === 'string' && !!v.trim() && v.length <= max
export function validateFamilyRecord(entity, row, old, get, list) {
  if (!FAMILY_ENTITIES.includes(entity)) return
  if (row.deleted) throw new Error('家庭签订和打卡记录需要保留，请收起公约')
  if (!text(row.childId, 200)) throw new Error('缺少家庭档案')
  const member = id => {
    const m = get('familyMembers', id)
    if (!m || m.deleted || m.childId !== row.childId) throw new Error('参与成员不属于这个家庭')
    return m
  }
  if (old && old.childId !== row.childId) throw new Error('不能更换记录所属家庭')
  if (entity === 'familyMembers') {
    if (!text(row.name, 30) || !['parent', 'child'].includes(row.role)) throw new Error('成员名称或角色无效')
    if (old && old.role !== row.role) throw new Error('不能更换成员角色，请新增成员')
    return
  }
  if (entity === 'growthPacts') {
    if (!text(row.title, 60) || !Array.isArray(row.clauses) || row.clauses.length < 1 || row.clauses.length > 12 || typeof row.sealed !== 'boolean' || typeof row.archived !== 'boolean') throw new Error('公约格式无效')
    if(row.replacesPactId){const previous=get('growthPacts',row.replacesPactId);if(!previous||previous.childId!==row.childId||!previous.sealed||previous.wishPlan||row.replacesPactId===row.id)throw new Error('公约版本来源无效')}
    if(row.ruleIds!==undefined&&(!Array.isArray(row.ruleIds)||row.ruleIds.length>50||row.ruleIds.some(id=>get('routineRules',id)?.childId!==row.childId)))throw new Error('关联打卡项目无效')
    if(old?.sealed&&(old.replacesPactId!==row.replacesPactId||JSON.stringify(old.ruleIds)!==JSON.stringify(row.ruleIds)))throw new Error('已签版本关联不能修改')
    member(row.authorId)
    for (const c of row.clauses) { member(c.memberId); if (!text(c.text, 120)) throw new Error('约定内容无效') }
    if (row.wishPlan !== undefined) {
      const plan = row.wishPlan
      if (!plan || !text(plan.wishId) || !text(plan.rewardName,80) || (plan.rewardCost !== null && (!Number.isInteger(plan.rewardCost) || plan.rewardCost < 1 || plan.rewardCost > 100000)) || !Array.isArray(plan.ruleIds) || !plan.ruleIds.length || plan.ruleIds.length > 10 || new Set(plan.ruleIds).size !== plan.ruleIds.length || plan.ruleIds.some(id => !text(id))) throw new Error('心愿攒星公约格式无效')
      const wish = get('wishes',plan.wishId)
      if (!wish || wish.childId !== row.childId || plan.ruleIds.some(id => get('routineRules',id)?.childId !== row.childId)) throw new Error('心愿和打卡必须属于同一个孩子')
      const roles = row.clauses.map(c => member(c.memberId).role)
      if (!roles.includes('parent') || !roles.includes('child')) throw new Error('心愿公约需要家长和孩子共同签订')
      if (row.sealed && (!plan.rewardCost || ((!old || !old.sealed) && (wish.cost !== plan.rewardCost || wish.name !== plan.rewardName)))) throw new Error('请先确认心愿兑换星数和名称')
    }
    if (old?.sealed && JSON.stringify(old.wishPlan) !== JSON.stringify(row.wishPlan)) throw new Error('签订的心愿和打卡不能改写')
    if (old?.sealed && (old.title !== row.title || JSON.stringify(old.clauses) !== JSON.stringify(row.clauses) || !row.sealed)) throw new Error('签订内容不能改写，请重新制定公约')
    if (old?.archived && !row.archived) throw new Error('已收起的公约不能重新启用')
    return
  }
  member(row.memberId)
  if (old) {
    const keys = entity === 'pactSignatures' ? ['pactId', 'memberId'] : entity === 'familyChecks' ? ['pactId', 'clause', 'memberId', 'date'] : ['checkId', 'memberId']
    if (keys.some(k => old[k] !== row[k])) throw new Error('已记录的签订和打卡不能改写')
    return // 重传历史记录时允许公约已归档。
  }
  if (entity === 'familyReactions') {
    const c = get('familyChecks', row.checkId)
    if (!c || c.deleted || c.childId !== row.childId || c.memberId === row.memberId || row.id !== `encourage:${row.checkId}:${row.memberId}`) throw new Error('只能给家人的有效打卡送鼓励')
    return
  }
  const p = get('growthPacts', row.pactId)
  if (!p || p.deleted || !p.sealed || p.childId !== row.childId) throw new Error('公约尚未确认')
  // 离线重传/备份恢复允许归档公约的历史记录，客户端负责停用归档入口。
  if (!p.clauses.some(c => c.memberId === row.memberId)) throw new Error('只能签订自己的约定')
  if (entity === 'pactSignatures') {
    if (row.id !== `signature:${row.pactId}:${row.memberId}`) throw new Error('签订编号无效')
  } else {
    if (p.wishPlan) throw new Error('心愿公约请使用原有打卡，不另建记录')
    const d = typeof row.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? new Date(`${row.date}T00:00:00Z`) : null
    if (!d || !Number.isFinite(d.getTime()) || d.toISOString().slice(0,10) !== row.date || !Number.isInteger(row.clause) || p.clauses[row.clause]?.memberId !== row.memberId || row.id !== `family-check:${row.pactId}:${row.clause}:${row.date}`) throw new Error('打卡内容或日期无效')
    const signatures = list('pactSignatures')
    if (!p.clauses.every(c => signatures.some(s => s.pactId === p.id && s.memberId === c.memberId))) throw new Error('公约需要全员签订后才能打卡')
  }
}
