import type { Character, GameEvent } from '../types'
import { toTourMember } from './tour'
import type { HouseholdKind, TourHousehold } from './tour'

/**
 * content/ 配下の JSON をビルド時に取り込む。
 * ファイル名は決め打ちせず、必ず glob で拾う(ファイルが増減しても壊れない)。
 * 世代は最上位フォルダ content/gen<N>/ で分かれる。
 */
export const GENERATION = 1

/** content/gen1/households/*.json の生データ。メンバーはIDで参照する */
interface HouseholdJson {
  id: string
  kind: HouseholdKind
  label: string
  moveReason: string
  topicId: string
  budget: number
  memberIds: string[]
}

const characterModules = import.meta.glob<{ default: Character }>(
  '../../content/gen*/characters/*.json',
  { eager: true },
)
// events/ はフラット(分野は JSON の category)。旧構成のサブフォルダも拾えるようにしておく
const eventModules = import.meta.glob<{ default: GameEvent }>(
  ['../../content/gen*/events/*.json', '../../content/gen*/events/*/*.json'],
  { eager: true },
)
const householdModules = import.meta.glob<{ default: HouseholdJson }>(
  '../../content/gen*/households/*.json',
  { eager: true },
)

/** 現在プレイ中の世代のものだけを取り出す */
function ofGeneration<T>(modules: Record<string, { default: T }>): T[] {
  return Object.entries(modules)
    .filter(([path]) => path.includes(`/gen${GENERATION}/`))
    .map(([, m]) => m.default)
}

export const characters: Character[] = ofGeneration(characterModules)
export const events: GameEvent[] = ofGeneration(eventModules)

export function characterById(id: string): Character | undefined {
  return characters.find((c) => c.id === id)
}

/** 転入の単位。人物は characters から解決する(データを二重に持たない) */
export const households: TourHousehold[] = ofGeneration(householdModules)
  .map((h) => ({
    ...h,
    members: h.memberIds
      .map(characterById)
      .filter((c) => c !== undefined)
      .map(toTourMember),
  }))
  .filter((h) => h.members.length > 0)

export function eventsForCharacter(characterId: string): GameEvent[] {
  return events.filter((e) => e.characterId === characterId)
}
