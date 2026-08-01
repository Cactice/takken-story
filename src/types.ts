export type Gender = 'male' | 'female'

export interface Character {
  id: string
  name: string
  sprite: string
  personality: string
}

export interface GameEvent {
  id: string
  characterId: string
  topicId: string
  dialogue: string[]
  choices: string[]
  correctChoice: number
  explanation: string
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
}

export const START_AGE = 15
export const START_YEAR = 1
export const DAYS_PER_MONTH = 30
export const DAYS_PER_YEAR = 12 * DAYS_PER_MONTH

/** 金額はすべて「万円」単位で保持する */
export const REWARD_CONSULT = 1
export const REWARD_EXAM_PASS = 100
export const REWARD_EXAM_FAIL = 5
/** 自宅の家賃(毎月) */
export const RENT_MONTHLY = 5
export const MONEY_START = 10
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
