import { useEffect, useState } from 'react'
import type { Character, Gender } from '../../types'
import { TOWN_SHEET, characterSpriteStyle, playerSpriteStyle, sheetStyle } from '../../lib/sprites'
import './town.css'

interface Props {
  characters: Character[]
  gender: Gender
  /** 会話中は移動・決定キーを無効化 */
  inputLocked: boolean
  onTapCharacter: (c: Character) => void
}

const COLS = 12
const ROWS = 9

// Tiny Town タイル番号
const T = {
  grass: 0,
  grassTuft: 1,
  flowers: 2,
  path: 25,
  treeGreen: 28,
  treeOrange: 27,
  roofRedL: 52,
  roofRedM: 53,
  roofRedR: 54,
  roofBlueL: 48,
  roofBlueR: 50,
  wallBrown: 72,
  wallBrownDoor: 74,
  wallBrownR: 75,
  wallGray: 76,
  wallGrayDoor: 78,
  sign: 83,
  mailbox: 104,
} as const

// 地面レイヤー(G=草 t=草むら f=花 P=道)
const GROUND = [
  'GGGGGGGGGGGG',
  'GGGGGGGGGGGG',
  'GfGGGGGGGGtG',
  'GGPGGGGPGGPG',
  'PPPPPPPPPPPP',
  'GGGGPGGGGGGG',
  'GtGGPGGGGfGG',
  'GGGGPGGGGGGG',
  'GGGGPGGGGGGG',
] as const

const GROUND_TILE: Record<string, number> = {
  G: T.grass,
  t: T.grassTuft,
  f: T.flowers,
  P: T.path,
}

interface Obj {
  x: number
  y: number
  tile: number
  solid?: boolean
}

// オブジェクトレイヤー(手置き): 不動産屋(赤屋根3幅+看板+ポスト)、住宅、木
const OBJECTS: Obj[] = [
  // 不動産屋 ひばり不動産 (cols 1-3)
  { x: 1, y: 2, tile: T.roofRedL, solid: true },
  { x: 2, y: 2, tile: T.roofRedM, solid: true },
  { x: 3, y: 2, tile: T.roofRedR, solid: true },
  { x: 1, y: 3, tile: T.wallBrown, solid: true },
  { x: 2, y: 3, tile: T.wallBrownDoor, solid: true },
  { x: 3, y: 3, tile: T.wallBrownR, solid: true },
  { x: 4, y: 3, tile: T.sign, solid: true },
  { x: 0, y: 3, tile: T.mailbox, solid: true },
  // 青屋根の家 (cols 6-7)
  { x: 6, y: 2, tile: T.roofBlueL, solid: true },
  { x: 7, y: 2, tile: T.roofBlueR, solid: true },
  { x: 6, y: 3, tile: T.wallGray, solid: true },
  { x: 7, y: 3, tile: T.wallGrayDoor, solid: true },
  // 赤屋根の家 (cols 9-10)
  { x: 9, y: 2, tile: T.roofRedL, solid: true },
  { x: 10, y: 2, tile: T.roofRedR, solid: true },
  { x: 9, y: 3, tile: T.wallBrown, solid: true },
  { x: 10, y: 3, tile: T.wallBrownDoor, solid: true },
  // 南側の家 (cols 7-8)
  { x: 7, y: 6, tile: T.roofBlueL, solid: true },
  { x: 8, y: 6, tile: T.roofBlueR, solid: true },
  { x: 7, y: 7, tile: T.wallGrayDoor, solid: true },
  { x: 8, y: 7, tile: T.wallGray, solid: true },
  // 木
  { x: 0, y: 0, tile: T.treeGreen, solid: true },
  { x: 3, y: 0, tile: T.treeOrange, solid: true },
  { x: 6, y: 0, tile: T.treeGreen, solid: true },
  { x: 8, y: 0, tile: T.treeOrange, solid: true },
  { x: 11, y: 0, tile: T.treeGreen, solid: true },
  { x: 11, y: 6, tile: T.treeOrange, solid: true },
  { x: 1, y: 7, tile: T.treeGreen, solid: true },
  { x: 2, y: 8, tile: T.treeOrange, solid: true },
  { x: 10, y: 8, tile: T.treeGreen, solid: true },
]

// 住民の立ち位置(タイル座標)。住民が増えたら index ループで使い回す
const SPOTS: [number, number][] = [
  [5, 3],
  [8, 5],
  [2, 5],
  [10, 5],
  [6, 8],
  [0, 5],
  [3, 6],
  [9, 7],
  [11, 4],
  [1, 1],
  [9, 1],
  [4, 1],
]

const SOLID = new Set(OBJECTS.filter((o) => o.solid).map((o) => `${o.x},${o.y}`))

const KEY_DIR: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  w: [0, -1],
  s: [0, 1],
  a: [-1, 0],
  d: [1, 0],
}

export function TownView({ characters, gender, inputLocked, onTapCharacter }: Props) {
  const [player, setPlayer] = useState<[number, number]>([5, 4])

  const residents = characters.map((c, i) => ({
    character: c,
    spot: SPOTS[i % SPOTS.length],
  }))

  useEffect(() => {
    if (inputLocked) return
    const residentAt = new Map(residents.map((r) => [`${r.spot[0]},${r.spot[1]}`, r.character]))

    const onKey = (e: KeyboardEvent) => {
      const dir = KEY_DIR[e.key]
      if (dir) {
        e.preventDefault()
        setPlayer(([x, y]) => {
          const nx = x + dir[0]
          const ny = y + dir[1]
          if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) return [x, y]
          const key = `${nx},${ny}`
          if (SOLID.has(key) || residentAt.has(key)) return [x, y]
          return [nx, ny]
        })
        return
      }
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        setPlayer(([x, y]) => {
          const neighbor = [
            [x, y - 1],
            [x, y + 1],
            [x - 1, y],
            [x + 1, y],
          ]
            .map(([nx, ny]) => residentAt.get(`${nx},${ny}`))
            .find((c) => c !== undefined)
          if (neighbor) onTapCharacter(neighbor)
          return [x, y]
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // residents は characters から導出で毎回同値
  }, [inputLocked, characters, onTapCharacter]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="town" aria-label="町">
      <div className="town-grid">
        {GROUND.flatMap((row, y) =>
          [...row].map((ch, x) => (
            <div
              key={`${x}-${y}`}
              className="tile"
              style={{ ...sheetStyle(TOWN_SHEET, GROUND_TILE[ch]), gridColumn: x + 1, gridRow: y + 1 }}
            />
          )),
        )}
        {OBJECTS.map((o, i) => (
          <div
            key={`o${i}`}
            className="tile obj"
            style={{ ...sheetStyle(TOWN_SHEET, o.tile), gridColumn: o.x + 1, gridRow: o.y + 1 }}
          />
        ))}
        {residents.map(({ character: c, spot: [x, y] }) => (
          <button
            key={c.id}
            type="button"
            className="resident"
            style={{ gridColumn: x + 1, gridRow: y + 1 }}
            onClick={() => onTapCharacter(c)}
            aria-label={`${c.name}と話す`}
          >
            <span className="char-sprite" style={characterSpriteStyle(c.id)} />
            <span className="resident-name">{c.name}</span>
          </button>
        ))}
        <div
          className="player"
          style={{ gridColumn: player[0] + 1, gridRow: player[1] + 1 }}
          aria-label="主人公"
        >
          <span className="char-sprite" style={playerSpriteStyle(gender)} />
        </div>
      </div>
      <p className="town-help">矢印キーで移動 / 住民のとなりでスペースで会話</p>
    </section>
  )
}
