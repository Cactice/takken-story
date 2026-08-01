import type { Gender } from '../types'

/** content/romance/<characterId>.json の形 */
export interface RomanceStage {
  minAffection: number
  lines: string[]
}

export interface IdealHome {
  description: string
  likedFeatures: string[]
  dislikedFeatures: string[]
}

export interface RomanceContent {
  characterId: string
  /** 住民の性別。主人公と異性のときだけ恋愛対象になる */
  gender: Gender
  stages: RomanceStage[]
  houseInviteLines: string[]
  idealHome: IdealHome
  reactions: { good: string[]; bad: string[]; neutral: string[] }
  proposalLines: string[]
}

/** セーブされる恋愛の状態(相手ごと) */
export interface RomanceState {
  affection: number
  /** 関係の進展段階 0..MAX_PROGRESS。MAX で結婚できる */
  progress: number
  /** デート回数 */
  dates: number
  /** 誘いを断った回数(また誘われる。親密度は下げない) */
  declined: number
}

/** デートで見て回る物件。src/lib/properties.ts ができたらそちらの型に差し替える */
export interface DateProperty {
  id: string
  name: string
  /** idealHome の liked/disliked と突き合わせる特徴タグ */
  features: string[]
}

export const AFFECTION_PER_TALK = 1
export const AFFECTION_MAX = 40
/** これを超えると「家を見に行きたい」と言い出す */
export const HOUSE_INVITE_AFFECTION = 24
export const MAX_PROGRESS = 3
/** デートで回る物件数 */
export const DATE_ROUNDS = 3
export const EXCITEMENT_START = 50
export const EXCITEMENT_MAX = 100
/** デート成功(関係が進展する)ラインのときめき度 */
export const EXCITEMENT_SUCCESS = 70
const EXCITEMENT_PER_LIKED = 15
const EXCITEMENT_PER_DISLIKED = 15

const contentModules = import.meta.glob<{ default: RomanceContent }>(
  '../../content/romance/*.json',
  { eager: true },
)

export const romanceContents: RomanceContent[] = Object.values(contentModules).map(
  (m) => m.default,
)

/** 主人公と異性の候補だけを返す */
export function romanceCandidates(playerGender: Gender): RomanceContent[] {
  return romanceContents.filter((c) => c.gender !== playerGender)
}

export function romanceContentFor(
  characterId: string,
  playerGender: Gender,
): RomanceContent | null {
  return romanceCandidates(playerGender).find((c) => c.characterId === characterId) ?? null
}

export const EMPTY_ROMANCE: RomanceState = { affection: 0, progress: 0, dates: 0, declined: 0 }

export function romanceStateOf(
  romance: Record<string, RomanceState> | undefined,
  characterId: string,
): RomanceState {
  return romance?.[characterId] ?? EMPTY_ROMANCE
}

/** 会話1回ぶんの親密度上昇(相談でも雑談でも同じ) */
export function talkOnce(prev: RomanceState): RomanceState {
  return { ...prev, affection: Math.min(AFFECTION_MAX, prev.affection + AFFECTION_PER_TALK) }
}

/** 親密度に応じた会話段階(0..stages.length-1) */
export function stageIndexFor(content: RomanceContent, affection: number): number {
  let idx = 0
  content.stages.forEach((s, i) => {
    if (affection >= s.minAffection) idx = i
  })
  return idx
}

/** その段階のセリフ。会話回数でローテーションして毎回同じにならないようにする */
export function lineFor(content: RomanceContent, st: RomanceState): string {
  const stage = content.stages[stageIndexFor(content, st.affection)]
  return stage.lines[st.affection % stage.lines.length]
}

/** 「家を見に行きたい」と言い出すか(断られてもまた誘う) */
export function wantsHouseVisit(content: RomanceContent, st: RomanceState): boolean {
  return (
    st.affection >= HOUSE_INVITE_AFFECTION &&
    st.progress < MAX_PROGRESS &&
    stageIndexFor(content, st.affection) === content.stages.length - 1
  )
}

export interface Reaction {
  delta: number
  line: string
  liked: string[]
  disliked: string[]
}

/** 物件1件への反応。必ずセリフを返す */
export function reactToProperty(
  content: RomanceContent,
  property: DateProperty,
  seed: number,
): Reaction {
  const { likedFeatures, dislikedFeatures } = content.idealHome
  const liked = property.features.filter((f) => likedFeatures.includes(f))
  const disliked = property.features.filter((f) => dislikedFeatures.includes(f))
  const delta = liked.length * EXCITEMENT_PER_LIKED - disliked.length * EXCITEMENT_PER_DISLIKED
  const pool =
    delta > 0 ? content.reactions.good : delta < 0 ? content.reactions.bad : content.reactions.neutral
  const feature = delta > 0 ? liked[0] : delta < 0 ? disliked[0] : ''
  const line = pool[seed % pool.length].replace('{feature}', feature)
  return { delta, line, liked, disliked }
}

export function clampExcitement(v: number): number {
  return Math.max(0, Math.min(EXCITEMENT_MAX, v))
}

/** デート終了時の状態更新。成功なら関係が1段進む */
export function finishDate(prev: RomanceState, excitement: number): RomanceState {
  const success = excitement >= EXCITEMENT_SUCCESS
  return {
    ...prev,
    dates: prev.dates + 1,
    progress: success ? Math.min(MAX_PROGRESS, prev.progress + 1) : prev.progress,
  }
}

export function declineDate(prev: RomanceState): RomanceState {
  // 断っても親密度は下げない
  return { ...prev, declined: prev.declined + 1 }
}

export function canMarry(st: RomanceState): boolean {
  return st.progress >= MAX_PROGRESS
}

/**
 * デート用の物件。src/lib/properties.ts ができたら差し替える。
 * ponytail: 物件データはデート判定に必要な特徴タグだけ。間取りや価格が要るなら properties.ts から渡す。
 */
export const FALLBACK_PROPERTIES: DateProperty[] = [
  { id: 'p1', name: '商店街の角の2階建て', features: ['商店街に近い', '1階が広い', '日当たり良好'] },
  { id: 'p2', name: '駅裏の新築アパート', features: ['新しい', '狭い', '庭がない', '騒がしい'] },
  { id: 'p3', name: '丘の上の庭付き一戸建て', features: ['庭付き', '静か', '日当たり良好', '広い'] },
  { id: 'p4', name: '川沿いの古民家', features: ['庭付き', '静か', '広い', '駅から遠い'] },
  { id: 'p5', name: '大通り沿いのタワー最上階', features: ['新しい', '広い', '家賃が高い', '騒がしい'] },
  { id: 'p6', name: '路地裏の平屋', features: ['静か', '狭い', '日当たりが悪い', '商店街に近い'] },
  { id: 'p7', name: '公園前のメゾネット', features: ['日当たり良好', '広い', '庭がない', '家賃が高い'] },
  { id: 'p8', name: '市場そばの店舗付き住宅', features: ['商店街に近い', '1階が広い', '騒がしい'] },
]

/** デートの各ラウンドで提示する3件を、ラウンド番号から決定的に選ぶ */
export function propertyChoices(
  properties: DateProperty[],
  round: number,
  perRound = 3,
): DateProperty[] {
  const out: DateProperty[] = []
  for (let i = 0; i < perRound; i++) {
    out.push(properties[(round * perRound + i) % properties.length])
  }
  return out
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`romance self-check: ${msg}`)
}

/** 自己チェック(dev のみ)。親密度とときめき度の判定が壊れたら即落ちる */
export function romanceSelfCheck(): void {
  const c = romanceContents.find((x) => x.characterId === 'hinata')
  assert(c !== undefined, 'hinata content missing')
  if (!c) return

  // 親密度: 話すたびに1上がり、上限で止まる
  let st = EMPTY_ROMANCE
  for (let i = 0; i < 5; i++) st = talkOnce(st)
  assert(st.affection === 5, 'affection should be 5')
  assert(talkOnce({ ...st, affection: AFFECTION_MAX }).affection === AFFECTION_MAX, 'affection cap')

  // 段階: 親密度で会話が進む
  assert(stageIndexFor(c, 0) === 0, 'stage 0')
  assert(stageIndexFor(c, HOUSE_INVITE_AFFECTION) === c.stages.length - 1, 'last stage')
  assert(!wantsHouseVisit(c, { ...EMPTY_ROMANCE, affection: 5 }), 'too early to invite')
  assert(
    wantsHouseVisit(c, { ...EMPTY_ROMANCE, affection: HOUSE_INVITE_AFFECTION }),
    'should invite',
  )
  // 断っても親密度は下がらない
  assert(declineDate(st).affection === st.affection, 'decline keeps affection')

  // ときめき度: 理想に合う家は上がり、合わない家は下がる
  const good: DateProperty = { id: 'g', name: 'g', features: ['商店街に近い', '1階が広い'] }
  const bad: DateProperty = { id: 'b', name: 'b', features: ['狭い', '日当たりが悪い'] }
  assert(reactToProperty(c, good, 0).delta > 0, 'liked home should raise')
  assert(reactToProperty(c, bad, 0).delta < 0, 'disliked home should lower')
  assert(reactToProperty(c, good, 0).line.includes('商店街に近い'), 'reaction names feature')
  assert(reactToProperty(c, { id: 'n', name: 'n', features: [] }, 0).line.length > 0, 'always a line')
  assert(clampExcitement(-10) === 0 && clampExcitement(999) === EXCITEMENT_MAX, 'clamp')
  assert(finishDate(EMPTY_ROMANCE, EXCITEMENT_SUCCESS).progress === 1, 'success advances')
  assert(finishDate(EMPTY_ROMANCE, EXCITEMENT_SUCCESS - 1).progress === 0, 'fail stays')
  assert(
    canMarry(finishDate({ ...EMPTY_ROMANCE, progress: MAX_PROGRESS - 1 }, EXCITEMENT_MAX)),
    'max progress can marry',
  )
}

if (import.meta.env.DEV) romanceSelfCheck()
