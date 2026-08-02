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
import type { Sheet } from '../sprites'
import { cellHash, drift, seasonLayers } from './types.ts'
import {
  TOWN_RUT_H,
  TOWN_RUT_V,
  TOWN_SNOW,
  TOWN_SNOWMAN,
  TOWN_WINTER_SIZE,
} from './winter-tiles.ts'
import type { GameMap, OverCell, PlacedBuilding, Season, SeasonSkin } from './types.ts'

/** 雪が積もった版のタイルシート(scripts/make-winter-tiles.py で生成) */
export const TOWN_WINTER_SHEET: Sheet = {
  url: `${import.meta.env?.BASE_URL ?? '/'}assets/tiny-town/tilemap_winter.png`,
  ...TOWN_WINTER_SIZE,
}

/** 雪だるまを置いた場所。この周りだけ雪が濃くなる(誰かが雪をかき集めた跡) */
const SNOWMEN: readonly (readonly [number, number])[] = [
  [5, 3],
  [14, 8],
  [5, 18],
  [19, 16],
]

/**
 * 冬の地面。道は轍が残った雪。草地は3割くらいのマスに雪が積もり、残りのマスは雪なし。
 * 積もるマスは吹きだまりで塊になり、雪だるまの周りは必ず積もる(雪をかき集めた跡)。
 */
function snowAt(tile: number, x: number, y: number): number | undefined {
  // 道は轍を残す。左右に道が続いていれば横向き、そうでなければ縦向き
  const isPath = (px: number, py: number) => GROUND[py]?.[px] === 'P'
  const rut = (isPath(x - 1, y) || isPath(x + 1, y) ? TOWN_RUT_H : TOWN_RUT_V)[tile]
  if (rut) return rut[0]
  const near = SNOWMEN.some(([sx, sy]) => Math.abs(sx - x) + Math.abs(sy - y) <= 2)
  if (!near && !drift(x, y, 30)) return undefined // このマスは雪なし
  const vs = TOWN_SNOW[tile]
  return vs?.[cellHash(x, y) % vs.length]
}

/**
 * 村の季節。農村なので変化は大きく。
 * 木(緑27/橙28)・草むら・花・苗を入れ替え、冬はシートごと雪版にする。
 */
const SEASONS_ARIKITA: Partial<Record<Season, SeasonSkin>> = {
  // 春: 枯れ色の木が芽吹き、草むらに花が咲く
  spring: { swap: { [T.treeOrange]: T.treeGreen, [T.grassTuft]: T.flowers }, filter: 'saturate(1.06) brightness(1.05)' },
  // 夏: 濃い緑。草むらは伸びて茂みに
  summer: {
    swap: { [T.treeOrange]: T.treeGreen, [T.grassTuft]: T.bush, [T.flowers]: T.grassTuft },
    filter: 'saturate(1.3) contrast(1.04)',
  },
  // 秋: 全部紅葉。花は散り、茂みにきのこ
  autumn: {
    swap: { [T.treeGreen]: T.treeOrange, [T.flowers]: T.grassTuft, [T.bush]: T.mushroom },
    filter: 'sepia(0.18) saturate(1.25) hue-rotate(-12deg)',
  },
  // 冬: 雪。屋根・木・地面に雪を「足した」シートに差し替える(色は元のまま)。
  // 道端に雪だるまを置くのが一番「冬だ」と伝わる
  winter: {
    sheet: TOWN_WINTER_SHEET,
    swap: { [T.flowers]: T.grassTuft, [T.sprout]: T.grassTuft },
    tileAt: snowAt,
    decor: SNOWMEN.map(([x, y]) => ({ x, y, tile: TOWN_SNOWMAN })),
  },
}

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

  const buildings: PlacedBuilding[] = BUILDINGS.map((b) => ({
    id: b.id,
    name: b.id,
    entrance: b.entrance,
    rect: {
      x0: b.x,
      y0: b.y,
      x1: b.x + Math.max(...b.cells.map((row) => row.length)) - 1,
      y1: b.y + b.cells.length - 1,
    },
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
    layers: seasonLayers(TOWN_SHEET, ground, over, SEASONS_ARIKITA),
    buildings,
    // 村は平屋ばかりなので影は落とさない
    shadows: [],
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
