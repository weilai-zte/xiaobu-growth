const NAMES: Record<string, string> = { bell: '叮当小铃铛', ball: '彩色小皮球', swing: '树枝小秋千', scarf: '探险小围巾', backpack: '叶子小背包', pin: '星星小徽章' }
export function BirdItemPicture({ kind }: { kind: string }) {
  return <svg className="bird-item-picture" viewBox="0 0 100 100" role="img" aria-label={NAMES[kind] ?? '小鸟物品'}><title>{NAMES[kind] ?? '小鸟物品'}</title><desc>冒险中找到的小玩意，获得后可以给小步使用。</desc><BirdItemShape kind={kind} /></svg>
}
export function BirdItemShape({ kind }: { kind: string }) {
  return <g><circle cx="50" cy="50" r="45" fill="#f0f4e3" /><g stroke="#4d6543" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
    {kind === 'bell' ? <><path d="M27 65q8-8 8-25a15 15 0 0 1 30 0q0 17 8 25Z" fill="#f4cd62"/><path d="M42 73q8 10 16 0M50 20v-7" fill="none"/><path d="m19 34-7-7m69 7 7-7" stroke="#c99b34"/></> : kind === 'ball' ? <><circle cx="50" cy="51" r="29" fill="#d3b6e9"/><path d="M25 36q28 15 48 1M24 66q28-15 52-2M47 23q-18 32 8 55" fill="none" stroke="#fff9db"/></> : kind === 'swing' ? <><path d="M30 15v53m40-53v53M20 15h60" fill="none"/><rect x="22" y="67" width="56" height="13" rx="5" fill="#d3ae7d"/><path d="m30 24-8 8 8 6m40 9 8-8-8-6" fill="none" stroke="#99b474"/></> : kind === 'scarf' ? <><path d="M20 32q30 18 60 0v24q-30 16-60 0Z" fill="#e9a583"/><path d="m61 55 16 29-21-5-9-22Z" fill="#e9a583"/><path d="m55 67 12-4m-7 14 11-4" stroke="#fff0ce"/></> : kind === 'backpack' ? <><path d="M38 24q0-17 24 0" fill="none"/><rect x="24" y="23" width="52" height="62" rx="17" fill="#a7c878"/><path d="M25 35q25 23 50 0" fill="#d5e6a4"/><rect x="35" y="59" width="30" height="17" rx="5" fill="#e5d7a1"/><path d="M50 40v10"/></> : <><path d="m50 17 10 22 24 4-18 17 4 25-20-12-22 12 4-25-18-17 25-4Z" fill="#f0cf6a"/><path d="m35 48 9 9 19-17" fill="none"/></>}
  </g></g>
}
