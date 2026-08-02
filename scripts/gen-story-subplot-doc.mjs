// 家系ごとの物語を、要約だけ並べたドキュメントを生成する。
// 原稿は docs/household-plan.json の story にあり、このスクリプトは読んで並べるだけ。
// 表・世代ごとの節・イベント一覧は載せない(通しで読むのが目的なので邪魔になる)。
//   イベント単位の一覧 … docs/events-by-household.md
//   セリフの台本      … docs/script-dump.md
import { readFileSync, writeFileSync } from 'node:fs'

// 物語の重要度順。ここに無い世帯は household-plan.json の順で後ろに並ぶ。
// 並び順: 軸(主人公・伴走者・敵) → 因縁 → 村の家(第1世代の登場順) → 都会の家(第2世代の登場順)
const ORDER = [
  '主', '禿鷹', '海沢',
  '見沼', '鈴木',
  '桜井', '水瀬', '岸和田', '田中', '白石', '織部', '冬野',
  '都倉', '葉山', '安西', '黒瀬',
]

const plan = JSON.parse(readFileSync('docs/household-plan.json', 'utf8'))
// 禿鷹家(boss)も一つの世帯として並べる
const households = { 禿鷹: plan.boss, ...plan.households }

const names = Object.keys(households).sort((a, b) => {
  const ia = ORDER.indexOf(a)
  const ib = ORDER.indexOf(b)
  return (ia < 0 ? ORDER.length : ia) - (ib < 0 ? ORDER.length : ib)
})

const out = [
  '# 家系ごとの物語',
  '',
  '一つの家が五代で何をしたか、要約だけを並べたもの。',
  '',
  '- 本筋のあらすじ … [story-all.md](story-all.md)',
  '- 家ごとのイベント一覧 … [events-by-household.md](events-by-household.md)',
  '- セリフの台本 … [script-dump.md](script-dump.md)',
  '- 人物の一覧 … [characters.md](characters.md)',
  '',
  '> このファイルは `node scripts/gen-story-subplot-doc.mjs` で生成される。',
  '> **原稿は [household-plan.json](household-plan.json) の `story` にある。** そちらを編集すること。',
  '',
]

let written = 0
for (const name of names) {
  const story = households[name]?.story?.trim()
  if (!story) continue
  out.push('---', '', `## ${name}家`, '', story, '')
  written++
}

writeFileSync('docs/story-all-subplot-household.md', `${out.join('\n')}\n`)
console.log(`docs/story-all-subplot-household.md を生成: ${written}家系`)
