import world from '../story/world.json'
import families from '../story/families.json'
import characters from '../story/characters.json'
import topics from '../story/topics.json'
import gen1 from '../story/events/gen1.json'
import gen2 from '../story/events/gen2.json'
import gen3 from '../story/events/gen3.json'
import gen4 from '../story/events/gen4.json'
import gen5 from '../story/events/gen5.json'

export type Hair = {
  strands: number; length: number; part: number; spread: number
  curl: number; tie: number | null; bangs: number; stiff: number
}
export type Family = {
  id: string
  cloth: { base: string; accent: string; why: string }
  hair: { male: Hair; female: Hair }
  story: string
  movement: { type: string; who: string; ids?: string[]; note?: string }[]
}
export type Character = {
  id: string; name: string; family?: string
  gender?: 'male' | 'female'; birthYear?: number; appearsIn: number[]
  job?: string; personality?: string; motive?: string; weakness?: string
  catchphrase?: string; smallTalk?: Record<string, string[]>
  byAge?: { from: number; personality?: string; catchphrase?: string; job?: string }[]
}
export type Line = { who: string; text: string; role?: 'teach' }
export type StoryEvent = {
  id: string; year: number; month: number; kind: string; title: string
  topicId: string | null; cast: string[]; lines: Line[]
  thanks: Line | null; later: Line | null
  quiz: {
    question?: string; choices?: string[]; answer?: number
    explanation?: string; diagram?: { type: string; labels: string[] }
  } | null
}
export type Generation = (typeof world.generations)[number]

export const generations = world.generations as Generation[]
export const foreshadow = world.foreshadow
export const familyList = families as Family[]
export const familyOf = new Map(familyList.map((f) => [f.id, f]))
export const topicList = topics as { id: string; name: string; field: string; kakomonCount: number; kakomon: string[] }[]
export const topicOf = new Map(topicList.map((t) => [t.id, t]))

// 主人公は JSON に居ない。世代番号がそのまま名前になる。
const PLAYERS: Character[] = generations.map((g) => ({
  id: `shu-${g.gen}`,
  name: `主${'一二三四五'[g.gen - 1]}`,
  family: '主',
  gender: 'male',
  birthYear: g.playerBirthYear,
  appearsIn: [g.gen, g.gen + 1, g.gen + 2].filter((n) => n <= 5),
  job: `${g.gen}代目`,
}))

export const cast: Character[] = [...(characters as Character[]), ...PLAYERS]
export const castOf = new Map(cast.map((c) => [c.id, c]))

export const eventsOf: Record<number, StoryEvent[]> = {
  1: gen1 as StoryEvent[], 2: gen2 as StoryEvent[], 3: gen3 as StoryEvent[],
  4: gen4 as StoryEvent[], 5: gen5 as StoryEvent[],
}

export const KIND_JA: Record<string, string> = {
  life: '人生', newcomer: '転入', farewell: '転出', trouble: '悩み', romance: '恋愛',
}

export const ageAt = (c: Character | undefined, year: number) =>
  c?.birthYear == null ? null : year - c.birthYear

/** 年齢で変わる人物像。一番大きい閾値が勝つ。 */
export const atAge = (c: Character, age: number | null): Character => {
  if (age == null || !c.byAge?.length) return c
  const hit = c.byAge.filter((v) => age >= v.from).sort((a, b) => b.from - a.from)[0]
  return hit ? { ...c, ...hit } : c
}
