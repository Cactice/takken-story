import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Diagram } from '../components/diagram/Diagram'
import { characterSpriteStyle } from '../lib/sprites'
import {
  ALL_CHARACTERS,
  ALL_EVENTS,
  CATEGORIES,
  CATEGORY_LABEL,
  FAMILIES,
  GENERATIONS,
  KINDS,
  KIND_LABEL,
  TOPICS,
  castOf,
  characterName,
  familyGroupOf,
  haystack,
  relationLabel,
  spouseOf,
} from './data'
import type { DebugCharacter, DebugEvent } from './data'
import './debug.css'

type Tab = 'events' | 'characters'

/**
 * 暦は主一の生年1000年が基準。各世代の主人公は世代開始年に15歳。
 * 1000 / 1030 / 1060 / 1090 / 1120年生まれ
 */
const PLAYER_BIRTH: Record<number, number> = { 1: 1000, 2: 1030, 3: 1060, 4: 1090, 5: 1120 }

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
  const [character, setCharacter] = useState<DebugCharacter | null>(null)

  const shown = useMemo(() => ALL_EVENTS.filter((e) => matches(e, filters)), [filters])
  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }))

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

      <div className="dbg-split">
        {tab === 'events' ? (
          <>
            <div className="dbg-left">
              <FilterBar
                filters={filters}
                set={set}
                onReset={() => setFilters(EMPTY)}
                count={shown.length}
              />
              <EventList events={shown} selected={event} onPick={setEvent} />
            </div>
            <div className="dbg-right">
              {event ? (
                <Player event={event} />
              ) : (
                <p className="dbg-empty">左の一覧からイベントを選ぶと、ここで再生します。</p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="dbg-left">
              <FamilyList selected={character} onPick={setCharacter} />
            </div>
            <div className="dbg-right">
              {character ? (
                <CharacterDetail
                  character={character}
                  onPickCharacter={setCharacter}
                  onPickEvent={(e) => {
                    setEvent(e)
                    setTab('events')
                  }}
                />
              ) : (
                <p className="dbg-empty">左の家系から人物を選んでください。</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * 一覧の ↑↓ 移動。会話ウィンドウも window で ↑↓ を拾うので、
 * 一覧にフォーカスがあるときは stopPropagation して右ペインへ渡さない。
 */
function useListKeys<T>(items: readonly T[], selected: T | null, onPick: (item: T) => void) {
  return (e: ReactKeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    e.stopPropagation()
    const i = selected ? items.indexOf(selected) : -1
    const next = e.key === 'ArrowDown' ? i + 1 : i - 1
    const target = items[next] ?? (next < 0 ? items[0] : undefined)
    if (target !== undefined) onPick(target)
  }
}

/** 選択が一覧の外に出ていたらスクロールして見せる */
function useScrollIntoView<T extends HTMLElement>(dep: unknown) {
  const ref = useRef<T>(null)
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest' })
  }, [dep])
  return ref
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

interface EventListProps {
  events: DebugEvent[]
  selected: DebugEvent | null
  onPick: (e: DebugEvent) => void
}

function EventList({ events, selected, onPick }: EventListProps) {
  const onKeyDown = useListKeys(events, selected, onPick)
  const rowRef = useScrollIntoView<HTMLTableRowElement>(selected)

  return (
    <div className="dbg-scroll" tabIndex={0} onKeyDown={onKeyDown} aria-label="イベント一覧">
      {events.length === 0 ? (
        <p className="dbg-empty">該当するイベントがありません。</p>
      ) : (
        <table className="dbg-table">
          <thead>
            <tr>
              <th>世代</th>
              <th>時期</th>
              <th>種類</th>
              <th>タイトル</th>
              <th>あらすじ</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr
                key={e.id}
                ref={e === selected ? rowRef : undefined}
                className={e === selected ? 'on' : ''}
                onClick={() => onPick(e)}
              >
                <td className="dbg-num">{e.generation}</td>
                <td className="dbg-when">{e.year ? `${e.year}年${e.month ?? 1}月` : '—'}</td>
                <td>
                  <span className={`dbg-kind kind-${e.kind}`}>{KIND_LABEL[e.kind] ?? e.kind}</span>
                </td>
                <td className="dbg-title">{e.title ?? e.id}</td>
                <td className="dbg-summary">{e.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/** セリフ「本文」を話者と中身に割る。話者名が無い行(ト書き)はそのまま出す */
function splitLine(line: string): { who?: string; text: string } {
  const m = line.match(/^(.+?)「([\s\S]*)」\s*$/)
  return m ? { who: m[1], text: m[2] } : { text: line }
}

/** イベントを一覧で読む。上から下までスクロールすれば、その回の話が全部読める */
function Player({ event }: { event: DebugEvent }) {
  return (
    <>
      <div className="dbg-meta">
        <h2>{event.title ?? event.id}</h2>
        <dl>
          <dt>世代</dt>
          <dd>第{event.generation}世代</dd>
          <dt>時期</dt>
          <dd>
            {event.year
              ? `${event.year}年${event.month ?? 1}月(主人公 ${event.year - PLAYER_BIRTH[event.generation]}歳)`
              : '—'}
          </dd>
          <dt>種類</dt>
          <dd>{KIND_LABEL[event.kind] ?? event.kind}</dd>
          <dt>分野</dt>
          <dd>{(event.category ?? []).map((c) => CATEGORY_LABEL[c] ?? c).join('・')}</dd>
          <dt>論点</dt>
          <dd className="dbg-topic">{event.topicId}</dd>
          <dt>登場人物</dt>
          <dd>{castOf(event).map(characterName).join('、')}</dd>
        </dl>
        <p className="dbg-summary">{event.summary}</p>
      </div>

      <section className="dbg-script">
        <h2>会話</h2>
        <ol className="dbg-lines">
          {event.dialogue.map((line, i) => {
            const { who, text } = splitLine(line)
            return (
              <li key={`${event.id}-d${i}`} className={who ? '' : 'note'}>
                {who && <b className="dbg-who">{who}</b>}
                <span>{text}</span>
              </li>
            )
          })}
        </ol>
      </section>

      <Quiz key={event.id} event={event} />

      {(event.playerLines?.length || event.thanksLine || event.resolvedLine) && (
        <section className="dbg-script">
          <h2>解いたあと</h2>
          <ol className="dbg-lines">
            {(event.playerLines ?? []).map((l, i) => (
              <li key={`${event.id}-p${i}`}>
                <b className="dbg-who">あなた</b>
                <span>{l}</span>
              </li>
            ))}
            {event.thanksLine && (
              <li>
                {(() => {
                  const { who, text } = splitLine(event.thanksLine)
                  return (
                    <>
                      {who && <b className="dbg-who">{who}</b>}
                      <span>{text}</span>
                    </>
                  )
                })()}
              </li>
            )}
            {event.resolvedLine && (
              <li className="note">
                <span>のちに — {splitLine(event.resolvedLine).text}</span>
              </li>
            )}
          </ol>
        </section>
      )}
    </>
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

interface FamilyListProps {
  selected: DebugCharacter | null
  onPick: (c: DebugCharacter) => void
}

/** ↑↓ 用のフラット順。折りたたんだ家系は飛ばす */
function visibleOrder(collapsed: ReadonlySet<string>): DebugCharacter[] {
  return FAMILIES.filter((g) => !collapsed.has(g.name)).flatMap((g) => g.members)
}

function FamilyList({ selected, onPick }: FamilyListProps) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const onKeyDown = useListKeys(visibleOrder(collapsed), selected, onPick)
  const itemRef = useScrollIntoView<HTMLLIElement>(selected)

  const toggle = (name: string) =>
    setCollapsed((s) => {
      const next = new Set(s)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

  return (
    <div className="dbg-scroll" tabIndex={0} onKeyDown={onKeyDown} aria-label="人物一覧">
      {FAMILIES.map((g) => (
        <section key={g.name} className="dbg-family">
          <button
            type="button"
            className="dbg-family-head"
            aria-expanded={!collapsed.has(g.name)}
            onClick={() => toggle(g.name)}
          >
            <span className="dbg-caret">{collapsed.has(g.name) ? '▶' : '▼'}</span>
            {g.name}
            <span className="dbg-family-count">{g.members.length}人</span>
          </button>
          {!collapsed.has(g.name) && (
            <ul className="dbg-chars">
              {g.members.map((c) => (
                <li key={c.id} ref={c === selected ? itemRef : undefined}>
                  <button
                    type="button"
                    className={`dbg-char ${c === selected ? 'on' : ''}`}
                    onClick={() => onPick(c)}
                  >
                    <span className="dbg-char-sprite" style={characterSpriteStyle(c.id)} />
                    <span className="dbg-char-body">
                      <b>{c.name}</b>
                      <span className="dbg-char-meta">
                        {c.birthYear != null && <span className="dbg-num">{c.birthYear}年生</span>}
                        <span>
                          第{c.appearsIn?.length ? c.appearsIn.join('・') : c.generation}世代
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}

interface CharacterDetailProps {
  character: DebugCharacter
  onPickCharacter: (c: DebugCharacter) => void
  onPickEvent: (e: DebugEvent) => void
}

function CharacterDetail({ character: c, onPickCharacter, onPickEvent }: CharacterDetailProps) {
  const appearances = ALL_EVENTS.filter((e) => castOf(e).includes(c.id))
  const family = familyGroupOf(c)
  const spouse = spouseOf(c)

  return (
    <div className="dbg-meta dbg-detail">
      <h2>
        <span className="dbg-char-sprite" style={characterSpriteStyle(c.id)} />
        {c.name}
      </h2>
      <dl>
        <dt>生年</dt>
        <dd className="dbg-num">{c.birthYear != null ? `${c.birthYear}年` : '—'}</dd>
        <dt>世代</dt>
        <dd>第{c.appearsIn?.length ? c.appearsIn.join('・') : c.generation}世代</dd>
        <dt>年齢</dt>
        <dd>{c.age != null ? `${c.age}歳` : '—'}</dd>
        <dt>職業</dt>
        <dd>{c.job ?? '—'}</dd>
        <dt>家系</dt>
        <dd>{family?.name ?? '—'}</dd>
        <dt>配偶者</dt>
        <dd>{spouse || '—'}</dd>
      </dl>
      {family && family.members.length > 1 && (
        <>
          <h3>{family.name}(生年順)</h3>
          <ol className="dbg-tree">
            {family.members.map((m) => (
              <li key={m.id} className={m.id === c.id ? 'on' : ''}>
                <button type="button" className="dbg-tree-row" onClick={() => onPickCharacter(m)}>
                  <span className="dbg-char-sprite" style={characterSpriteStyle(m.id)} />
                  <span className="dbg-num">{m.birthYear ?? '—'}</span>
                  <b>{m.name}</b>
                  <span className="dbg-rel">{relationLabel(c, m)}</span>
                  <span className="dbg-summary">{m.job}</span>
                </button>
              </li>
            ))}
          </ol>
        </>
      )}

      {family && family.story.length > 0 && (
        <>
          <h3>{family.name}の物語</h3>
          {family.story.map((p) => (
            <p key={p.slice(0, 24)} className="dbg-story">
              {p}
            </p>
          ))}
        </>
      )}

      {c.personality && (
        <>
          <h3>{c.name}の物語</h3>
          <p className="dbg-story">{c.personality}</p>
        </>
      )}

      {family && family.movement.length > 0 && (
        <>
          <h3>移動の型</h3>
          <ul className="dbg-movement">
            {family.movement.map((m) => (
              <li key={`${m.type}-${m.who ?? ''}`}>
                <span className="dbg-kind">{m.type}</span>
                {m.note && <span className="dbg-summary">{m.note}</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      <h3>出演イベント {appearances.length}件</h3>
      {appearances.length === 0 ? (
        <p className="dbg-summary">出演イベントはありません。</p>
      ) : (
        <ul className="dbg-appearances">
          {appearances.map((e) => (
            <li key={e.id}>
              <button type="button" className="dbg-appearance" onClick={() => onPickEvent(e)}>
                <span className={`dbg-kind kind-${e.kind}`}>{KIND_LABEL[e.kind] ?? e.kind}</span>
                <b>{e.title ?? e.id}</b>
                <span className="dbg-summary">{e.summary}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
