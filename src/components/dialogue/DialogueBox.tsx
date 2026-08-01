import { useState } from 'react'
import type { Character, GameEvent } from '../../types'
import { spriteGlyph } from '../../lib/content'
import './dialogue.css'

interface Props {
  character: Character
  event: GameEvent | null
  answered: boolean
  onAnswer: (correct: boolean, eventId: string) => void
  onClose: () => void
}

type Phase = 'talking' | 'choosing' | 'result'

export function DialogueBox({ character, event, answered, onAnswer, onClose }: Props) {
  const [line, setLine] = useState(0)
  const [phase, setPhase] = useState<Phase>('talking')
  const [picked, setPicked] = useState<number | null>(null)

  // イベントなし or 回答済みなら雑談だけ
  const smallTalk = !event || answered

  const advance = () => {
    if (smallTalk) {
      onClose()
      return
    }
    if (line + 1 < event.dialogue.length) {
      setLine(line + 1)
    } else {
      setPhase('choosing')
    }
  }

  const pick = (i: number) => {
    if (!event) return
    setPicked(i)
    setPhase('result')
    onAnswer(i === event.correctChoice, event.id)
  }

  const correct = event !== null && picked === event.correctChoice

  return (
    <div className="dialogue-overlay" role="dialog" aria-label={`${character.name}との会話`}>
      <div className="dialogue-box">
        <div className="dialogue-portrait">
          <span className="dialogue-sprite">{spriteGlyph(character)}</span>
          <span className="dialogue-name">{character.name}</span>
        </div>

        {phase === 'talking' && (
          <button type="button" className="dialogue-text" onClick={advance}>
            {smallTalk
              ? 'こんにちは!今日はいい天気だねえ。'
              : event.dialogue[line]}
            <span className="dialogue-next" aria-hidden="true">▼</span>
          </button>
        )}

        {phase === 'choosing' && event && (
          <div className="dialogue-choices">
            {event.choices.map((c, i) => (
              <button key={i} type="button" className="pixel-btn choice-btn" onClick={() => pick(i)}>
                {c}
              </button>
            ))}
          </div>
        )}

        {phase === 'result' && event && (
          <button type="button" className="dialogue-text" onClick={onClose}>
            <strong className={correct ? 'result-correct' : 'result-wrong'}>
              {correct ? '⭕ せいかい!+1万円' : '❌ ざんねん…'}
            </strong>
            <br />
            {event.explanation}
            <span className="dialogue-next" aria-hidden="true">▼</span>
          </button>
        )}

        <button type="button" className="dialogue-close" onClick={onClose} aria-label="閉じる">
          ✕
        </button>
      </div>
    </div>
  )
}
