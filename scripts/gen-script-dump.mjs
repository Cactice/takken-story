#!/usr/bin/env node
/**
 * 全イベントのセリフだけを時系列で書き出す(問題・選択肢・解説は除く)。
 * 物語として通しで読むためのもの。docs/script-dump.md に出力する。
 *   node scripts/gen-script-dump.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const GEN_START = { 1: 1015, 2: 1045, 3: 1075, 4: 1105, 5: 1135 }
const STAGE = {
  1: 'ありきた村(基礎)',
  2: '黒会市(誘惑)',
  3: 'ありきた村(サスペンス)',
  4: '黒会市(再建)',
  5: 'ありきた村(総力戦)',
}
const KIND = { newcomer: '転入', farewell: '転出', life: '人生', trouble: '悩み', romance: '恋愛' }

const walk = (d, o = []) => {
  if (!fs.existsSync(d)) return o
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p, o)
    else if (e.name.endsWith('.json')) o.push(p)
  }
  return o
}

const names = new Map()
for (let g = 1; g <= 5; g++) {
  for (const p of walk(path.join(ROOT, `content/gen${g}/characters`))) {
    const c = JSON.parse(fs.readFileSync(p, 'utf8'))
    names.set(c.id, { name: c.name, job: c.job, age: c.age })
  }
}

const out = [
  '# 全イベントの台本(セリフのみ)',
  '',
  '問題文・選択肢・解説は載せていない。**物語として通しで読むため**のファイル。',
  '`node scripts/gen-script-dump.mjs` で生成する。編集しても次の生成で消える。',
  '',
  '暦は主一の生年1000年が基準。各世代の主人公は世代開始年に15歳。',
  '',
]

for (let g = 1; g <= 5; g++) {
  const events = [
    ...walk(path.join(ROOT, `content/gen${g}/events`)),
    ...walk(path.join(ROOT, `content/gen${g}/romance`)),
  ]
    .map((p) => ({ p, j: JSON.parse(fs.readFileSync(p, 'utf8')) }))
    .sort((a, b) => (a.j.year ?? 9999) - (b.j.year ?? 9999) || (a.j.month ?? 99) - (b.j.month ?? 99))

  const tally = {}
  for (const { p, j } of events) {
    const k = p.includes('/romance/') ? 'romance' : j.kind
    tally[k] = (tally[k] ?? 0) + 1
  }
  const mix = Object.entries(tally)
    .map(([k, v]) => `${KIND[k] ?? k} ${v}`)
    .join(' / ')

  out.push(
    '---',
    '',
    `# 第${g}世代 ｜ ${STAGE[g]} ｜ ${GEN_START[g]}年〜`,
    '',
    `全${events.length}件 — ${mix}`,
    '',
  )

  for (const { p, j } of events) {
    const kind = p.includes('/romance/') ? 'romance' : j.kind
    const when = j.year ? `${j.year}年${j.month ?? 1}月` : '時期未設定'
    const cast = (j.cast ?? [j.characterId])
      .map((id) => {
        const c = names.get(id)
        return c ? `${c.name}(${c.age ?? '?'}・${c.job ?? ''})` : id
      })
      .join(' / ')

    out.push(
      `## ${when} ｜ [${KIND[kind] ?? kind}] ${j.title ?? j.id}`,
      '',
      `- **あらすじ**: ${j.summary ?? '(なし)'}`,
      `- **出る人**: ${cast}`,
      `- **論点**: ${j.topicId}`,
      `- **id**: \`${j.id}\``,
      '',
    )
    for (const line of j.dialogue ?? []) out.push(`  - ${line}`)
    if (j.playerLines?.length) {
      out.push('', '  《主人公の説明》')
      for (const l of j.playerLines) out.push(`  - ${l}`)
    }
    if (j.thanksLine) out.push('', `  《お礼》 ${j.thanksLine}`)
    if (j.resolvedLine) out.push(`  《のちに》 ${j.resolvedLine}`)
    // 恋愛は段階ごとのセリフがある
    for (const s of j.stages ?? []) {
      out.push('', `  《親密度${s.minAffection}〜》`)
      for (const l of s.lines) out.push(`  - ${l}`)
    }
    if (j.houseInviteLines?.length) {
      out.push('', '  《家を見に行きたい》')
      for (const l of j.houseInviteLines) out.push(`  - ${l}`)
    }
    if (j.proposalLines?.length) {
      out.push('', '  《告白》')
      for (const l of j.proposalLines) out.push(`  - ${l}`)
    }
    out.push('')
  }
}

fs.writeFileSync(path.join(ROOT, 'docs/script-dump.md'), `${out.join('\n')}\n`)
console.log(`docs/script-dump.md を生成: ${out.length}行`)
