import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  CHAR_SHEET,
  TOWN_SHEET,
  characterSpriteStyle,
  playerSpriteStyle,
  sheetStyle,
} from '../../lib/sprites'
import type { Facing, Sheet } from '../../lib/sprites'
import type { Gender } from '../../types'
import './home.css'

/**
 * 主人公の自宅(ボロ屋)の中。
 * ついてきたハゲ田のメモは、ここに入った時点で本棚に並ぶ(docs/SYSTEMS.md)。
 * 操作は矢印キーとスペースだけ。
 */

/**
 * 部屋の見取り図。1文字=1タイル。
 * # 板壁 / W 窓 / S 本棚 / b 寝床 / d 机 / . 床 / @ 玄関(出口)
 */
const ROOM = [
  '########',
  '#W#SS#W#',
  '#bb..d.#',
  '#......#',
  '#......#',
  '###@####',
] as const

const COLS = ROOM[0].length
const ROWS = ROOM.length

/**
 * 室内の見た目。壁・窓・扉は Tiny Town、家具は Tiny Dungeon から流用している。
 * ponytail: 内装専用のドット絵を足すなら、ここの番号を差し替えるだけでよい。
 */
const TILE: Record<string, { sheet: Sheet; index: number }> = {
  '#': { sheet: TOWN_SHEET, index: 72 }, // 板壁
  W: { sheet: TOWN_SHEET, index: 84 }, // 窓
  '@': { sheet: TOWN_SHEET, index: 85 }, // 木の扉
  S: { sheet: CHAR_SHEET, index: 75 }, // 棚(木枠)
  b: { sheet: CHAR_SHEET, index: 79 }, // 寝床
  d: { sheet: CHAR_SHEET, index: 72 }, // 机
}

const at = (x: number, y: number): string =>
  y >= 0 && y < ROWS && x >= 0 && x < COLS ? ROOM[y][x] : '#'

const isFloor = (x: number, y: number): boolean => at(x, y) === '.' || at(x, y) === '@'

/** 玄関の1つ上。外から入ってきた直後の立ち位置 */
const START: [number, number] = [3, 4]

const KEY_DIR: Record<string, [number, number, Facing]> = {
  ArrowUp: [0, -1, 'up'],
  ArrowDown: [0, 1, 'down'],
  ArrowLeft: [-1, 0, 'left'],
  ArrowRight: [1, 0, 'right'],
}

const FACE_DELTA: Record<Facing, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
}

export interface ShelfBook {
  /** メモのID(= イベントID) */
  id: string
  /** 表紙に描く顔(相談をくれた住民) */
  characterId: string
  /** 読み上げ用の題 */
  title?: string
}

interface Props {
  gender: Gender
  /** 棚に並んでいるメモ。冊数だけ背表紙が増える */
  books: readonly ShelfBook[]
  /** 本棚に向かってスペース */
  onOpenShelf: () => void
  /** 玄関から出る */
  onLeave: () => void
  /** 復習画面を開いている間は動かさない */
  locked?: boolean
}

export function HomeInterior({ gender, books, onOpenShelf, onLeave, locked = false }: Props) {
  const [pos, setPos] = useState<[number, number]>(START)
  const [facing, setFacing] = useState<Facing>('up')
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (locked) return
    const onKey = (e: KeyboardEvent) => {
      const dir = KEY_DIR[e.key]
      if (dir) {
        e.preventDefault()
        setFacing(dir[2])
        setPos(([x, y]) => {
          const nx = x + dir[0]
          const ny = y + dir[1]
          if (!isFloor(nx, ny)) return [x, y]
          // 玄関を踏んだら外へ(下に抜けるだけで出られる)
          if (at(nx, ny) === '@') {
            onLeave()
            return [x, y]
          }
          setStep((s) => s + 1)
          return [nx, ny]
        })
        return
      }
      if (e.key !== ' ' && e.key !== 'Enter') return
      e.preventDefault()
      const [dx, dy] = FACE_DELTA[facing]
      const target = at(pos[0] + dx, pos[1] + dy)
      if (target === 'S') onOpenShelf()
      else if (target === '@') onLeave()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [facing, pos, locked, onOpenShelf, onLeave])

  /** 棚は横2マス。冊数が増えるほど背表紙が増えて棚が埋まっていく */
  const shelfX = ROOM[1].indexOf('S')
  const shelfY = 1
  const shelfW = [...ROOM[1]].filter((c) => c === 'S').length

  return (
    <section className="home" aria-label="自宅の中">
      <div
        className="home-room"
        style={
          {
            '--cols': COLS,
            '--rows': ROWS,
            // 板の床。diagram の敷き詰めタイルを流用(同じ Kenney の素材)
            backgroundImage: `url(${import.meta.env.BASE_URL}assets/diagram/floor-warm.png)`,
          } as CSSProperties
        }
      >
        {ROOM.flatMap((row, y) =>
          [...row].map((ch, x) => {
            const t = TILE[ch]
            return (
              <div
                key={`${x}-${y}`}
                className={`home-tile${ch === '.' || ch === '@' ? ' is-floor' : ''}`}
                style={{ gridColumn: x + 1, gridRow: y + 1 }}
              >
                {t && <span className="home-obj" style={sheetStyle(t.sheet, t.index)} />}
              </div>
            )
          }),
        )}

        <div
          className="home-shelf"
          style={{ gridColumn: `${shelfX + 1} / span ${shelfW}`, gridRow: shelfY + 1 }}
          aria-label={`本棚 ハゲ田のメモ${books.length}冊`}
        >
          {books.map((b) => (
            <span key={b.id} className="home-book" title={b.title}>
              <span className="home-book-face" style={characterSpriteStyle(b.characterId)} />
            </span>
          ))}
        </div>

        <div
          className="home-player"
          style={{ gridColumn: pos[0] + 1, gridRow: pos[1] + 1 }}
          aria-label="主人公"
        >
          <span className="home-sprite" style={playerSpriteStyle(gender, facing, step)} />
        </div>
      </div>

      <p className="home-help">
        矢印キーで移動 / 本棚を向いてスペースで復習 / 玄関(下)から外へ
        {books.length > 0 && ` — ハゲ田のメモが${books.length}冊、棚に並んでいる`}
      </p>
    </section>
  )
}
