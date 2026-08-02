// 全キャラの一覧(生年・性別・職業・配偶者・登場世代)を docs/characters.md に出力する。
import { readFileSync, writeFileSync, globSync } from 'node:fs'

const GEN_START = { 1: 1015, 2: 1045, 3: 1075, 4: 1105, 5: 1135 }
const chars = {}
for (const f of globSync('content/gen*/characters/*.json')) {
  const c = JSON.parse(readFileSync(f, 'utf8'))
  chars[c.id] = c
}
const nameOf = (id) => chars[id]?.name ?? id
const famOf = (c) => c.family ?? (c.familyName ? c.familyName + '家' : '(所属なし)')

const byFam = {}
for (const c of Object.values(chars)) (byFam[famOf(c)] ??= []).push(c)

const ORDER = ['主家','禿鷹家','海沢家','見沼家','鈴木家','桜井家','水瀬家','岸和田家','田中家',
  '白石家','織部家','冬野家','都倉家','鳴海家','都築家','葉山家','細川家','古賀家','安西家','矢野家','黒瀬家']
const fams = Object.keys(byFam).sort(
  (a, b) => (ORDER.indexOf(a) < 0 ? 99 : ORDER.indexOf(a)) - (ORDER.indexOf(b) < 0 ? 99 : ORDER.indexOf(b)))

const out = [`# 登場人物一覧

暦: 第1世代の主人公は1000年生まれ。1世代=30年(第1世代1015年〜 / 第2世代1045年〜 / 第3世代1075年〜 / 第4世代1105年〜 / 第5世代1135年〜)。

**姓は結婚しても変わらない。**登場前から結婚している人物は、その時点で姓が揃っている。
`]

let male = 0, female = 0
for (const fam of fams) {
  const list = byFam[fam].sort((a, b) => (a.birthYear ?? 0) - (b.birthYear ?? 0))
  out.push(`\n## ${fam}\n`)
  out.push('| 人物 | 性別 | 生年 | 職業 | 配偶者 | 登場 |')
  out.push('|---|---|---|---|---|---|')
  for (const c of list) {
    c.gender === 'female' ? female++ : male++
    const sp = (c.relations ?? []).filter((r) => r.kind === 'spouse').map((r) => nameOf(r.characterId)).join('・') || '—'
    const gens = (c.appearsIn ?? [c.generation]).filter(Boolean)
    const when = gens.map((g) => `第${g}(${GEN_START[g] - c.birthYear}歳)`).join(' / ')
    out.push(`| **${c.name}** | ${c.gender === 'female' ? '女' : '男'} | ${c.birthYear}年 | ${c.job ?? '—'} | ${sp} | ${when} |`)
  }
}
out.push(`\n---\n\n**計 ${male + female}人**(男${male} / 女${female})`)
writeFileSync('docs/characters.md', out.join('\n') + '\n')
console.log(`docs/characters.md を生成: ${male + female}人`)
