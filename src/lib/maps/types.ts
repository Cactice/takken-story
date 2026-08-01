// 複数マップの共通型。マップ本体は「全角文字1文字 = 1タイル」のグリッドで書く。
//
//   ┌─ 凡例(legend)で 文字 → タイル定義 を対応づける
//   │  例) 路=アスファルト(通行可) / ビ=オフィスビル(通行不可) / 木=街路樹(通行不可)
//   └─ 建物のように複数タイルにまたがるものは、同じ文字を敷き詰めるだけでよい。
//      矩形の輪郭を見て屋根の左右・下辺・壁を自動で選ぶ(9スライス)。
//      入口の座標と物件IDは buildings 側で別途指定する。
//
// 既存の src/lib/map.ts(ありきた村)は文字グリッドではなくタイル番号直書きだが、
// arikita.ts のアダプタで同じ GameMap 形に落としてある。

import type { Sheet } from '../sprites'

/** 屋根+壁の9スライス定義。矩形の位置から自動でタイルを選ぶ */
export interface BuildingStyle {
  /** 屋根 上段 [左, 中, 右] */
  roofTop: readonly [number, number, number]
  /** 屋根 中段 [左, 中, 右]。高い建物はここを繰り返す */
  roofMid: readonly [number, number, number]
  /** 屋根 下段 [左, 中, 右] */
  roofBottom: readonly [number, number, number]
  /** 1階の壁(最下段)。[左, 中, 右] */
  wall: readonly [number, number, number]
  /** 入口タイル(最下段の入口座標に置く) */
  door: number
  /** 経年・傷みの表現(CSS filter) */
  filter?: string
}

export interface TileDef {
  /** 説明(凡例の可読性のため。コードでは使わない) */
  label: string
  /** 地面タイル番号。省略すると map の defaultGround を使う */
  ground?: number
  /** 地面に重ねるタイル(街路樹・街灯・信号など) */
  over?: number
  /** 建物の一部。同じ文字が並んだ矩形を1棟として9スライスで描く */
  building?: BuildingStyle
  /** 通行不可 */
  solid?: boolean
  /** over / building に掛ける CSS filter */
  filter?: string
}

export type Legend = Readonly<Record<string, TileDef>>

/** 建物1棟。グリッド上で同じ文字が並ぶ矩形と、入口の座標で紐づく */
export interface MapBuilding {
  /** properties.ts の PropertySpec.id と対応 */
  id: string
  /** 表示名(デバッグ・検証メッセージ用) */
  name: string
  /** 入口タイルの絶対座標。この矩形の最下段に置くこと */
  entrance: readonly [number, number]
}

/** 空き地・農地の看板。スペースで土地の情報を見る */
export interface MapSign {
  /** properties.ts の PropertySpec.id */
  id: string
  x: number
  y: number
}

/** 手で書くマップ定義。defineMap() に渡してコンパイルする */
export interface MapSpec {
  id: string
  /** 画面に出すマップ名 */
  name: string
  /** どの世代の舞台か */
  generation: number
  sheet: Sheet
  /** 凡例に無い文字が来たときの土台 & 建物の下に敷く地面 */
  defaultGround: string
  legend: Legend
  /** 1行=1文字列。全角文字なので等幅フォントで縦に揃って見える */
  grid: readonly string[]
  buildings: readonly MapBuilding[]
  signs: readonly MapSign[]
  /** 住民ID → 立ち位置 */
  residentSpots: Readonly<Record<string, readonly [number, number]>>
  /** residentSpots に無い住民の予備の立ち位置 */
  spareSpots: readonly (readonly [number, number])[]
  start: readonly [number, number]
  /** 看板スプライトのタイル番号 */
  signTile: number
  /** ビューポートのマップ外の色 */
  outsideColor: string
}

/** 描画用に展開済みのマップ。TownView はこれだけ見れば描ける */
export interface GameMap {
  id: string
  name: string
  generation: number
  sheet: Sheet
  cols: number
  rows: number
  /** [y][x] の地面タイル番号 */
  ground: readonly (readonly number[])[]
  /** [y][x] の重ねタイル(null = 何も無い) */
  over: readonly (readonly (OverCell | null)[])[]
  buildings: readonly MapBuilding[]
  signs: readonly MapSign[]
  residentSpots: Readonly<Record<string, readonly [number, number]>>
  spareSpots: readonly (readonly [number, number])[]
  start: readonly [number, number]
  signTile: number
  outsideColor: string
  isSolid(x: number, y: number): boolean
  inBounds(x: number, y: number): boolean
  /** そのタイルに紐づく物件ID(建物のどこを向いても、看板を向いても出る) */
  propertyIdAt(x: number, y: number): string | undefined
}

export interface OverCell {
  tile: number
  filter?: string
}

/** 全角前提なのでコードポイント単位で切る */
const chars = (row: string): string[] => [...row]

const key = (x: number, y: number) => `${x},${y}`

/** 同じ文字が繋がっている矩形を1棟として拾う */
function buildingRects(grid: string[][], legend: Legend) {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  const seen = new Set<string>()
  const rects: { ch: string; x0: number; y0: number; x1: number; y1: number }[] = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const ch = grid[y][x]
      if (!legend[ch]?.building || seen.has(key(x, y))) continue
      // 右へ・下へ伸ばして矩形にする(建物は矩形前提)
      let x1 = x
      while (x1 + 1 < cols && grid[y][x1 + 1] === ch && !seen.has(key(x1 + 1, y))) x1++
      let y1 = y
      while (y1 + 1 < rows && grid[y1 + 1].slice(x, x1 + 1).every((c) => c === ch)) y1++
      for (let yy = y; yy <= y1; yy++) for (let xx = x; xx <= x1; xx++) seen.add(key(xx, yy))
      rects.push({ ch, x0: x, y0: y, x1, y1 })
    }
  }
  return rects
}

/**
 * 矩形内の (x,y) に置くタイルを9スライスで決める。
 * 入口は「壁を地面に敷いて、その上に扉スプライトを重ねる」(扉は背景が透明なため)
 */
function buildingTile(
  s: BuildingStyle,
  x: number,
  y: number,
  r: { x0: number; y0: number; x1: number; y1: number },
  isDoor: boolean,
): { tile: number; ground?: number } {
  const col = x === r.x0 ? 0 : x === r.x1 ? 2 : 1
  if (y === r.y1) return isDoor ? { tile: s.door, ground: s.wall[col] } : { tile: s.wall[col] }
  if (y === r.y0) return { tile: s.roofTop[col] }
  if (y === r.y1 - 1) return { tile: s.roofBottom[col] }
  return { tile: s.roofMid[col] }
}

/** 手書きの MapSpec を描画用の GameMap に展開する */
export function defineMap(spec: MapSpec): GameMap {
  const grid = spec.grid.map(chars)
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  const base = spec.legend[spec.defaultGround]
  const baseGround = base?.ground ?? 0

  const ground: number[][] = []
  const over: (OverCell | null)[][] = []
  const solid = new Set<string>()
  for (let y = 0; y < rows; y++) {
    ground.push(new Array(cols).fill(baseGround))
    over.push(new Array(cols).fill(null))
    for (let x = 0; x < cols; x++) {
      const def = spec.legend[grid[y][x]]
      if (!def) continue
      if (def.ground !== undefined) ground[y][x] = def.ground
      if (def.over !== undefined) over[y][x] = { tile: def.over, filter: def.filter }
      if (def.solid || def.building) solid.add(key(x, y))
    }
  }

  const doors = new Set(spec.buildings.map((b) => key(b.entrance[0], b.entrance[1])))
  const propertyAt = new Map<string, string>()
  for (const r of buildingRects(grid, spec.legend)) {
    const style = spec.legend[r.ch].building!
    const filter = spec.legend[r.ch].filter ?? style.filter
    const owner = spec.buildings.find(
      (b) => b.entrance[0] >= r.x0 && b.entrance[0] <= r.x1 && b.entrance[1] >= r.y0 && b.entrance[1] <= r.y1,
    )
    for (let y = r.y0; y <= r.y1; y++) {
      for (let x = r.x0; x <= r.x1; x++) {
        const cell = buildingTile(style, x, y, r, doors.has(key(x, y)))
        over[y][x] = { tile: cell.tile, filter }
        if (cell.ground !== undefined) ground[y][x] = cell.ground
        if (owner) propertyAt.set(key(x, y), owner.id)
      }
    }
  }
  for (const s of spec.signs) {
    solid.add(key(s.x, s.y))
    propertyAt.set(key(s.x, s.y), s.id)
  }

  return {
    ...spec,
    cols,
    rows,
    ground,
    over,
    isSolid: (x, y) => solid.has(key(x, y)),
    inBounds: (x, y) => x >= 0 && y >= 0 && x < cols && y < rows,
    propertyIdAt: (x, y) => propertyAt.get(key(x, y)),
  }
}

/** 到達できるマスを開始位置から塗る */
function reachable(map: GameMap): Set<string> {
  const seen = new Set<string>([key(map.start[0], map.start[1])])
  const queue: [number, number][] = [[map.start[0], map.start[1]]]
  while (queue.length > 0) {
    const [x, y] = queue.pop()!
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
      const nx = x + dx
      const ny = y + dy
      const k = key(nx, ny)
      if (!map.inBounds(nx, ny) || map.isSolid(nx, ny) || seen.has(k)) continue
      seen.add(k)
      queue.push([nx, ny])
    }
  }
  return seen
}

/**
 * マップの整合性チェック。map.ts の checkMap() と同じ役割。
 * 行の長さ・凡例に無い文字・入口の位置・道が繋がっているかを機械的に見る。
 */
export function checkMap(map: GameMap, spec?: MapSpec): string[] {
  const errors: string[] = []

  if (spec) {
    const cols = [...spec.grid[0]].length
    spec.grid.forEach((row, y) => {
      const cs = chars(row)
      if (cs.length !== cols) errors.push(`grid[${y}] の長さが ${cs.length}(他の行は ${cols})`)
      cs.forEach((ch, x) => {
        if (!(ch in spec.legend)) errors.push(`grid[${y}][${x}] に凡例に無い文字「${ch}」`)
        if (ch.codePointAt(0)! < 0x2000) errors.push(`grid[${y}][${x}] の「${ch}」が半角(全角文字で書くこと)`)
      })
    })
  }

  const claimed = new Set<string>()
  const claim = (x: number, y: number, who: string) => {
    if (!map.inBounds(x, y)) errors.push(`${who} がマップ外 (${x},${y})`)
    const k = key(x, y)
    if (claimed.has(k)) errors.push(`${who} が (${x},${y}) で他のオブジェクトと重なっている`)
    claimed.add(k)
  }

  const reach = reachable(map)
  const adjacent = (x: number, y: number) =>
    ([[0, -1], [0, 1], [-1, 0], [1, 0]] as const).some(([dx, dy]) => reach.has(key(x + dx, y + dy)))

  if (map.isSolid(map.start[0], map.start[1])) errors.push('開始位置が建物の中')

  for (const b of map.buildings) {
    const [x, y] = b.entrance
    if (!map.isSolid(x, y)) errors.push(`${b.name} の入口 (${x},${y}) が建物の外にある`)
    if (map.propertyIdAt(x, y) !== b.id) errors.push(`${b.name} の入口 (${x},${y}) がこの建物の矩形の中に無い`)
    if (!adjacent(x, y)) errors.push(`${b.name} の入口 (${x},${y}) に辿り着けない`)
  }
  for (const s of map.signs) {
    claim(s.x, s.y, `看板:${s.id}`)
    if (!adjacent(s.x, s.y)) errors.push(`看板 ${s.id} に辿り着けない`)
  }
  for (const [id, [x, y]] of Object.entries(map.residentSpots)) {
    if (map.isSolid(x, y)) errors.push(`住民 ${id} の立ち位置 (${x},${y}) が建物の中`)
    else if (!reach.has(key(x, y))) errors.push(`住民 ${id} の立ち位置 (${x},${y}) に辿り着けない`)
  }
  for (const [x, y] of map.spareSpots) {
    if (map.isSolid(x, y)) errors.push(`予備の立ち位置 (${x},${y}) が建物の中`)
    else if (!reach.has(key(x, y))) errors.push(`予備の立ち位置 (${x},${y}) に辿り着けない`)
  }
  return errors
}

/** DEV では定義ミスを即エラーにする(map.ts と同じ流儀) */
export function assertMap(map: GameMap, spec?: MapSpec): GameMap {
  if (import.meta.env?.DEV) {
    const errors = checkMap(map, spec)
    if (errors.length > 0) throw new Error(`マップ「${map.name}」の定義が不正:\n- ${errors.join('\n- ')}`)
  }
  return map
}
