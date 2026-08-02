// マップの一覧。世代 → 舞台の対応もここ。
//
// ── 既存コードへの繋ぎ方(3ステップ) ────────────────────────────
// 1. TownView に `map: GameMap` と `season: Season` を prop で足し、
//    `src/lib/map.ts` からの import を
//    `map.isSolid / map.inBounds / map.propertyIdAt / map.residentSpots /
//     map.spareSpots / map.start / map.cols / map.rows / map.signTile` に置き換える。
//    絵は季節ごとのハガネヤーから取る:
//      const layer = map.layers[season]
//      layer.ground[y][x] / layer.over[y][x] / layer.sheet / layer.filter
//    描画順は 地面 → 影(map.shadows に半透明の黒) → 重ね物 → 看板 → 人。
//    参照実装は src/dev-preview/main.tsx の MapPreview。
//    town.css の `.town-viewport { background }` は map.outsideColor を使う。
// 2. App.tsx で
//      <TownView ... map={MAP_OF_GENERATION[state.generation] ?? ARIKITA}
//                    season={seasonOfMonth(cal.month)} />
//    (1年=4分・1季節=1分。cal.month から seasonOfMonth() で引く)
// 3. タイトルの後に `<GenerationSelect unlocked={...} onSelect={...} />` を挟む。
//    unlocked は「クリア済み世代+1」までの Set を App 側で作って渡す
//    (GenerationSelect は解放判定を持たない)。
// ──────────────────────────────────────────────────────────────
export type {
  BuildingStyle,
  GameMap,
  Legend,
  MapBuilding,
  MapDecor,
  MapSign,
  MapSpec,
  OverCell,
  PlacedBuilding,
  Season,
  SeasonLayer,
  SeasonSkin,
  TileDef,
} from './types.ts'
export { SEASONS, SEASON_LABEL, seasonOfMonth, seasonLayers } from './types.ts'
export { assertMap, checkMap, defineMap } from './types.ts'

import { ARIKITA } from './arikita.ts'
import { KUROKAI } from './kurokai.ts'
import type { GameMap } from './types.ts'

export { ARIKITA, KUROKAI }

export const MAPS: Readonly<Record<string, GameMap>> = {
  arikita: ARIKITA,
  kurokai: KUROKAI,
}

/** 世代 → その世代で最初に立つ舞台 */
export const MAP_OF_GENERATION: Readonly<Record<number, GameMap>> = {
  1: ARIKITA,
  2: KUROKAI,
  3: ARIKITA,
  4: KUROKAI,
  5: ARIKITA,
}

export function mapById(id: string): GameMap | undefined {
  return MAPS[id]
}
