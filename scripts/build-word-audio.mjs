// 单词录音本地生成，不将儿童数据传给语音服务。可见单词即完整音频文本。
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const words = ['apple','banana','orange','cat','dog','fish','bird','rabbit','bear','ball','book','tree','sun','moon','star','flower','car','bus','train','hat','shirt','bicycle','elephant','shoe']
const temporary = mkdtempSync(join(tmpdir(), 'xiaobu-word-audio-'))
mkdirSync('public/audio/words', { recursive: true })
for (const word of words) {
  const target = `public/audio/words/${word}.mp3`
  if (existsSync(target)) continue
  const source = join(temporary, `${word}.aiff`)
  execFileSync('say', ['-v', 'Samantha', '-r', '140', '-o', source, word])
  execFileSync('ffmpeg', ['-nostdin', '-loglevel', 'error', '-i', source, '-codec:a', 'libmp3lame', '-q:a', '4', target])
}
console.log(`已生成 ${words.length} 个英文单词音频`)
