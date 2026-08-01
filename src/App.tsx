import { useCallback, useEffect, useState } from 'react'
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

interface PromptOption {
  label: string
  onPick: () => void
}

/** 矢印+スペースだけで操作できる確認ダイアログ(exam.css のスタイルを流用) */
function PromptOverlay({ title, body, options }: { title: string; body: string; options: PromptOption[] }) {
  const [sel, setSel] = useState(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
        const delta = e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? options.length - 1 : 1
        setSel((s) => (s + delta) % options.length)
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        options[sel].onPick()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="exam-overlay" role="dialog" aria-label={title}>
      <div className="exam-panel">
        <h2 className="exam-title">{title}</h2>
        <p style={{ whiteSpace: 'pre-line' }}>{body}</p>
        <div className="exam-actions">
          {options.map((o, i) => (
            <button
              key={o.label}
              type="button"
              className={`pixel-btn ${i > 0 ? 'pixel-btn-secondary' : ''} ${i === sel ? 'is-key-selected' : ''}`}
              onClick={o.onPick}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="exam-hint">矢印で選択 / スペースで決定</p>
      </div>
    </div>
  )
}

export default function App() {
  const [state, setState] = useState<GameState | null>(null)
  const [talkingTo, setTalkingTo] = useState<Character | null>(null)
  /** 応募ダイアログを「今年は受けない」で閉じた年(未セーブ。リロードで再表示されるだけ) */
  const [applyDismissedYear, setApplyDismissedYear] = useState(0)

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

  // 1年目はハゲタ社長が自動申込。2年目以降は6月の確認ダイアログで応募
  const applied = year === START_YEAR || state.appliedExamYear === year
  const applyPromptOpen =
    !examDue &&
    talkingTo === null &&
    year > START_YEAR &&
    month === APPLY_DEADLINE_MONTH &&
    !applied &&
    applyDismissedYear !== year
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
        {year > START_YEAR && applied && <span className="hud-item">✅ 応募済み</span>}
        <span className="hud-item hud-date">
          <DateMeter month={month} day={day} />
        </span>
      </header>

      <TownView
        characters={characters}
        gender={state.gender}
        alertIds={alertIds}
        inputLocked={talkingTo !== null || examDue || applyPromptOpen}
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

      {applyPromptOpen && (
        <PromptOverlay
          title="📮 宅建試験の応募(6月末締切)"
          body={'ハゲタ「おい、今年の試験の応募はどうする?\n締切は今月末だぞ」'}
          options={[
            { label: '応募する', onPick: () => update((s) => ({ ...s, appliedExamYear: year })) },
            { label: '今年は受けない', onPick: () => setApplyDismissedYear(year) },
          ]}
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
        <PromptOverlay
          title="📝 宅建試験(10月15日)"
          body={'今日は試験日だが…応募していないので今年は受けられない。\n来年は6月末までに応募しよう。'}
          options={[
            { label: 'わかった…', onPick: () => update((s) => ({ ...s, lastExamYear: year })) },
          ]}
        />
      )}
    </div>
  )
}
