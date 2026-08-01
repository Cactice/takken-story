/**
 * 物件案内(コアゲームプレイ)の状態機械。
 * 純粋関数のみ。副作用(タイマー・描画・メモ発行)は呼び出し側 = TourScreen が持つ。
 */

import type { PropertySpec } from './properties'

/* ------------------------------------------------------------------ *
 * 物件データ
 * マップ上の建物・土地(properties.ts の PropertySpec)を、案内ゲームが使う
 * 数値中心の形に変換して扱う。表示用の文字列は PropertySpec 側が持つ。
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

/** "築26年" / "建蔽率 60%" / "土地 1,900㎡" のような表記から最初の数値を取り出す */
function num(text: string | undefined, fallback: number): number {
  const m = text?.replace(/,/g, '').match(/-?\d+(\.\d+)?/)
  return m ? Number(m[0]) : fallback
}

/** "敷金1ヶ月 / 礼金なし" → 敷金1・礼金0 */
function months(deposit: string | undefined, label: string): number {
  const m = deposit?.replace(/,/g, '').match(new RegExp(`${label}\\s*(\\d+(?:\\.\\d+)?)`))
  return m ? Number(m[1]) : 0
}

/**
 * マップ上の物件を案内ゲーム用に変換する。
 * ponytail: 売買物件(価格だけの物件)は「価格 ÷ 300 = 月あたりの負担」というざっくり
 * 換算で家賃相当にしている。世帯の予算が月額なので比較の軸を揃えるためだけの近似。
 * 実際の利回りで詰めたくなったらこの 300 を触れば済む。
 */
export const RENT_FROM_PRICE = 300

export function toTourProperty(p: PropertySpec): TourProperty {
  const isRent = p.price.includes('賃料')
  const price = num(p.price, 0)
  return {
    id: p.id,
    name: p.name,
    structure: p.structure ?? '土地',
    floors: Math.max(1, num(p.floors, 1)),
    ageYears: num(p.age, 0),
    area: num(p.kind === 'land' ? p.landArea : p.area, num(p.landArea, 0)),
    zoning: p.zoning,
    buildingCoverage: num(p.coverage, 60),
    floorAreaRatio: num(p.floorAreaRatio, 200),
    rent: isRent ? price : Math.max(1, Math.round(price / RENT_FROM_PRICE)),
    depositMonths: months(p.deposit, '敷金'),
    keyMoneyMonths: months(p.deposit, '礼金'),
    features: p.features,
    legalNotes: p.legalNotes,
  }
}

/* ------------------------------------------------------------------ *
 * 転入は「世帯」単位(単身・カップル・家族・ルームシェア)
 * content/gen1/households/*.json + content/gen1/characters/*.json を
 * 組み立てたもの。JSON の読み込みは lib/content.ts が持つ。
 * ------------------------------------------------------------------ */
export type HouseholdKind = 'single' | 'couple' | 'family' | 'share'

/**
 * 話し方と着眼点。同じ物件でも人によって見るところと言い回しが違う。
 * ponytail: いまは年齢とIDから機械的に決めている。content 側のキャラJSONに
 * `voice: { style, focus }` を持たせたら toTourMember がそのまま流し込むだけでよい。
 */
export type VoiceStyle = 'polite' | 'casual' | 'kid' | 'elder' | 'gruff'

export interface MemberVoice {
  style: VoiceStyle
  /** 家を見るときに真っ先に見るところ(通勤・日当たり・庭・段差 など) */
  focus: string
}

/** 世帯のメンバー1人分の希望 */
export interface TourMember {
  id: string
  name: string
  age: number
  /** 要望 */
  demands: string
  likedFeatures: string[]
  dislikedFeatures: string[]
  voice: MemberVoice
}

const FOCUS_POOL = ['通勤のしやすさ', '日当たり', '間取りの使い勝手', '静かさ', '庭と外まわり', '段差と動線']

/** content に voice が無いあいだの割り当て。年齢で口調、IDで着眼点を散らす */
export function defaultVoice(id: string, age: number, likedFeatures: string[]): MemberVoice {
  const style: VoiceStyle =
    age > 0 && age <= 12
      ? 'kid'
      : age >= 65
        ? 'elder'
        : (['polite', 'casual', 'gruff'] as const)[hash(`v/${id}`) % 3]
  return { style, focus: likedFeatures[0] ?? FOCUS_POOL[hash(`f/${id}`) % FOCUS_POOL.length] }
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
  /**
   * 引越し理由に紐づくハゲタのアドバイス。topicId の論点イベントから組み立てる
   * (content.ts が解決して渡す。データを二重に持たない)
   */
  advice?: { title: string; text: string }
}

/** content/gen1/characters/*.json の1人を内見メンバーに変換する */
export function toTourMember(c: {
  id: string
  name: string
  age?: number
  /** content 側で口調を持たせたらここに入る(無ければ defaultVoice) */
  voice?: MemberVoice
  moveIn?: { demands: string; likedFeatures: string[]; dislikedFeatures: string[] }
}): TourMember {
  const age = c.age ?? 0
  const likedFeatures = c.moveIn?.likedFeatures ?? []
  return {
    id: c.id,
    name: c.name,
    age,
    demands: c.moveIn?.demands ?? '特に希望はないです',
    likedFeatures,
    dislikedFeatures: c.moveIn?.dislikedFeatures ?? [],
    voice: c.voice ?? defaultVoice(c.id, age, likedFeatures),
  }
}

/* ------------------------------------------------------------------ *
 * 定数(調整用のつまみはここに集約)
 * ------------------------------------------------------------------ */
export const HP_MAX = 100
/** 時間経過: この間隔で HP_DRAIN_PER_TICK ずつ減る */
export const HP_TICK_MS = 3000
export const HP_DRAIN_PER_TICK = 1
/** はっきり嫌がったメンバー1人につき減る量(1物件1回まで) */
export const HP_PENALTY_DISLIKE = 8
/** 「ピンと来ない」1人につき減る量。内見の結果が「何も起きない」にならないようにする */
export const HP_PENALTY_MEH = 4
/** 気に入ったメンバー1人につき回復する量 */
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
 * 内見の結果は必ず「機嫌が下がる」か「契約候補になる」のどちらか。
 * 何も起きない結果は作らない(内見する意味がなくなるため)。
 * ------------------------------------------------------------------ */
export type Mood = 'like' | 'meh' | 'dislike'

export interface Reaction {
  mood: Mood
  /** 気に入った点 */
  hits: string[]
  /** 気に入らない点 */
  misses: string[]
  line: string
}

/**
 * 物件データから読み取れる「暗黙の特徴」。
 * 物件の紹介文は言葉づかいがまちまちなので、数値から言える特徴を足してやらないと
 * 「築浅がいい」「静かがいい」といった要望と噛み合わない。
 */
export function derivedFeatures(p: TourProperty): string[] {
  const text = [...p.features, ...p.legalNotes].join('/')
  const out: string[] = []
  if (p.ageYears <= 15) out.push('築浅')
  if (p.ageYears >= 30) out.push('築古')
  if (p.rent <= 4) out.push('家賃が安い')
  if (p.floors >= 2) out.push('2階建て')
  else out.push('平屋', 'バリアフリー')
  if (p.zoning.includes('低層住居') || p.zoning.includes('調整区域') || p.zoning.includes('農業'))
    out.push('静か')
  if (p.zoning.includes('商業') || p.zoning.includes('工業')) out.push('駅近', '事業用可')
  if (text.includes('バス停') || text.includes('村役場') || text.includes('県道')) out.push('駅近')
  if (text.includes('庭') || text.includes('畑') || text.includes('農')) out.push('広い庭')
  if (text.includes('畑') || text.includes('農地')) out.push('畑付き')
  if (text.includes('店舗') || text.includes('事務所') || text.includes('作業')) out.push('事業用可')
  if (text.includes('駐車') || text.includes('駐輪')) out.push('駐車場あり')
  if (p.structure.includes('RC')) out.push('防音')
  if (text.includes('日当たり') || text.includes('南向き') || text.includes('南斜面'))
    out.push('日当たり良好')
  if (p.area >= 100) out.push('広い')
  if (p.buildingCoverage >= 80) out.push('隣が近い')
  if (text.includes('ペット不可')) return out
  if (text.includes('庭') || p.zoning.includes('調整区域')) out.push('ペット可')
  return out
}

/** 物件の説明文(特徴+法的注意点+構造+用途地域+暗黙の特徴)に keyword が含まれるか */
function mentions(p: TourProperty, keyword: string): boolean {
  const haystack = [...p.features, ...p.legalNotes, ...derivedFeatures(p), p.structure, p.zoning].join('/')
  return haystack.includes(keyword)
}

/** 口調ごとの言い回し。同じ気分でも人によって言葉が変わる */
interface Phrases {
  like: (hits: string) => string
  mixed: (hits: string, misses: string) => string
  meh: (focus: string) => string
  dislike: (misses: string) => string
}

const VOICES: Record<VoiceStyle, Phrases> = {
  polite: {
    like: (h) => `${h}なんですね! ここ、気に入りました`,
    mixed: (h, m) => `${h}はいいですね。ただ、${m}のが引っかかります`,
    meh: (f) => `${f}を見たかったんですが…この家は決め手に欠けますね`,
    dislike: (m) => `${m}のはちょっと…私には難しいです`,
  },
  casual: {
    like: (h) => `お、${h}じゃん! ここ好きだな`,
    mixed: (h, m) => `${h}はアリ。でも${m}のがなあ`,
    meh: (f) => `${f}は…まあ普通かな。決め手がないんだよね`,
    dislike: (m) => `${m}のはナシだって。ここは無理`,
  },
  kid: {
    like: (h) => `わー! ${h}だって! ここがいい!`,
    mixed: (h, m) => `${h}はすき! でも${m}のはやだ`,
    meh: (f) => `${f}、べつにふつう。つまんない`,
    dislike: (m) => `やだ、${m}んだもん`,
  },
  elder: {
    like: (h) => `${h}とは、ええ家じゃなあ`,
    mixed: (h, m) => `${h}はええが、${m}のがのう`,
    meh: (f) => `${f}がのう…わしにはどうもピンとこん`,
    dislike: (m) => `${m}のはいかん。年寄りには堪えるよ`,
  },
  gruff: {
    like: (h) => `${h}か。悪くない。ここでいい`,
    mixed: (h, m) => `${h}は認める。だが${m}がな`,
    meh: (f) => `${f}が物足りん。わざわざ来た甲斐がないな`,
    dislike: (m) => `${m}のは無理だ。話にならん`,
  },
}

/** メンバー1人の反応。予算は世帯合計で判定する */
export function reactionTo(m: TourMember, p: TourProperty, budget: number): Reaction {
  const hits = m.likedFeatures.filter((f) => mentions(p, f))
  const misses = m.dislikedFeatures.filter((f) => f !== '家賃が高い' && mentions(p, f))
  if (p.rent > budget) misses.push('家賃が高い')

  const score = hits.length - misses.length
  const mood: Mood = score > 0 ? 'like' : score < 0 ? 'dislike' : hits.length > 0 ? 'meh' : 'meh'
  const v = VOICES[m.voice.style]
  const because = (xs: string[]) => xs.join('と')

  const line =
    mood === 'like'
      ? misses.length > 0
        ? v.mixed(because(hits), because(misses))
        : v.like(because(hits))
      : mood === 'dislike'
        ? hits.length > 0
          ? v.mixed(because(hits), because(misses))
          : v.dislike(because(misses))
        : hits.length > 0
          ? v.mixed(because(hits), because(misses))
          : v.meh(m.voice.focus)

  return { mood, hits, misses, line }
}

/** 世帯全員分の反応をまとめたもの */
export interface HouseholdReaction {
  /** メンバーごとの反応(household.members と同じ順) */
  each: { member: TourMember; reaction: Reaction }[]
  /** 世帯としての総意 */
  mood: Mood
  /** はっきり嫌がったメンバー数 */
  dislikes: number
  /** ピンと来なかったメンバー数 */
  mehs: number
  /** 気に入ったメンバー数 */
  likes: number
  /** 契約候補にできる = 嫌がる人がおらず、気に入った人がいる */
  candidate: boolean
  /** 世帯としての一言 */
  line: string
}

export function householdReaction(h: TourHousehold, p: TourProperty): HouseholdReaction {
  const each = h.members.map((member) => ({ member, reaction: reactionTo(member, p, h.budget) }))
  const likers = each.filter((e) => e.reaction.mood === 'like')
  const haters = each.filter((e) => e.reaction.mood === 'dislike')
  const mehs = each.filter((e) => e.reaction.mood === 'meh')
  const candidate = haters.length === 0 && likers.length > 0
  const mood: Mood = candidate ? 'like' : haters.length > 0 ? 'dislike' : 'meh'

  const names = (xs: typeof each) => xs.map((e) => e.member.name).join('と')
  const line = candidate
    ? each.length === 1
      ? `${names(likers)}はこの家が気に入ったようだ。契約に進める。`
      : `${names(likers)}が乗り気だ。反対する人もいない — この物件なら契約に進める。`
    : haters.length > 0 && likers.length > 0
      ? `${names(likers)}は乗り気だが、${names(haters)}が首を振っている。折り合わない物件は疲れるだけだ。`
      : haters.length > 0
        ? `${names(haters)}「…この家はちょっと」`
        : `${names(mehs)}は反応が薄い。決め手のない内見に付き合わせた分、疲れが出た。`

  return { each, mood, dislikes: haters.length, mehs: mehs.length, likes: likers.length, candidate, line }
}

/**
 * 1物件あたりのHP増減。0にはならない:
 * 契約候補 → 気に入った人数分プラス / それ以外 → 嫌がった人+ピンと来ない人の分だけマイナス
 */
export function hpDeltaFor(hr: HouseholdReaction): number {
  if (hr.candidate) return HP_BONUS_ALL_LIKE * hr.likes
  return -(hr.dislikes * HP_PENALTY_DISLIKE + hr.mehs * HP_PENALTY_MEH)
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
 * 物件を回るところ(map)はマップ側 = TownView が主役なので、ここでは
 * 「案内中である」という状態と内見の加減点だけを持つ。
 * ------------------------------------------------------------------ */
export type TourPhase =
  /** 画面外から歩いてきて、頭に「!」を付けたまま主人公についてくる。話しかけると面談へ */
  | { kind: 'arriving' }
  /** 面談(要望を聞く)。オーバーレイ */
  | { kind: 'briefing'; line: number }
  /** マップ上を連れ回して物件を見せる */
  | { kind: 'map' }
  /** 35条書面の読み上げ。オーバーレイ */
  | { kind: 'disclosure'; index: number; step: 'read' | 'question' | 'feedback'; sel: number; correct: boolean }
  /** 契約成立 or 失敗 */
  | { kind: 'done'; success: boolean }

export interface EarnedMemo {
  topicId: string
  title: string
}

export interface TourState {
  household: TourHousehold
  hp: number
  phase: TourPhase
  /** 内見済みの物件。同じ物件では二度とHPが動かない */
  scored: string[]
  /** 契約に進める物件(世帯が気に入った物件) */
  candidates: string[]
  /** 直前に内見した物件(追従キャラの「さっきの家どうだった?」に使う) */
  lastVisited: TourProperty | null
  contracted: TourProperty | null
  /** 成立時の報酬(万円) */
  reward: number
  /** 発生したメモ。呼び出し側が新着分を拾う */
  memos: EarnedMemo[]
}

export type TourAction =
  /** スペース: 次へ */
  | { type: 'advance' }
  /** 矢印: 選択肢を動かす */
  | { type: 'move'; delta: number }
  /** 時間経過 */
  | { type: 'tick' }
  /** マップ上で物件を内見した */
  | { type: 'inspect'; property: TourProperty }
  /** 内見済みの物件で契約に進む */
  | { type: 'contract'; property: TourProperty }
  /** ついてきた転入者に話しかけた → 面談が始まる */
  | { type: 'meet' }

const KIND_LABEL: Record<HouseholdKind, string> = {
  single: '単身',
  couple: 'カップル',
  family: '家族',
  share: 'ルームシェア',
}

/** 世帯の面談。世帯名・引越し理由・メンバー1人ずつの要望・世帯予算 */
export function briefingLines(h: TourHousehold): string[] {
  return [
    `${h.label}「あの…この村に越してきたくて。物件を見せてもらえませんか?」`,
    `ハゲタ「${h.label}(${KIND_LABEL[h.kind]}・${h.members.length}人)か。新人、案内してやれ」`,
    `${h.label}「${h.moveReason}んです」`,
    ...(h.advice
      ? [
          `ハゲタ「${h.advice.title}か。新人、こういう客が来たときの勘所を教えてやる」`,
          `ハゲタ「${h.advice.text}」`,
        ]
      : []),
    ...h.members.map((m) => `${m.name}(${m.age}歳)「${m.demands}」`),
    `ハゲタ「予算は世帯で月${h.budget}万円までだ。全員の希望に折り合いをつけろよ」`,
    `ハゲタ「${h.label}を連れて村を回れ。建物を向いてスペースで物件の話ができる」`,
  ]
}

export function initTour(household: TourHousehold): TourState {
  return {
    household,
    hp: HP_MAX,
    phase: { kind: 'arriving' },
    scored: [],
    candidates: [],
    lastVisited: null,
    contracted: null,
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

/** その物件はもう内見済みか(2回目以降はHPが動かない) */
export function isInspected(s: TourState, propertyId: string): boolean {
  return s.scored.includes(propertyId)
}

/** 世帯が気に入った物件か(契約に進めるのはここだけ) */
export function isCandidate(s: TourState, propertyId: string): boolean {
  return s.candidates.includes(propertyId)
}

export function tourReducer(s: TourState, a: TourAction): TourState {
  const ph = s.phase
  if (ph.kind === 'done') return s

  // 面談前(ついてきているだけ)は機嫌が減らない
  if (a.type === 'tick') return ph.kind === 'arriving' ? s : damage(s, HP_DRAIN_PER_TICK)

  if (a.type === 'meet')
    return ph.kind === 'arriving' ? { ...s, phase: { kind: 'briefing', line: 0 } } : s

  if (a.type === 'inspect') {
    if (ph.kind !== 'map') return s
    const p = a.property
    const next = { ...s, lastVisited: p }
    if (isInspected(s, p.id)) return next
    const hr = householdReaction(s.household, p)
    return applyHp(
      {
        ...next,
        scored: [...s.scored, p.id],
        candidates: hr.candidate ? [...s.candidates, p.id] : s.candidates,
      },
      hpDeltaFor(hr),
    )
  }

  if (a.type === 'contract') {
    // 気に入っていない物件では契約に進めない
    if (ph.kind !== 'map' || !isCandidate(s, a.property.id)) return s
    return {
      ...s,
      contracted: a.property,
      phase: { kind: 'disclosure', index: 0, step: 'read', sel: 0, correct: false },
    }
  }

  if (a.type === 'move') {
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
      // 引越し理由に紐づくメモを獲得して、マップへ出る
      return {
        ...s,
        memos: [
          ...s.memos,
          {
            topicId: s.household.topicId,
            title: s.household.advice?.title ?? `${s.household.label}の引越し理由`,
          },
        ],
        phase: { kind: 'map' },
      }
    }

    case 'arriving':
    case 'map':
      return s

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

/** 契約対象の物件。disclosure/done でしか呼ばない */
export function contractedProperty(s: TourState): TourProperty {
  if (!s.contracted) throw new Error('契約対象の物件が決まっていない')
  return s.contracted
}

/* ------------------------------------------------------------------ *
 * 追従キャラに話しかけたときのセリフ
 * ------------------------------------------------------------------ */

/**
 * 状況に応じて出し分ける:
 * 1. 機嫌が悪い → 疲れたと言う
 * 2. 直前に見た物件がある → その感想(人によって違う)
 * 3. それ以外 → 要望の再確認 or 雑談(人によって違う)
 */
export function followerLine(s: TourState, m: TourMember): string {
  const h = s.household
  if (s.phase.kind === 'arriving') return 'あの、家を探しているんです。話を聞いてもらえますか?'
  if (s.hp <= HP_MAX * 0.4) return 'そろそろ疲れてきました…。今日はあと1、2軒にしませんか'

  if (s.lastVisited) {
    const r = reactionTo(m, s.lastVisited, h.budget)
    return `さっき見た${s.lastVisited.name}ですけど… ${r.line}`
  }

  const smallTalk = [
    `${h.moveReason}んです。いい家が見つかるといいなあ`,
    'この村、思ったより広いんですね。歩くだけで楽しいです',
    `${m.voice.focus}だけは譲れないんですよ、ほんとうに`,
  ]
  return hash(`talk/${m.id}`) % 2 === 0
    ? `もう一度言いますね。${m.demands}`
    : smallTalk[hash(`st/${m.id}/${h.id}`) % smallTalk.length]
}
