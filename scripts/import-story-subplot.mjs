#!/usr/bin/env node
/**
 * docs/story-all-subplot-household.md への手入れを、原稿 docs/household-plan.json に取り込む。
 *
 * このドキュメントは生成物だが、読みながら直接書き直したくなる種類のものなので、
 * 逆向きも通れるようにしてある。直接編集したら:
 *   node scripts/import-story-subplot.mjs   # md → household-plan.json
 *   npm run docs                            # 書き戻して差分ゼロを確認
 */
import { readFileSync, writeFileSync } from 'node:fs'

const md = readFileSync('docs/story-all-subplot-household.md', 'utf8')
const plan = JSON.parse(readFileSync('docs/household-plan.json', 'utf8'))

// 「## ◯◯家」から次の「---」までが、その家の物語
const sections = [...md.matchAll(/\n## (.+?)家\n([\s\S]*?)(?=\n---\n|$)/g)]

let changed = 0
const unknown = []
for (const [, name, body] of sections) {
  const story = body.trim()
  const target = name === '禿鷹' ? plan.boss : plan.households[name]
  if (!target) {
    unknown.push(name)
    continue
  }
  if (target.story !== story) {
    target.story = story
    changed++
    console.log(`  ${name}家 を更新`)
  }
}

if (unknown.length) console.log(`household-plan.json に無い家系: ${unknown.join('・')}`)
if (changed) {
  writeFileSync('docs/household-plan.json', `${JSON.stringify(plan, null, 2)}\n`)
  console.log(`${changed}家系を household-plan.json へ取り込みました`)
} else {
  console.log('差分なし')
}
