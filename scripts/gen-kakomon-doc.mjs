// 過去問の「地図」を作る。本文は書かない。どの論点がいつ出たか、だけ。
// 本文は kakomon/json/(gitignore)にある。ここに写すと配布になるので絶対に書かないこと。
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const R = new URL('..', import.meta.url).pathname
const j = (p) => JSON.parse(readFileSync(join(R, p), 'utf8'))

const topics = j('story/topics.json')
const events = [1, 2, 3, 4, 5].flatMap((g) => j(`story/events/gen${g}.json`).map((e) => ({ ...e, gen: g })))
const usedBy = new Map()
for (const e of events) {
  if (e.topicId) usedBy.set(e.topicId, [...(usedBy.get(e.topicId) ?? []), e])
}

const dir = join(R, 'kakomon/json')
const exams = existsSync(dir)
  ? readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
      .map((f) => ({ file: f.replace('.json', ''), ...JSON.parse(readFileSync(join(dir, f), 'utf8')) }))
  : []

const FIELD = { kenri: '権利関係', gyoho: '宅建業法', hourei: '法令上の制限', zeikin: '税・その他' }
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—')

let md = `# 過去問の地図

**問題文はここに書かない。**著作権があるので、本文は \`kakomon/\`(gitignore済み)の外に出さない。
ここにあるのは、どの論点がどれだけ出ているか、どのイベントに紐づいているか、という地図だけ。

出典は[一般財団法人 不動産適正取引推進機構](https://www.retio.or.jp/exam/past_ques_ans/other/)が
公開している「試験問題及び正解番号表」。\`node scripts/gen-kakomon-doc.mjs\` で作り直せる。

## 手元のデータ

`

if (!exams.length) {
  md += '`kakomon/json/` が無い。手元にPDFを置いて抽出し直すこと。\n'
} else {
  md += '| 年度 | 取得元 | 問数 | 4選択肢が揃った問 | 正解番号 |\n|---|---|---|---|---|\n'
  for (const e of exams) {
    const q = e.questions ?? []
    const c4 = q.filter((x) => (x.choices ?? []).length === 4).length
    const ans = q.filter((x) => x.answer != null).length
    md += `| ${e.file} | ${e.source ?? '—'} | ${q.length} | ${c4}（${pct(c4, q.length)}） | ${ans}（${pct(ans, q.length)}） |\n`
  }
}

md += `
## 論点別

15年分を機械的に振り分けた**概数**。「イベント」はこの論点を使っている物語の回。

`
for (const [key, name] of Object.entries(FIELD)) {
  const list = topics.filter((t) => t.field === key).sort((a, b) => b.kakomonCount - a.kakomonCount)
  if (!list.length) continue
  const sum = list.reduce((n, t) => n + t.kakomonCount, 0)
  md += `### ${name}（${list.length}論点 / ${sum}問）\n\n| 論点 | 出題 | イベント |\n|---|---|---|\n`
  for (const t of list) {
    const evs = usedBy.get(t.id) ?? []
    const cell = evs.length
      ? evs.map((e) => `第${e.gen}世代 ${e.title}`).join('<br>')
      : '**なし**'
    md += `| \`${t.id}\`<br>${t.name} | ${t.kakomonCount} | ${cell} |\n`
  }
  md += '\n'
}

const orphan = topics.filter((t) => !usedBy.has(t.id))
md += `## イベントの無い論点

${orphan.length ? orphan.map((t) => `- \`${t.id}\` ${t.name}（${t.kakomonCount}問）`).join('\n') : 'なし。全部の論点にイベントがある。'}
`

writeFileSync(join(R, 'docs/KAKOMON.md'), md)
console.log(`docs/KAKOMON.md を生成: ${topics.length}論点 / ${exams.length}年度`)
