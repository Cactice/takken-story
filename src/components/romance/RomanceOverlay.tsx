import { useEffect, useState } from 'react'
import type { Character, Gender } from '../../types'
import { characterSpriteStyle } from '../../lib/sprites'
import {
  DATE_ROUNDS,
  EXCITEMENT_MAX,
  EXCITEMENT_START,
  EXCITEMENT_SUCCESS,
  FALLBACK_PROPERTIES,
  canMarry,
  clampExcitement,
  declineDate,
  finishDate,
  lineFor,
  propertyChoices,
  reactToProperty,
  wantsHouseVisit,
} from '../../lib/romance'
import type { DateProperty, RomanceContent, RomanceState } from '../../lib/romance'
import '../dialogue/dialogue.css'
import './romance.css'

interface Props {
  character: Character
  content: RomanceContent
  /** 今回の会話ぶんの親密度を加算したあとの状態 */
  st: RomanceState
  gender: Gender
  /** src/lib/properties.ts ができたら物件を渡す。省略時は最小の内蔵データ */
  properties?: DateProperty[]
  onUpdate: (fn: (prev: RomanceState) => RomanceState) => void
  onRelationshipMaxed: (characterId: string) => void
  onClose: () => void
}

type Phase = 'talk' | 'invite' | 'choose' | 'react' | 'result'

/** 矢印+スペースだけで進む恋愛会話 → 家を見に行く誘い → デート(物件巡り) */
export function RomanceOverlay({
  character,
  content,
  st,
  properties,
  onUpdate,
  onRelationshipMaxed,
  onClose,
}: Props) {
  const pool = properties && properties.length > 0 ? properties : FALLBACK_PROPERTIES
  const invited = wantsHouseVisit(content, st)
  const [talkLine] = useState(() => lineFor(content, st))
  const [phase, setPhase] = useState<Phase>('talk')
  /** talk/invite フェーズで表示中の行番号 */
  const [step, setStep] = useState(0)
  const [sel, setSel] = useState(0)
  const [round, setRound] = useState(0)
  const [excitement, setExcitement] = useState(EXCITEMENT_START)
  const [reaction, setReaction] = useState<{ line: string; delta: number } | null>(null)

  const choices = propertyChoices(pool, round)

  const startDate = () => {
    setPhase('choose')
    setSel(0)
  }

  const pickProperty = () => {
    const r = reactToProperty(content, choices[sel], round + sel)
    setExcitement((e) => clampExcitement(e + r.delta))
    setReaction(r)
    setPhase('react')
  }

  const afterReaction = () => {
    if (round + 1 < DATE_ROUNDS) {
      setRound(round + 1)
      setSel(0)
      setPhase('choose')
      return
    }
    setPhase('result')
  }

  const finish = () => {
    const next = finishDate(st, excitement)
    onUpdate(() => next)
    if (canMarry(next)) onRelationshipMaxed(content.characterId)
    onClose()
  }

  const advance = () => {
    if (phase === 'talk') {
      if (!invited) return onClose()
      setPhase('invite')
      setStep(0)
      return
    }
    if (phase === 'invite') {
      if (step + 1 < content.houseInviteLines.length) return setStep(step + 1)
      setPhase('choose')
      setSel(0)
      setStep(-1) // -1 = まだ「連れて行く/やめておく」の選択前
      return
    }
    if (phase === 'react') return afterReaction()
    if (phase === 'result') return finish()
  }

  // 誘いの選択待ちかどうか(choose フェーズだが step === -1)
  const askingInvite = phase === 'choose' && step === -1
  const inviteOptions = [
    { label: '連れて行く', onPick: startDate },
    {
      label: '今はやめておく',
      onPick: () => {
        onUpdate(declineDate)
        onClose()
      },
    },
  ]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const horizontal = e.key === 'ArrowLeft' || e.key === 'ArrowRight'
      const vertical = e.key === 'ArrowUp' || e.key === 'ArrowDown'
      const confirm = e.key === ' ' || e.key === 'Enter'
      if (!horizontal && !vertical && !confirm) return
      e.preventDefault()

      if (askingInvite) {
        if (confirm) inviteOptions[sel].onPick()
        else setSel((s) => 1 - s)
        return
      }
      if (phase === 'choose') {
        if (confirm) pickProperty()
        else
          setSel(
            (s) =>
              (s + (e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? choices.length - 1 : 1)) %
              choices.length,
          )
        return
      }
      advance()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const portrait = (
    <div className="dialogue-portrait">
      <span className="dialogue-sprite" style={characterSpriteStyle(character.id)} />
      <span className="dialogue-name speaker-char">{character.name}</span>
    </div>
  )

  const meter = (
    <div className="romance-meter" aria-label={`ときめき度 ${excitement}`}>
      <span className="romance-meter-label">💗 ときめき度</span>
      <span className="romance-meter-track">
        <span
          className="romance-meter-fill"
          style={{ width: `${(excitement / EXCITEMENT_MAX) * 100}%` }}
        />
      </span>
      <span className="romance-meter-value">{excitement}</span>
    </div>
  )

  if (phase === 'choose' && !askingInvite) {
    return (
      <div className="dialogue-overlay romance-overlay" role="dialog" aria-label="デート: 物件巡り">
        <div className="dialogue-box">
          {portrait}
          <div className="romance-body">
          {meter}
          <p className="romance-round">
            {round + 1}件目 / {DATE_ROUNDS}件 — どの家を見せる?
          </p>
          <ul className="romance-choices">
            {choices.map((p, i) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={`romance-card ${i === sel ? 'is-key-selected' : ''}`}
                  onClick={() => (i === sel ? pickProperty() : setSel(i))}
                >
                  <strong>{p.name}</strong>
                  <span className="romance-tags">{p.features.map((f) => `#${f}`).join(' ')}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="exam-hint">矢印で選択 / スペースで案内する</p>
          </div>
        </div>
      </div>
    )
  }

  if (askingInvite) {
    return (
      <div className="dialogue-overlay romance-overlay" role="dialog" aria-label="家を見に行く誘い">
        <div className="dialogue-box">
          {portrait}
          <div className="romance-body">
          <p className="dialogue-line">物件を見に連れて行く?</p>
          <div className="exam-actions">
            {inviteOptions.map((o, i) => (
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
          <p className="exam-hint">矢印で選択 / スペースで決定(断っても嫌われない)</p>
          </div>
        </div>
      </div>
    )
  }

  const text =
    phase === 'talk'
      ? talkLine
      : phase === 'invite'
        ? content.houseInviteLines[step]
        : phase === 'react'
          ? (reaction?.line ?? '')
          : ''

  const success = excitement >= EXCITEMENT_SUCCESS
  const nextState = finishDate(st, excitement)

  return (
    <div className="dialogue-overlay romance-overlay" role="dialog" aria-label={`${character.name}との会話`}>
      <div className="dialogue-box">
        {portrait}
        <div className="romance-body">
        {(phase === 'react' || phase === 'result') && meter}
        <button type="button" className="dialogue-text" onClick={advance}>
          {phase === 'result' ? (
            <span className="romance-result">
              <strong className={success ? 'result-correct' : ''}>
                {success ? '💞 関係が進展した!' : '…今日はここまで。またの機会に。'}
              </strong>
              <span className="romance-ideal">
                {character.name}の理想の家: {content.idealHome.description}
              </span>
              {canMarry(nextState) && (
                <strong className="result-correct">
                  {content.proposalLines[0]}
                  <br />
                  結婚できる関係になった!
                </strong>
              )}
            </span>
          ) : (
            <span className="dialogue-line">{text}</span>
          )}
          <span className="dialogue-next" aria-hidden="true">▼</span>
        </button>
        </div>
      </div>
    </div>
  )
}
