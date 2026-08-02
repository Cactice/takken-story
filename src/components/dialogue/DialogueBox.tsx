import { useEffect, useMemo, useState } from 'react'
import type { Character, DiagramSpec, GameEvent, Gender } from '../../types'
import { characterSpriteStyle, playerSpriteStyle } from '../../lib/sprites'
import { Diagram } from '../diagram/Diagram'
import './dialogue.css'

interface Props {
  character: Character
  /** 今日の相談。null なら一言雑談(解決済みなら resolvedLine) */
  event: GameEvent | null
  gender: Gender
  /** 相談がないときに話す一言(解決済みの報告など) */
  smallTalk?: string
  /** メモ入手まで見終えた(相談を体験した) */
  onComplete: (eventId: string) => void
  onClose: () => void
}

type Speaker = 'char' | 'boss' | 'player'

interface Step {
  speaker: Speaker
  text: string
  diagram?: DiagramSpec
  /** メモ入手演出 */
  memo?: boolean
}

const BOSS_NAME = '禿鷹社長'
const DEFAULT_SMALL_TALK = 'こんにちは!今日はいい天気だねえ。'

/** データ中の「ハゲタ「…」」はハゲタの発言として表示する */
function toStep(line: string): Step {
  const m = /^ハゲタ「(.*)」$/.exec(line.trim())
  return m ? { speaker: 'boss', text: m[1] } : { speaker: 'char', text: line }
}

function buildSteps(event: GameEvent | null, smallTalk?: string): Step[] {
  if (!event) return [{ speaker: 'char', text: smallTalk ?? DEFAULT_SMALL_TALK }]
  return [
    ...event.dialogue.map(toStep),
    { speaker: 'boss', text: event.explanation, diagram: event.diagram },
    ...(event.playerLines ?? []).map((text): Step => ({ speaker: 'player', text })),
    ...(event.thanksLine ? [{ speaker: 'char' as const, text: event.thanksLine }] : []),
    { speaker: 'char', text: '', memo: true },
  ]
}

export function DialogueBox({ character, event, gender, smallTalk, onComplete, onClose }: Props) {
  const steps = useMemo(() => buildSteps(event, smallTalk), [event, smallTalk])
  const [index, setIndex] = useState(0)
  const step = steps[Math.min(index, steps.length - 1)]

  const advance = () => {
    if (index + 1 < steps.length) {
      setIndex(index + 1)
      return
    }
    if (event) onComplete(event.id)
    onClose()
  }

  // 操作は矢印キーとスペースのみ(矢印でも進める)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === ' ' ||
        e.key === 'Enter' ||
        e.key === 'ArrowRight' ||
        e.key === 'ArrowDown'
      ) {
        e.preventDefault()
        advance()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        setIndex((i) => Math.max(0, i - 1))
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const speakerName =
    step.speaker === 'boss' ? BOSS_NAME : step.speaker === 'player' ? 'あなた' : character.name
  const spriteStyle =
    step.speaker === 'boss'
      ? characterSpriteStyle('tencho-gozo')
      : step.speaker === 'player'
        ? playerSpriteStyle(gender)
        : characterSpriteStyle(character.id)

  return (
    <div className="dialogue-overlay" role="dialog" aria-label={`${character.name}との会話`}>
      <div className="dialogue-box">
        <div className="dialogue-portrait">
          <span className="dialogue-sprite" style={spriteStyle} />
          <span className={`dialogue-name speaker-${step.speaker}`}>{speakerName}</span>
        </div>

        <button type="button" className="dialogue-text" onClick={advance}>
          {step.memo ? (
            <span className="memo-get">
              <span className="memo-book" aria-hidden="true">📖</span>
              <strong className="advice-heading">「ハゲタのメモ」を1冊 手に入れた!</strong>
              <span className="memo-sub">本が主人公のうしろについてきた</span>
              <strong className="result-correct">相談解決! +1万円</strong>
            </span>
          ) : (
            <>
              {step.speaker === 'boss' && (
                <strong className="advice-heading">💡 ハゲタの解説</strong>
              )}
              {step.diagram && <Diagram spec={step.diagram} />}
              <span className="dialogue-line">{step.text}</span>
            </>
          )}
          <span className="dialogue-next" aria-hidden="true">▼</span>
        </button>

        <button type="button" className="dialogue-close" onClick={onClose} aria-label="閉じる">
          ✕
        </button>
        <span className="dialogue-hint">スペース/→ で進む</span>
      </div>
    </div>
  )
}
