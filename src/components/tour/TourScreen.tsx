import { useEffect } from 'react'
import { characterSpriteStyle } from '../../lib/sprites'
import {
  HP_MAX,
  brokerageFee,
  briefingLines,
  contractedProperty,
  disclosureFor,
} from '../../lib/tour'
import type { TourAction, TourState } from '../../lib/tour'
import './tour.css'

export interface TourResult {
  success: boolean
  /** 成立時の仲介手数料(万円) */
  reward: number
  propertyId: string | null
  /** 契約成立で村の住民になるメンバー(世帯全員) */
  residentIds: string[]
}

interface Props {
  /** 案内の状態。物件を回る部分(phase: map)はマップ側が持つので、ここでは何も描かない */
  state: TourState
  dispatch: (a: TourAction) => void
  onFinish: (result: TourResult) => void
}

/** 客の機嫌バー。マップ上のHUDからも使う */
export function HpBar({ hp, name }: { hp: number; name: string }) {
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

export function TourScreen({ state, dispatch, onFinish }: Props) {
  // 物件を回っている間(map)と、ついてきているだけの間(arriving)はマップが主役
  const overlayOpen = state.phase.kind !== 'map' && state.phase.kind !== 'arriving'

  // 操作は矢印キーとスペースのみ
  useEffect(() => {
    if (!overlayOpen) return
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
  }, [overlayOpen, dispatch])

  // 物件を回っている間はマップが主役。オーバーレイは出さない
  if (!overlayOpen) return null

  const household = state.household
  return (
    <div className="tour-overlay" role="dialog" aria-label="物件案内">
      <div className="tour-panel">
        <header className="tour-head">
          {household.members.map((m) => (
            <span key={m.id} className="tour-sprite" style={characterSpriteStyle(m.id)} title={m.name} />
          ))}
          <span className="tour-name">
            {household.label}({household.members.map((m) => m.name).join('・')})
          </span>
          <HpBar hp={state.hp} name={household.label} />
        </header>

        <TourBody state={state} onFinish={onFinish} />

        <p className="tour-hint">矢印で選択 / スペースで進む</p>
      </div>
    </div>
  )
}

function TourBody({ state, onFinish }: { state: TourState; onFinish: (r: TourResult) => void }) {
  const ph = state.phase
  const h = state.household
  /** 世帯の代表(質問や締めのセリフを言う人) */
  const rep = h.members[0]

  if (ph.kind === 'briefing') {
    const lines = briefingLines(h)
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

  if (ph.kind === 'disclosure') {
    const p = contractedProperty(state)
    const item = disclosureFor(p)[ph.index]
    return (
      <section className="tour-scene">
        <h2 className="tour-title">
          📄 重要事項説明(35条書面) {ph.index + 1}/3 — {p.name}
        </h2>
        <p className="tour-line">
          <strong>{item.heading}</strong>
          <br />
          ハゲタ「{item.text}」
        </p>

        {ph.step !== 'read' && (
          <p className="tour-line tour-reaction">
            ❓ {rep.name}「{item.question.ask}」
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

  // arriving(登場中)と map(マップ上で内見中)はオーバーレイを出さない。
  // ここを素通りさせると done の画面(契約は流れた)が誤って出る
  if (ph.kind !== 'done') return null

  const p = state.contracted
  const success = ph.success
  return (
    <section className="tour-scene">
      <h2 className="tour-title">{success ? '🎉 契約成立!' : '💔 契約は流れた…'}</h2>
      <p className="tour-line">
        {success && p
          ? `${rep.name}「${p.name}に決めました! ありがとうございます」\nハゲタ「よくやった。仲介手数料は賃料1ヶ月分、${brokerageFee(p)}万円だ。${h.label}の${h.members.length}人が村の住民になったぞ」`
          : `${rep.name}「…すみません、今日は帰ります」\nハゲタ「客の機嫌を切らしたな。世帯全員の要望に折り合う物件を見せろ」`}
      </p>
      <button
        type="button"
        className="pixel-btn is-key-selected"
        onClick={() =>
          onFinish({
            success,
            reward: state.reward,
            propertyId: p?.id ?? null,
            // 契約成立なら世帯全員が村の住民になる
            residentIds: success ? h.members.map((m) => m.id) : [],
          })
        }
      >
        もどる
      </button>
    </section>
  )
}
