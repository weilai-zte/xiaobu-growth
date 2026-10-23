// 单词录音本地生成，不将儿童数据传给语音服务。可见单词即完整音频文本。
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, existsSync, readFileSync, rmSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
// 用已安装的TypeScript编译纯数据目录，读取真正的导出，避免维护第二份单词清单。
const catalogPath = join(root, 'src/lib/wordCatalog.ts')
const compiled = ts.transpileModule(readFileSync(catalogPath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText
const { WORDS } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
if (!Array.isArray(WORDS) || !WORDS.length || WORDS.some(item => !/^[a-z]{2,15}$/.test(item.word)) || new Set(WORDS.map(item => item.word)).size !== WORDS.length) {
  throw new Error('词库应包含唯一且合法的小写英文单词')
}
const output = join(root, 'public/audio/words')
const temporary = mkdtempSync(join(tmpdir(), 'xiaobu-word-audio-'))
mkdirSync(output, { recursive: true })
let generated = 0
let retained = 0
try {
  for (const {word} of WORDS) {
    const target = join(output, `${word}.mp3`)
    if (existsSync(target)) { retained++; continue }
    const source = join(temporary, `${word}.aiff`)
    const encoded = join(temporary, `${word}.mp3`)
    execFileSync('say', ['-v', 'Samantha', '-r', '140', '-o', source, word])
    execFileSync('ffmpeg', ['-nostdin', '-loglevel', 'error', '-i', source, '-codec:a', 'libmp3lame', '-q:a', '4', encoded])
    renameSync(encoded, target)
    generated++
    if (generated % 20 === 0) console.log(`已新增 ${generated} 个音频`)
  }
  console.log(`词库 ${WORDS.length} 词；新增 ${generated} 个音频，保留已有 ${retained} 个`)
} finally {
  rmSync(temporary, {recursive: true, force: true})
}
