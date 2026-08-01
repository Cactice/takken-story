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
  householdReaction,
  initTour,
  tourReducer,
} from '../../lib/tour'
import type { TourHousehold, TourProperty, TourState } from '../../lib/tour'
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
  household: TourHousehold
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

export function TourScreen({ household, properties = DUMMY_PROPERTIES, onMemoEarned, onFinish }: Props) {
  const [state, dispatch] = useReducer(tourReducer, undefined, () => initTour(household, properties))

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

  if (ph.kind === 'visit') {
    const p = state.properties[ph.index]
    const hr = householdReaction(h, p)
    const comment = hagetaCommentFor(p, h.id)
    return (
      <section className="tour-scene">
        <h2 className="tour-title">
          🏠 {ph.index + 1}件目 / {state.properties.length}件 — {p.name}
        </h2>
        <SpecTable p={p} />
        {ph.step !== 'spec' && (
          <>
            {/* 内見の反応は世帯全員分を出す */}
            {hr.each.map(({ member, reaction }) => (
              <p key={member.id} className={`tour-line tour-reaction is-${reaction.mood}`}>
                {MOOD_FACE[reaction.mood]} {member.name}「{reaction.line}」
              </p>
            ))}
            {h.members.length > 1 && (
              <p className={`tour-line tour-reaction is-${hr.mood}`}>{hr.line}</p>
            )}
          </>
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
            const hr = householdReaction(h, p)
            return (
              <li key={p.id}>
                <span className={`tour-choice ${i === ph.sel ? 'is-key-selected' : ''}`}>
                  {hr.each.map((e) => MOOD_FACE[e.reaction.mood]).join('')} {p.name}(月{p.rent}万円)
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

  // done
  const p = state.contractedId ? contractedProperty(state) : null
  return (
    <section className="tour-scene">
      <h2 className="tour-title">{ph.success ? '🎉 契約成立!' : '💔 契約は流れた…'}</h2>
      <p className="tour-line">
        {ph.success && p
          ? `${rep.name}「${p.name}に決めました! ありがとうございます」\nハゲタ「よくやった。仲介手数料は賃料1ヶ月分、${brokerageFee(p)}万円だ。${h.label}の${h.members.length}人が村の住民になったぞ」`
          : `${rep.name}「…すみません、今日は帰ります」\nハゲタ「客の機嫌を切らしたな。世帯全員の要望に折り合う物件を見せろ」`}
      </p>
      <button
        type="button"
        className="pixel-btn is-key-selected"
        onClick={() =>
          onFinish({
            success: ph.success,
            reward: state.reward,
            propertyId: state.contractedId,
            // 契約成立なら世帯全員が村の住民になる
            residentIds: ph.success ? h.members.map((m) => m.id) : [],
          })
        }
      >
        もどる
      </button>
    </section>
  )
}
