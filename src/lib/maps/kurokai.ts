// 第2世代の舞台「黒会市(くろかいし)」。
// Kenney Roguelike Modern City (CC0) のタイル。37列 x 28行 の packed。
//
// ══ 凡例 ══════════════════════════════════════════════════
//   地面  路=アスファルト  線=車線(白線)  央=センターライン
//         横=横断歩道(縦じま)  断=横断歩道(横じま)
//         歩=歩道  広=広場コンクリ  空=更地(空き地)
//   装飾  木=街路樹  灯=街灯  信=信号機  販=自販機  箱=ゴミ箱
//   建物  駅=黒会駅  ビ=オフィスビル  マ=タワーマンション
//         雑=雑居ビル  コ=コンビニ  店=テナント店舗
//         社=黒会不動産(事務所)  倉=倉庫
// ══════════════════════════════════════════════════════════
// グリッドは全角1文字=1タイル。同じ建物の文字を敷き詰めると、
// 矩形の輪郭から屋根の左右・下辺・1階の壁を自動で選ぶ(types.ts の9スライス)。
// 入口の座標と物件IDは BUILDINGS 側で指定する。
// 行の長さ・凡例に無い文字・入口・道の繋がりは checkMap() が機械的に検証する。

import type { Sheet } from '../sprites'
import { assertMap, defineMap } from './types.ts'
import type { BuildingStyle, GameMap, Legend, MapSpec } from './types.ts'

export const CITY_SHEET: Sheet = {
  url: `${import.meta.env?.BASE_URL ?? '/'}assets/city/tilemap_packed.png`,
  cols: 37,
  rows: 28,
}

/** 屋上 [奥, 手前] × [左, 中, 右] */
const ROOF = {
  grey: [[50, 51, 52], [124, 125, 126]],
  white: [[53, 54, 55], [127, 128, 129]],
  tan: [[61, 62, 63], [135, 136, 137]],
  brick: [[37, 38, 39], [111, 112, 113]],
} as const

/** 2階以上の壁。1行=1階。階の境に庇が入るので、積むと階数が数えられる */
const FLOOR = {
  brick: [259, 260, 262],
  grey: [263, 264, 266],
  tan: [267, 268, 270],
  glass: [271, 272, 274],
} as const

/** 1階の壁(足元に基礎が入る) [左, 中, 右] */
const WALL = {
  brick: [296, 297, 299],
  grey: [300, 301, 303],
  tan: [304, 305, 307],
  glass: [308, 309, 311],
} as const

/** 入口 */
const DOOR = { glass: 732, shop: 658 } as const

/** 屋上の小物(給水槽・室外機)。透明背景なので屋根の上に重ねる */
const ROOFTOP = [543, 544, 545, 546] as const

const style = (
  roof: readonly (readonly number[])[],
  floor: readonly number[],
  wall: readonly number[],
  door: number,
  filter?: string,
): BuildingStyle => ({
  roofTop: roof[0] as [number, number, number],
  roofBottom: roof[1] as [number, number, number],
  floor: floor as [number, number, number],
  wall: wall as [number, number, number],
  door,
  filter,
})

const LEGEND: Legend = {
  // ── 地面 ──
  路: { label: 'アスファルト', ground: 714 },
  線: { label: '車線(白線)', ground: 712 },
  央: { label: 'センターライン', ground: 749 },
  横: { label: '横断歩道(縦じま)', ground: 827 },
  断: { label: '横断歩道(横じま)', ground: 824 },
  歩: { label: '歩道', ground: 741 },
  広: { label: '広場のコンクリート', ground: 890 },
  空: { label: '更地(空き地)', ground: 892 },
  // ── 装飾(通行不可) ──
  木: { label: '街路樹', ground: 741, over: 440, solid: true },
  灯: { label: '街灯', ground: 741, over: 668, solid: true },
  信: { label: '信号機', ground: 741, over: 557, solid: true },
  販: { label: '自動販売機', ground: 741, over: 985, solid: true },
  箱: { label: 'ゴミ箱', ground: 741, over: 532, solid: true },
  // ── 建物 ──
  駅: { label: '黒会駅', building: style(ROOF.brick, FLOOR.brick, WALL.brick, DOOR.glass) },
  ビ: { label: 'オフィスビル', building: style(ROOF.white, FLOOR.grey, WALL.glass, DOOR.glass) },
  マ: { label: 'タワーマンション', building: style(ROOF.tan, FLOOR.tan, WALL.tan, DOOR.shop) },
  雑: {
    label: '雑居ビル',
    building: style(ROOF.brick, FLOOR.brick, WALL.brick, DOOR.shop, 'brightness(0.92)'),
  },
  コ: { label: 'コンビニ', building: style(ROOF.white, FLOOR.grey, WALL.glass, DOOR.shop) },
  店: { label: 'テナント店舗', building: style(ROOF.tan, FLOOR.brick, WALL.brick, DOOR.shop) },
  社: { label: '黒会不動産(事務所)', building: style(ROOF.white, FLOOR.grey, WALL.glass, DOOR.shop) },
  倉: {
    label: '倉庫',
    building: style(ROOF.grey, FLOOR.grey, WALL.grey, DOOR.glass, 'brightness(0.85)'),
  },
  // 入口を持たない背景のビル群。少し暗く沈めて奥行きを出す
  オ: {
    label: '背景の高層ビル',
    building: style(ROOF.grey, FLOOR.grey, WALL.grey, DOOR.glass, 'brightness(0.86) saturate(0.9)'),
  },
}

// 25列 x 25行。奥に背景の高層ビル、手前に中低層 —— 縦の段数でスカイラインを作る。
// **階数 = 矩形の高さ - 2**(屋上2段)。BUILDINGS の floors と checkMap() が突き合わせる。
const GRID = [
  'オオオオ歩歩歩歩歩歩歩路央歩ビビビビ歩歩歩歩オオオ',
  'オオオオ歩マママママ歩路央歩ビビビビ歩歩歩歩オオオ',
  'オオオオ歩マママママ歩路央歩ビビビビ歩歩歩歩オオオ',
  'オオオオ歩マママママ歩路央歩ビビビビ歩マママオオオ',
  'オオオオ歩マママママ歩路央歩ビビビビ歩マママオオオ',
  'オオオオ歩マママママ歩路央歩ビビビビ歩マママオオオ',
  'オオオオ歩マママママ歩路央歩ビビビビ歩マママオオオ',
  'オオオオ歩マママママ歩路央歩ビビビビ歩マママオオオ',
  '駅駅駅駅歩マママママ歩路央歩ビビビビ歩マママオオオ',
  '駅駅駅駅歩マママママ歩路央歩ビビビビ歩マママオオオ',
  '駅駅駅駅歩マママママ歩路央歩ビビビビ歩マママコココ',
  '駅駅駅駅歩マママママ歩路央歩ビビビビ歩マママコココ',
  '駅駅駅駅歩マママママ歩路央歩ビビビビ歩マママコココ',
  '歩歩歩木歩歩歩歩灯歩信断断歩歩歩歩木歩歩歩歩販歩歩',
  '路路路路路路路路路横路路路路横路路路路路路路路路路',
  '線線線線線線線線線横線路路線横線線線線線線線線線線',
  '歩歩灯歩歩歩木歩販歩歩断断信歩歩箱歩歩歩木歩歩歩歩',
  '広社社社社広雑雑雑雑広路央広店店店広倉倉倉広空空空',
  '広社社社社広雑雑雑雑広路央広店店店広倉倉倉広空空空',
  '広社社社社広雑雑雑雑広路央広店店店広倉倉倉広空空空',
  '広社社社社広雑雑雑雑広路央広広広広広広広広広空空空',
  '広広広広広広雑雑雑雑広路央広広広広広広広広広空空空',
  '広木広広広広広広広広広路央広広木広広広灯広広空空空',
  '広広広広灯広広広箱広広路央広広広広広広広販広空空空',
  '広広広広広広広広広広広路央広広広広広広広広広空空空',
]

const SPEC: MapSpec = {
  id: 'kurokai',
  name: '黒会市',
  generation: 2,
  sheet: CITY_SHEET,
  defaultGround: '歩',
  legend: LEGEND,
  grid: GRID,
  buildings: [
    // ── 駅前ブロック(北)。奥に背景の高層ビル、手前に中低層 ──
    { id: 'kurokai-station', name: '黒会駅', entrance: [1, 12], floors: 3 },
    { id: 'kurokai-mansion-w', name: 'パークマンション黒会', entrance: [6, 12], floors: 10 },
    { id: 'kurokai-tower-office', name: '黒会セントラルタワー', entrance: [15, 12], floors: 11 },
    { id: 'kurokai-tower-mansion', name: 'スカイレジデンス黒会', entrance: [20, 12], floors: 8 },
    { id: 'kurokai-konbini', name: 'コンビニ黒会駅前店', entrance: [23, 12], floors: 1 },
    // ── 南ブロック ──
    { id: 'kurokai-agency', name: '黒会不動産(事務所)', entrance: [2, 20], floors: 2 },
    { id: 'kurokai-zakkyo-s', name: '南口雑居ビル', entrance: [7, 21], floors: 3 },
    { id: 'kurokai-shop-s', name: '南商店', entrance: [15, 19], floors: 1 },
    { id: 'kurokai-souko', name: '東倉庫', entrance: [19, 19], floors: 1 },
  ],
  // 屋上の給水槽・室外機。上から見えるのは屋上なので、ここで高さの実感を足す
  decor: [
    { x: 15, y: 0, tile: ROOFTOP[0] },
    { x: 16, y: 1, tile: ROOFTOP[1] },
    { x: 6, y: 2, tile: ROOFTOP[2] },
    { x: 8, y: 2, tile: ROOFTOP[3] },
    { x: 20, y: 4, tile: ROOFTOP[0] },
    { x: 1, y: 1, tile: ROOFTOP[1] },
    { x: 2, y: 0, tile: ROOFTOP[3] },
    { x: 23, y: 1, tile: ROOFTOP[2] },
    { x: 2, y: 9, tile: ROOFTOP[0] },
    { x: 7, y: 18, tile: ROOFTOP[1] },
  ],
  signs: [
    { id: 'kurokai-vacant-east', x: 23, y: 22 },
    { id: 'kurokai-parking', x: 6, y: 23 },
  ],
  // 第2世代の住民が増えたらここに足す(IDは content 側と合わせる)
  residentSpots: {
    umizawa: [3, 21], // 海沢 → 事務所の前
  },
  spareSpots: [
    [5, 21], [7, 22], [15, 20], [19, 20], [17, 21], [1, 21],
    [4, 13], [4, 5], [18, 8], [10, 5],
  ],
  start: [3, 22],
  signTile: 283,
  outsideColor: '#3f4650',
}

export const KUROKAI: GameMap = assertMap(defineMap(SPEC), SPEC)
export const KUROKAI_SPEC = SPEC
