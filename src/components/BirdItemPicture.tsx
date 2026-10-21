const NAMES: Record<string, string> = {
  bell: '叮当小铃铛',
  ball: '彩色小皮球',
  swing: '树枝小秋千',
  scarf: '探险小围巾',
  backpack: '叶子小背包',
  pin: '星星小徽章',
  honey: '桂花蜂蜜罐',
  berry: '月光莓果篮',
  gem: '蓝晶宝石',
  shell: '彩虹贝壳',
  acorn: '金色橡果',
  mushroom: '发光蘑菇',
  chime: '星星风铃',
  flower: '会唱歌的花',
}
export function BirdItemPicture({ kind }: { kind: string }) {
  return <svg className="bird-item-picture" viewBox="0 0 100 100" role="img" aria-label={NAMES[kind] ?? '小鸟物品'}><title>{NAMES[kind] ?? '小鸟物品'}</title><desc>冒险中找到的小玩意，获得后可以给小步使用。</desc><BirdItemShape kind={kind} /></svg>
}
export function BirdItemShape({ kind }: { kind: string }) {
  return <g><circle cx="50" cy="50" r="45" fill="#f0f4e3" /><g stroke="#4d6543" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
    {kind === 'bell' ? <><path d="M27 65q8-8 8-25a15 15 0 0 1 30 0q0 17 8 25Z" fill="#f4cd62"/><path d="M42 73q8 10 16 0M50 20v-7" fill="none"/><path d="m19 34-7-7m69 7 7-7" stroke="#c99b34"/></> : kind === 'ball' ? <><circle cx="50" cy="51" r="29" fill="#d3b6e9"/><path d="M25 36q28 15 48 1M24 66q28-15 52-2M47 23q-18 32 8 55" fill="none" stroke="#fff9db"/></> : kind === 'swing' ? <><path d="M30 15v53m40-53v53M20 15h60" fill="none"/><rect x="22" y="67" width="56" height="13" rx="5" fill="#d3ae7d"/><path d="m30 24-8 8 8 6m40 9 8-8-8-6" fill="none" stroke="#99b474"/></> : kind === 'scarf' ? <><path d="M20 32q30 18 60 0v24q-30 16-60 0Z" fill="#e9a583"/><path d="m61 55 16 29-21-5-9-22Z" fill="#e9a583"/><path d="m55 67 12-4m-7 14 11-4" stroke="#fff0ce"/></> : kind === 'backpack' ? <><path d="M38 24q0-17 24 0" fill="none"/><rect x="24" y="23" width="52" height="62" rx="17" fill="#a7c878"/><path d="M25 35q25 23 50 0" fill="#d5e6a4"/><rect x="35" y="59" width="30" height="17" rx="5" fill="#e5d7a1"/><path d="M50 40v10"/></> : kind === 'pin' ? <><path d="m50 17 10 22 24 4-18 17 4 25-20-12-22 12 4-25-18-17 25-4Z" fill="#f0cf6a"/><path d="m35 48 9 9 19-17" fill="none"/></> : kind === 'honey' ? <><path d="M31 31h38l-4 47q-15 9-30 0Z" fill="#e8a846"/><path d="m37 25 4 8m9-11 4 9m10-8 4 8" fill="none"/><path d="M34 43q16 8 32 0v28q-16 8-32 0Z" fill="#f2c96d" stroke="none"/><path d="m50 52 4 8 9 1-7 6 2 9-8-4-8 4 2-9-7-6 9-1Z" fill="#fff2b5" stroke="#a8782e"/></> : kind === 'berry' ? <><path d="M23 43h54l-7 38q-20 10-40 0Z" fill="#c39b63"/><path d="M29 43q4-18 22-17 17 1 20 17" fill="none" stroke="#8e6a42"/><circle cx="39" cy="53" r="9" fill="#8a80d6"/><circle cx="57" cy="50" r="9" fill="#b58bd9"/><circle cx="51" cy="63" r="9" fill="#717fd1"/><path d="m58 34-13-12-8 1m21 11 7-9" fill="none" stroke="#668948"/></> : kind === 'gem' ? <><path d="m50 17 25 19-9 38-16 12-16-12-9-38Z" fill="#80cde2"/><path d="m50 17 5 28 20-9M50 17l-5 28-20-9m5 47 15-37 15 37M31 36h38" fill="none" stroke="#e7fbff" strokeWidth="3"/><path d="m35 61 9 4m22-5 7-3" stroke="#fff" opacity=".8"/></> : kind === 'shell' ? <><path d="M18 69q2-40 32-48 31 8 33 48-4 17-33 16-29 1-32-16Z" fill="#f1b7a4"/><path d="M50 22v58M34 26l8 54m24-54-8 54M23 34l19 47m35-47L58 81" fill="none" stroke="#d88379" strokeWidth="2.5"/><path d="m18 69 9-2 5 12m56-10-9-2-5 12" fill="none" stroke="#f8d5b7"/></> : kind === 'acorn' ? <><path d="M34 37q0-17 16-17t16 17Z" fill="#b48743"/><path d="M28 37q22-11 44 0t-5 44q-17 14-34 0T28 37Z" fill="#d89d4e"/><path d="M40 31q10 7 20 0m-20 22q10 8 20 0m-18 20q8 5 16 0" fill="none" stroke="#9b6c32" strokeWidth="2.5"/><path d="M50 20q11-14 22-5-9 2-13 11" fill="#7d9e55"/></> : kind === 'mushroom' ? <><path d="M36 49h28v31q-14 8-28 0Z" fill="#f2e6cb"/><path d="M18 49q7-32 32-32t32 32q-28 16-64 0Z" fill="#8a7ac6"/><circle cx="35" cy="35" r="5" fill="#f8e9b3" stroke="none"/><circle cx="57" cy="29" r="4" fill="#f8e9b3" stroke="none"/><circle cx="66" cy="45" r="5" fill="#f8e9b3" stroke="none"/><path d="m78 25 2 6 7 2-7 2-2 7-2-7-7-2 7-2Z" fill="#f4cc65" stroke="none"/></> : kind === 'chime' ? <><path d="M24 27h52M32 27v26m36-26v26" fill="none"/><path d="M38 37v23m24-23v23" fill="none"/><circle cx="32" cy="59" r="7" fill="#f3cf68"/><circle cx="56" cy="64" r="8" fill="#9bc8e3"/><circle cx="70" cy="58" r="7" fill="#dcacd5"/><path d="m80 68 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" fill="#f4d577"/></> : <><path d="M50 79V43" fill="none"/><path d="M50 50q-19-2-21-18 20-1 21 18Zm0 0q19-2 21-18-20-1-21 18Zm0 12q-16 0-17-14 16 0 17 14Zm0 0q16 0 17-14-16 0-17 14Z" fill="#df9bc9"/><circle cx="50" cy="37" r="10" fill="#f4cf67"/><path d="M50 24v-9m-8 9 3-8m13 8-3-8" fill="none" stroke="#cf9b3d"/></>}
  </g><path d="M70 25q8-8 16-3-5 2-7 8" fill="#fff" opacity=".65" stroke="none"/></g>
}
