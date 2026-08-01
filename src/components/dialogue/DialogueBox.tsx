import { useEffect, useState } from 'react'
import type { Character, GameEvent } from '../../types'
import { characterSpriteStyle } from '../../lib/sprites'
import './dialogue.css'

interface Props {
  character: Character
  /** 今日の相談。null なら一言雑談 */
  event: GameEvent | null
  /** アドバイスまで読み終えた(相談を体験した) */
  onComplete: (eventId: string) => void
  onClose: () => void
}

type Phase = 'talking' | 'advice'

export function DialogueBox({ character, event, onComplete, onClose }: Props) {
  const [line, setLine] = useState(0)
  const [phase, setPhase] = useState<Phase>('talking')

  const advance = () => {
    if (!event) {
      onClose()
      return
    }
    if (line + 1 < event.dialogue.length) {
      setLine(line + 1)
    } else {
      setPhase('advice')
    }
  }

  const finish = () => {
    if (event) onComplete(event.id)
    onClose()
  }

  // キーボードだけで完結: スペース/Enterで進む、Escで閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (phase === 'advice') finish()
        else advance()
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="dialogue-overlay" role="dialog" aria-label={`${character.name}との会話`}>
      <div className="dialogue-box">
        <div className="dialogue-portrait">
          <span className="dialogue-sprite" style={characterSpriteStyle(character.id)} />
          <span className="dialogue-name">{phase === 'advice' ? 'ハゲタ社長' : character.name}</span>
        </div>

        {phase === 'talking' && (
          <button type="button" className="dialogue-text" onClick={advance}>
            {event ? event.dialogue[line] : 'こんにちは!今日はいい天気だねえ。'}
            <span className="dialogue-next" aria-hidden="true">▼</span>
          </button>
        )}

        {phase === 'advice' && event && (
          <button type="button" className="dialogue-text" onClick={finish}>
            <strong className="advice-heading">💡 ハゲタのアドバイス</strong>
            <br />
            {event.explanation}
            <br />
            <strong className="result-correct">相談解決!+1万円</strong>
            <span className="dialogue-next" aria-hidden="true">▼</span>
          </button>
        )}

        <button type="button" className="dialogue-close" onClick={onClose} aria-label="閉じる">
          ✕
        </button>
        <span className="dialogue-hint">スペースで進む</span>
      </div>
    </div>
  )
}
