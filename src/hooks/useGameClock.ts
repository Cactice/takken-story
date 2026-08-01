import { useEffect } from 'react'

/** リアル5分 ≒ ゲーム内1ヶ月 (リアル1時間 ≒ 1年) */
export const MS_PER_MONTH = 5 * 60 * 1000

export function useGameClock(running: boolean, onMonth: () => void): void {
  useEffect(() => {
    if (!running) return
    const id = setInterval(onMonth, MS_PER_MONTH)
    return () => clearInterval(id)
  }, [running, onMonth])
}
