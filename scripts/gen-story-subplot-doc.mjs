// 各世代の「本筋」と、その世代で動く各世帯の「サブプロット」を並べたドキュメントを生成する。
//   本筋     … docs/story-all.md の世代セクション
//   サブプロット … docs/household-plan.json の story と、その世代のイベント
// 手書きの原稿は story-all.md と household-plan.json 側にあり、このスクリプトは読むだけ。
import { readFileSync, writeFileSync, globSync } from 'node:fs'

const STAGE = { 1: 'ありきた村', 2: '黒会市', 3: 'ありきた村', 4: '黒会市', 5: 'ありきた村' }
const GEN_START = { 1: 1015, 2: 1045, 3: 1075, 4: 1105, 5: 1135 }

// --- 本筋を story-all.md から取り出す ---
const all = readFileSync('docs/story-all.md', 'utf8')
const mainPlot = {}
const heads = [...all.matchAll(/\n## 第(\d)世代 ([^\n]*)\n/g)]
heads.forEach((m, i) => {
  const start = m.index + m[0].length
  const end = i + 1 < heads.length ? heads[i + 1].index : all.indexOf('\n## 伏線と回収')
  mainPlot[m[1]] = { head: m[2].trim(), body: all.slice(start, end).trim() }
})

// --- 世帯と人物 ---
const plan = JSON.parse(readFileSync('docs/household-plan.json', 'utf8'))
const households = plan.households ?? plan
const chars = {}
for (const f of globSync('content/gen*/characters/*.json')) {
  const c = JSON.parse(readFileSync(f, 'utf8'))
  chars[c.id] = c
}
const famOf = (id) => chars[id]?.family ?? (chars[id]?.familyName ? chars[id].familyName + '家' : null)
const nameOf = (id) => chars[id] ? (chars[id].familyName ?? '') + (chars[id].givenName ?? '') : id

// --- イベントを世代×世帯で束ねる ---
const evs = []
for (const f of globSync('content/gen*/events/**/*.json')) {
  const e = JSON.parse(readFileSync(f, 'utf8'))
  e._gen = Number(f.split('/gen')[1][0])
  evs.push(e)
}
const key = (g, fam) => `${g}/${fam}`
const byGenFam = {}
for (const e of evs) {
  for (const fam of new Set((e.cast ?? []).map(famOf).filter(Boolean))) {
    ;(byGenFam[key(e._gen, fam)] ??= []).push(e)
  }
}

// --- 出力 ---
const out = [`# 本筋とサブプロット

各世代の**本筋**の下に、その世代で動く**世帯ごとのサブプロット**を並べたもの。
「この年、村では何が起きていて、それぞれの家はどうしていたか」が縦に読める。

- 本筋のあらすじ … [story-all.md](story-all.md)
- 家ごとの通し物語 … [events-by-household.md](events-by-household.md)
- 暦: 第1世代の主人公は1000年生まれ。1世代=30年
`]

for (const g of [1, 2, 3, 4, 5]) {
  const mp = mainPlot[String(g)]
  out.push(`\n---\n\n# 第${g}世代 ｜ ${STAGE[g]} ｜ ${GEN_START[g]}年〜\n`)
  out.push(`## 本筋\n`)
  out.push(mp ? mp.body : '(未執筆)')

  // この世代に関わる世帯
  const fams = Object.keys(households).filter((f) => byGenFam[key(g, f + '家')]?.length)
  out.push(`\n## サブプロット(${fams.length}世帯)\n`)
  if (!fams.length) out.push('(この世代に絡む世帯なし)')

  for (const f of fams) {
    const fam = f + '家'
    const list = byGenFam[key(g, fam)] ?? []
    // この世代に登場する構成員と、その年齢
    const members = Object.values(chars)
      .filter((c) => (c.family ?? c.familyName + '家') === fam && (c.appearsIn ?? [c.generation]).includes(g))
      .map((c) => `${(c.familyName ?? '') + (c.givenName ?? '')}(${c.agesByGeneration?.[g] ?? c.age}歳)`)
    // この世代に該当する移動の枝
    const branches = (households[f].movement ?? []).filter((m) => (m.gens ?? []).includes(g))

    out.push(`### ${fam}${members.length ? ' — ' + members.join('・') : ''}`)
    for (const b of branches) out.push(`> **${b.type}**(${b.who}) ${b.note ?? ''}`)
    out.push('')
    for (const e of list.sort((a, b) => (a.stage ?? 0) - (b.stage ?? 0))) {
      const others = (e.cast ?? []).filter((c) => famOf(c) !== fam).map(nameOf).join('・')
      out.push(`- **${e.title}** — ${e.summary ?? ''}${others ? `〈${others}〉` : ''}`)
    }
    out.push('')
  }
}

writeFileSync('docs/story-all-subplot-household.md', out.join('\n') + '\n')
console.log('docs/story-all-subplot-household.md を生成')
