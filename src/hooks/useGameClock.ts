import { useEffect } from 'react'

/** 1ヶ月=リアル50秒(1年=10分)。30日換算で1日≒1.67秒 */
export const MS_PER_MONTH = 50 * 1000
export const MS_PER_DAY = Math.round(MS_PER_MONTH / 30)

export function useGameClock(running: boolean, onDay: () => void): void {
  useEffect(() => {
    if (!running) return
    const id = setInterval(onDay, MS_PER_DAY)
    return () => clearInterval(id)
  }, [running, onDay])
}
