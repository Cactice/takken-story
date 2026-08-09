#!/usr/bin/env node
/**
 * 実装済みイベントの question に、対応する過去問を紐づける。
 *
 * **問題文は書き出さない。**残すのは「令和6年 問30」のような**出典の指し**だけ。
 * 過去問の中身は kakomon/json/ にあり、そちらは .gitignore 済み。
 *
 *   node scripts/link-kakomon.mjs
 *   → docs/kakomon-link.md
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ORDERED } from './kakomon-clues.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const JSON_DIR = path.join(ROOT, 'kakomon/json')

const LABEL = {
  H24: '平成24年', H25: '平成25年', H26: '平成26年', H27: '平成27年',
  H28: '平成28年', H29: '平成29年', H30: '平成30年', R01: '令和元年',
  'R02-10': '令和2年10月', 'R02-12': '令和2年12月',
  'R03-10': '令和3年10月', 'R03-12': '令和3年12月',
  R04: '令和4年', R05: '令和5年', R06: '令和6年', R07: '令和7年',
}

/** 過去問を論点ごとに束ねる。1問1論点(先に当たったものを採る) */
function indexKakomon() {
  const byTopic = {}
  if (!fs.existsSync(JSON_DIR)) return byTopic
  for (const f of fs.readdirSync(JSON_DIR).filter((x) => x.endsWith('.json')).sort()) {
    const { year, questions } = JSON.parse(fs.readFileSync(path.join(JSON_DIR, f), 'utf8'))
    for (const q of questions) {
      const text = q.body + q.choices.join('')
      for (const [id, clues] of ORDERED) {
        if (clues.some((c) => text.includes(c))) {
          ;(byTopic[id] ??= []).push({ year, no: q.no })
          break
        }
      }
    }
  }
  return byTopic
}

const walk = (d, o = []) => {
  if (!fs.existsSync(d)) return o
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p, o)
    else if (e.name.endsWith('.json')) o.push(p)
  }
  return o
}

const byTopic = indexKakomon()
const events = []
for (let g = 1; g <= 5; g++) {
  for (const p of [
    ...walk(path.join(ROOT, `content/gen${g}/events`)),
    ...walk(path.join(ROOT, `content/gen${g}/romance`)),
  ]) {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'))
    events.push({ gen: g, id: j.id, title: j.title ?? j.id, topicId: j.topicId, hasQ: !!j.question })
  }
}
events.sort((a, b) => a.gen - b.gen || a.id.localeCompare(b.id))

const noQuestion = events.filter((e) => !e.hasQ)
const noKakomon = events.filter((e) => e.hasQ && !(byTopic[e.topicId] ?? []).length)

const out = [
  '# イベントと過去問の対応',
  '',
  '実装済みイベントの論点に、過去問15年分(平成24年〜令和7年・783問)のどれが当たるかを機械的に紐づけたもの。',
  '**問題文は載せていない。**出典の指しだけ。中身は `kakomon/json/`(gitignore済み)にある。',
  '',
  '`node scripts/link-kakomon.mjs` で生成する。',
  '',
  '| 世代 | イベント | 論点 | 過去問 |',
  '|---|---|---|---|',
]
for (const e of events) {
  const hits = byTopic[e.topicId] ?? []
  const refs = hits.length
    ? `${hits.length}問 — ${hits.slice(0, 6).map((h) => `${LABEL[h.year] ?? h.year}問${h.no}`).join(' / ')}${hits.length > 6 ? ' …' : ''}`
    : '**なし**'
  out.push(`| ${e.gen} | ${e.title} | \`${e.topicId}\` | ${refs} |`)
}

out.push('', '## 過去問が見つからなかったイベント', '')
if (noKakomon.length === 0) out.push('なし。すべてのイベントに対応する過去問がある。')
else {
  out.push('| 世代 | イベント | 論点 |', '|---|---|---|')
  for (const e of noKakomon) out.push(`| ${e.gen} | ${e.title} | \`${e.topicId}\` |`)
}

if (noQuestion.length) {
  out.push('', '## question が未設定のイベント', '')
  out.push(...noQuestion.map((e) => `- 第${e.gen}世代 \`${e.id}\``))
}

fs.writeFileSync(path.join(ROOT, 'docs/kakomon-link.md'), `${out.join('\n')}\n`)
console.log(`イベント ${events.length}件 / question未設定 ${noQuestion.length}件 / 過去問なし ${noKakomon.length}件`)
console.log('docs/kakomon-link.md を生成')
