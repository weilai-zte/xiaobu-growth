import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, existsSync } from 'node:fs'
import { WordPicture } from '../src/components/WordPicture'
import { WORDS as words, type Word } from '../src/lib/wordCatalog'

const original = [
  ['apple','苹果'],['banana','香蕉'],['orange','橙子'],['cat','猫'],['dog','狗'],['fish','鱼'],
  ['bird','鸟'],['rabbit','兔子'],['bear','熊'],['ball','球'],['book','书'],['tree','树'],
  ['sun','太阳'],['moon','月亮'],['star','星星'],['flower','花'],['car','小汽车'],['bus','公共汽车'],
  ['train','火车'],['hat','帽子'],['shirt','衬衫'],['bicycle','自行车'],['elephant','大象'],['shoe','鞋'],
]
const additions = `pear peach grape lemon watermelon strawberry cherry pineapple mango coconut carrot potato tomato onion corn pumpkin cucumber egg bread cake cookie candy cheese rice noodle milk juice water tea cup plate bowl spoon fork knife bottle chair table bed desk door window clock lamp sofa mirror key bag pen pencil ruler eraser scissors umbrella kite doll robot drum guitar piano boat ship plane truck taxi duck chicken cow pig sheep horse goat lion tiger monkey panda zebra giraffe snake turtle frog butterfly bee ant spider snail whale dolphin crab octopus cloud rain snow rainbow mountain river sea leaf grass shell`.split(' ')
const expected = [...original.map(([word, cn]) => ({word, cn})), ...additions.map(word => ({word, cn: words.find(item => item.word === word)?.cn ?? '待补图片'}))]

function picture(item: {word: string; cn: string}) {
  const holder = document.createElement('div')
  holder.innerHTML = renderToStaticMarkup(<WordPicture item={item as Word} />)
  return holder
}

describe('小学英语离线图片词库', () => {
  it('独立目录至少120词，拼写合法且唯一，保留原24词释义与顺序', () => {
    expect(words.map(item => item.word)).toEqual(expected.map(item => item.word))
    expect(words.length).toBeGreaterThanOrEqual(120)
    expect(new Set(words.map(item => item.word)).size).toBe(words.length)
    for (const item of words) {
      expect(item.word).toMatch(/^[a-z]{2,15}$/)
      expect(item.cn).toMatch(/[\u4e00-\u9fff]/)
    }
    expect(words.slice(0,24).map(({word,cn}) => [word,cn])).toEqual(original)
  })

  it('每词有具体且互不重复的离线矢量图、中文标签，无英文答案或外链', () => {
    const shapes = new Set<string>()
    for (const item of words) {
      const holder = picture(item)
      expect(holder.querySelector('[role="img"]')?.getAttribute('aria-label'), item.word).toBe(`图片线索：${item.cn}`)
      expect(holder.querySelector('svg'), item.word).not.toBeNull()
      expect(holder.querySelectorAll('path,circle,ellipse,rect,line,polygon,polyline').length, item.word).toBeGreaterThan(1)
      expect(holder.querySelector('text,image,foreignObject,use,[href],[style]'), item.word).toBeNull()
      expect(holder.textContent, item.word).not.toMatch(new RegExp(`\\b${item.word}\\b`, 'i'))
      // 忽略标题/描述/标签后比较实际几何，防止新词全部落到同一个通用占位图。
      holder.querySelectorAll('title,desc').forEach(node => node.remove())
      holder.querySelectorAll('*').forEach(node => {node.removeAttribute('aria-label'); node.removeAttribute('data-word')})
      const shape = holder.querySelector('svg')!.innerHTML
      expect(shapes.has(shape), `${item.word} 不应复用无关图片`).toBe(false)
      shapes.add(shape)
    }
  })

  it('词库与预期新增词均有非空MP3音频', () => {
    for (const {word} of [...words, ...expected]) {
      const path = `public/audio/words/${word}.mp3`
      expect(existsSync(path), `${word} 音频缺失`).toBe(true)
      const data = readFileSync(path)
      expect(data.byteLength, word).toBeGreaterThan(1000)
      expect(data.subarray(0,3).toString() === 'ID3' || (data[0] === 0xff && (data[1] & 0xe0) === 0xe0), `${word} MP3头`).toBe(true)
    }
  })
})
