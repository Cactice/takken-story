import { useEffect } from 'react'

/** 1ヶ月=リアル50秒(1年=10分)。30日換算で1日≒1.67秒 */
/**
 * 時間設計: 40歳定年 = 15歳から25年が1世代の持ち時間。
 * 1世代 = 25年 = 50分 → 1年 = 2分(120秒) → 1季節 = 30秒 → 1ヶ月 = 10秒
 * 全体 = 5世代 × 50分 = 約4時間
 */
export const MS_PER_YEAR = 2 * 60 * 1000
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
