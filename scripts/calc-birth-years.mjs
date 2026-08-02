// 人物の出生年を暦から計算し、世代をまたぐ年齢の矛盾を検出する。
// 暦: 第1世代の主人公は1000年生まれ、15歳開始・30歳定年 → 1世代=30年(docs/CONTENT_SCHEMA.md)
import { readFileSync, writeFileSync } from 'node:fs'
import { globSync } from 'node:fs'

const GEN_START = { 1: 1015, 2: 1045, 3: 1075, 4: 1105, 5: 1135 }
const files = globSync('content/gen*/characters/*.json')
const issues = []

for (const f of files.sort()) {
  const d = JSON.parse(readFileSync(f, 'utf8'))
  const { generation: g, age } = d
  if (!g || age == null) {
    issues.push(`${d.id}: generation か age が無い`)
    continue
  }
  d.birthYear = GEN_START[g] - age
  const ages = {}
  for (const gg of d.appearsIn ?? [g]) {
    const a = GEN_START[gg] - d.birthYear
    ages[gg] = a
    if (a < 0) issues.push(`${d.id}: 第${gg}世代で未生誕(${a}歳)`)
    else if (a > 100) issues.push(`${d.id}: 第${gg}世代で${a}歳`)
  }
  d.agesByGeneration = ages
  writeFileSync(f, JSON.stringify(d, null, 2) + '\n')
}

console.log(`人物 ${files.length}人の出生年を計算`)
if (issues.length) {
  console.error(`\n年齢の矛盾 ${issues.length}件:`)
  for (const i of issues) console.error('  ' + i)
  process.exit(1)
}
console.log('年齢の矛盾なし')
