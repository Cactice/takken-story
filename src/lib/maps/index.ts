// マップの一覧。世代 → 舞台の対応もここ。
export type { BuildingStyle, GameMap, Legend, MapBuilding, MapSign, MapSpec, OverCell, TileDef } from './types.ts'
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
