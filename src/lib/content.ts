import type { Character, GameEvent } from '../types'
import { toTourMember } from './tour'
import type { HouseholdKind, TourHousehold } from './tour'

/**
 * content/ 配下の JSON をビルド時に取り込む。
 * ファイル名は決め打ちせず、必ず glob で拾う(ファイルが増減しても壊れない)。
 * 世代は最上位フォルダ content/gen<N>/ で分かれる。
 */
/**
 * いま読み込んでいる世代。世代選択で切り替わる。
 * ponytail: モジュール内の配列を差し替える形にしてある。世代をまたぐ同時プレイは
 * 無いので、これで十分(選び直したときは App が loadGeneration を呼ぶ)。
 */
export let GENERATION = 1

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

/** 引越し理由の論点を解説するイベントを探し、ハゲタのアドバイスに仕立てる */
function adviceForTopic(topicId: string): { title: string; text: string } | undefined {
  const e = events.find((x) => x.topicId === topicId)
  if (!e) return undefined
  return { title: e.title ?? topicId, text: e.explanation }
}

function householdsOfGeneration(): TourHousehold[] {
  return ofGeneration(householdModules)
    .map((h) => ({
      ...h,
      advice: adviceForTopic(h.topicId),
      members: h.memberIds
        .map(characterById)
        .filter((c) => c !== undefined)
        .map(toTourMember),
    }))
    .filter((h) => h.members.length > 0)
}

/** 転入の単位。人物は characters から解決する(データを二重に持たない) */
export const households: TourHousehold[] = householdsOfGeneration()

/** 世代を切り替える(選択画面から呼ぶ)。配列の中身を入れ替える */
export function loadGeneration(generation: number): void {
  GENERATION = generation
  characters.splice(0, characters.length, ...ofGeneration(characterModules))
  events.splice(0, events.length, ...ofGeneration(eventModules))
  households.splice(0, households.length, ...householdsOfGeneration())
}

export function eventsForCharacter(characterId: string): GameEvent[] {
  return events.filter((e) => e.characterId === characterId)
}
