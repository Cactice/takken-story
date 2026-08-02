import type { Character, GameEvent } from '../types'

/**
 * デバッグ画面用のデータ読み込み。
 * lib/content.ts は「いま遊んでいる世代」だけを出すので、ここでは全世代を素で読む。
 * ponytail: glob をここに持つことで lib/content.ts に一切触らず、本編に影響を与えない。
 */

/** content の実データにあるが GameEvent には無い項目(本編では使っていない) */
export interface DebugEvent extends GameEvent {
  generation: number
  kind: string
  category: string[]
  summary?: string
  cast?: string[]
  places?: string[]
  mentorId?: string
}

export interface Relation {
  characterId: string
  kind: string
  note?: string
}

export interface DebugCharacter extends Character {
  generation: number
  birthYear?: number
  job?: string
  family?: string
  appearsIn?: number[]
  relations?: Relation[]
}

const eventModules = import.meta.glob<{ default: DebugEvent }>(
  ['../../content/gen*/events/*.json', '../../content/gen*/events/*/*.json'],
  { eager: true },
)
const characterModules = import.meta.glob<{ default: DebugCharacter }>(
  '../../content/gen*/characters/*.json',
  { eager: true },
)

function fullName<T extends Character>(c: T): T {
  const full = [c.familyName, c.givenName].filter(Boolean).join('')
  return full ? { ...c, name: full } : c
}

export const ALL_EVENTS: DebugEvent[] = Object.values(eventModules)
  .map((m) => m.default)
  .sort(
    (a, b) =>
      a.generation - b.generation ||
      a.kind.localeCompare(b.kind) ||
      a.id.localeCompare(b.id),
  )

export const ALL_CHARACTERS: DebugCharacter[] = Object.values(characterModules)
  .map((m) => fullName(m.default))
  .sort((a, b) => a.generation - b.generation || a.id.localeCompare(b.id))

export const KIND_LABEL: Record<string, string> = {
  trouble: '悩み相談',
  newcomer: '転入',
  work: '会社の仕事',
  business: '会社の制度',
  village: '村の出来事',
  dispute: '揉め事',
  life: '人生',
  farewell: '別れ',
  romance: '恋愛',
  season: '時勢',
}

export const CATEGORY_LABEL: Record<string, string> = {
  kenri: '権利関係',
  gyoho: '宅建業法',
  hourei: '法令上の制限',
  zei: '税その他',
}

const byId = new Map(ALL_CHARACTERS.map((c) => [c.id, c]))

export function characterById(id: string): DebugCharacter | undefined {
  return byId.get(id)
}

export function characterName(id: string): string {
  return byId.get(id)?.name ?? id
}

/** 配偶者は relations の kind:"spouse" から引く(専用フィールドは無い) */
export function spouseOf(c: DebugCharacter): string {
  const ids = (c.relations ?? []).filter((r) => r.kind === 'spouse').map((r) => r.characterId)
  return ids.map(characterName).join('・')
}

/** 会話ウィンドウに渡す人物。content に無いIDでも落ちないようにする */
export function castOf(e: DebugEvent): string[] {
  return e.cast?.length ? e.cast : [e.characterId]
}

export function speakerCharacter(e: DebugEvent): Character {
  return (
    characterById(e.characterId) ?? {
      id: e.characterId,
      name: e.characterId,
      sprite: '',
      personality: '',
    }
  )
}

function uniqSorted(xs: string[]): string[] {
  return [...new Set(xs)].sort()
}

export const GENERATIONS = uniqSorted(ALL_EVENTS.map((e) => String(e.generation)))
export const KINDS = uniqSorted(ALL_EVENTS.map((e) => e.kind))
export const CATEGORIES = uniqSorted(ALL_EVENTS.flatMap((e) => e.category ?? []))
export const TOPICS = uniqSorted(ALL_EVENTS.map((e) => e.topicId))

/** フリーワード検索の対象。セリフ・解説まで含めて拾う */
export function haystack(e: DebugEvent): string {
  return [
    e.id,
    e.topicId,
    e.title,
    e.summary,
    e.kind,
    ...(e.category ?? []),
    ...castOf(e).map(characterName),
    ...e.dialogue,
    e.explanation,
    ...(e.playerLines ?? []),
    e.thanksLine,
  ]
    .filter(Boolean)
    .join('\n')
}
