import { useMemo, useState } from 'react'
import { DialogueBox } from '../components/dialogue/DialogueBox'
import { Diagram } from '../components/diagram/Diagram'
import { characterSpriteStyle } from '../lib/sprites'
import {
  ALL_CHARACTERS,
  ALL_EVENTS,
  CATEGORIES,
  CATEGORY_LABEL,
  GENERATIONS,
  KINDS,
  KIND_LABEL,
  TOPICS,
  castOf,
  characterName,
  haystack,
  speakerCharacter,
  spouseOf,
} from './data'
import type { DebugCharacter, DebugEvent } from './data'
import './debug.css'

type Tab = 'events' | 'characters'
type Phase = 'list' | 'play' | 'exam'

interface Filters {
  generation: string
  kind: string
  category: string
  topicId: string
  characterId: string
  q: string
}

const EMPTY: Filters = { generation: '', kind: '', category: '', topicId: '', characterId: '', q: '' }

function matches(e: DebugEvent, f: Filters): boolean {
  if (f.generation && String(e.generation) !== f.generation) return false
  if (f.kind && e.kind !== f.kind) return false
  if (f.category && !(e.category ?? []).includes(f.category)) return false
  if (f.topicId && e.topicId !== f.topicId) return false
  if (f.characterId && !castOf(e).includes(f.characterId)) return false
  if (f.q && !haystack(e).toLowerCase().includes(f.q.toLowerCase())) return false
  return true
}

export function DebugScreen() {
  const [tab, setTab] = useState<Tab>('events')
  const [filters, setFilters] = useState<Filters>(EMPTY)
  const [event, setEvent] = useState<DebugEvent | null>(null)
  const [phase, setPhase] = useState<Phase>('list')
  /** 再生をやり直すたびに変える。DialogueBox の内部インデックスを初期化するための key */
  const [take, setTake] = useState(0)

  const shown = useMemo(() => ALL_EVENTS.filter((e) => matches(e, filters)), [filters])
  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }))

  const play = (e: DebugEvent) => {
    setEvent(e)
    setPhase('play')
    setTake((n) => n + 1)
  }

  if (phase !== 'list' && event) {
    return (
      <Player
        event={event}
        phase={phase}
        take={take}
        onFinish={() => setPhase('exam')}
        onClose={() => setPhase((p) => (p === 'exam' ? p : 'list'))}
        onReplay={() => play(event)}
        onBack={() => setPhase('list')}
      />
    )
  }

  return (
    <div className="dbg">
      <header className="dbg-head">
        <h1>禿鷹の野帳 — イベント確認</h1>
        <nav className="dbg-tabs">
          <button
            type="button"
            className={tab === 'events' ? 'on' : ''}
            onClick={() => setTab('events')}
          >
            イベント {ALL_EVENTS.length}
          </button>
          <button
            type="button"
            className={tab === 'characters' ? 'on' : ''}
            onClick={() => setTab('characters')}
          >
            人物 {ALL_CHARACTERS.length}
          </button>
        </nav>
      </header>

      {tab === 'events' ? (
        <>
          <FilterBar filters={filters} set={set} onReset={() => setFilters(EMPTY)} count={shown.length} />
          <EventTable events={shown} onPick={play} />
        </>
      ) : (
        <CharacterGrid
          onPick={(c) => {
            setFilters({ ...EMPTY, characterId: c.id })
            setTab('events')
          }}
        />
      )}
    </div>
  )
}

interface FilterBarProps {
  filters: Filters
  set: (patch: Partial<Filters>) => void
  onReset: () => void
  count: number
}

function FilterBar({ filters, set, onReset, count }: FilterBarProps) {
  return (
    <div className="dbg-filters">
      <label>
        世代
        <select value={filters.generation} onChange={(e) => set({ generation: e.target.value })}>
          <option value="">すべて</option>
          {GENERATIONS.map((g) => (
            <option key={g} value={g}>
              第{g}世代
            </option>
          ))}
        </select>
      </label>
      <label>
        種類
        <select value={filters.kind} onChange={(e) => set({ kind: e.target.value })}>
          <option value="">すべて</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k] ?? k}
            </option>
          ))}
        </select>
      </label>
      <label>
        分野
        <select value={filters.category} onChange={(e) => set({ category: e.target.value })}>
          <option value="">すべて</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c] ?? c}
            </option>
          ))}
        </select>
      </label>
      <label>
        論点
        <select value={filters.topicId} onChange={(e) => set({ topicId: e.target.value })}>
          <option value="">すべて</option>
          {TOPICS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label>
        人物
        <select value={filters.characterId} onChange={(e) => set({ characterId: e.target.value })}>
          <option value="">すべて</option>
          {ALL_CHARACTERS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}(第{c.generation}世代)
            </option>
          ))}
        </select>
      </label>
      <label className="dbg-search">
        検索
        <input
          type="search"
          value={filters.q}
          placeholder="タイトル・あらすじ・セリフ・解説"
          onChange={(e) => set({ q: e.target.value })}
        />
      </label>
      <button type="button" className="dbg-btn" onClick={onReset}>
        条件をクリア
      </button>
      <span className="dbg-count">{count} 件</span>
    </div>
  )
}

function EventTable({ events, onPick }: { events: DebugEvent[]; onPick: (e: DebugEvent) => void }) {
  if (events.length === 0) return <p className="dbg-empty">該当するイベントがありません。</p>
  return (
    <table className="dbg-table">
      <thead>
        <tr>
          <th>世代</th>
          <th>種類</th>
          <th>分野</th>
          <th>論点</th>
          <th>タイトル</th>
          <th>あらすじ</th>
          <th>登場人物</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {events.map((e) => (
          <tr key={e.id} onClick={() => onPick(e)}>
            <td className="dbg-num">{e.generation}</td>
            <td>
              <span className={`dbg-kind kind-${e.kind}`}>{KIND_LABEL[e.kind] ?? e.kind}</span>
            </td>
            <td>{(e.category ?? []).map((c) => CATEGORY_LABEL[c] ?? c).join('・')}</td>
            <td className="dbg-topic">{e.topicId}</td>
            <td className="dbg-title">{e.title ?? e.id}</td>
            <td className="dbg-summary">{e.summary}</td>
            <td className="dbg-cast">{castOf(e).map(characterName).join('、')}</td>
            <td>
              <button type="button" className="dbg-btn dbg-play">
                ▶ 再生
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

interface PlayerProps {
  event: DebugEvent
  phase: Phase
  take: number
  onFinish: () => void
  onClose: () => void
  onReplay: () => void
  onBack: () => void
}

function Player({ event, phase, take, onFinish, onClose, onReplay, onBack }: PlayerProps) {
  return (
    <div className="dbg dbg-stage">
      <header className="dbg-head">
        <button type="button" className="dbg-btn" onClick={onBack}>
          ← 一覧へ戻る
        </button>
        <h1>
          {event.title ?? event.id}
          <small>
            第{event.generation}世代 / {KIND_LABEL[event.kind] ?? event.kind} / {event.topicId}
          </small>
        </h1>
        <button type="button" className="dbg-btn" onClick={onReplay}>
          ↻ もう一度再生
        </button>
      </header>

      {phase === 'play' ? (
        <DialogueBox
          key={`${event.id}-${take}`}
          character={speakerCharacter(event)}
          event={event}
          gender="male"
          onComplete={onFinish}
          onClose={onClose}
        />
      ) : (
        <Quiz event={event} />
      )}
    </div>
  )
}

function Quiz({ event }: { event: DebugEvent }) {
  const [picked, setPicked] = useState<number | null>(null)
  return (
    <section className="dbg-quiz">
      <h2>試験問題</h2>
      <p className="dbg-quiz-q">{event.title ?? event.topicId}</p>
      <ol className="dbg-choices">
        {event.choices.map((c, i) => {
          const state =
            picked === null ? '' : i === event.correctChoice ? 'ok' : i === picked ? 'ng' : ''
          return (
            <li key={c}>
              <button type="button" className={`dbg-choice ${state}`} onClick={() => setPicked(i)}>
                <span className="dbg-num">{i + 1}</span>
                {c}
                {picked !== null && i === event.correctChoice && <b> ← 正解</b>}
              </button>
            </li>
          )
        })}
      </ol>
      {picked !== null && (
        <div className="dbg-explain">
          <strong>💡 解説</strong>
          {event.diagram && <Diagram spec={event.diagram} size="lg" />}
          <p>{event.explanation}</p>
        </div>
      )}
      <details className="dbg-raw">
        <summary>JSON を見る</summary>
        <pre>{JSON.stringify(event, null, 2)}</pre>
      </details>
    </section>
  )
}

function CharacterGrid({ onPick }: { onPick: (c: DebugCharacter) => void }) {
  return (
    <ul className="dbg-chars">
      {ALL_CHARACTERS.map((c) => {
        const spouse = spouseOf(c)
        const gens = c.appearsIn?.length ? c.appearsIn.join('・') : String(c.generation)
        return (
          <li key={c.id}>
            <button type="button" className="dbg-char" onClick={() => onPick(c)}>
              <span className="dbg-char-sprite" style={characterSpriteStyle(c.id)} />
              <span className="dbg-char-body">
                <b>{c.name}</b>
                <span className="dbg-char-meta">
                  {c.birthYear != null && <span>{c.birthYear}年生</span>}
                  <span>第{gens}世代</span>
                  {c.age != null && <span>{c.age}歳</span>}
                </span>
                {c.job && <span className="dbg-char-job">{c.job}</span>}
                <span className="dbg-char-meta">
                  {c.family && <span>{c.family}</span>}
                  {spouse && <span>配偶者: {spouse}</span>}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
