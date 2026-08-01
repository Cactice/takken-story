/**
 * 物件案内(コアゲームプレイ)の状態機械。
 * 純粋関数のみ。副作用(タイマー・描画・メモ発行)は呼び出し側 = TourScreen が持つ。
 */

/* ------------------------------------------------------------------ *
 * 物件データ
 * ponytail: src/lib/properties.ts を別エージェントが作成中。出来たら
 * `import { properties } from './properties'` に差し替え、この型が合わなければ
 * toTourProperty() のようなアダプタを1つ足すだけで済むようにしてある。
 * ------------------------------------------------------------------ */
export interface TourProperty {
  id: string
  name: string
  /** 木造 / 鉄骨造 / RC造 */
  structure: string
  floors: number
  /** 築年数 */
  ageYears: number
  /** 専有面積(平米) */
  area: number
  /** 用途地域 */
  zoning: string
  /** 建蔽率(%) */
  buildingCoverage: number
  /** 容積率(%) */
  floorAreaRatio: number
  /** 賃料(万円/月) */
  rent: number
  /** 敷金(ヶ月) */
  depositMonths: number
  /** 礼金(ヶ月) */
  keyMoneyMonths: number
  /** 設備・特徴 */
  features: string[]
  /** 法的な注意点 */
  legalNotes: string[]
}

/** properties.ts が出来るまでの仮データ */
export const DUMMY_PROPERTIES: TourProperty[] = [
  {
    id: 'p-hibari-so',
    name: 'ひばり荘 201号室',
    structure: '木造',
    floors: 2,
    ageYears: 28,
    area: 42,
    zoning: '第一種低層住居専用地域',
    buildingCoverage: 50,
    floorAreaRatio: 100,
    rent: 4,
    depositMonths: 1,
    keyMoneyMonths: 0,
    features: ['家賃が安い', '日当たり良好', '駐車場あり', '木造'],
    legalNotes: ['第一種低層住居専用地域のため店舗の営業はできない'],
  },
  {
    id: 'p-grand-maison',
    name: 'グランドメゾンありきた 305号室',
    structure: 'RC造',
    floors: 5,
    ageYears: 3,
    area: 55,
    zoning: '近隣商業地域',
    buildingCoverage: 80,
    floorAreaRatio: 300,
    rent: 9,
    depositMonths: 2,
    keyMoneyMonths: 1,
    features: ['RC造', '防音', '駅近', '築浅'],
    legalNotes: ['管理規約でリフォームに制限あり'],
  },
  {
    id: 'p-shotengai',
    name: '商店街の店舗付き住宅',
    structure: '鉄骨造',
    floors: 2,
    ageYears: 15,
    area: 78,
    zoning: '近隣商業地域',
    buildingCoverage: 80,
    floorAreaRatio: 200,
    rent: 8,
    depositMonths: 2,
    keyMoneyMonths: 1,
    features: ['事業用可', '駅近', '2階建て'],
    legalNotes: ['1階部分は店舗用途で契約する必要がある'],
  },
  {
    id: 'p-nouka',
    name: '村はずれの農家',
    structure: '木造',
    floors: 2,
    ageYears: 52,
    area: 120,
    zoning: '市街化調整区域',
    buildingCoverage: 60,
    floorAreaRatio: 200,
    rent: 4,
    depositMonths: 1,
    keyMoneyMonths: 0,
    features: ['畑付き', '広い庭', '静か', 'ペット可', '木造'],
    legalNotes: ['市街化調整区域のため建て替えに開発許可が必要', '畑を宅地にするには農地法の許可が必要'],
  },
  {
    id: 'p-kominka',
    name: '平屋の古民家',
    structure: '木造',
    floors: 1,
    ageYears: 61,
    area: 66,
    zoning: '第一種低層住居専用地域',
    buildingCoverage: 50,
    floorAreaRatio: 100,
    rent: 3,
    depositMonths: 0,
    keyMoneyMonths: 0,
    features: ['バリアフリー', '静か', '広い庭', 'ペット可', '木造'],
    legalNotes: ['接道義務を満たさず再建築不可'],
  },
]

/* ------------------------------------------------------------------ *
 * 転入は「世帯」単位(単身・カップル・家族・ルームシェア)
 * content/gen1/households/*.json + content/gen1/characters/*.json を
 * 組み立てたもの。JSON の読み込みは lib/content.ts が持つ。
 * ------------------------------------------------------------------ */
export type HouseholdKind = 'single' | 'couple' | 'family' | 'share'

/** 世帯のメンバー1人分の希望 */
export interface TourMember {
  id: string
  name: string
  age: number
  /** 要望 */
  demands: string
  likedFeatures: string[]
  dislikedFeatures: string[]
}

export interface TourHousehold {
  id: string
  kind: HouseholdKind
  /** 画面に出す世帯名 */
  label: string
  /** 引越し理由 */
  moveReason: string
  /** 引越し理由に関連する宅建論点 */
  topicId: string
  /** 世帯合計の家賃上限(万円/月) */
  budget: number
  members: TourMember[]
}

/** content/gen1/characters/*.json の1人を内見メンバーに変換する */
export function toTourMember(c: {
  id: string
  name: string
  age?: number
  moveIn?: { demands: string; likedFeatures: string[]; dislikedFeatures: string[] }
}): TourMember {
  return {
    id: c.id,
    name: c.name,
    age: c.age ?? 0,
    demands: c.moveIn?.demands ?? '特に希望はないです',
    likedFeatures: c.moveIn?.likedFeatures ?? [],
    dislikedFeatures: c.moveIn?.dislikedFeatures ?? [],
  }
}

/* ------------------------------------------------------------------ *
 * 定数(調整用のつまみはここに集約)
 * ------------------------------------------------------------------ */
export const HP_MAX = 100
/** 時間経過: この間隔で HP_DRAIN_PER_TICK ずつ減る */
export const HP_TICK_MS = 3000
export const HP_DRAIN_PER_TICK = 1
/** 興味のない物件を案内したときの追加ダメージ(嫌がったメンバー1人につき・1物件1回まで) */
export const HP_PENALTY_DISLIKE = 12
/** 世帯全員が気に入った物件を案内したときの回復(メンバー1人につき) */
export const HP_BONUS_ALL_LIKE = 6
/** 35条の質問に誤答したときのダメージ */
export const HP_PENALTY_WRONG = 20
/** ハゲタが法的解説をする確率 */
export const HAGETA_COMMENT_RATE = 0.5

/** 賃貸の媒介報酬は賃料1ヶ月分が上限(万円単位・最低1万円) */
export function brokerageFee(p: TourProperty): number {
  return Math.max(1, Math.round(p.rent))
}

/* ------------------------------------------------------------------ *
 * 住民の反応
 * ------------------------------------------------------------------ */
export type Mood = 'like' | 'neutral' | 'dislike'

export interface Reaction {
  mood: Mood
  /** 気に入った点 */
  hits: string[]
  /** 気に入らない点 */
  misses: string[]
  line: string
}

/** 物件の説明文(特徴+法的注意点+構造+用途地域)に keyword が含まれるか */
function mentions(p: TourProperty, keyword: string): boolean {
  const haystack = [...p.features, ...p.legalNotes, p.structure, p.zoning].join('/')
  return haystack.includes(keyword)
}

/** メンバー1人の反応。予算は世帯合計で判定する */
export function reactionTo(m: TourMember, p: TourProperty, budget: number): Reaction {
  const hits = m.likedFeatures.filter((f) => mentions(p, f))
  const misses = m.dislikedFeatures.filter((f) => f !== '家賃が高い' && mentions(p, f))
  if (p.rent > budget) misses.push('家賃が高い')

  const score = hits.length - misses.length
  const mood: Mood = score > 0 ? 'like' : score < 0 ? 'dislike' : 'neutral'
  const because = (xs: string[]) => xs.join('と')

  const line =
    mood === 'like'
      ? `${because(hits)}なんですね! ここ、いいなあ。`
      : mood === 'dislike'
        ? `うーん…${because(misses)}のはちょっと…。`
        : hits.length > 0
          ? `${because(hits)}はいいけど、${because(misses)}のが引っかかるかな。`
          : '悪くはないけど、ピンと来ないですね…。'

  return { mood, hits, misses, line }
}

/** 世帯全員分の反応をまとめたもの */
export interface HouseholdReaction {
  /** メンバーごとの反応(household.members と同じ順) */
  each: { member: TourMember; reaction: Reaction }[]
  /** 世帯としての総意。割れたら neutral */
  mood: Mood
  /** 嫌がったメンバー数(この人数分だけHPが減る) */
  dislikes: number
  /** 全員が気に入った */
  allLike: boolean
  /** 世帯としての一言(割れたときは折衷の言葉になる) */
  line: string
}

export function householdReaction(h: TourHousehold, p: TourProperty): HouseholdReaction {
  const each = h.members.map((member) => ({ member, reaction: reactionTo(member, p, h.budget) }))
  const likers = each.filter((e) => e.reaction.mood === 'like')
  const haters = each.filter((e) => e.reaction.mood === 'dislike')
  const allLike = likers.length === each.length
  const mood: Mood =
    allLike ? 'like' : haters.length > 0 && likers.length === 0 ? 'dislike' : 'neutral'

  const names = (xs: typeof each) => xs.map((e) => e.member.name).join('と')
  const line =
    each.length === 1
      ? each[0].reaction.line
      : allLike
        ? `${names(each)}「ここ、みんな気に入りました!」`
        : likers.length > 0 && haters.length > 0
          ? `${names(likers)}は乗り気だが、${names(haters)}は渋い顔だ。折り合いをつけたいところ。`
          : haters.length > 0
            ? `${names(haters)}「…この家はちょっと」`
            : '世帯そろって、可もなく不可もなくという顔をしている。'

  return { each, mood, dislikes: haters.length, allLike, line }
}

/** 1物件あたりのHP増減。全員 like なら人数分プラス、嫌がった人数分だけマイナス */
export function hpDeltaFor(hr: HouseholdReaction): number {
  if (hr.allLike) return HP_BONUS_ALL_LIKE * hr.each.length
  return -HP_PENALTY_DISLIKE * hr.dislikes
}

/* ------------------------------------------------------------------ *
 * ハゲタの法的解説(毎回ではない)
 * ------------------------------------------------------------------ */
export interface HagetaComment {
  text: string
  topicId: string
  title: string
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** 同じ組み合わせなら毎回同じ結果になる疑似乱数(0〜1) */
function seeded(seed: string): number {
  return (hash(seed) % 1000) / 1000
}

function commentCandidates(p: TourProperty): HagetaComment[] {
  const maxFloorArea = Math.round((p.area * p.floorAreaRatio) / 100)
  const maxBuildArea = Math.round((p.area * p.buildingCoverage) / 100)
  const list: HagetaComment[] = [
    {
      text: `ハゲタ「この土地は建蔽率${p.buildingCoverage}%・容積率${p.floorAreaRatio}%だ。敷地${p.area}平米なら建築面積は${maxBuildArea}平米、延べ面積は${maxFloorArea}平米まで。これ以上は増築できん」`,
      topicId: 'hourei-kenpei',
      title: '建蔽率と容積率の上限',
    },
    {
      text: `ハゲタ「用途地域は${p.zoning}だ。${p.zoning.includes('低層住居') ? '静かな住宅街を守る地域だから、店を開くのはご法度だぞ' : '住まいも店も建てられる地域だ。何を建てていいかは用途地域で決まる'}」`,
      topicId: 'hourei-yoto',
      title: '用途地域で建てられる建物が変わる',
    },
    {
      text: `ハゲタ「構造は${p.structure}、築${p.ageYears}年。${p.structure === 'RC造' ? '鉄筋コンクリートは重くて遮音性が高い' : p.structure === '鉄骨造' ? '鉄骨は柱が細くできるから間取りの自由が利く' : '木造は軽くて安いが、音は抜けやすい'}。構造は住み心地に直結する」`,
      topicId: 'sonota-tatemono',
      title: '建物の構造と住み心地',
    },
  ]
  for (const note of p.legalNotes) {
    if (note.includes('再建築'))
      list.push({
        text: `ハゲタ「${note}。道路に2m接していない土地は建て替えができん。安いのには理由があるんだ」`,
        topicId: 'hourei-kenchiku-kakunin',
        title: '接道義務と再建築不可',
      })
    if (note.includes('開発許可') || note.includes('調整区域'))
      list.push({
        text: `ハゲタ「${note}。市街化調整区域は市街化を抑える区域だから、建てるのに一手間かかるぞ」`,
        topicId: 'hourei-kaihatsu',
        title: '市街化調整区域と開発許可',
      })
    if (note.includes('農地'))
      list.push({
        text: `ハゲタ「${note}。畑を畑のまま借りるのも農地法3条の許可がいる。勝手に宅地にはできん」`,
        topicId: 'hourei-nochi',
        title: '農地法の許可',
      })
  }
  return list
}

/** 毎回は出ない。出るときは物件データから解説を1つ選ぶ */
export function hagetaCommentFor(p: TourProperty, seed: string): HagetaComment | null {
  const r = seeded(`${seed}/${p.id}`)
  if (r >= HAGETA_COMMENT_RATE) return null
  const list = commentCandidates(p)
  return list[hash(`c/${seed}/${p.id}`) % list.length]
}

/* ------------------------------------------------------------------ *
 * 35条書面(重要事項説明)
 * ------------------------------------------------------------------ */
export interface DisclosureQuestion {
  ask: string
  choices: string[]
  correct: number
  explain: string
}

export interface DisclosureItem {
  heading: string
  text: string
  question: DisclosureQuestion
}

export function disclosureFor(p: TourProperty): DisclosureItem[] {
  const maxFloorArea = Math.round((p.area * p.floorAreaRatio) / 100)
  const maxBuildArea = Math.round((p.area * p.buildingCoverage) / 100)
  return [
    {
      heading: '① 登記された権利について',
      text: `「${p.name}」の登記記録に記載された所有者は貸主本人で、所有権以外の権利の登記はありません。`,
      question: {
        ask: 'この説明って、契約したあとに聞くものじゃないんですか?',
        choices: [
          '契約する前に説明を受けるものです',
          '契約したあと1週間以内に説明します',
          '引っ越したあとで大丈夫です',
        ],
        correct: 0,
        explain:
          '重要事項説明(35条書面)は契約が成立するまでの間に、宅建士が宅建士証を提示して行う。契約後では意味がない。',
      },
    },
    {
      heading: '② 法令に基づく制限',
      text: `用途地域は${p.zoning}、建蔽率${p.buildingCoverage}%、容積率${p.floorAreaRatio}%です。${p.legalNotes.join('。')}。`,
      question: {
        ask: `敷地は${p.area}平米ですよね。延べ床は何平米まで建てられるんですか?`,
        choices: [
          `${maxFloorArea}平米まで`,
          `${maxBuildArea}平米まで`,
          `${p.area}平米まで`,
        ],
        correct: 0,
        explain: `延べ面積の上限は敷地面積×容積率。${p.area}×${p.floorAreaRatio}%=${maxFloorArea}平米。${maxBuildArea}平米は建蔽率から出る建築面積(真上から見た面積)の上限だ。`,
      },
    },
    {
      heading: '③ 賃料・敷金など契約の条件',
      text: `賃料は月${p.rent}万円、敷金${p.depositMonths}ヶ月、礼金${p.keyMoneyMonths}ヶ月です。`,
      question: {
        ask: '敷金って、出ていくときに全額返ってくるんですか?',
        choices: [
          '普通に住んでいてできた傷みの分は差し引かれず、残りは返ってきます',
          '一度預けた敷金は返ってきません',
          '汚れていなくても半分は返ってきません',
        ],
        correct: 0,
        explain:
          '敷金は預り金。通常損耗や経年変化の原状回復費用は借主の負担ではないので、未払賃料や借主の故意・過失による損傷の分だけ差し引いて返還される。',
      },
    },
  ]
}

/* ------------------------------------------------------------------ *
 * 状態機械
 * ------------------------------------------------------------------ */
export type TourPhase =
  /** 会社での面談(要望を聞く) */
  | { kind: 'briefing'; line: number }
  /** 物件を回る */
  | { kind: 'visit'; index: number; step: 'spec' | 'reaction' | 'hageta' }
  /** 契約する物件を選ぶ */
  | { kind: 'choose'; sel: number }
  /** 35条書面の読み上げ */
  | { kind: 'disclosure'; index: number; step: 'read' | 'question' | 'feedback'; sel: number; correct: boolean }
  /** 契約成立 or 失敗 */
  | { kind: 'done'; success: boolean }

export interface EarnedMemo {
  topicId: string
  title: string
}

export interface TourState {
  household: TourHousehold
  properties: TourProperty[]
  hp: number
  phase: TourPhase
  /** 加減点済みの物件(同じ物件で二重に増減させない) */
  scored: string[]
  contractedId: string | null
  /** 成立時の報酬(万円) */
  reward: number
  /** 発生したメモ。呼び出し側が新着分を onMemoEarned で拾う */
  memos: EarnedMemo[]
}

export type TourAction =
  /** スペース: 次へ */
  | { type: 'advance' }
  /** 矢印: 選択肢を動かす */
  | { type: 'move'; delta: number }
  /** 時間経過 */
  | { type: 'tick' }

const KIND_LABEL: Record<HouseholdKind, string> = {
  single: '単身',
  couple: 'カップル',
  family: '家族',
  share: 'ルームシェア',
}

/** 世帯の面談。世帯名・引越し理由・メンバー1人ずつの要望・世帯予算 */
export function briefingLines(h: TourHousehold): string[] {
  return [
    `ハゲタ「新人、今日の転入は${h.label}(${KIND_LABEL[h.kind]}・${h.members.length}人)だ。物件を案内してやれ」`,
    `${h.label}「${h.moveReason}んです」`,
    ...h.members.map((m) => `${m.name}(${m.age}歳)「${m.demands}」`),
    `ハゲタ「予算は世帯で月${h.budget}万円までだ。全員の希望に折り合いをつけろよ」`,
  ]
}

export function initTour(household: TourHousehold, properties: TourProperty[]): TourState {
  return {
    household,
    properties,
    hp: HP_MAX,
    phase: { kind: 'briefing', line: 0 },
    scored: [],
    contractedId: null,
    reward: 0,
    memos: [],
  }
}

/** HPを増減し(上限 HP_MAX)、尽きたら契約失敗にする */
function applyHp(s: TourState, delta: number): TourState {
  const hp = Math.min(HP_MAX, Math.max(0, s.hp + delta))
  if (hp > 0) return { ...s, hp }
  return { ...s, hp, phase: { kind: 'done', success: false } }
}

const damage = (s: TourState, amount: number) => applyHp(s, -amount)

function startVisit(s: TourState, index: number): TourState {
  if (index >= s.properties.length) return { ...s, phase: { kind: 'choose', sel: 0 } }
  return { ...s, phase: { kind: 'visit', index, step: 'spec' } }
}

export function tourReducer(s: TourState, a: TourAction): TourState {
  const ph = s.phase
  if (ph.kind === 'done') return s

  if (a.type === 'tick') return damage(s, HP_DRAIN_PER_TICK)

  if (a.type === 'move') {
    if (ph.kind === 'choose') {
      const n = s.properties.length
      return { ...s, phase: { ...ph, sel: (ph.sel + a.delta + n) % n } }
    }
    if (ph.kind === 'disclosure' && ph.step === 'question') {
      const n = disclosureFor(contractedProperty(s)).at(ph.index)?.question.choices.length ?? 3
      return { ...s, phase: { ...ph, sel: (ph.sel + a.delta + n) % n } }
    }
    return s
  }

  // advance
  switch (ph.kind) {
    case 'briefing': {
      const lines = briefingLines(s.household)
      if (ph.line + 1 < lines.length) return { ...s, phase: { kind: 'briefing', line: ph.line + 1 } }
      // 引越し理由に紐づくメモを獲得
      return startVisit(
        {
          ...s,
          memos: [...s.memos, { topicId: s.household.topicId, title: `${s.household.label}の引越し理由` }],
        },
        0,
      )
    }

    case 'visit': {
      const p = s.properties[ph.index]
      if (ph.step === 'spec') return { ...s, phase: { ...ph, step: 'reaction' } }
      if (ph.step === 'reaction') {
        // 嫌がったメンバーの人数分だけ減り、全員が気に入れば人数分回復(同じ物件では1回だけ)
        const delta = hpDeltaFor(householdReaction(s.household, p))
        const first = !s.scored.includes(p.id)
        const next = first && delta !== 0 ? applyHp({ ...s, scored: [...s.scored, p.id] }, delta) : s
        if (next.phase.kind === 'done') return next
        const comment = hagetaCommentFor(p, s.household.id)
        if (!comment) return startVisit(next, ph.index + 1)
        return {
          ...next,
          memos: [...next.memos, { topicId: comment.topicId, title: comment.title }],
          phase: { ...ph, step: 'hageta' },
        }
      }
      return startVisit(s, ph.index + 1)
    }

    case 'choose': {
      const p = s.properties[ph.sel]
      return {
        ...s,
        contractedId: p.id,
        phase: { kind: 'disclosure', index: 0, step: 'read', sel: 0, correct: false },
      }
    }

    case 'disclosure': {
      const p = contractedProperty(s)
      const items = disclosureFor(p)
      if (ph.step === 'read') return { ...s, phase: { ...ph, step: 'question', sel: 0 } }
      if (ph.step === 'question') {
        const correct = ph.sel === items[ph.index].question.correct
        const next = correct ? s : damage(s, HP_PENALTY_WRONG)
        if (next.phase.kind === 'done') return next
        return { ...next, phase: { ...ph, step: 'feedback', correct } }
      }
      if (ph.index + 1 < items.length)
        return { ...s, phase: { kind: 'disclosure', index: ph.index + 1, step: 'read', sel: 0, correct: false } }
      return { ...s, reward: brokerageFee(p), phase: { kind: 'done', success: true } }
    }
  }
}

export function contractedProperty(s: TourState): TourProperty {
  return s.properties.find((p) => p.id === s.contractedId) ?? s.properties[0]
}
