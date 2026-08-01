import { useEffect, useState } from 'react'
import { Diagram } from '../diagram/Diagram'
import { characterById } from '../../lib/content'
import { characterSpriteStyle } from '../../lib/sprites'
import type { GameEvent } from '../../types'
import './memo.css'

interface Props {
  /** 手持ちのメモ。1冊 = 解決した相談イベント1件 */
  memos: GameEvent[]
  onClose: () => void
}

/**
 * ハゲ田のメモ(本)の中身。
 * メモはイベントを参照するだけで、図もセリフも複製しない(docs/SYSTEMS.md)。
 * 追従中の「確認」からも、将来の自宅の棚の復習からも、この同じ画面を使う。
 */
export function MemoBook({ memos, onClose }: Props) {
  const [i, setI] = useState(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        setI((n) => (n - 1 + memos.length) % memos.length)
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        setI((n) => (n + 1) % memos.length)
      } else if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [memos.length, onClose])

  const ev = memos[Math.min(i, memos.length - 1)]
  if (!ev) return null
  const who = characterById(ev.characterId)

  return (
    <div className="memo-overlay" role="dialog" aria-label="ハゲ田のメモ">
      <article className="memo-panel">
        <header className="memo-head">
          {/* 表紙には、その悩みをくれた住民の顔 */}
          <span className="memo-face" style={characterSpriteStyle(ev.characterId)} />
          <span className="memo-who">{who?.name ?? ev.characterId}の相談</span>
          <span className="memo-page">
            {i + 1} / {memos.length}冊目
          </span>
        </header>

        <h2 className="memo-title">📓 {ev.title ?? ev.topicId}</h2>

        {ev.diagram && (
          <div className="memo-figure">
            <Diagram spec={ev.diagram} size="lg" />
          </div>
        )}

        <section className="memo-section">
          <h3>要点</h3>
          <p>{ev.playerLines?.join(' ') ?? ev.title}</p>
        </section>

        <section className="memo-section">
          <h3>ハゲタの解説</h3>
          <p>{ev.explanation}</p>
        </section>

        <section className="memo-section memo-source">
          <h3>根拠</h3>
          <p>論点: {ev.topicId}</p>
        </section>

        <p className="memo-hint">矢印で冊をめくる / スペースで閉じる</p>
      </article>
    </div>
  )
}
