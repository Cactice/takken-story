import { useEffect, useRef, useState } from 'react'
import { Diagram } from '../diagram/Diagram'
import { useDotFont } from '../diagram/useDotFont'
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
 * ハゲ田のメモ(本)の中身 = 復習画面。
 * メモはイベントを参照するだけで、図もセリフも複製しない(docs/SYSTEMS.md)。
 * 追従中の「確認」からも、自宅の棚からも、この同じ画面を使う。
 *
 * 操作は矢印とスペースだけ:
 *   ←→ 冊をめくる / ↑↓ 確認問題の選択 / スペース 解答 → もう一度で閉じる
 */
export function MemoBook({ memos, onClose }: Props) {
  // 図が無い冊でも、ページ番号と条文はドットフォントで出す
  useDotFont()
  const [i, setI] = useState(0)
  const [pick, setPick] = useState(0)
  const [answered, setAnswered] = useState(false)

  const panel = useRef<HTMLElement>(null)
  const picked = useRef<HTMLLIElement>(null)
  const verdict = useRef<HTMLParagraphElement>(null)

  const ev = memos[Math.min(i, memos.length - 1)]
  const choices = ev?.choices ?? []

  // 縦スクロールは矢印に取られているので、いま見せたいところへ自動で送る
  useEffect(() => {
    const target = answered ? verdict.current : picked.current
    target?.scrollIntoView({ block: 'nearest' })
  }, [pick, answered])
  useEffect(() => {
    panel.current?.scrollTo({ top: 0 })
  }, [i])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        const d = e.key === 'ArrowLeft' ? memos.length - 1 : 1
        setI((n) => (n + d) % memos.length)
        setPick(0)
        setAnswered(false)
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        if (choices.length === 0) return
        const d = e.key === 'ArrowUp' ? choices.length - 1 : 1
        setPick((n) => (n + d) % choices.length)
      } else if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault()
        // 未解答なら1回目のスペースは解答。解答後(と問題なし)は閉じる
        if (e.key !== 'Escape' && !answered && choices.length > 0) setAnswered(true)
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [memos.length, choices.length, answered, onClose])

  if (!ev) return null
  const who = characterById(ev.characterId)
  const correct = answered && pick === ev.correctChoice

  return (
    <div className="memo-overlay dg" role="dialog" aria-label="ハゲ田のメモ">
      <article className="memo-panel" ref={panel}>
        <header className="memo-head">
          {/* 表紙には、その悩みをくれた住民の顔 */}
          <span className="memo-face" style={characterSpriteStyle(ev.characterId)} />
          <span className="memo-who">{who?.name ?? ev.characterId}の相談</span>
          <span className="memo-page">
            {i + 1} / {memos.length}冊目
          </span>
        </header>

        <h2 className="memo-title">{ev.memo?.title ?? ev.title ?? ev.topicId}</h2>

        {/* 1. 図 — 会話で使ったものと同じコンポーネント */}
        {ev.diagram && (
          <div className="memo-figure">
            <Diagram spec={ev.diagram} size="lg" />
          </div>
        )}

        {/* 2. 要点 */}
        <section className="memo-section">
          <h3>要点</h3>
          <p>{ev.memo?.summary ?? ev.playerLines?.join(' ') ?? ev.title ?? ev.topicId}</p>
        </section>

        {/* 3. 解説(ハゲ田の口調のまま) */}
        <section className="memo-section">
          <h3>ハゲ田の解説</h3>
          <p>{ev.explanation}</p>
        </section>

        {/* 4. 根拠条文(あれば) */}
        {ev.source && (
          <section className="memo-section memo-source">
            <h3>根拠条文</h3>
            <p>{ev.source}</p>
          </section>
        )}

        {/* 5. 確認問題(テスト効果) */}
        {choices.length > 0 && (
          <section className="memo-section memo-quiz">
            <h3>確認問題</h3>
            <ul className="memo-choices">
              {choices.map((c, n) => (
                <li
                  key={c}
                  ref={n === pick ? picked : undefined}
                  className={[
                    'memo-choice',
                    n === pick ? 'is-picked' : '',
                    answered && n === ev.correctChoice ? 'is-correct' : '',
                    answered && n === pick && n !== ev.correctChoice ? 'is-wrong' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {c}
                </li>
              ))}
            </ul>
            {answered && (
              <p ref={verdict} className={`memo-verdict ${correct ? 'is-correct' : 'is-wrong'}`}>
                {/* 解説は上にそのまま載っているので、ここでは正誤と正解だけ言う */}
                {correct
                  ? '⭕ 正解だ。この調子で覚えとけ。'
                  : `❌ はずれ。正解は「${choices[ev.correctChoice]}」だ。上の解説をもう一度読め。`}
              </p>
            )}
          </section>
        )}

        <p className="memo-hint">
          {choices.length === 0
            ? '←→ でめくる / スペースで閉じる'
            : answered
              ? '←→ でめくる / スペースで閉じる'
              : '←→ でめくる / ↑↓ で選ぶ / スペースで解答'}
        </p>
      </article>
    </div>
  )
}
