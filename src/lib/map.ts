// ありきた村のマップ定義。Kenney Tiny Town (CC0) のタイル番号ベース。
// タイル番号は 12列 x 11行 の tilemap_packed.png のインデックス。

export const MAP_COLS = 25
export const MAP_ROWS = 20

/** Tiny Town タイル番号 */
export const T = {
  grass: 0,
  grassTuft: 1,
  flowers: 2,
  treeOrange: 27,
  treeGreen: 28,
  bush: 5,
  sprout: 17,
  mushroom: 29,
  path: 25,
  soil: 41,
  vacantLot: 39,
  // 屋根(青灰=RC/洋風、赤=木造)
  roofBlueL: 48,
  roofBlueM: 49,
  roofBlueR: 50,
  roofBlueLowL: 60,
  roofBlueLowM: 61,
  roofBlueLowR: 62,
  roofRedL: 52,
  roofRedM: 53,
  roofRedR: 54,
  roofRedLowL: 64,
  roofRedLowM: 65,
  roofRedLowR: 66,
  // 壁
  wallWood: 72,
  wallWoodCracked: 73,
  wallWoodOpening: 74,
  wallWoodWindow: 84,
  doorWood: 85,
  doorWoodB: 86,
  doorWoodC: 87,
  wallStone: 76,
  wallStoneR: 77,
  wallStoneOpening: 78,
  wallStoneWindow: 88,
  doorStone: 89,
  // 小物
  sign: 83,
  barrel: 130,
  log: 106,
} as const

/**
 * 地面レイヤー
 * G=草 t=草むら f=花 P=道 D=荒れ地(空き地) F=土(畑)
 */
export const GROUND: readonly string[] = [
  'GGGGGGGGGGGGGGGGGGGGGGGGG',
  'GGGGGGtGGGGGGGfGGGGGGGGGG',
  'GGGGGGGGGGGGGGGGGGGGGGDDD',
  'GGGGGGGGGGGGGGGGGGGGGGDDD',
  'GGGGGGGGGGGGGGGGGGGGGGDDD',
  'GGGGGGGGGGGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGGGGGGGGGGGGG',
  'PPPPPPPPPPPPPPPPPPPPPPPPP',
  'GGGGGPGGGGGGGGGGGPGGGGGGG',
  'GGGGGPGGGGGGGGGGGPGGGGGGG',
  'GGGGGPGGGGGGGGGGGPGGGGGGG',
  'GGGGGPGGGGGGGGGGGPGGGGGGG',
  'GGGGGPGGGGGGGGGGGPGGGGGGG',
  'PPPPPPPPPPPPPPPPPPPPPPPPP',
  'GGGPGGGGGGGGGGGPGGGGGGPGG',
  'GGGPGGGGGGFFFFFPGGGGGGDDG',
  'GGGPGGGGGGFFFFFGGDDDDGDDG',
  'GGPPGGGGGGFFFFFGGDDDDGDDG',
  'GGGGGGGGGGGGGGGGGDDDDGGGG',
  'GGGGGGGGGGGGGGGGGGGGGGGGG',
]

export const GROUND_TILE: Record<string, number> = {
  G: T.grass,
  t: T.grassTuft,
  f: T.flowers,
  P: T.path,
  D: T.vacantLot,
  F: T.soil,
}

export interface Building {
  /** properties.ts の PropertySpec.id と対応 */
  id: string
  /** 左上タイル座標 */
  x: number
  y: number
  /** 行ごとのタイル番号(-1 = 空き) */
  cells: readonly (readonly number[])[]
  /** 入口タイルの絶対座標。中に入れる建物はここから内装シーンへ */
  entrance: [number, number]
  /** 経年・傷みの表現(CSS filter) */
  filter?: string
}

const B = (
  id: string,
  x: number,
  y: number,
  cells: readonly (readonly number[])[],
  entrance: [number, number],
  filter?: string,
): Building => ({ id, x, y, cells, entrance, filter })

const w = T.wallWood
const ww = T.wallWoodWindow
const wo = T.wallWoodOpening
const s = T.wallStone
const sw = T.wallStoneWindow
const so = T.wallStoneOpening

export const BUILDINGS: readonly Building[] = [
  // ── 北ブロック(メイン通り沿い・南向き) ──
  // 禿鷹不動産(店舗)。赤い切妻屋根+ショーウィンドウ、通りで一番目立つ
  B('hibari', 2, 4, [
    [T.roofRedL, T.roofRedM, T.roofRedR],
    [T.roofRedLowL, T.roofRedLowM, T.roofRedLowR],
    [ww, wo, ww],
  ], [3, 6]),
  // ありきたハイツ(RCマンション)。4段積みで村で一番高い
  B('mansion', 7, 3, [
    [T.roofBlueL, T.roofBlueM, T.roofBlueR],
    [T.roofBlueLowL, T.roofBlueLowM, T.roofBlueLowR],
    [sw, s, sw],
    [sw, so, sw],
  ], [8, 6]),
  // ありきた診療所(鉄骨平屋)
  B('clinic', 12, 5, [
    [T.roofBlueL, T.roofBlueM, T.roofBlueR],
    [sw, so, sw],
  ], [13, 6]),
  // サクライベーカリー(店舗兼住宅)
  B('bakery', 17, 5, [
    [T.roofRedL, T.roofRedR],
    [wo, ww],
  ], [17, 6]),
  // みなせ生花店(借地上の店舗)
  B('flower', 20, 5, [
    [T.roofBlueL, T.roofBlueR],
    [sw, T.doorStone],
  ], [21, 6]),

  // ── 中央ブロック(南向き) ──
  // ガストン荘(木造アパート2階建)。1階に扉が3つ並ぶ
  B('apart-wood', 2, 9, [
    [T.roofRedL, T.roofRedM, T.roofRedR],
    [ww, ww, ww],
    [T.doorWood, T.doorWoodB, T.doorWoodC],
  ], [3, 11]),
  // 第二ガストン荘(築41年のボロアパート)
  B('apart-old', 7, 9, [
    [T.roofRedL, T.roofRedR],
    [ww, ww],
    [T.doorWood, T.doorWoodC],
  ], [8, 11], 'sepia(0.45) brightness(0.82)'),
  // オリビア邸(一戸建て)
  B('house-misaki', 11, 10, [
    [T.roofBlueL, T.roofBlueR],
    [sw, T.doorStone],
  ], [12, 11]),
  // シルビアの実家(旧・呉服店の古民家)
  B('kimono', 15, 10, [
    [T.roofRedL, T.roofRedR],
    [ww, wo],
  ], [16, 11], 'sepia(0.55) brightness(0.88)'),
  // ブルーノ工務店(準工業地域の作業所)
  B('koumuten', 19, 10, [
    [T.roofBlueL, T.roofBlueM, T.roofBlueR],
    [sw, so, s],
  ], [20, 11]),

  // ── 南ブロック ──
  // 主人公の自宅(ボロ屋)。壁はひび割れ、扉すらない
  B('player-home', 1, 15, [
    [T.roofRedL, T.roofRedR],
    [T.wallWoodCracked, wo],
  ], [2, 16], 'sepia(0.7) brightness(0.68) saturate(0.55)'),
  // ポッポ農場 母屋(市街化調整区域の農家住宅)
  B('farmhouse', 6, 15, [
    [T.roofRedL, T.roofRedM, T.roofRedR],
    [ww, wo, w],
  ], [7, 16], 'sepia(0.4) brightness(0.92)'),
]

/** 空き地・農地の看板。スペースで土地の情報を見る */
export interface LandSign {
  /** properties.ts の PropertySpec.id */
  id: string
  x: number
  y: number
}

export const LAND_SIGNS: readonly LandSign[] = [
  { id: 'vacant-hill', x: 23, y: 5 },
  { id: 'field', x: 12, y: 14 },
  { id: 'vacant-river', x: 18, y: 15 },
  { id: 'vacant-station', x: 22, y: 14 },
]

export interface Decor {
  x: number
  y: number
  tile: number
  solid?: boolean
}

export const DECOR: readonly Decor[] = [
  // 村を囲む木
  ...([[0, 0], [3, 0], [6, 0], [10, 0], [14, 0], [18, 0], [21, 0], [24, 0], [1, 1], [23, 1],
    [0, 2], [20, 2], [0, 3], [11, 3], [16, 3], [0, 5], [24, 5], [24, 6],
    [0, 9], [0, 12], [24, 9], [24, 12], [0, 15], [0, 18], [4, 19], [9, 19], [24, 16], [24, 19],
  ] as const).map(([x, y], i) => ({ x, y, tile: i % 2 ? T.treeOrange : T.treeGreen, solid: true })),
  // 不動産屋まわり
  { x: 1, y: 6, tile: T.sign, solid: true },
  { x: 5, y: 6, tile: T.bush },
  // 工務店の資材
  { x: 22, y: 11, tile: T.log, solid: true },
  { x: 22, y: 10, tile: T.barrel, solid: true },
  // 農場の畑(苗)
  ...([[10, 15], [12, 15], [14, 15], [11, 16], [13, 16], [10, 17], [12, 17], [14, 17]] as const).map(
    ([x, y]) => ({ x, y, tile: T.sprout }),
  ),
  // 草木のアクセント
  { x: 19, y: 6, tile: T.bush },
  { x: 22, y: 6, tile: T.flowers },
  { x: 20, y: 4, tile: T.bush },
  { x: 6, y: 18, tile: T.mushroom },
  { x: 17, y: 19, tile: T.bush },
]

/** 住民ID → 立ち位置。悩みの種になる建物の前に立たせる */
export const RESIDENT_SPOTS: Record<string, [number, number]> = {
  'tencho-gozo': [4, 7], // ハゲタ社長 → 禿鷹不動産の前
  koji: [8, 7], // チップ(区分所有・マンション購入) → ありきたハイツの前
  misaki: [13, 7], // オリビア(クリニック移転・自宅売却) → 診療所の前
  hinata: [17, 7], // メープル(店舗の建替え・2号店) → サクライベーカリーの前
  ren: [21, 7], // リオン(借地・農地) → みなせ生花店の前
  tetsujiro: [3, 12], // ガストン(大家・店子トラブル) → ガストン荘の前
  'kr-yoshie': [16, 12], // シルビア(相続・共有名義) → 実家(古民家)の前
  'kr-genta': [20, 12], // ブルーノ(現場の不法行為) → ブルーノ工務店の前
  tanaka: [9, 16], // ポッポさん(農地の売買・転用) → 農家と畑のあいだ
}

/** RESIDENT_SPOTS に無い住民が増えたときの予備の立ち位置 */
export const SPARE_SPOTS: readonly [number, number][] = [
  [10, 7], [15, 8], [6, 12], [11, 12], [18, 12], [5, 14], [15, 18], [2, 8],
]

const solid = new Set<string>()
for (const b of BUILDINGS) {
  b.cells.forEach((row, dy) =>
    row.forEach((tile, dx) => {
      if (tile >= 0) solid.add(`${b.x + dx},${b.y + dy}`)
    }),
  )
}
for (const sign of LAND_SIGNS) solid.add(`${sign.x},${sign.y}`)
for (const d of DECOR) if (d.solid) solid.add(`${d.x},${d.y}`)

export function isSolid(x: number, y: number): boolean {
  return solid.has(`${x},${y}`)
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < MAP_COLS && y < MAP_ROWS
}

const propertyAtCell = new Map<string, string>()
for (const b of BUILDINGS) {
  b.cells.forEach((row, dy) =>
    row.forEach((tile, dx) => {
      if (tile >= 0) propertyAtCell.set(`${b.x + dx},${b.y + dy}`, b.id)
    }),
  )
}
for (const sign of LAND_SIGNS) propertyAtCell.set(`${sign.x},${sign.y}`, sign.id)

/** そのタイルに紐づく物件ID(建物のどこを向いても、看板を向いても出る) */
export function propertyIdAt(x: number, y: number): string | undefined {
  return propertyAtCell.get(`${x},${y}`)
}

/** 建物の入口の前(契約した住民を立たせる場所)。埋まっているタイルは避ける */
export function frontOfBuilding(id: string, taken: ReadonlySet<string> = new Set()): [number, number] | undefined {
  const b = BUILDINGS.find((x) => x.id === id)
  if (!b) return undefined
  const [ex, ey] = b.entrance
  const around: [number, number][] = [
    [ex, ey + 1],
    [ex - 1, ey + 1],
    [ex + 1, ey + 1],
    [ex - 1, ey],
    [ex + 1, ey],
    [ex, ey + 2],
  ]
  return around.find(
    ([x, y]) => inBounds(x, y) && !isSolid(x, y) && !taken.has(`${x},${y}`),
  )
}

/** マップの整合性チェック(開発時のみ)。ここが落ちたらタイル座標がずれている */
export function checkMap(): string[] {
  const errors: string[] = []
  GROUND.forEach((row, y) => {
    if (row.length !== MAP_COLS) errors.push(`GROUND[${y}] の長さが ${row.length}`)
    ;[...row].forEach((ch, x) => {
      if (!(ch in GROUND_TILE)) errors.push(`GROUND[${y}][${x}] に未定義の記号 ${ch}`)
    })
  })
  const seen = new Set<string>()
  const claim = (x: number, y: number, who: string) => {
    if (!inBounds(x, y)) errors.push(`${who} がマップ外 (${x},${y})`)
    const k = `${x},${y}`
    if (seen.has(k)) errors.push(`${who} が (${x},${y}) で他のオブジェクトと重なっている`)
    seen.add(k)
  }
  for (const b of BUILDINGS) {
    b.cells.forEach((row, dy) =>
      row.forEach((tile, dx) => {
        if (tile >= 0) claim(b.x + dx, b.y + dy, b.id)
      }),
    )
    if (!isSolid(...b.entrance)) errors.push(`${b.id} の入口が建物の外にある`)
  }
  for (const s of LAND_SIGNS) claim(s.x, s.y, `看板:${s.id}`)
  for (const d of DECOR) if (d.solid) claim(d.x, d.y, `装飾(${d.tile})`)
  for (const [id, [x, y]] of Object.entries(RESIDENT_SPOTS)) {
    if (isSolid(x, y)) errors.push(`住民 ${id} の立ち位置 (${x},${y}) が建物の中`)
  }
  for (const [x, y] of SPARE_SPOTS) {
    if (isSolid(x, y)) errors.push(`予備の立ち位置 (${x},${y}) が建物の中`)
  }
  if (isSolid(...START_POS)) errors.push('開始位置が建物の中')

  // 開始位置から全ての物件に隣接できるか(道で繋がっているか)
  const reach = new Set<string>()
  const queue: [number, number][] = [START_POS]
  reach.add(`${START_POS[0]},${START_POS[1]}`)
  while (queue.length > 0) {
    const [x, y] = queue.pop()!
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
      const nx = x + dx
      const ny = y + dy
      const k = `${nx},${ny}`
      if (!inBounds(nx, ny) || isSolid(nx, ny) || reach.has(k)) continue
      reach.add(k)
      queue.push([nx, ny])
    }
  }
  const adjacentToReachable = (x: number, y: number) =>
    ([[0, -1], [0, 1], [-1, 0], [1, 0]] as const).some(([dx, dy]) => reach.has(`${x + dx},${y + dy}`))
  for (const b of BUILDINGS) {
    if (!adjacentToReachable(...b.entrance)) errors.push(`${b.id} の入口に辿り着けない`)
  }
  for (const s of LAND_SIGNS) {
    if (!adjacentToReachable(s.x, s.y)) errors.push(`看板 ${s.id} に辿り着けない`)
  }
  for (const [id, [x, y]] of Object.entries(RESIDENT_SPOTS)) {
    if (!adjacentToReachable(x, y)) errors.push(`住民 ${id} に辿り着けない`)
  }
  return errors
}

export const HIBARI = BUILDINGS.find((b) => b.id === 'hibari')!
export const PLAYER_HOME = BUILDINGS.find((b) => b.id === 'player-home')!

/** 開始位置: 自宅前の道 */
export const START_POS: [number, number] = [3, 13]

if (import.meta.env?.DEV) {
  const errors = checkMap()
  if (errors.length > 0) throw new Error(`マップ定義が不正:\n- ${errors.join('\n- ')}`)
}

