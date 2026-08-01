import type { GameState } from '../types'

const KEY = 'takken-study:save:v2'

export function loadState(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as GameState
    // 最低限の検証: 外部データを信用しない
    if (
      (s.gender !== 'male' && s.gender !== 'female') ||
      typeof s.daysElapsed !== 'number' ||
      typeof s.money !== 'number' ||
      typeof s.scheduleYear !== 'number' ||
      typeof s.appliedExamYear !== 'number' ||
      typeof s.lastExamYear !== 'number' ||
      !Array.isArray(s.experiencedEvents) ||
      !Array.isArray(s.yearSchedule) ||
      !Array.isArray(s.retryEventIds) ||
      !Array.isArray(s.examResults)
    ) {
      return null
    }
    return s
  } catch {
    return null
  }
}

export function saveState(state: GameState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // ストレージ不可(プライベートモード等)は無視
  }
}

export function clearSave(): void {
  localStorage.removeItem(KEY)
}
