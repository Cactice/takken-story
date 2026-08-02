import { useCallback, useEffect, useState } from 'react'
import { TitleScreen } from './components/title/TitleScreen'
import { TownView } from './components/town/TownView'
import { DialogueBox } from './components/dialogue/DialogueBox'
import { ExamScreen, passLine } from './components/exam/ExamScreen'
import type { ExamAnswer } from './components/exam/ExamScreen'
import { DateMeter } from './components/hud/DateMeter'
import { HpBar, TourScreen } from './components/tour/TourScreen'
import {
  HP_TICK_MS,
  followerLine,
  hagetaCommentFor,
  hpDeltaFor,
  householdReaction,
  initTour,
  isCandidate,
  isInspected,
  toTourProperty,
  tourReducer,
} from './lib/tour'
import type {
  HagetaComment,
  HouseholdReaction,
  TourAction,
  TourHousehold,
  TourMember,
  TourProperty,
  TourState,
} from './lib/tour'
import type { Follower } from './lib/follower'
import { propertyById } from './lib/properties'
import { FollowerTalk } from './components/tour/FollowerTalk'
import { MemoBook } from './components/memo/MemoBook'
import { HomeInterior } from './components/home/HomeInterior'
import { MAP_OF_GENERATION, ARIKITA } from './lib/maps'
import type { GameMap } from './lib/maps'
import { arrivalStaging, openingStaging } from './lib/staging'
import type { Staging } from './lib/staging'
import { GenerationSelect } from './components/generation/GenerationSelect'
import { seasonOfMonth } from './lib/maps'
import { useGameClock } from './hooks/useGameClock'
import { characters, events, households, loadGeneration } from './lib/content'
import { availableConsultations, buildYearSchedule } from './lib/schedule'
import { RomanceOverlay } from './components/romance/RomanceOverlay'
import { romanceContentFor, romanceStateOf, talkOnce } from './lib/romance'
import type { RomanceState } from './lib/romance'
import { saveState } from './lib/save'
import { playerSpriteStyle } from './lib/sprites'
import { smallTalkFor } from './lib/smalltalk'
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

/** 転入者が村に入ってくる入口(北の端の中央)と、歩いてきて立ち止まる場所 */
const gateOf = (map: GameMap): [number, number] => [Math.floor(map.cols / 2), 0]
const arrivalSpotOf = (map: GameMap): [number, number] => [map.start[0], map.start[1]]

/** 建物の入口の前(住民を立たせる場所)。埋まっているタイルは避ける */
function frontOfBuilding(
  map: GameMap,
  id: string,
  taken: ReadonlySet<string> = new Set(),
): [number, number] | undefined {
  const b = map.buildings.find((x) => x.id === id)
  if (!b) return undefined
  const [ex, ey] = b.entrance
  const around: [number, number][] = [
    [ex, ey + 1],
    [ex - 1, ey + 1],
    [ex + 1, ey + 1],
    [ex - 1, ey],
    [ex + 1, ey],
    [ex, ey + 2],
  ]
  return around.find(
    ([x, y]) => map.inBounds(x, y) && !map.isSolid(x, y) && !taken.has(`${x},${y}`),
  )
}

/** 後ろに連なるハゲ田のメモの最大数(これ以上は棚に置いてある扱い) */
const MAX_BOOKS = 6

const MOOD_FACE = { like: '😊', meh: '😐', dislike: '😖' } as const

/** 内見結果の読み上げ文。メンバー全員の反応 → 機嫌の増減 → ハゲタの解説 */
function inspectionText(x: {
  hr: HouseholdReaction
  delta: number
  comment: HagetaComment | null
}): string {
  const lines = x.hr.each.map(
    ({ member, reaction }) => `${MOOD_FACE[reaction.mood]} ${member.name}「${reaction.line}」`,
  )
  if (x.hr.each.length > 1) lines.push(x.hr.line)
  lines.push(
    x.delta > 0
      ? `💗 機嫌が +${x.delta} 上がった。この物件は契約候補だ(もう一度スペースで契約に進める)`
      : `💢 機嫌が ${x.delta} 下がった。合わない物件を見せると客は疲れる`,
  )
  if (x.comment) lines.push('', x.comment.text)
  return lines.join('\n')
}

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

/**
 * URLクエリで選択画面をスキップする(デバッグ用)。
 * 例: ?generation=1&gender=boy  → 世代選択と性別選択を飛ばして開始
 * gender は boy/girl / male/female / 男/女 を受ける
 */
function debugParams(): { generation: number | null; gender: Gender | null } {
  const q = new URLSearchParams(window.location.search)
  const g = Number(q.get('generation'))
  const raw = (q.get('gender') ?? '').toLowerCase()
  const gender: Gender | null =
    raw === 'boy' || raw === 'male' || raw === '男'
      ? 'male'
      : raw === 'girl' || raw === 'female' || raw === '女'
        ? 'female'
        : null
  return { generation: g >= 1 && g <= 5 ? g : null, gender }
}

export default function App() {
  const [state, setState] = useState<GameState | null>(null)
  const [talkingTo, setTalkingTo] = useState<Character | null>(null)
  /** 応募ダイアログを「今年は受けない」で閉じた年(未セーブ。リロードで再表示されるだけ) */
  const [applyDismissedYear, setApplyDismissedYear] = useState(0)
  /** 案内(物件案内)の状態。null = 案内していない */
  const [tour, setTour] = useState<TourState | null>(null)
  /** 転入世帯の案内が済んだ(または断った)日 */
  const [tourDismissedDay, setTourDismissedDay] = useState(-1)
  /** 再生中の演出イベント(オープニング・転入者の登場) */
  const [staging, setStaging] = useState<Staging | null>(null)
  /** 演出で歩いてきている転入世帯(follow でこの世帯の案内が始まる) */
  const [arriving, setArriving] = useState<TourHousehold | null>(null)
  /** 世代選択 → 性別選択 の順に出す */
  const debug = debugParams()
  const [chosenGeneration, setChosenGeneration] = useState<number | null>(() => {
    if (debug.generation !== null) loadGeneration(debug.generation)
    return debug.generation
  })
  /** 物件パネルを閉じた直後の物件ID(案内中なら内見/契約を聞く) */
  const [viewedProperty, setViewedProperty] = useState<string | null>(null)
  /** 内見した結果(メンバー全員の反応) */
  const [inspected, setInspected] = useState<{
    property: TourProperty
    hr: HouseholdReaction
    delta: number
    comment: HagetaComment | null
  } | null>(null)
  /** 追従キャラに話しかけた会話(世帯全員が順番に喋る) */
  const [followerTalk, setFollowerTalk] = useState<{ member: TourMember; text: string }[] | null>(null)
  /** ハゲ田のメモ(本)に話しかけたとき */
  const [memoPrompt, setMemoPrompt] = useState(false)
  const [memoOpen, setMemoOpen] = useState(false)
  /** 自宅の中にいるか。入ると持っていたメモが棚に並ぶ */
  const [insideHome, setInsideHome] = useState(false)
  /** 自宅の本棚を開いて復習中 */
  const [shelfOpen, setShelfOpen] = useState(false)

  const dispatchTour = useCallback(
    (a: TourAction) => setTour((t) => (t === null ? t : tourReducer(t, a))),
    [],
  )

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

  // 試験・面談/35条のオーバーレイ中は時計を止める(マップを歩いている間は進む)
  useGameClock(
    state !== null &&
      !examDue &&
      staging === null &&
      (tour === null || tour.phase.kind === 'map' || tour.phase.kind === 'arriving'),
    tickDay,
  )

  // 客の機嫌は時間で減っていく(マップを回っている間と35条の読み上げ中)
  const tourRunning =
    tour !== null && (tour.phase.kind === 'map' || tour.phase.kind === 'disclosure')
  useEffect(() => {
    if (!tourRunning) return
    const id = setInterval(() => dispatchTour({ type: 'tick' }), HP_TICK_MS)
    return () => clearInterval(id)
  }, [tourRunning, dispatchTour])

  // 3ヶ月に1度、転入希望者が村にやってくる。
  // 会社でモーダルを出すのではなく、画面外から歩いてきて勝手についてくる(docs/SYSTEMS.md)
  useEffect(() => {
    if (state === null || tour !== null || arriving !== null || staging !== null) return
    const { month: m, day: d } = calendarOf(state)
    if (d !== 1 || m % 3 !== 1 || tourDismissedDay === state.daysElapsed) return
    const hh = households[Math.floor(state.daysElapsed / (3 * DAYS_PER_MONTH)) % households.length]
    if (hh === undefined) return
    setArriving(hh)
    const map = MAP_OF_GENERATION[state.generation ?? 1] ?? ARIKITA
    setStaging(
      arrivalStaging(
        hh.members.map((m2) => ({ id: m2.id, name: m2.name })),
        arrivalSpotOf(map),
        gateOf(map),
      ),
    )
  }, [state, tour, arriving, staging, tourDismissedDay])

  const startGame = useCallback(
    (gender: Gender) => {
      const fresh: GameState = {
        gender,
        generation: chosenGeneration ?? 1,
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
      // 開始直後: 自宅 → 職場 → 最初の客 まで一続きの演出(これがそのままチュートリアル)。
      // ponytail: いまは第1世代の演出しか無い。他世代は即プレイ(その世代の演出はデータを足すだけ)
      const map = MAP_OF_GENERATION[chosenGeneration ?? 1] ?? ARIKITA
      const home = frontOfBuilding(map, 'player-home')
      const office = frontOfBuilding(map, 'hibari')
      if ((chosenGeneration ?? 1) !== 1 || !home || !office) return
      const first = households[0]
      if (first) setArriving(first)
      setStaging(
        openingStaging(
          { homeFront: home, officeFront: office, gate: gateOf(map) },
          (first?.members ?? []).map((m) => ({ id: m.id, name: m.name })),
        ),
      )
    },
    [chosenGeneration],
  )

  // デバッグ: ?gender= が指定されていれば性別選択を飛ばして開始
  useEffect(() => {
    if (state === null && chosenGeneration !== null && debug.gender !== null) startGame(debug.gender)
  }, [state, chosenGeneration, debug.gender, startGame])

  if (!state || !cal) {
    // 世代選択 → 性別選択 → ゲーム開始
    if (chosenGeneration === null)
      return (
        <GenerationSelect
          // ponytail: 当面は全世代を解放(デバッグ用)。
          // 本来の解放条件に戻すときは「クリア済み世代+1」の Set をここで作る
          unlocked={new Set([1, 2, 3, 4, 5])}
          onSelect={(generation) => {
            loadGeneration(generation)
            setChosenGeneration(generation)
          }}
        />
      )
    return <TitleScreen onStart={startGame} />
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
  const examQuestions = state.yearSchedule
    .map((s) => events.find((e) => e.id === s.eventId))
    .filter((e) => e !== undefined)
  const experiencedIds = new Set(state.experiencedEvents.map((e) => e.eventId))

  // 相談がないときの雑談。引っ越したて → 解決済みのお礼 → 時期の話 → ふだんの雑談
  const resolvedLine =
    talkingTo === null || pendingEvent !== null
      ? undefined
      : [...state.experiencedEvents]
          .reverse()
          .map((x) => events.find((e) => e.id === x.eventId))
          .find((e) => e !== undefined && e.characterId === talkingTo.id)?.resolvedLine

  const movedInDay = talkingTo ? state.residentSince?.[talkingTo.id] : undefined
  const homeId = talkingTo ? state.residentHomes?.[talkingTo.id] : undefined
  const solvedLine =
    talkingTo === null || pendingEvent !== null
      ? undefined
      : smallTalkFor(talkingTo, {
          daysSinceMoveIn: movedInDay === undefined ? undefined : state.daysElapsed - movedInDay,
          homeName: homeId ? propertyById(homeId)?.name : undefined,
          home: homeId ? propertyById(homeId) : undefined,
          month,
          resolvedLine,
          // 話しかけるたび・日が変わるたびに変わる種(同じ文が連続しない)
          seed: state.daysElapsed + (state.romance?.[talkingTo.id]?.affection ?? 0),
        })

  /* ---------------- 追従とマップ上の内見 ---------------- */
  // 取得済みのメモ(eventId、取得順)。イベント解決時に GameState.memos へ積まれる想定。
  // まだ積まれていない旧セーブは、解決済みイベントから復元する
  const memoIds = state.memos ?? [...new Set(state.experiencedEvents.map((e) => e.eventId))]
  const shelvedIds = state.shelvedMemos ?? []
  /** まだ棚に並べていないメモ = 後ろについてくる本。自宅に入ると空になる */
  const carriedIds = memoIds.filter((id) => !shelvedIds.includes(id))
  // 連なりすぎても邪魔なので、ついてくる冊数には上限を入れてある
  const bookCount = Math.min(carriedIds.length, MAX_BOOKS)
  const touringOnMap = tour !== null && (tour.phase.kind === 'map' || tour.phase.kind === 'arriving')
  const followers: Follower[] = [
    ...(touringOnMap && tour
      ? tour.household.members.map((m) => ({
          id: m.id,
          kind: 'member' as const,
          name: m.name,
          alert: tour.phase.kind === 'arriving',
        }))
      : []),
    ...Array.from({ length: bookCount }, (_, i) => ({ id: `memo-${i}`, kind: 'book' as const })),
  ]

  const gameMap = MAP_OF_GENERATION[state.generation ?? 1] ?? ARIKITA
  const occupancy = state.occupancy ?? {}
  /** 住民ID → 契約した家の前。空きが無ければ既定の立ち位置に落ちる */
  const homeSpots: Record<string, [number, number]> = {}
  {
    const taken = new Set<string>()
    for (const [charId, propId] of Object.entries(state.residentHomes ?? {})) {
      const spot = frontOfBuilding(gameMap, propId, taken)
      if (!spot) continue
      taken.add(`${spot[0]},${spot[1]}`)
      homeSpots[charId] = spot
    }
  }

  const tourOverlayOpen =
    tour !== null && tour.phase.kind !== 'map' && tour.phase.kind !== 'arriving'
  const viewedSpec = viewedProperty === null ? undefined : propertyById(viewedProperty)
  const viewedTourProperty =
    touringOnMap && tour?.phase.kind === 'map' && viewedSpec !== undefined
      ? toTourProperty(viewedSpec)
      : null
  const alreadyInspected =
    tour !== null && viewedTourProperty !== null && isInspected(tour, viewedTourProperty.id)
  const isFavourite =
    tour !== null && viewedTourProperty !== null && isCandidate(tour, viewedTourProperty.id)
  /** 満室の建物は内見できない(ハゲタが止める) */
  const viewedUnits = viewedSpec?.units ?? 1
  const viewedFull =
    viewedTourProperty !== null && (occupancy[viewedTourProperty.id] ?? 0) >= viewedUnits
  const inspectPromptOpen =
    viewedTourProperty !== null && inspected === null && !alreadyInspected && !viewedFull
  const contractPromptOpen =
    viewedTourProperty !== null && inspected === null && alreadyInspected && isFavourite && !viewedFull
  /** 内見済みだが気に入られなかった物件 */
  const rejectedPromptOpen =
    viewedTourProperty !== null && inspected === null && alreadyInspected && !isFavourite && !viewedFull

  /** 内見する: 全員の反応を出し、初回だけHPが動く */
  const doInspect = (p: TourProperty) => {
    if (tour === null) return
    const hr = householdReaction(tour.household, p)
    setInspected({
      property: p,
      hr,
      // 2回目以降はHPが変動しない
      delta: isInspected(tour, p.id) ? 0 : hpDeltaFor(hr),
      comment: hagetaCommentFor(p, tour.household.id),
    })
    dispatchTour({ type: 'inspect', property: p })
    setViewedProperty(null)
  }

  /**
   * 連れの誰かに話しかけると、ついてきている世帯全員が順番に一言ずつ話す。
   * 一列に並ぶと2人目以降に隣接できないので、話す相手は選ばせない。
   */
  const talkToFollower = (f: Follower) => {
    if (f.kind === 'book') return setMemoPrompt(true)
    if (tour === null) return
    // 面談前(ついてきているだけ)なら、話しかけると要望のヒアリングが始まる
    if (tour.phase.kind === 'arriving') return dispatchTour({ type: 'meet' })
    setFollowerTalk(
      tour.household.members.map((member) => ({ member, text: followerLine(tour, member) })),
    )
  }

  const eventsOf = (ids: readonly string[]) =>
    [...ids].reverse().map((id) => events.find((e) => e.id === id)).filter((e) => e !== undefined)
  /** ついてきている(まだ棚に並べていない)ハゲ田のメモ。新しい順 */
  const memoEvents = eventsOf(carriedIds)
  /** 自宅の棚に並んでいるメモ。新しい順 */
  const shelfEvents = eventsOf(shelvedIds)

  /** 自宅に入る: 持っていたメモが全部、部屋の棚に並ぶ(身軽になる) */
  const enterHome = () => {
    setInsideHome(true)
    update((s) => ({
      ...s,
      memos: memoIds,
      shelvedMemos: [...shelvedIds, ...carriedIds],
    }))
  }

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
        {/* 案内中だけ、客の機嫌をマップのHUDに常時出す */}
        {tour && (
          <span className="hud-item hud-hp">
            <HpBar hp={tour.hp} name={tour.household.label} />
          </span>
        )}
      </header>

      <TownView
        season={seasonOfMonth(month)}
        map={gameMap}
        characters={residentCharacters}
        gender={state.gender}
        alertIds={alertIds}
        companyAlert={arriving !== null || tour !== null}
        followers={followers}
        occupancy={occupancy}
        homeSpots={homeSpots}
        inputLocked={
          talkingTo !== null ||
          examDue ||
          applyPromptOpen ||
          tourOverlayOpen ||
          inspectPromptOpen ||
          contractPromptOpen ||
          rejectedPromptOpen ||
          viewedFull ||
          memoPrompt ||
          memoOpen ||
          insideHome ||
          inspected !== null ||
          followerTalk !== null
        }
        onTapCharacter={openTalk}
        staging={staging}
        onStageFollow={(actorId) => {
          // 歩いてきた転入者が追従列に加わる。最初の1人で案内(まだ面談前)が始まる
          if (arriving === null) return
          setTour((t) => t ?? initTour(arriving))
          void actorId
        }}
        onStagingEnd={() => {
          setStaging(null)
          setArriving(null)
          if (!state.openingDone) update((s) => ({ ...s, openingDone: true }))
        }}
        onTalkFollower={talkToFollower}
        // ponytail: 自宅は「向いてスペース → 物件パネル(ボロ屋のスペック)→ 閉じると中へ」。
        // TownView は別作業中で触れないので、既存の物件パネルの導線に相乗りしている
        onPropertyViewed={(id) => (id === 'player-home' ? enterHome() : setViewedProperty(id))}
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

      {tour && (
        <TourScreen
          key={tour.household.id}
          state={tour}
          dispatch={dispatchTour}
          onFinish={({ success, reward, propertyId, residentIds }) => {
            // 契約成立 = その世帯の全員が村に住み着き、建物の空き戸が1つ埋まる
            if (success)
              update((s) => {
                const residents = s.residents ?? INITIAL_RESIDENTS
                const occ = s.occupancy ?? {}
                const homes = s.residentHomes ?? {}
                return {
                  ...s,
                  money: s.money + reward,
                  residents: [...residents, ...residentIds.filter((id) => !residents.includes(id))],
                  occupancy: propertyId ? { ...occ, [propertyId]: (occ[propertyId] ?? 0) + 1 } : occ,
                  residentHomes: propertyId
                    ? { ...homes, ...Object.fromEntries(residentIds.map((id) => [id, propertyId])) }
                    : homes,
                  residentSince: {
                    ...(s.residentSince ?? {}),
                    ...Object.fromEntries(residentIds.map((id) => [id, s.daysElapsed])),
                  },
                }
              })
            setTourDismissedDay(state.daysElapsed)
            setTour(null)
          }}
        />
      )}

      {/* マップ上の内見: 物件パネルを閉じたあとに聞く */}
      {inspectPromptOpen && viewedTourProperty && (
        <PromptOverlay
          title={`🏠 ${viewedTourProperty.name}`}
          body={`${tour?.household.label}を連れている。\nこの物件を内見しますか?`}
          options={[
            { label: '内見する', onPick: () => doInspect(viewedTourProperty) },
            { label: 'やめておく', onPick: () => setViewedProperty(null) },
          ]}
        />
      )}

      {contractPromptOpen && viewedTourProperty && (
        <PromptOverlay
          title={`📝 ${viewedTourProperty.name}`}
          body={'内見ずみの物件だ。\nこの物件で契約に進みますか?(35条書面の読み上げになる)'}
          options={[
            {
              label: '契約に進む',
              onPick: () => {
                dispatchTour({ type: 'contract', property: viewedTourProperty })
                setViewedProperty(null)
              },
            },
            { label: 'まだ見て回る', onPick: () => setViewedProperty(null) },
          ]}
        />
      )}

      {viewedFull && viewedTourProperty && (
        <PromptOverlay
          title={`🚪 ${viewedTourProperty.name}`}
          body={'ハゲタ「そこは満室だ。空いてない部屋は案内できん。\n他をあたれ」'}
          options={[{ label: 'わかった', onPick: () => setViewedProperty(null) }]}
        />
      )}

      {rejectedPromptOpen && viewedTourProperty && (
        <PromptOverlay
          title={`🙅 ${viewedTourProperty.name}`}
          body={'内見ずみだが、この物件には乗り気ではない。\n(契約に進めるのは、気に入った物件だけだ)'}
          options={[{ label: 'ほかを探す', onPick: () => setViewedProperty(null) }]}
        />
      )}

      {inspected && (
        <PromptOverlay
          title={`👀 内見 — ${inspected.property.name}`}
          body={inspectionText(inspected)}
          options={[{ label: 'なるほど', onPick: () => setInspected(null) }]}
        />
      )}

      {followerTalk && <FollowerTalk lines={followerTalk} onClose={() => setFollowerTalk(null)} />}

      {memoPrompt && (
        <PromptOverlay
          title="📚 ハゲ田のメモ"
          body={`ハゲ田のメモが${bookCount}冊、ぱたぱたとついてくる。\n(自宅の棚に並べれば、いつでも復習できるはずだ)`}
          options={[
            {
              label: memoEvents.length > 0 ? '確認する' : '中身はまだ無い',
              onPick: () => {
                setMemoPrompt(false)
                if (memoEvents.length > 0) setMemoOpen(true)
              },
            },
            { label: 'やめておく', onPick: () => setMemoPrompt(false) },
          ]}
        />
      )}

      {memoOpen && <MemoBook memos={memoEvents} onClose={() => setMemoOpen(false)} />}

      {/* 自宅の中。棚に並んだメモを本棚の前のスペースで復習できる */}
      {insideHome && (
        <HomeInterior
          gender={state.gender}
          books={shelfEvents.map((e) => ({
            id: e.id,
            characterId: e.characterId,
            title: e.memo?.title ?? e.title,
          }))}
          locked={shelfOpen}
          onOpenShelf={() => shelfEvents.length > 0 && setShelfOpen(true)}
          onLeave={() => setInsideHome(false)}
        />
      )}

      {shelfOpen && <MemoBook memos={shelfEvents} onClose={() => setShelfOpen(false)} />}

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
