// 過去問の本文は kakomon/json/(gitignore)にある。開発サーバでだけ読む。
// 本番ビルドには入らない。リポジトリにも入らない。
type Exam = {
  year: string
  questions: { no: number; body: string; choices: string[]; answer?: number | null }[]
}

const files = import.meta.env.DEV
  ? import.meta.glob<{ default: Exam }>('../kakomon/json/*.json')
  : {}

/** 「令和2年10月問18」→ { file: 'R02-10', no: 18 } */
export const parseRef = (s: string) => {
  const m = s.match(/(平成|令和)(元|\d+)年(?:(\d+)月)?問(\d+)/)
  if (!m) return null
  const n = m[2] === '元' ? 1 : +m[2]
  const y = `${m[1] === '平成' ? 'H' : 'R'}${String(n).padStart(2, '0')}`
  return { file: m[3] ? `${y}-${m[3]}` : y, no: +m[4] }
}

const cache = new Map<string, Promise<Exam | null>>()
const load = (name: string) => {
  if (!cache.has(name)) {
    const key = Object.keys(files).find((k) => k.endsWith(`/${name}.json`))
    cache.set(name, key ? files[key]().then((m) => m.default) : Promise.resolve(null))
  }
  return cache.get(name)!
}

export const fetchQuestion = async (ref: string) => {
  const p = parseRef(ref)
  if (!p) return null
  const exam = await load(p.file)
  const q = exam?.questions.find((x) => x.no === p.no)
  return q ? { ...q, ref } : null
}

export type Question = NonNullable<Awaited<ReturnType<typeof fetchQuestion>>>

/** 日本語なので2文字の連続(bigram)の集合にする。記号と空白は捨てる。 */
const bigrams = (s: string) => {
  const t = s.replace(/[\s。、，．・「」『』（）()【】〔〕:：;；?？!！\d]/g, '')
  return new Set(Array.from({ length: Math.max(0, t.length - 1) }, (_, i) => t.slice(i, i + 2)))
}

/** 検索文の一片と、その重み。問題文は厚め、セリフや論点名は薄めに効かせる。 */
export type QueryPart = [text: string, weight: number]

const weighted = (parts: QueryPart[]) => {
  const m = new Map<string, number>()
  for (const [text, w] of parts) {
    for (const g of bigrams(text)) m.set(g, Math.max(m.get(g) ?? 0, w))
  }
  return m
}

/** 指しの一覧から本文を引く。読めなかったものは落とす */
const loadAll = async (refs: string[]) =>
  (await Promise.all(refs.map(fetchQuestion))).filter((q): q is Question => q != null)

/**
 * イベントの文脈に近い過去問を、近い順に n 問返す。
 * ponytail: bigram の重なりを重み付きで足して長さで割るだけの素朴な採点。
 * 精度が要るようになったら TF-IDF なり埋め込みなりに差し替える。
 */
export const pickClosest = async (parts: QueryPart[], refs: string[], n = 3): Promise<Question[]> => {
  const all = await loadAll(refs)
  const q = weighted(parts)
  const score = (c: Question) => {
    const b = bigrams([c.body, ...c.choices].join(''))
    let hit = 0
    for (const g of b) hit += q.get(g) ?? 0
    return hit / Math.sqrt(b.size || 1) // 長い過去問が有利になりすぎないよう軽く割る
  }
  return all.map((c) => [score(c), c] as const).sort((a, b) => b[0] - a[0]).slice(0, n).map(([, c]) => c)
}

/** その論点から適当に n 問。転がすたびに違う組み合わせが出る */
export const pickRandom = async (refs: string[], n = 3): Promise<Question[]> => {
  const all = await loadAll(refs)
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[all[i], all[j]] = [all[j], all[i]]
  }
  return all.slice(0, n)
}
