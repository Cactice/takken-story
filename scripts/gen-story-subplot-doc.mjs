// 世帯ごとに、五代を上から下まで通しで読めるドキュメントを生成する。
//   冒頭    … docs/story-all.md の各世代の書き出し(全体像)
//   世帯    … docs/household-plan.json の story / storyByGen と、その世代のイベント
// 手書きの原稿は story-all.md と household-plan.json 側にあり、このスクリプトは読むだけ。
import { readFileSync, writeFileSync, globSync } from 'node:fs'

const STAGE = { 1: 'ありきた村', 2: '黒会市', 3: 'ありきた村', 4: '黒会市', 5: 'ありきた村' }
const GEN_START = { 1: 1015, 2: 1045, 3: 1075, 4: 1105, 5: 1135 }
// 物語の重要度順。ここに無い世帯は household-plan.json の順で後ろに並ぶ。
// 並び順: 軸(主人公・伴走者・敵) → 因縁 → 村の家(第1世代の登場順) → 都会の家(第2世代の登場順)
const ORDER = [
  '主', '禿鷹', '海沢',
  '見沼', '鈴木',
  '桜井', '水瀬', '岸和田', '田中', '白石', '織部', '冬野',
  '都倉', '鳴海', '都築', '葉山', '細川', '古賀', '安西', '矢野', '黒瀬',
]

// --- 本筋を story-all.md から取り出す(世代ごとに書き出しの一段落だけ) ---
const all = readFileSync('docs/story-all.md', 'utf8')
const mainPlot = {}
const heads = [...all.matchAll(/\n## 第(\d)世代 ([^\n]*)\n/g)]
heads.forEach((m, i) => {
  const start = m.index + m[0].length
  const end = i + 1 < heads.length ? heads[i + 1].index : all.indexOf('\n## 伏線と回収')
  const body = all.slice(start, end).trim()
  mainPlot[m[1]] = { head: m[2].trim(), lead: body.split('\n\n')[0].trim() }
})

// --- 世帯と人物 ---
const plan = JSON.parse(readFileSync('docs/household-plan.json', 'utf8'))
// 禿鷹家(boss)も一つの世帯として並べる
const households = { 禿鷹: plan.boss, ...plan.households }
const chars = {}
for (const f of globSync('content/gen*/characters/*.json')) {
  const c = JSON.parse(readFileSync(f, 'utf8'))
  chars[c.id] = c
}
const famOf = (id) => chars[id]?.family ?? (chars[id]?.familyName ? chars[id].familyName + '家' : null)
const nameOf = (id) => (chars[id] ? (chars[id].familyName ?? '') + (chars[id].givenName ?? '') : id)

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
const out = [
  `# 本筋とサブプロット

**世帯ごと**に、五代を上から下まで通しで読めるようにしたもの。
一つの家が、どの世代で何をして、そのとき本筋の横で何が起きていたかが縦に読める。

- 本筋のあらすじ … [story-all.md](story-all.md)
- 家ごとのイベント一覧 … [events-by-household.md](events-by-household.md)
- 暦: 第1世代の主人公は1000年生まれ。1世代=30年
- 主人公の家系は**主家**。ゲーム内で主人公は「あなた」で、名前は画面に出ない。
  各代は世代番号をそのまま名にして**主一・主二・主三・主四・主五**と呼ぶ(ドキュメント上の識別子)。
  「祖父」「父」は世代で指す人が変わるので、地の文では**人物をフルネームで呼ぶ**
`,
  `\n---\n\n# 本筋\n`,
]

for (const g of [1, 2, 3, 4, 5]) {
  const mp = mainPlot[String(g)]
  out.push(`## 第${g}世代 ｜ ${STAGE[g]} ｜ ${GEN_START[g]}年〜`)
  out.push('')
  out.push(mp ? mp.lead : '(未執筆)')
  out.push('')
}

out.push(`\n---\n\n# サブプロット(世帯ごと)\n`)

const names = Object.keys(households).sort((a, b) => {
  const ia = ORDER.indexOf(a)
  const ib = ORDER.indexOf(b)
  return (ia < 0 ? ORDER.length : ia) - (ib < 0 ? ORDER.length : ib)
})

for (const name of names) {
  const h = households[name]
  const fam = name + '家'
  // イベントを持たない世帯(主人公家系など)は storyByGen の世代で出す
  const gens = [1, 2, 3, 4, 5].filter(
    (g) => byGenFam[key(g, fam)]?.length || h.storyByGen?.[String(g)],
  )
  if (!gens.length) continue

  out.push(`## ${fam} ｜ 第${gens.join('・')}世代`)
  out.push('')

  // 世帯の顔ぶれ: 誰が・いつ生まれ・どの世代に出るか
  const roster = Object.values(chars)
    .filter((c) => (c.family ?? c.familyName + '家') === fam)
    .sort((a, b) => (a.birthYear ?? 0) - (b.birthYear ?? 0))
  const planned = (h.members ?? []).map((m) => ({
    familyName: '', givenName: m.name, birthYear: m.birthYear,
    appearsIn: [m.gen], generation: m.gen, _plan: true,
  }))
  const all = [...roster, ...planned].sort((a, b) => (a.birthYear ?? 0) - (b.birthYear ?? 0))
  if (all.length) {
    out.push('| 人物 | 生年 | 登場 |')
    out.push('|---|---|---|')
    for (const c of all) {
      const name = (c.familyName ?? '') + (c.givenName ?? '')
      const gs = (c.appearsIn ?? [c.generation]).filter(Boolean)
      const when = gs.map((g) => `第${g}世代(${(c.birthYear != null ? GEN_START[g] - c.birthYear : c.age)}歳)`).join(' / ')
      out.push(`| ${name} | ${c.birthYear ?? '—'}年 | ${when} |`)
    }
    out.push('')
  }
  ;(h.movement ?? []).forEach((b, i) => {
    if (i) out.push('>')
    out.push(`> **${b.type}**(${b.who}) ${b.note ?? ''}`)
  })
  if (h.movement?.length) out.push('')
  if (h.story) {
    out.push(h.story)
    out.push('')
  }

  for (const g of gens) {
    const members = Object.values(chars)
      .filter((c) => (c.family ?? c.familyName + '家') === fam && (c.appearsIn ?? [c.generation]).includes(g))
      .map((c) => `${(c.familyName ?? '') + (c.givenName ?? '')}(${c.agesByGeneration?.[g] ?? c.age}歳)`)

    out.push(`### 第${g}世代 ｜ ${STAGE[g]} ｜ ${GEN_START[g]}年〜${members.length ? ' — ' + members.join('・') : ''}`)
    out.push('')
    const byGen = h.storyByGen?.[String(g)]
    if (byGen) {
      out.push(byGen)
      out.push('')
    }
    for (const e of (byGenFam[key(g, fam)] ?? []).sort((a, b) => (a.stage ?? 0) - (b.stage ?? 0))) {
      const others = (e.cast ?? []).filter((c) => famOf(c) !== fam).map(nameOf).join('・')
      out.push(`- **${e.title}** — ${e.summary ?? ''}${others ? `〈${others}〉` : ''}`)
    }
    out.push('')
  }
}

writeFileSync('docs/story-all-subplot-household.md', out.join('\n') + '\n')
console.log('docs/story-all-subplot-household.md を生成')
