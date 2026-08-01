import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Character, Gender } from '../../types'
import { TOWN_SHEET, characterSpriteStyle, playerSpriteStyle, sheetStyle } from '../../lib/sprites'
import type { Facing } from '../../lib/sprites'
import {
  BUILDINGS,
  DECOR,
  GROUND,
  GROUND_TILE,
  HIBARI,
  LAND_SIGNS,
  MAP_COLS,
  MAP_ROWS,
  RESIDENT_SPOTS,
  SPARE_SPOTS,
  START_POS,
  T,
  inBounds,
  isSolid,
  propertyIdAt,
} from '../../lib/map'
import { propertyById } from '../../lib/properties'
import { PropertyPanel } from '../property/PropertyPanel'
import './town.css'

interface Props {
  characters: Character[]
  gender: Gender
  /** 相談が控えている住民のID(頭に「!」を表示) */
  alertIds: ReadonlySet<string>
  /** 会話中は移動・決定キーを無効化 */
  inputLocked: boolean
  /** 会社(ひばり不動産)の頭上に「!」を出す(新しい転入者のサイン) */
  companyAlert?: boolean
  onTapCharacter: (c: Character) => void
}

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

export function TownView({
  characters,
  gender,
  alertIds,
  inputLocked,
  companyAlert = false,
  onTapCharacter,
}: Props) {
  const [player, setPlayer] = useState<[number, number]>(START_POS)
  const [facing, setFacing] = useState<Facing>('up')
  const [openProperty, setOpenProperty] = useState<string | null>(null)

  // 住民は悩みに合った建物の前へ。未登録のIDは予備の立ち位置に回す
  let spare = 0
  const residents = characters.map((c) => ({
    character: c,
    spot: RESIDENT_SPOTS[c.id] ?? SPARE_SPOTS[spare++ % SPARE_SPOTS.length],
  }))

  const panelOpen = openProperty !== null

  useEffect(() => {
    if (inputLocked || panelOpen) return
    const residentAt = new Map(residents.map((r) => [`${r.spot[0]},${r.spot[1]}`, r.character]))

    const onKey = (e: KeyboardEvent) => {
      const dir = KEY_DIR[e.key]
      if (dir) {
        e.preventDefault()
        setFacing(dir[2])
        setPlayer(([x, y]) => {
          const nx = x + dir[0]
          const ny = y + dir[1]
          if (!inBounds(nx, ny)) return [x, y]
          if (isSolid(nx, ny) || residentAt.has(`${nx},${ny}`)) return [x, y]
          return [nx, ny]
        })
        return
      }
      if (e.key !== ' ' && e.key !== 'Enter') return
      e.preventDefault()
      setPlayer(([x, y]) => {
        const [dx, dy] = FACE_DELTA[facing]
        const fx = x + dx
        const fy = y + dy
        // 1. 向いている先に住民 → 会話
        const faced = residentAt.get(`${fx},${fy}`)
        if (faced) {
          onTapCharacter(faced)
          return [x, y]
        }
        // 2. 向いている先が建物 or 空き地の看板 → 物件ステータス
        const propId = propertyIdAt(fx, fy)
        if (propId) {
          setOpenProperty(propId)
          return [x, y]
        }
        // 3. 向きが合っていなくても隣の住民とは話せる(取り回し優先)
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
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // residents は characters から導出で毎回同値
  }, [inputLocked, panelOpen, facing, characters, onTapCharacter]) // eslint-disable-line react-hooks/exhaustive-deps

  const openSpec = openProperty === null ? undefined : propertyById(openProperty)

  return (
    <section className="town" aria-label="町">
      <div className="town-viewport">
        {/* カメラ: 主人公が常に中央。--px/--py でマップ側を逆方向に translate */}
        <div
          className="town-grid"
          style={
            {
              '--px': player[0],
              '--py': player[1],
              '--cols': MAP_COLS,
              '--rows': MAP_ROWS,
            } as CSSProperties
          }
        >
          {GROUND.flatMap((row, y) =>
            [...row].map((ch, x) => (
              <div
                key={`${x}-${y}`}
                className="tile"
                style={{
                  ...sheetStyle(TOWN_SHEET, GROUND_TILE[ch] ?? T.grass),
                  gridColumn: x + 1,
                  gridRow: y + 1,
                }}
              />
            )),
          )}

          {DECOR.map((d, i) => (
            <div
              key={`d${i}`}
              className="tile obj"
              style={{ ...sheetStyle(TOWN_SHEET, d.tile), gridColumn: d.x + 1, gridRow: d.y + 1 }}
            />
          ))}

          {BUILDINGS.flatMap((b) =>
            b.cells.flatMap((row, dy) =>
              row.map((tile, dx) =>
                tile < 0 ? null : (
                  <div
                    key={`${b.id}-${dx}-${dy}`}
                    className="tile obj"
                    style={{
                      ...sheetStyle(TOWN_SHEET, tile),
                      gridColumn: b.x + dx + 1,
                      gridRow: b.y + dy + 1,
                      filter: b.filter,
                    }}
                  />
                ),
              ),
            ),
          )}

          {LAND_SIGNS.map((sign) => (
            <div
              key={sign.id}
              className="tile obj land-sign"
              style={{
                ...sheetStyle(TOWN_SHEET, T.sign),
                gridColumn: sign.x + 1,
                gridRow: sign.y + 1,
              }}
              aria-label="土地の看板"
            />
          ))}

          {companyAlert && (
            <div
              className="building-alert"
              style={{ gridColumn: HIBARI.x + 2, gridRow: HIBARI.y }}
              aria-label="会社に用事あり"
            >
              !
            </div>
          )}

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
                <span className="resident-alert" aria-label="相談あり">
                  !
                </span>
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

      <p className="town-help">
        矢印キーで移動 / 住民のとなりでスペースで会話 / 建物・看板を向いてスペースで物件情報
      </p>

      {openSpec && <PropertyPanel spec={openSpec} onClose={() => setOpenProperty(null)} />}
    </section>
  )
}
