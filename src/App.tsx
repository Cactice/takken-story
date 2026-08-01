import { useCallback, useState } from 'react'
import { TitleScreen } from './components/title/TitleScreen'
import { TownView } from './components/town/TownView'
import { DialogueBox } from './components/dialogue/DialogueBox'
import { ExamScreen, passLine } from './components/exam/ExamScreen'
import type { ExamAnswer } from './components/exam/ExamScreen'
import { DateMeter } from './components/hud/DateMeter'
import { useGameClock } from './hooks/useGameClock'
import { characters, events } from './lib/content'
import { availableConsultations, buildYearSchedule } from './lib/schedule'
import { loadState, saveState } from './lib/save'
import { playerSpriteStyle } from './lib/sprites'
import {
  APPLY_DEADLINE_MONTH,
  EXAM_DAY,
  EXAM_MONTH,
  REWARD_CONSULT,
  REWARD_EXAM_FAIL,
  REWARD_EXAM_PASS,
  START_YEAR,
  ageOf,
  calendarOf,
} from './types'
import type { Character, GameState, Gender } from './types'
import './App.css'

export default function App() {
  const [state, setState] = useState<GameState | null>(null)
  const [talkingTo, setTalkingTo] = useState<Character | null>(null)

  const update = useCallback((fn: (s: GameState) => GameState) => {
    setState((prev) => {
      if (!prev) return prev
      const next = fn(prev)
      saveState(next)
      return next
    })
  }, [])

  const tickDay = useCallback(
    () =>
      update((s) => {
        const next = { ...s, daysElapsed: s.daysElapsed + 1 }
        const { year } = calendarOf(next)
        if (year === next.scheduleYear) return next
        // 年初: 未体験(+前年の間違い優先)から今年の10件を組む
        return {
          ...next,
          scheduleYear: year,
          yearSchedule: buildYearSchedule(
            events,
            new Set(next.experiencedEvents.map((e) => e.eventId)),
            next.retryEventIds,
          ),
          retryEventIds: [],
        }
      }),
    [update],
  )

  const cal = state ? calendarOf(state) : null
  const examDue =
    state !== null &&
    cal !== null &&
    cal.month === EXAM_MONTH &&
    cal.day >= EXAM_DAY &&
    state.lastExamYear < cal.year

  // 試験・結果表示中は時計を止める(表示中に月をまたがないように)
  useGameClock(state !== null && !examDue, tickDay)

  if (!state || !cal) {
    return (
      <TitleScreen
        hasSave={loadState() !== null}
        onStart={(gender: Gender) => {
          const fresh: GameState = {
            gender,
            daysElapsed: 0,
            money: 100000,
            experiencedEvents: [],
            scheduleYear: START_YEAR,
            yearSchedule: buildYearSchedule(events, new Set(), []),
            retryEventIds: [],
            appliedExamYear: 0,
            lastExamYear: 0,
            examResults: [],
          }
          saveState(fresh)
          setState(fresh)
        }}
        onContinue={() => setState(loadState())}
      />
    )
  }

  const { year, month, day } = calendarOf(state)
  const available = availableConsultations(state, month, year)
  const alertIds = new Set(
    available
      .map((id) => events.find((e) => e.id === id))
      .filter((e) => e !== undefined)
      .map((e) => e.characterId),
  )

  const pendingEvent =
    talkingTo === null
      ? null
      : (events.find((e) => e.characterId === talkingTo.id && available.includes(e.id)) ?? null)

  // 1年目はハゲタ社長が自動申込。2年目以降は6月末までの応募が必要
  const applied = year === START_YEAR || state.appliedExamYear === year
  const canApply =
    year > START_YEAR && month <= APPLY_DEADLINE_MONTH && state.appliedExamYear !== year
  const examQuestions = state.yearSchedule
    .map((s) => events.find((e) => e.id === s.eventId))
    .filter((e) => e !== undefined)
  const experiencedIds = new Set(state.experiencedEvents.map((e) => e.eventId))

  const finishExam = (answers: ExamAnswer[]) => {
    const correct = answers.filter((a) => a.correct).length
    const passed = correct >= passLine(answers.length)
    update((s) => ({
      ...s,
      money: s.money + (passed ? REWARD_EXAM_PASS : REWARD_EXAM_FAIL),
      lastExamYear: year,
      retryEventIds: answers.filter((a) => !a.correct).map((a) => a.event.id),
      examResults: [...s.examResults, { year, correct, total: answers.length, passed }],
    }))
  }

  return (
    <div className="game">
      <header className="game-header">
        <span className="hud-item">
          <span className="hud-avatar" style={playerSpriteStyle(state.gender)} /> {ageOf(state)}歳
        </span>
        <span className="hud-item">📅 {year}年目</span>
        <span className="hud-item hud-money">💰 {state.money.toLocaleString()}円</span>
        {canApply && (
          <button
            type="button"
            className="pixel-btn hud-apply"
            onClick={() => update((s) => ({ ...s, appliedExamYear: year }))}
          >
            📮 宅建試験に応募する(6月末締切)
          </button>
        )}
        {year > START_YEAR && applied && <span className="hud-item">✅ 応募済み</span>}
        <span className="hud-item hud-date">
          <DateMeter month={month} day={day} />
        </span>
      </header>

      <TownView
        characters={characters}
        gender={state.gender}
        alertIds={alertIds}
        inputLocked={talkingTo !== null || examDue}
        onTapCharacter={setTalkingTo}
      />

      {talkingTo && !examDue && (
        <DialogueBox
          key={talkingTo.id + (pendingEvent?.id ?? '')}
          character={talkingTo}
          event={pendingEvent}
          onComplete={(eventId) =>
            update((s) => ({
              ...s,
              money: s.money + REWARD_CONSULT,
              experiencedEvents: s.experiencedEvents.some(
                (x) => x.eventId === eventId && x.year === year,
              )
                ? s.experiencedEvents
                : [...s.experiencedEvents, { eventId, year }],
            }))
          }
          onClose={() => setTalkingTo(null)}
        />
      )}

      {examDue && applied && (
        <ExamScreen
          year={year}
          firstYear={year === START_YEAR}
          questions={examQuestions}
          experiencedIds={experiencedIds}
          onFinish={finishExam}
          onDecline={() => update((s) => ({ ...s, lastExamYear: year }))}
        />
      )}

      {examDue && !applied && (
        <div className="exam-overlay" role="dialog" aria-label="試験のお知らせ">
          <div className="exam-panel">
            <h2 className="exam-title">📝 宅建試験(10月15日)</h2>
            <p>
              今日は試験日だが…応募していないので今年は受けられない。
              <br />
              来年は6月末までに応募しよう。
            </p>
            <div className="exam-actions">
              <button
                type="button"
                className="pixel-btn"
                onClick={() => update((s) => ({ ...s, lastExamYear: year }))}
              >
                わかった…
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
