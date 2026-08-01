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

export interface GameState {
  gender: Gender
  /** ゲーム内経過月数(開始時 0)。年齢・年月はここから導出 */
  monthsElapsed: number
  money: number
  /** 回答済みイベントID */
  answeredEventIds: string[]
}

export const START_AGE = 15
export const START_YEAR = 1
export const REWARD_CORRECT = 10000

export function ageOf(s: GameState): number {
  return START_AGE + Math.floor(s.monthsElapsed / 12)
}

export function calendarOf(s: GameState): { year: number; month: number } {
  return {
    year: START_YEAR + Math.floor(s.monthsElapsed / 12),
    month: (s.monthsElapsed % 12) + 1,
  }
}
