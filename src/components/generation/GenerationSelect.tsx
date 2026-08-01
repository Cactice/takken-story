import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { sheetStyle } from '../../lib/sprites'
import { GENERATIONS } from './generations'
import type { GenerationInfo, Thumb } from './generations'
import './generation.css'

interface Props {
  /** 解放済みの世代番号。判定はここでは持たず、呼び出し側から受け取る */
  unlocked: ReadonlySet<number>
  /** 最初に選ばれている世代 */
  initial?: number
  onSelect: (generation: number) => void
  /** タイトルに戻るなど。省略すると戻る導線は出ない */
  onBack?: () => void
}

/** ドット絵タイルを並べてサムネイルにする */
function ThumbArt({ thumb, alt }: { thumb: Thumb; alt: string }) {
  const cols = thumb.tiles[0].length
  return (
    <div
      className="gen-thumb"
      role="img"
      aria-label={alt}
      style={{ '--thumb-cols': cols, '--thumb-filter': thumb.filter ?? 'none' } as CSSProperties}
    >
      {thumb.tiles.flatMap((row, y) =>
        row.map((tile, x) => (
          <span key={`${x}-${y}`} className="gen-thumb-tile" style={sheetStyle(thumb.sheet, tile)} />
        )),
      )}
    </div>
  )
}

export function GenerationSelect({ unlocked, initial = 1, onSelect, onBack }: Props) {
  const initialIndex = Math.max(0, GENERATIONS.findIndex((g) => g.generation === initial))
  const [index, setIndex] = useState(initialIndex)
  /** ロックされた世代を決定したときの振動 */
  const [denied, setDenied] = useState(0)

  const current: GenerationInfo = GENERATIONS[index]
  const isUnlocked = unlocked.has(current.generation)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        setIndex((i) => (i + GENERATIONS.length - 1) % GENERATIONS.length)
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        setIndex((i) => (i + 1) % GENERATIONS.length)
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (unlocked.has(GENERATIONS[index].generation)) onSelect(GENERATIONS[index].generation)
        else setDenied((n) => n + 1)
      } else if (e.key === 'Escape' && onBack) {
        e.preventDefault()
        onBack()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, unlocked, onSelect, onBack])

  return (
    <main className="gen-select">
      <header className="gen-head">
        <p className="gen-eyebrow">SELECT STAGE</p>
        <h1 className="gen-title">世代をえらぶ</h1>
      </header>

      <ol className="gen-track" aria-label="世代の一覧">
        {GENERATIONS.map((info, i) => {
          const locked = !unlocked.has(info.generation)
          return (
            <li key={info.generation}>
              <button
                type="button"
                className={`gen-card ${i === index ? 'is-selected' : ''} ${locked ? 'is-locked' : ''}`}
                aria-current={i === index}
                aria-disabled={locked}
                onClick={() => (locked ? setDenied((n) => n + 1) : onSelect(info.generation))}
                onMouseEnter={() => setIndex(i)}
              >
                <span className="gen-no">{info.generation}</span>
                <ThumbArt thumb={info.thumb} alt={`${info.stageName}のようす`} />
                <span className="gen-card-name">{info.stageName}</span>
                <span className="gen-card-tone">{locked ? '未到達' : info.tone}</span>
                {locked && (
                  <span className="gen-lock" aria-label="未到達">
                    <span className="gen-lock-shackle" />
                    <span className="gen-lock-body" />
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ol>

      <section
        key={`${current.generation}-${denied}`}
        className={`gen-detail ${isUnlocked ? '' : 'is-locked'}`}
        aria-live="polite"
      >
        <p className="gen-detail-head">
          <span className="gen-detail-no">第{current.generation}世代</span>
          <span className="gen-detail-title">{isUnlocked ? current.title : '？？？'}</span>
        </p>
        <dl className="gen-detail-meta">
          <div>
            <dt>舞台</dt>
            <dd>{current.stageName}</dd>
          </div>
          <div>
            <dt>目標</dt>
            <dd>{isUnlocked ? current.goal : '？？？'}</dd>
          </div>
          <div>
            <dt>トーン</dt>
            <dd>{current.tone}</dd>
          </div>
        </dl>
        <p className="gen-detail-body">
          {isUnlocked ? current.summary : 'まだ ここまで 到達していない。\n前の世代を クリアすると 遊べるようになる。'}
        </p>
        <p className="gen-detail-study">学習範囲: {current.study}</p>
      </section>

      <p className="gen-hint">← → でえらぶ / スペースで決定{onBack ? ' / Escで戻る' : ''}</p>
    </main>
  )
}
