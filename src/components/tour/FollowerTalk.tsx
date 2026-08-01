import { useEffect, useState } from 'react'
import { characterSpriteStyle } from '../../lib/sprites'
import type { TourMember } from '../../lib/tour'
import './tour.css'

interface Props {
  /** 話す順のメンバーとセリフ(ついてきている世帯全員) */
  lines: { member: TourMember; text: string }[]
  onClose: () => void
}

/**
 * 追従キャラに話しかけたときの会話。
 * 誰か1人に話しかければ、ついてきている世帯全員が順番に一言ずつ話す
 * (一列に並ぶと2人目以降に隣接できないため、選ばせずに全員喋らせる)。
 */
export function FollowerTalk({ lines, onClose }: Props) {
  const [i, setI] = useState(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'Enter') return
      e.preventDefault()
      setI((n) => {
        if (n + 1 >= lines.length) {
          onClose()
          return n
        }
        return n + 1
      })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lines.length, onClose])

  const cur = lines[Math.min(i, lines.length - 1)]
  if (!cur) return null

  return (
    <div className="tour-overlay" role="dialog" aria-label="連れとの会話">
      <div className="tour-panel">
        <header className="tour-head">
          {/* 話者が切り替わるのが分かるように、顔スプライトと名前を出す */}
          <span className="tour-sprite is-speaking" style={characterSpriteStyle(cur.member.id)} />
          <span className="tour-name">
            {cur.member.name}({cur.member.age}歳)
          </span>
          <span className="tour-turn">
            {i + 1} / {lines.length}人
          </span>
        </header>

        <section className="tour-scene">
          <p className="tour-line">
            {cur.member.name}「{cur.text}」
          </p>
          <span className="tour-next" aria-hidden="true">
            ▼
          </span>
        </section>

        <p className="tour-hint">スペースで次の人</p>
      </div>
    </div>
  )
}
