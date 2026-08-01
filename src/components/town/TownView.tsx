import { useEffect, useState } from 'react'
import type { Character, Gender } from '../../types'
import { TOWN_SHEET, characterSpriteStyle, playerSpriteStyle, sheetStyle } from '../../lib/sprites'
import type { Facing } from '../../lib/sprites'
import './town.css'

interface Props {
  characters: Character[]
  gender: Gender
  /** 相談が控えている住民のID(頭に「!」を表示) */
  alertIds: ReadonlySet<string>
  /** 会話中は移動・決定キーを無効化 */
  inputLocked: boolean
  onTapCharacter: (c: Character) => void
}

const COLS = 20
const ROWS = 15

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
  'GGGGGGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGGGGGGGG',
  'GGfGGGGGGGtGGGGGfGGG',
  'GGGGGGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGGGGGGGG',
  'PPPPPPPPPPPPPPPPPPPP',
  'GGGGGPGGGGGGGGPGGGGG',
  'GGGGGPGGGGGGGGPGGGGG',
  'GGGGGPGGGGGGGGPGGtGG',
  'GGGGGPGGGGGGGGPGGGGG',
  'GGGGGPPPPPPPPPPGGGGG',
  'GGGGGGGGtGGfGGGGGGGG',
  'GGGGGGGGGGGGGGGGGGGG',
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
  // 不動産屋 ひばり不動産 (cols 1-3、メイン道路北側)
  { x: 1, y: 5, tile: T.roofRedL, solid: true },
  { x: 2, y: 5, tile: T.roofRedM, solid: true },
  { x: 3, y: 5, tile: T.roofRedR, solid: true },
  { x: 1, y: 6, tile: T.wallBrown, solid: true },
  { x: 2, y: 6, tile: T.wallBrownDoor, solid: true },
  { x: 3, y: 6, tile: T.wallBrownR, solid: true },
  { x: 4, y: 6, tile: T.sign, solid: true },
  { x: 0, y: 6, tile: T.mailbox, solid: true },
  // 青屋根の家 (cols 6-7)
  { x: 6, y: 5, tile: T.roofBlueL, solid: true },
  { x: 7, y: 5, tile: T.roofBlueR, solid: true },
  { x: 6, y: 6, tile: T.wallGrayDoor, solid: true },
  { x: 7, y: 6, tile: T.wallGray, solid: true },
  // 赤屋根の家 (cols 10-11)
  { x: 10, y: 5, tile: T.roofRedL, solid: true },
  { x: 11, y: 5, tile: T.roofRedR, solid: true },
  { x: 10, y: 6, tile: T.wallBrown, solid: true },
  { x: 11, y: 6, tile: T.wallBrownDoor, solid: true },
  // 赤屋根の家 (cols 15-16)
  { x: 15, y: 5, tile: T.roofRedL, solid: true },
  { x: 16, y: 5, tile: T.roofRedR, solid: true },
  { x: 15, y: 6, tile: T.wallBrown, solid: true },
  { x: 16, y: 6, tile: T.wallBrownDoor, solid: true },
  // 北西の青屋根の家 (cols 1-2)
  { x: 1, y: 9, tile: T.roofBlueL, solid: true },
  { x: 2, y: 9, tile: T.roofBlueR, solid: true },
  { x: 1, y: 10, tile: T.wallGray, solid: true },
  { x: 2, y: 10, tile: T.wallGrayDoor, solid: true },
  // 南側の家 (cols 7-8 / 11-12、南道路向き)
  { x: 7, y: 10, tile: T.roofBlueL, solid: true },
  { x: 8, y: 10, tile: T.roofBlueR, solid: true },
  { x: 7, y: 11, tile: T.wallGrayDoor, solid: true },
  { x: 8, y: 11, tile: T.wallGray, solid: true },
  { x: 11, y: 10, tile: T.roofRedL, solid: true },
  { x: 12, y: 10, tile: T.roofRedR, solid: true },
  { x: 11, y: 11, tile: T.wallBrown, solid: true },
  { x: 12, y: 11, tile: T.wallBrownDoor, solid: true },
  // 木
  { x: 0, y: 0, tile: T.treeGreen, solid: true },
  { x: 5, y: 1, tile: T.treeOrange, solid: true },
  { x: 9, y: 0, tile: T.treeGreen, solid: true },
  { x: 14, y: 1, tile: T.treeOrange, solid: true },
  { x: 19, y: 0, tile: T.treeGreen, solid: true },
  { x: 0, y: 3, tile: T.treeOrange, solid: true },
  { x: 3, y: 3, tile: T.treeGreen, solid: true },
  { x: 12, y: 3, tile: T.treeOrange, solid: true },
  { x: 17, y: 2, tile: T.treeGreen, solid: true },
  { x: 19, y: 3, tile: T.treeOrange, solid: true },
  { x: 0, y: 10, tile: T.treeGreen, solid: true },
  { x: 19, y: 10, tile: T.treeOrange, solid: true },
  { x: 1, y: 13, tile: T.treeOrange, solid: true },
  { x: 5, y: 13, tile: T.treeGreen, solid: true },
  { x: 15, y: 13, tile: T.treeOrange, solid: true },
  { x: 18, y: 13, tile: T.treeGreen, solid: true },
]

// 住民の立ち位置(タイル座標)。住民が増えたら index ループで使い回す
const SPOTS: [number, number][] = [
  [8, 6],
  [13, 6],
  [4, 8],
  [6, 8],
  [13, 8],
  [16, 8],
  [18, 8],
  [6, 11],
  [10, 11],
  [2, 12],
  [9, 13],
  [12, 13],
]

const SOLID = new Set(OBJECTS.filter((o) => o.solid).map((o) => `${o.x},${o.y}`))

const KEY_DIR: Record<string, [number, number, Facing]> = {
  ArrowUp: [0, -1, 'up'],
  ArrowDown: [0, 1, 'down'],
  ArrowLeft: [-1, 0, 'left'],
  ArrowRight: [1, 0, 'right'],
  w: [0, -1, 'up'],
  s: [0, 1, 'down'],
  a: [-1, 0, 'left'],
  d: [1, 0, 'right'],
}

export function TownView({ characters, gender, alertIds, inputLocked, onTapCharacter }: Props) {
  const [player, setPlayer] = useState<[number, number]>([9, 7])
  const [facing, setFacing] = useState<Facing>('down')

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
        setFacing(dir[2])
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
      <div className="town-viewport">
        {/* カメラ: 主人公が常に中央。--px/--py でマップ側を逆方向に translate */}
        <div
          className="town-grid"
          style={{ '--px': player[0], '--py': player[1] } as React.CSSProperties}
        >
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
              {alertIds.has(c.id) && (
                <span className="resident-alert" aria-label="相談あり">!</span>
              )}
              <span className="char-sprite" style={characterSpriteStyle(c.id)} />
              <span className="resident-name">{c.name}</span>
            </button>
          ))}
          <div className="player" aria-label="主人公">
            <span className="char-sprite player-sprite" style={playerSpriteStyle(gender, facing)} />
          </div>
        </div>
      </div>
      <p className="town-help">矢印キーで移動 / 住民のとなりでスペースで会話</p>
    </section>
  )
}
