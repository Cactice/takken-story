import { useEffect, useReducer, useRef } from 'react'
import { characterSpriteStyle } from '../../lib/sprites'
import {
  DUMMY_PROPERTIES,
  HP_MAX,
  HP_TICK_MS,
  brokerageFee,
  briefingLines,
  contractedProperty,
  disclosureFor,
  hagetaCommentFor,
  initTour,
  reactionTo,
  tourReducer,
} from '../../lib/tour'
import type { Newcomer, TourProperty, TourState } from '../../lib/tour'
import './tour.css'

// content/newcomers/*.json をビルド時に取り込む
const newcomerModules = import.meta.glob<{ default: Newcomer }>('../../../content/newcomers/*.json', {
  eager: true,
})
export const newcomers: Newcomer[] = Object.values(newcomerModules).map((m) => m.default)

export interface TourResult {
  success: boolean
  /** 成立時の仲介手数料(万円) */
  reward: number
  propertyId: string | null
}

interface Props {
  newcomer: Newcomer
  /** 案内して回る物件。将来はマップ上で選んだ物件IDから渡す */
  properties?: TourProperty[]
  /** ハゲタのメモ(学習ポイント)が発生した */
  onMemoEarned?: (topicId: string, title: string) => void
  onFinish: (result: TourResult) => void
}

const MOOD_FACE = { like: '😊', neutral: '😐', dislike: '😖' } as const

function SpecTable({ p }: { p: TourProperty }) {
  const rows: [string, string][] = [
    ['構造 / 階数', `${p.structure} / ${p.floors}階建て`],
    ['築年数 / 面積', `築${p.ageYears}年 / ${p.area}平米`],
    ['用途地域', p.zoning],
    ['建蔽率 / 容積率', `${p.buildingCoverage}% / ${p.floorAreaRatio}%`],
    ['賃料', `月${p.rent}万円`],
    ['敷金 / 礼金', `${p.depositMonths}ヶ月 / ${p.keyMoneyMonths}ヶ月`],
    ['設備・特徴', p.features.join('、')],
    ['注意点', p.legalNotes.join('。')],
  ]
  return (
    <table className="tour-spec">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <th scope="row">{k}</th>
            <td>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function HpBar({ hp, name }: { hp: number; name: string }) {
  const pct = Math.round((hp / HP_MAX) * 100)
  const tone = pct > 50 ? 'good' : pct > 20 ? 'warn' : 'bad'
  return (
    <div className="tour-hp">
      <span className="tour-hp-label">
        {name}の機嫌 {pct}%
      </span>
      <span className="tour-hp-track">
        <span className={`tour-hp-fill is-${tone}`} style={{ transform: `scaleX(${pct / 100})` }} />
      </span>
    </div>
  )
}

export function TourScreen({ newcomer, properties = DUMMY_PROPERTIES, onMemoEarned, onFinish }: Props) {
  const [state, dispatch] = useReducer(tourReducer, undefined, () => initTour(newcomer, properties))

  // 発行済みメモ数。増えた分だけコールバックを呼ぶ
  const sentMemos = useRef(0)
  useEffect(() => {
    for (const memo of state.memos.slice(sentMemos.current)) onMemoEarned?.(memo.topicId, memo.title)
    sentMemos.current = state.memos.length
  }, [state.memos, onMemoEarned])

  // 時間経過でHPが減る(ツアー中のみ)
  const running = state.phase.kind !== 'done'
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => dispatch({ type: 'tick' }), HP_TICK_MS)
    return () => clearInterval(id)
  }, [running])

  // 操作は矢印キーとスペースのみ
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowLeft'].includes(e.key)) {
        e.preventDefault()
        dispatch({ type: 'move', delta: -1 })
      } else if (['ArrowDown', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
        dispatch({ type: 'move', delta: 1 })
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        dispatch({ type: 'advance' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="tour-overlay" role="dialog" aria-label="物件案内">
      <div className="tour-panel">
        <header className="tour-head">
          <span className="tour-sprite" style={characterSpriteStyle(newcomer.id)} />
          <span className="tour-name">
            {newcomer.name}({newcomer.age}歳)
          </span>
          <HpBar hp={state.hp} name={newcomer.name} />
        </header>

        <TourBody state={state} onFinish={onFinish} />

        <p className="tour-hint">矢印で選択 / スペースで進む</p>
      </div>
    </div>
  )
}

function TourBody({ state, onFinish }: { state: TourState; onFinish: (r: TourResult) => void }) {
  const ph = state.phase
  const n = state.newcomer

  if (ph.kind === 'briefing') {
    const lines = briefingLines(n)
    return (
      <section className="tour-scene">
        <h2 className="tour-title">🏢 ひばり不動産 — 面談</h2>
        <p className="tour-line">{lines[ph.line]}</p>
        <span className="tour-next" aria-hidden="true">
          ▼
        </span>
      </section>
    )
  }

  if (ph.kind === 'visit') {
    const p = state.properties[ph.index]
    const r = reactionTo(n, p)
    const comment = hagetaCommentFor(p, n.id)
    return (
      <section className="tour-scene">
        <h2 className="tour-title">
          🏠 {ph.index + 1}件目 / {state.properties.length}件 — {p.name}
        </h2>
        <SpecTable p={p} />
        {ph.step !== 'spec' && (
          <p className={`tour-line tour-reaction is-${r.mood}`}>
            {MOOD_FACE[r.mood]} {n.name}「{r.line}」
          </p>
        )}
        {ph.step === 'hageta' && comment && <p className="tour-line tour-hageta">{comment.text}</p>}
        <span className="tour-next" aria-hidden="true">
          ▼
        </span>
      </section>
    )
  }

  if (ph.kind === 'choose') {
    return (
      <section className="tour-scene">
        <h2 className="tour-title">📝 どの物件で契約する?</h2>
        <ul className="tour-choices">
          {state.properties.map((p, i) => {
            const r = reactionTo(n, p)
            return (
              <li key={p.id}>
                <span className={`tour-choice ${i === ph.sel ? 'is-key-selected' : ''}`}>
                  {MOOD_FACE[r.mood]} {p.name}(月{p.rent}万円)
                </span>
              </li>
            )
          })}
        </ul>
      </section>
    )
  }

  if (ph.kind === 'disclosure') {
    const p = contractedProperty(state)
    const item = disclosureFor(p)[ph.index]
    return (
      <section className="tour-scene">
        <h2 className="tour-title">
          📄 重要事項説明(35条書面) {ph.index + 1}/3
        </h2>
        <p className="tour-line">
          <strong>{item.heading}</strong>
          <br />
          ハゲタ「{item.text}」
        </p>

        {ph.step !== 'read' && (
          <p className="tour-line tour-reaction">
            ❓ {n.name}「{item.question.ask}」
          </p>
        )}

        {ph.step === 'question' && (
          <ul className="tour-choices">
            {item.question.choices.map((c, i) => (
              <li key={c}>
                <span className={`tour-choice ${i === ph.sel ? 'is-key-selected' : ''}`}>{c}</span>
              </li>
            ))}
          </ul>
        )}

        {ph.step === 'feedback' && (
          <p className="tour-line">
            <strong className={ph.correct ? 'tour-ok' : 'tour-ng'}>
              {ph.correct ? '✅ 正しく答えられた!' : '❌ 誤答… 機嫌が下がった'}
            </strong>
            <br />
            ハゲタ「{item.question.explain}」
          </p>
        )}
        <span className="tour-next" aria-hidden="true">
          ▼
        </span>
      </section>
    )
  }

  // done
  const p = state.contractedId ? contractedProperty(state) : null
  return (
    <section className="tour-scene">
      <h2 className="tour-title">{ph.success ? '🎉 契約成立!' : '💔 契約は流れた…'}</h2>
      <p className="tour-line">
        {ph.success && p
          ? `${n.name}「${p.name}に決めました! ありがとうございます」\nハゲタ「よくやった。仲介手数料は賃料1ヶ月分、${brokerageFee(p)}万円だ」`
          : `${n.name}「…すみません、今日は帰ります」\nハゲタ「客の機嫌を切らしたな。要望に合う物件だけ見せろ」`}
      </p>
      <button
        type="button"
        className="pixel-btn is-key-selected"
        onClick={() =>
          onFinish({ success: ph.success, reward: state.reward, propertyId: state.contractedId })
        }
      >
        もどる
      </button>
    </section>
  )
}
