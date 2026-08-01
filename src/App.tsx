import { useCallback, useEffect, useState } from 'react'
import { TitleScreen } from './components/title/TitleScreen'
import { TownView } from './components/town/TownView'
import { DialogueBox } from './components/dialogue/DialogueBox'
import { ExamScreen, passLine } from './components/exam/ExamScreen'
import type { ExamAnswer } from './components/exam/ExamScreen'
import { DateMeter } from './components/hud/DateMeter'
import { TourScreen, newcomers } from './components/tour/TourScreen'
import type { Newcomer } from './lib/tour'
import { useGameClock } from './hooks/useGameClock'
import { characters, events } from './lib/content'
import { availableConsultations, buildYearSchedule } from './lib/schedule'
import { RomanceOverlay } from './components/romance/RomanceOverlay'
import { romanceContentFor, romanceStateOf, talkOnce } from './lib/romance'
import type { RomanceState } from './lib/romance'
import { loadState, saveState } from './lib/save'
import { playerSpriteStyle } from './lib/sprites'
import {
  APPLY_DEADLINE_MONTH,
  DAYS_PER_MONTH,
  EXAM_DAY,
  EXAM_MONTH,
  REWARD_CONSULT,
  MONEY_START,
  INITIAL_RESIDENTS,
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
  /** 案内中の転入者 */
  const [tourNewcomer, setTourNewcomer] = useState<Newcomer | null>(null)
  /** 転入者の案内を断った日 */
  const [tourDismissedDay, setTourDismissedDay] = useState(-1)

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

  // 試験・物件案内の表示中は時計を止める(表示中に月をまたがないように)
  useGameClock(state !== null && !examDue && tourNewcomer === null, tickDay)

  if (!state || !cal) {
    return (
      <TitleScreen
        hasSave={loadState() !== null}
        onStart={(gender: Gender) => {
          const fresh: GameState = {
            gender,
            daysElapsed: 0,
            money: MONEY_START,
            experiencedEvents: [],
            scheduleYear: START_YEAR,
            yearSchedule: buildYearSchedule(events, new Set(), []),
            retryEventIds: [],
            appliedExamYear: 0,
            lastExamYear: 0,
            examResults: [],
            residents: INITIAL_RESIDENTS,
          }
          saveState(fresh)
          setState(fresh)
        }}
        onContinue={() => setState(loadState())}
      />
    )
  }

  const { year, month, day } = calendarOf(state)
  // 村にいるのは開始時はハゲ田社長だけ。物件案内の契約成立で住民が増える
  const residentIds = new Set(state.residents ?? INITIAL_RESIDENTS)
  const residentCharacters = characters.filter((c) => residentIds.has(c.id))

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

  // 恋愛: 異性かつ romanceable な相手で、今日の相談がないときは恋愛会話に入る
  const romanceContent = talkingTo ? romanceContentFor(talkingTo.id, state.gender) : null
  const romanceOpen = romanceContent !== null && pendingEvent === null && !examDue
  /** 相手ごとの恋愛状態を差し替える */
  const updateRomance = (characterId: string, fn: (prev: RomanceState) => RomanceState) =>
    update((s) => ({
      ...s,
      romance: { ...s.romance, [characterId]: fn(romanceStateOf(s.romance, characterId)) },
    }))
  /** 会話を始めたら親密度が上がる(相談でも雑談でも) */
  const openTalk = (c: Character) => {
    setTalkingTo(c)
    if (romanceContentFor(c.id, state.gender)) updateRomance(c.id, talkOnce)
  }
  // TODO: 結婚 → 出産 → 世代交代(別途実装)
  const onRelationshipMaxed = (characterId: string) => void characterId

  // 1年目はハゲタ社長が自動申込。2年目以降は6月の確認ダイアログで応募
  const applied = year === START_YEAR || state.appliedExamYear === year
  const applyPromptOpen =
    !examDue &&
    talkingTo === null &&
    year > START_YEAR &&
    month === APPLY_DEADLINE_MONTH &&
    !applied &&
    applyDismissedYear !== year
  // 3ヶ月に1度、会社に転入者が来る
  // ponytail: 暫定トリガー。マップの会社に「!」が出せるようになったら、そこの入店処理から setTourNewcomer を呼べばよい
  const offeredNewcomer = newcomers[Math.floor(state.daysElapsed / (3 * DAYS_PER_MONTH)) % newcomers.length]
  const tourPromptOpen =
    !examDue &&
    !applyPromptOpen &&
    talkingTo === null &&
    tourNewcomer === null &&
    offeredNewcomer !== undefined &&
    day === 1 &&
    month % 3 === 1 &&
    tourDismissedDay !== state.daysElapsed

  const examQuestions = state.yearSchedule
    .map((s) => events.find((e) => e.id === s.eventId))
    .filter((e) => e !== undefined)
  const experiencedIds = new Set(state.experiencedEvents.map((e) => e.eventId))

  // 相談がないときは、その住民と最後に解決した論点の「あのときはありがとう」を話す
  const solvedLine =
    talkingTo === null || pendingEvent !== null
      ? undefined
      : [...state.experiencedEvents]
          .reverse()
          .map((x) => events.find((e) => e.id === x.eventId))
          .find((e) => e !== undefined && e.characterId === talkingTo.id)?.resolvedLine

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
        <span className="hud-item hud-money">💰 {state.money.toLocaleString()}万円</span>
        {year > START_YEAR && applied && <span className="hud-item">✅ 応募済み</span>}
        <span className="hud-item hud-date">
          <DateMeter month={month} day={day} />
        </span>
      </header>

      <TownView
        characters={residentCharacters}
        gender={state.gender}
        alertIds={alertIds}
        inputLocked={
          talkingTo !== null || examDue || applyPromptOpen || tourPromptOpen || tourNewcomer !== null
        }
        onTapCharacter={openTalk}
      />

      {talkingTo && !examDue && !romanceOpen && (
        <DialogueBox
          key={talkingTo.id + (pendingEvent?.id ?? '')}
          character={talkingTo}
          event={pendingEvent}
          gender={state.gender}
          smallTalk={solvedLine}
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

      {romanceOpen && talkingTo && romanceContent && (
        <RomanceOverlay
          key={talkingTo.id}
          character={talkingTo}
          content={romanceContent}
          st={romanceStateOf(state.romance, talkingTo.id)}
          gender={state.gender}
          onUpdate={(fn) => updateRomance(talkingTo.id, fn)}
          onRelationshipMaxed={onRelationshipMaxed}
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

      {tourPromptOpen && (
        <PromptOverlay
          title="🏢 会社に転入者が来ている"
          body={`ハゲタ「新人、${offeredNewcomer.name}さんが村に越してくる。\n物件を案内してやれ」`}
          options={[
            { label: '案内する', onPick: () => setTourNewcomer(offeredNewcomer) },
            { label: 'あとにする', onPick: () => setTourDismissedDay(state.daysElapsed) },
          ]}
        />
      )}

      {tourNewcomer && (
        <TourScreen
          key={tourNewcomer.id}
          newcomer={tourNewcomer}
          onFinish={({ reward }) => {
            // 契約成立(報酬あり)= その転入者が村に住み着く
            if (reward > 0)
              update((s) => ({
                ...s,
                money: s.money + reward,
                residents: [...(s.residents ?? INITIAL_RESIDENTS), tourNewcomer.id],
              }))
            setTourDismissedDay(state.daysElapsed)
            setTourNewcomer(null)
          }}
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
