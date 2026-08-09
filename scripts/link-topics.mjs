// 過去問800問を、61論点のどれかに割り当て直す。
// 以前の指しは語の当てずっぽうで、相続の欄に不動産取得税が入るなどずれていた。
// いまは論点の解説(story/lessons/*.json)という濃い手がかりがあるので、それと突き合わせる。
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const R = new URL('..', import.meta.url).pathname
const j = (p) => JSON.parse(readFileSync(join(R, p), 'utf8'))

const topics = j('story/topics.json')
const lessons = new Map()
const LDIR = join(R, 'story/lessons')
if (existsSync(LDIR)) {
  for (const f of readdirSync(LDIR).filter((x) => x.endsWith('.json'))) {
    for (const l of JSON.parse(readFileSync(join(LDIR, f), 'utf8'))) lessons.set(l.topicId, l)
  }
}

const KDIR = join(R, 'kakomon/json')
const exams = readdirSync(KDIR).filter((f) => f.endsWith('.json')).sort()
const ERA = (y) => (y.startsWith('H') ? '平成' : '令和')
const NUM = (y) => {
  const n = +y.slice(1, 3)
  return n === 1 && y.startsWith('R') ? '元' : String(n)
}
const refOf = (year, no) => {
  const [y, month] = year.split('-')
  return `${ERA(y)}${NUM(y)}年${month ? `${month}月` : ''}問${no}`
}

const bigrams = (s) => {
  const t = s.replace(/[\s。、，．・「」『』（）()【】〔〕:：;；?？!！\d]/g, '')
  const out = new Set()
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2))
  return out
}

// 論点の手がかり。解説があればそれを厚く使う
const profile = topics.map((t) => {
  const l = lessons.get(t.id)
  const parts = [[t.name, 3]]
  if (l) {
    parts.push([l.summary, 3], [(l.points ?? []).join(''), 2], [(l.traps ?? []).join(''), 2])
    parts.push([(l.panels ?? []).map((p) => p.caption + (p.note ?? '')).join(''), 1])
  }
  const m = new Map()
  for (const [text, w] of parts) for (const g of bigrams(text)) m.set(g, Math.max(m.get(g) ?? 0, w))
  return { t, m, hasLesson: !!l }
})

const rows = []
for (const f of exams) {
  const d = JSON.parse(readFileSync(join(KDIR, f), 'utf8'))
  for (const q of d.questions) {
    const b = bigrams([q.body, ...(q.choices ?? [])].join(''))
    let best = null
    for (const p of profile) {
      let hit = 0
      for (const g of b) hit += p.m.get(g) ?? 0
      // 解説の無い論点は手がかりが名前だけなので、不利になりすぎないよう底上げする
      const s = (hit / Math.sqrt(b.size || 1)) * (p.hasLesson ? 1 : 1.9)
      if (!best || s > best.s) best = { s, id: p.t.id }
    }
    rows.push({ ref: refOf(d.year, q.no), id: best.id, s: best.s })
  }
}

const byTopic = new Map()
for (const r of rows) byTopic.set(r.id, [...(byTopic.get(r.id) ?? []), r])

const out = topics.map((t) => {
  const list = (byTopic.get(t.id) ?? []).sort((a, b) => b.s - a.s)
  return { ...t, kakomonCount: list.length, kakomon: list.slice(0, 12).map((r) => r.ref) }
})
writeFileSync(join(R, 'story/topics.json'), JSON.stringify(out, null, 2) + '\n')

const empty = out.filter((t) => !t.kakomon.length)
console.log(`${rows.length}問を${topics.length}論点へ割り当てた`)
console.log(`指しが空の論点: ${empty.length ? empty.map((t) => t.id).join(' ') : 'なし'}`)
for (const t of [...out].sort((a, b) => b.kakomonCount - a.kakomonCount).slice(0, 8)) {
  console.log(`  ${String(t.kakomonCount).padStart(3)}問  ${t.id}  ${t.name}`)
}
