// 過去問の本文は kakomon/json/(gitignore)にある。開発サーバでだけ読む。
// 本番ビルドには入らない。リポジトリにも入らない。
type Exam = { year: string; questions: { no: number; body: string; choices: string[] }[] }

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
