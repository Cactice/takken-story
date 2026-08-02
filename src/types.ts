import type { RomanceState } from './lib/romance'

export type Gender = 'male' | 'female'

export interface Character {
  id: string
  /** 表示名。content 側の苗字+名前から組み立てる(白石オリビア のように) */
  name: string
  /** 苗字(漢字) */
  familyName?: string
  /** 名前(カタカナ) */
  givenName?: string
  sprite: string
  personality: string
  /** JSONの置き場所の世代 */
  generation?: number
  /** 実際に登場する世代。第4世代の人が第5世代にも出る、というのがある */
  appearsIn?: number[]
  age?: number
  gender?: Gender
  romanceable?: boolean
  /** 雑談(ふだんの一言)。content 側の人物JSONから引く */
  smallTalk?: string[]
  /** 入居して間もない頃の一言(新居の話・引っ越しの感想) */
  movedInLines?: string[]
  /** 月ごとの一言。キーは "1"〜"12" */
  seasonalLines?: Record<string, string[]>
  /** 住んでいる家への満足・不満の一言(契約した物件と希望の照合で出し分ける) */
  homeLines?: { satisfied?: string[]; dissatisfied?: string[] }
  /** 転入時の希望(世帯で内見するときに使う) */
  moveIn?: {
    demands: string
    likedFeatures: string[]
    dislikedFeatures: string[]
  }
  /**
   * 転出(村を出ていく)理由。content 側で書けるようにした差し込み口。
   * 無ければ src/lib/moveout.ts の既定文で動く(コンテンツ担当が後から書ける)。
   */
  moveOut?: {
    /** 引っ越す理由(住民のセリフ。法律用語は使わない) */
    reason: string
    /** 理由に対応する宅建の論点。ハゲ田のアドバイス(メモ)を引くのに使う */
    topicId: string
    /** 去り際の一言 */
    farewell?: string
  }
}

export type DiagramType =
  | 'area'
  | 'land'
  | 'timeline'
  | 'parties'
  | 'money'
  | 'floorplan'
  | 'ratio'

/** ハゲタの解説につける図 */
export interface DiagramSpec {
  type: DiagramType
  labels: string[]
  values?: number[]
}

export interface GameEvent {
  /** 発生時期。世代内の何年目・何月に起きるか。上から読むと物語になる */
  year?: number
  month?: number
  id: string
  characterId: string
  topicId: string
  /** 相談の見出し(ハゲ田のメモの表題にも使う) */
  title?: string
  dialogue: string[]
  choices: string[]
  correctChoice: number
  explanation: string
  diagram?: DiagramSpec
  /** 解説を受けて主人公が住民にかみ砕いて説明するセリフ */
  playerLines?: string[]
  /** 住民の感謝のセリフ */
  thanksLine?: string
  /** 解決済みの住民に再度話しかけたときのセリフ */
  resolvedLine?: string
  /**
   * 解決すると手に入る「ハゲ田のメモ」の見出しと要点(docs/CONTENT_SCHEMA.md)。
   * メモはイベントを参照するだけなので、ここに書くのは題と要約だけ。無ければ title で代用する
   */
  memo?: { title: string; summary?: string }
  /** 根拠条文(例: 「宅建業法 第35条」)。content/reference/ の条文に対応する */
  source?: string
}

/** 体験済み相談(体験した年つき) */
export interface ExperiencedEvent {
  eventId: string
  year: number
}

/** 年間スケジュール: どのイベントを何月に相談するか */
export interface ScheduledEvent {
  eventId: string
  month: number
}

export interface ExamResult {
  year: number
  correct: number
  total: number
  passed: boolean
}

export interface GameState {
  gender: Gender
  /** ゲーム内経過日数(開始時 0)。1ヶ月=30日で年月日を導出 */
  daysElapsed: number
  money: number
  experiencedEvents: ExperiencedEvent[]
  /** yearSchedule がどの年のものか */
  scheduleYear: number
  yearSchedule: ScheduledEvent[]
  /** 試験で間違えた論点。翌年のスケジュール候補に優先で戻す */
  retryEventIds: string[]
  /** 試験に応募した年(1年目は社長が自動申込なので不要) */
  appliedExamYear: number
  /** 試験を消化(受験/見送り/未応募)した年 */
  lastExamYear: number
  examResults: ExamResult[]
  /** 恋愛の状態(住民IDごと)。旧セーブとの互換のため任意 */
  romance?: Record<string, RomanceState>
  /**
   * 村に住んでいる住民ID。開始時はハゲ田社長だけで、物件案内の契約成立で増える。
   * 旧セーブとの互換のため任意(未定義なら全員在住として扱う)
   */
  residents?: string[]
  /**
   * 建物ID → 埋まっている戸数。開始時はすべて空き家(村にいるのは主人公とハゲ田だけ)。
   * 契約が成立するとその建物の空き戸が1つ埋まる
   */
  occupancy?: Record<string, number>
  /** 住民ID → 契約して住んでいる建物ID。マップの立ち位置に使う */
  residentHomes?: Record<string, string>
  /** 住民ID → 村に来た日(daysElapsed)。引っ越したばかりかの判定に使う */
  residentSince?: Record<string, number>
  /**
   * 取得済みの「ハゲ田のメモ」= 解決した相談イベントのID(取得順)。
   * イベント解決時にここへ追加される想定。未定義の旧セーブは experiencedEvents から復元する
   */
  memos?: string[]
  /**
   * 自宅の棚に並べたメモ。自宅に入ると memos が全部ここへ移り、追従から外れる(身軽になる)
   */
  shelvedMemos?: string[]
  /** オープニング(ハゲ田が自宅まで案内する演出)を見たか */
  openingDone?: boolean
  /** 選んだ世代(いまは第1世代のみ実装) */
  generation?: number
  /** 主人公が住んでいる物件ID。ここから毎月の家賃を引く(引越しで変わりうるので状態で持つ) */
  homePropertyId?: string
  /** 家賃を引いた最後の月(year*12+month)。同じ月に二重で引かないための目印 */
  lastRentMonth?: number
  /** 今月の収支(万円)。月が変わると0に戻る。HUDに出す */
  monthNet?: number
}

/**
 * 開始時から村にいる住民。村は出来立てだが空っぽではない(docs/SYSTEMS.md「村の人口」)。
 * ハゲ田社長 + すでに住んでいる3世帯。この3人は転入者としては現れない(App が除外する)。
 */
export const INITIAL_RESIDENTS = ['hageta-hageta', 'shiraishi-olivia', 'minase-rion', 'oribe-silvia']

/**
 * 開始時の住民の住まい(住民ID → 物件ID)。
 * この家は「埋まっている」= 案内できない。転出イベントで空きに戻る。
 */
export const INITIAL_HOMES: Readonly<Record<string, string>> = {
  misaki: 'clinic',
  ren: 'flower',
  'oribe-silvia': 'kimono',
}

export const START_AGE = 15
export const START_YEAR = 1
export const DAYS_PER_MONTH = 30
export const DAYS_PER_YEAR = 12 * DAYS_PER_MONTH

/**
 * 金額はすべて「万円」単位の整数。
 * 収支のバランス(1年=12ヶ月):
 *   出ていく: 自宅の家賃(第1世代は5万)× 12ヶ月 = 60万/年
 *   入ってくる: 相談の謝礼 8万 × 年3〜4件 + 面談の謝礼 3万 × 年4組 + 仲介手数料(賃料1ヶ月分)× 成約
 * → まじめに働けば少し黒字、何もしなければ数ヶ月で苦しくなる。
 */
export const REWARD_CONSULT = 8
/** 転入者の話を聞く(面談)ともらえる謝礼 */
export const REWARD_MEETING = 3
export const REWARD_EXAM_PASS = 100
export const REWARD_EXAM_FAIL = 5

/**
 * 主人公の自宅(物件ID)。**世代ごとに違う物件**で、家賃はその物件データの賃料を毎月引く
 * (定数にしない。docs/SYSTEMS.md「自宅と家賃」)。
 * 第2世代の「掴まされた高い物件」のように、家賃そのものが物語の実感になる。
 * ponytail: いまは第1世代のボロ屋しか物件データが無いので他世代は暫定で同じものを指している。
 * その世代の自宅にあたる物件を properties.ts に足したら、ここを差し替えるだけでよい。
 */
export const HOME_OF_GENERATION: Readonly<Record<number, string>> = {
  1: 'player-home',
  // 第2世代: 海沢に「相場の半値」と勧められた雑居ビルの一室。実際は共益費込みで月15万
  2: 'kurokai-zakkyo-s',
  3: 'player-home',
  4: 'player-home',
  5: 'player-home',
}

/** 所持金の初期値も世代ごとに違う(docs/STORY.md) */
export const MONEY_START_OF_GENERATION: Readonly<Record<number, number>> = {
  1: 10,
  2: 300,
  3: 500,
  4: 50,
  5: 5000,
}
export const EXAM_PASS_RATIO = 0.7
export const EXAM_MONTH = 10
export const EXAM_DAY = 15
export const APPLY_DEADLINE_MONTH = 6

export function ageOf(s: GameState): number {
  return START_AGE + Math.floor(s.daysElapsed / DAYS_PER_YEAR)
}

export function calendarOf(s: GameState): { year: number; month: number; day: number } {
  const dayOfYear = s.daysElapsed % DAYS_PER_YEAR
  return {
    year: START_YEAR + Math.floor(s.daysElapsed / DAYS_PER_YEAR),
    month: Math.floor(dayOfYear / DAYS_PER_MONTH) + 1,
    day: (dayOfYear % DAYS_PER_MONTH) + 1,
  }
}
