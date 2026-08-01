import type { GameEvent, GameState, ScheduledEvent } from '../types'

/** 1年に発生する相談イベント数 = 試験の問題数 */
export const EVENTS_PER_YEAR = 10
/** 相談は1〜9月に割り振る(10月は試験) */
const LAST_SCHEDULE_MONTH = 9

function shuffled<T>(arr: readonly T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * 年初のスケジュール作成。
 * 優先度: 前年の試験で間違えた論点 → 未体験イベント → (弾切れ時)体験済みの再出題
 */
export function buildYearSchedule(
  allEvents: readonly GameEvent[],
  experiencedIds: ReadonlySet<string>,
  retryEventIds: readonly string[],
): ScheduledEvent[] {
  const retry = retryEventIds.filter((id) => allEvents.some((e) => e.id === id))
  const rest = (pick: (e: GameEvent) => boolean) =>
    shuffled(allEvents.filter((e) => !retry.includes(e.id) && pick(e)).map((e) => e.id))
  const picked = [
    ...retry,
    ...rest((e) => !experiencedIds.has(e.id)),
    ...rest((e) => experiencedIds.has(e.id)),
  ].slice(0, EVENTS_PER_YEAR)

  return shuffled(picked).map((eventId, i) => ({
    eventId,
    month: 1 + Math.floor((i * LAST_SCHEDULE_MONTH) / Math.max(picked.length, 1)),
  }))
}

/** 現時点で相談可能(スケジュール月が来ていて今年まだ体験していない)なイベント */
export function availableConsultations(state: GameState, currentMonth: number, currentYear: number): string[] {
  return state.yearSchedule
    .filter((s) => s.month <= currentMonth)
    .map((s) => s.eventId)
    .filter(
      (id) => !state.experiencedEvents.some((x) => x.eventId === id && x.year === currentYear),
    )
}
