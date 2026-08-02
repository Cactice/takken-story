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
import './office.css'

/**
 * 禿鷹不動産(会社)の中。docs/SYSTEMS.md「建物に入る」。
 * ここは試験会場でもあり、転入者との面談の場でもある。
 * 作りは自宅(components/home/HomeInterior)と同じ: 矢印で歩き、向いてスペース。
 */

/**
 * 事務所の見取り図。1文字=1タイル。
 * # 板壁 / W 窓 / B 物件を貼ったガラス板 / d ハゲ田の机 / c 来客用の椅子
 * p 応接テーブル / . 床 / @ 出入口
 */
const ROOM = [
  '##########',
  '#W#BBBB#W#',
  '#........#',
  '#..d..cpc#',
  '#........#',
  '####@#####',
] as const

const COLS = ROOM[0].length
const ROWS = ROOM.length

/** 事務所の見た目。壁・窓・扉は Tiny Town、家具は Tiny Dungeon から流用 */
const TILE: Record<string, { sheet: Sheet; index: number }> = {
  '#': { sheet: TOWN_SHEET, index: 72 }, // 板壁
  W: { sheet: TOWN_SHEET, index: 84 }, // 窓
  '@': { sheet: TOWN_SHEET, index: 85 }, // 木の扉
  B: { sheet: TOWN_SHEET, index: 88 }, // ガラスの物件ボード
  d: { sheet: CHAR_SHEET, index: 72 }, // 机
  c: { sheet: CHAR_SHEET, index: 73 }, // 椅子
  p: { sheet: CHAR_SHEET, index: 75 }, // 応接テーブル
}

const at = (x: number, y: number): string =>
  y >= 0 && y < ROWS && x >= 0 && x < COLS ? ROOM[y][x] : '#'

const isFloor = (x: number, y: number): boolean => at(x, y) === '.' || at(x, y) === '@'

/** 出入口の1つ上。外から入ってきた直後の立ち位置 */
const START: [number, number] = [4, 4]

/** ハゲ田社長は自分の机([3,3])の後ろに立っている */
const BOSS: [number, number] = [3, 2]

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

/** ガラス板に貼ってある物件(いま案内できる空き物件) */
export interface Listing {
  id: string
  name: string
  category: string
  price: string
  vacancy: string
}

interface Props {
  gender: Gender
  /** ガラス板の貼り紙 = 空き物件 */
  listings: readonly Listing[]
  /** ハゲ田の机を向いてスペース(試験日なら受験、ふだんは一言) */
  onTalkBoss: () => void
  /** 出入口から外へ */
  onLeave: () => void
  /** 上に別のダイアログが出ている間は動かさない */
  locked?: boolean
}

export function OfficeInterior({ gender, listings, onTalkBoss, onLeave, locked = false }: Props) {
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
          // 出入口を踏んだら外へ
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
      if (target === 'd') onTalkBoss()
      else if (target === '@') onLeave()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [facing, pos, locked, onTalkBoss, onLeave])

  return (
    <section className="office" aria-label="禿鷹不動産の中">
      <div className="office-room" style={{ '--cols': COLS, '--rows': ROWS } as CSSProperties}>
        {ROOM.flatMap((row, y) =>
          [...row].map((ch, x) => {
            const t = TILE[ch]
            return (
              <div
                key={`${x}-${y}`}
                className={`office-tile${ch === '.' || ch === '@' ? ' is-floor' : ''}${ch === '#' ? ' is-wall' : ''}`}
                style={{ gridColumn: x + 1, gridRow: y + 1 }}
              >
                {t && <span className="office-obj" style={sheetStyle(t.sheet, t.index)} />}
              </div>
            )
          }),
        )}

        <div
          className="office-boss"
          style={{ gridColumn: BOSS[0] + 1, gridRow: BOSS[1] + 1 }}
          aria-label="ハゲタ社長"
        >
          <span className="office-sprite" style={characterSpriteStyle('tencho-gozo')} />
        </div>

        <div
          className="office-player"
          style={{ gridColumn: pos[0] + 1, gridRow: pos[1] + 1 }}
          aria-label="主人公"
        >
          <span className="office-sprite" style={playerSpriteStyle(gender, facing, step)} />
        </div>
      </div>

      {/* ガラス板の貼り紙。いま案内できる物件がひと目で分かる */}
      <div className="office-board" aria-label="物件ボード(空き物件)">
        <h2 className="office-board-title">🪟 物件ボード — いま案内できる空き物件</h2>
        {listings.length === 0 ? (
          <p className="office-board-empty">貼り紙は1枚もない。村は満室だ。</p>
        ) : (
          <ul className="office-board-list">
            {listings.map((l) => (
              <li key={l.id} className="office-listing">
                <strong>{l.name}</strong>
                <span className="office-listing-vacancy">{l.vacancy}</span>
                <span className="office-listing-sub">
                  {l.category} / {l.price}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="office-help">
        矢印キーで移動 / ハゲ田の机を向いてスペースで話す / 出入口(下)から外へ
      </p>
    </section>
  )
}
