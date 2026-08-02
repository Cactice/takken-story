// 人物の出生年を暦から計算し、世代をまたぐ年齢の矛盾を検出する。
// 暦: 第1世代の主人公は1000年生まれ、15歳開始・30歳定年 → 1世代=30年(docs/CONTENT_SCHEMA.md)
import { readFileSync, writeFileSync } from 'node:fs'
import { globSync } from 'node:fs'

const GEN_START = { 1: 1015, 2: 1045, 3: 1075, 4: 1105, 5: 1135 }
const files = globSync('content/gen*/characters/*.json')
const issues = []
const warnings = []
const chars = []

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
  chars.push(d)
  writeFileSync(f, JSON.stringify(d, null, 2) + '\n')
}

// --- 親子・祖父母の年齢差の検算 ---------------------------------------------
// relations の parent / child / grandparent / grandchild と birthYear を突き合わせる。
// 親が子を持つ年齢は 18〜45歳、祖父母は 36〜90歳を目安にする(目安を外れたら警告)。
// 生物学的にあり得ない差(15未満・60超 / 祖父母30未満・120超)はエラーで止める。
const BAND = {
  parent: { ok: [18, 45], hard: [15, 60], label: '親子' },
  child: { ok: [18, 45], hard: [15, 60], label: '親子' },
  grandparent: { ok: [36, 90], hard: [30, 120], label: '祖父母と孫' },
  grandchild: { ok: [36, 90], hard: [30, 120], label: '祖父母と孫' },
}
const byId = new Map(chars.map((c) => [c.id, c]))
const seen = new Set()
for (const d of chars) {
  for (const r of d.relations ?? []) {
    const band = BAND[r.kind]
    const other = byId.get(r.characterId)
    if (!band || !other) continue
    // 年上→年下の向きに正規化する(parent/grandparent は相手が年上)
    const elder = r.kind === 'parent' || r.kind === 'grandparent' ? other : d
    const younger = elder === d ? other : d
    const pairKey = `${elder.id}>${younger.id}`
    if (seen.has(pairKey)) continue
    seen.add(pairKey)
    const gap = younger.birthYear - elder.birthYear
    const where = `${elder.id}(${elder.birthYear}年生) → ${younger.id}(${younger.birthYear}年生) は${gap}歳差`
    if (gap < band.hard[0] || gap > band.hard[1]) {
      issues.push(`${where}: ${band.label}としてあり得ない(${band.hard[0]}〜${band.hard[1]}歳差の範囲外)`)
    } else if (gap < band.ok[0] || gap > band.ok[1]) {
      warnings.push(`${where}: ${band.label}の目安(${band.ok[0]}〜${band.ok[1]}歳差)を外れている`)
    }
  }
}

console.log(`人物 ${files.length}人の出生年を計算`)
if (warnings.length) {
  console.warn(`\n年齢差の警告 ${warnings.length}件:`)
  for (const w of warnings) console.warn('  ' + w)
}
if (issues.length) {
  console.error(`\n年齢の矛盾 ${issues.length}件:`)
  for (const i of issues) console.error('  ' + i)
  process.exit(1)
}
console.log('年齢の矛盾なし')
