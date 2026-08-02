import plan from '../../docs/household-plan.json'
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
  descendantOf?: string
}

const eventModules = import.meta.glob<{ default: DebugEvent }>(
  [
    '../../content/gen*/events/*.json',
    '../../content/gen*/events/*/*.json',
    // 恋愛は events の外(独自の進行を持つ)。デバッグでは同じ一覧で読めたほうがいい
    '../../content/gen*/romance/*.json',
  ],
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
  // 世代 → 発生時期の順。上から順に再生すれば物語として読める。
  // 時期未設定(year なし)は世代の末尾へ送る
  .sort(
    (a, b) =>
      a.generation - b.generation ||
      (a.year ?? 99) - (b.year ?? 99) ||
      (a.month ?? 99) - (b.month ?? 99) ||
      a.id.localeCompare(b.id),
  )

export const ALL_CHARACTERS: DebugCharacter[] = Object.values(characterModules)
  .map((m) => fullName(m.default))
  .sort((a, b) => a.generation - b.generation || a.id.localeCompare(b.id))

export const KIND_LABEL: Record<string, string> = {
  newcomer: '転入',
  farewell: '転出',
  life: '人生',
  trouble: '悩み',
  romance: '恋愛',
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

/* ================================================================
 * 家系
 * ============================================================= */

/**
 * 家系の並び。scripts/gen-story-subplot-doc.mjs の ORDER と同じ
 * (軸: 主家→禿鷹家→海沢家 / 因縁: 見沼家→鈴木家 / 村の家 / 都会の家)
 */
const FAMILY_ORDER = [
  '主',
  '禿鷹',
  '海沢',
  '見沼',
  '鈴木',
  '桜井',
  '水瀬',
  '岸和田',
  '田中',
  '白石',
  '織部',
  '冬野',
  '都倉',
  '葉山',
  '安西',
  '黒瀬',
]

export interface Movement {
  type: string
  who?: string
  note?: string
}

interface PlanHousehold {
  movement?: Movement[]
  note?: string
  story?: string
}

const PLAN = plan as unknown as {
  boss: PlanHousehold
  households: Record<string, PlanHousehold>
}

/** gen-story-subplot-doc.mjs の famOf と同じ規則 */
export function familyOf(c: DebugCharacter): string {
  return c.family ?? (c.familyName ? `${c.familyName}家` : '家系なし')
}

export interface FamilyGroup {
  /** 「禿鷹家」のような表示名 */
  name: string
  members: DebugCharacter[]
  /** docs/household-plan.json の移動の型 */
  movement: Movement[]
  note?: string
  /** docs/household-plan.json の家系の要約(段落ごとに分割済み) */
  story: string[]
}

/** 「禿鷹家」→ household-plan.json の項目(禿鷹だけ boss に入っている) */
function planOf(family: string): PlanHousehold | undefined {
  const key = family.replace(/家$/, '')
  return key === '禿鷹' ? PLAN.boss : PLAN.households[key]
}

function familyRank(family: string): number {
  const i = FAMILY_ORDER.indexOf(family.replace(/家$/, ''))
  return i < 0 ? FAMILY_ORDER.length : i
}

export const FAMILIES: FamilyGroup[] = (() => {
  const groups = new Map<string, DebugCharacter[]>()
  for (const c of ALL_CHARACTERS) {
    const f = familyOf(c)
    groups.set(f, [...(groups.get(f) ?? []), c])
  }
  return [...groups.entries()]
    .map(([name, members]) => ({
      name,
      // 生年順 = 親→子→孫。家系図として縦に読める
      members: [...members].sort((a, b) => (a.birthYear ?? 0) - (b.birthYear ?? 0)),
      movement: planOf(name)?.movement ?? [],
      note: planOf(name)?.note,
      // ponytail: **強調** は落として素の段落にする。専用の md パーサは要らない
      story: (planOf(name)?.story ?? '')
        .split('\n\n')
        .map((p) => p.replace(/\*\*/g, '').trim())
        .filter(Boolean),
    }))
    .sort((a, b) => familyRank(a.name) - familyRank(b.name) || a.name.localeCompare(b.name))
})()

export function familyGroupOf(c: DebugCharacter): FamilyGroup | undefined {
  const f = familyOf(c)
  return FAMILIES.find((g) => g.name === f)
}

const REL_LABEL: Record<string, string> = {
  parent: '親',
  child: '子',
  spouse: '配偶者',
  sibling: 'きょうだい',
  grandparent: '祖父母',
  grandchild: '孫',
  ancestor: '先祖',
  descendant: '子孫',
  'family-like': '家族同然',
}

/** A から見た関係を、B から見た関係に裏返す */
const REL_INVERSE: Record<string, string> = {
  parent: 'child',
  child: 'parent',
  grandparent: 'grandchild',
  grandchild: 'grandparent',
  ancestor: 'descendant',
  descendant: 'ancestor',
  spouse: 'spouse',
  sibling: 'sibling',
  'family-like': 'family-like',
}

/**
 * base から見た other の続柄。
 * 片側にしか relations が書かれていないデータがあるので、逆向きも見る。
 */
export function relationLabel(base: DebugCharacter, other: DebugCharacter): string {
  if (base.id === other.id) return 'この人'
  const direct = (base.relations ?? []).find((r) => r.characterId === other.id)
  if (direct && REL_LABEL[direct.kind]) return REL_LABEL[direct.kind]
  const reverse = (other.relations ?? []).find((r) => r.characterId === base.id)
  if (reverse) {
    const inv = REL_INVERSE[reverse.kind]
    if (inv && REL_LABEL[inv]) return REL_LABEL[inv]
  }
  if (other.descendantOf === base.id) return '子孫'
  if (base.descendantOf === other.id) return '先祖'
  return ''
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
