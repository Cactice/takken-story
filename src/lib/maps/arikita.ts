// 第1世代「ありきた村」。既存の src/lib/map.ts を GameMap 形に変換するアダプタ。
//
// map.ts は別作業で使用中なので触らず、ここで読み替えるだけにしてある。
// TODO(あとで): map.ts の GROUND / BUILDINGS / DECOR を kurokai.ts と同じ
//   「全角文字グリッド + 凡例」に書き直して、このアダプタごと消す。
//   そのとき村の凡例は 草/木/花/道/畑/空(空き地)/家… あたりになる。

import {
  BUILDINGS,
  DECOR,
  GROUND,
  GROUND_TILE,
  LAND_SIGNS,
  MAP_COLS,
  MAP_ROWS,
  RESIDENT_SPOTS,
  SPARE_SPOTS,
  START_POS,
  T,
} from '../map'
import { TOWN_SHEET } from '../sprites'
import type { GameMap, MapBuilding, OverCell } from './types.ts'

const key = (x: number, y: number) => `${x},${y}`

function build(): GameMap {
  const ground = GROUND.map((row) => [...row].map((ch) => GROUND_TILE[ch] ?? T.grass))
  const over: (OverCell | null)[][] = Array.from({ length: MAP_ROWS }, () =>
    new Array<OverCell | null>(MAP_COLS).fill(null),
  )
  const solid = new Set<string>()
  const propertyAt = new Map<string, string>()

  for (const d of DECOR) {
    over[d.y][d.x] = { tile: d.tile }
    if (d.solid) solid.add(key(d.x, d.y))
  }
  for (const b of BUILDINGS) {
    b.cells.forEach((row, dy) =>
      row.forEach((tile, dx) => {
        if (tile < 0) return
        const x = b.x + dx
        const y = b.y + dy
        over[y][x] = { tile, filter: b.filter }
        solid.add(key(x, y))
        propertyAt.set(key(x, y), b.id)
      }),
    )
  }
  for (const s of LAND_SIGNS) {
    solid.add(key(s.x, s.y))
    propertyAt.set(key(s.x, s.y), s.id)
  }

  const buildings: MapBuilding[] = BUILDINGS.map((b) => ({
    id: b.id,
    name: b.id,
    entrance: b.entrance,
  }))

  return {
    id: 'arikita',
    name: 'ありきた村',
    generation: 1,
    sheet: TOWN_SHEET,
    cols: MAP_COLS,
    rows: MAP_ROWS,
    ground,
    over,
    buildings,
    signs: LAND_SIGNS.map((s) => ({ ...s })),
    residentSpots: RESIDENT_SPOTS,
    spareSpots: SPARE_SPOTS,
    start: START_POS,
    signTile: T.sign,
    outsideColor: '#3d7a35',
    isSolid: (x, y) => solid.has(key(x, y)),
    inBounds: (x, y) => x >= 0 && y >= 0 && x < MAP_COLS && y < MAP_ROWS,
    propertyIdAt: (x, y) => propertyAt.get(key(x, y)),
  }
}

export const ARIKITA: GameMap = build()
