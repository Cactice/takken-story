import { useEffect } from 'react'

/** 1ヶ月=リアル50秒(1年=10分)。30日換算で1日≒1.67秒 */
/**
 * 時間設計: 30歳定年 = 15歳から15年が1世代の持ち時間。
 * 1世代 = 15年 = 60分 → 1年 = 4分(240秒) → 1季節 = 1分 → 1ヶ月 = 20秒
 * 全体 = 5世代 × 60分 = 5時間
 */
export const MS_PER_YEAR = 4 * 60 * 1000
export const MS_PER_SEASON = MS_PER_YEAR / 4
export const MS_PER_MONTH = MS_PER_YEAR / 12
export const MS_PER_DAY = Math.round(MS_PER_MONTH / 30)

export function useGameClock(running: boolean, onDay: () => void): void {
  useEffect(() => {
    if (!running) return
    const id = setInterval(onDay, MS_PER_DAY)
    return () => clearInterval(id)
  }, [running, onDay])
}
