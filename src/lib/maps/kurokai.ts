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

/** 屋根の9スライス(上段/中段/下段) */
const ROOF = {
  grey: [[50, 51, 52], [87, 88, 89], [124, 125, 126]],
  white: [[53, 54, 55], [90, 91, 92], [127, 128, 129]],
  tan: [[61, 62, 63], [98, 99, 100], [135, 136, 137]],
  brick: [[37, 38, 39], [74, 75, 76], [111, 112, 113]],
} as const

/** 1階の壁 [左, 中, 右] */
const WALL = {
  brick: [296, 297, 299],
  grey: [300, 301, 303],
  tan: [304, 305, 307],
  glass: [308, 309, 311],
} as const

/** 入口 */
const DOOR = { glass: 732, shop: 658 } as const

const style = (
  roof: readonly (readonly [number, number, number] | readonly number[])[],
  wall: readonly number[],
  door: number,
  filter?: string,
): BuildingStyle => ({
  roofTop: roof[0] as [number, number, number],
  roofMid: roof[1] as [number, number, number],
  roofBottom: roof[2] as [number, number, number],
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
  駅: { label: '黒会駅', building: style(ROOF.grey, WALL.grey, DOOR.glass) },
  ビ: { label: 'オフィスビル', building: style(ROOF.white, WALL.glass, DOOR.glass) },
  マ: { label: 'タワーマンション', building: style(ROOF.tan, WALL.tan, DOOR.shop) },
  雑: { label: '雑居ビル', building: style(ROOF.brick, WALL.brick, DOOR.shop, 'brightness(0.92)') },
  コ: { label: 'コンビニ', building: style(ROOF.white, WALL.glass, DOOR.shop) },
  店: { label: 'テナント店舗', building: style(ROOF.tan, WALL.brick, DOOR.shop) },
  社: { label: '黒会不動産(事務所)', building: style(ROOF.white, WALL.glass, DOOR.shop) },
  倉: { label: '倉庫', building: style(ROOF.grey, WALL.grey, DOOR.glass, 'brightness(0.85)') },
}

// 25列 x 20行。ありきた村と同じ広さ。
const GRID = [
  '駅駅駅駅駅駅雑雑雑歩歩路央歩ビビビビ歩ママママ歩歩',
  '駅駅駅駅駅駅雑雑雑歩歩路央歩ビビビビ歩ママママ歩歩',
  '駅駅駅駅駅駅雑雑雑歩歩路央歩ビビビビ歩ママママ歩歩',
  '駅駅駅駅駅駅雑雑雑歩歩路央歩ビビビビ歩ママママ歩歩',
  '駅駅駅駅駅駅雑雑雑歩歩路央歩ビビビビ歩ママママ歩歩',
  '木歩歩歩歩歩歩歩歩木歩路央歩木歩歩歩歩歩歩歩歩歩木',
  'ビビビビ歩ママママ歩歩路央歩コココ歩店店店歩倉倉倉',
  'ビビビビ歩ママママ歩歩路央歩コココ歩店店店歩倉倉倉',
  'ビビビビ歩ママママ歩歩路央歩コココ歩店店店歩倉倉倉',
  '歩歩灯歩歩歩歩歩歩歩信断断歩販歩歩歩歩歩歩灯歩歩歩',
  '路路路路路路路路路横路路路路横路路路路路路路路路路',
  '線線線線線線線線線横線路路線横線線線線線線線線線線',
  '歩歩歩箱歩歩歩歩歩歩歩断断信歩歩歩歩木歩歩歩歩歩歩',
  '社社社社歩雑雑雑雑歩歩路央歩店店店歩雑雑雑歩空空空',
  '社社社社歩雑雑雑雑歩歩路央歩店店店歩雑雑雑歩空空空',
  '社社社社歩雑雑雑雑歩歩路央歩店店店歩雑雑雑歩空空空',
  '広広広広広広広広広広歩路央歩広広広広広広広広空空空',
  '広木広広灯広広販広広歩路央歩広木広広灯広広広空空空',
  '広広広箱広広広広広広歩路央歩広広広広広広広広空空空',
  '広広広広広広広広広広歩路央歩広広広広広広広広空空空',
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
    // ── 駅前ブロック(北) ──
    { id: 'kurokai-station', name: '黒会駅', entrance: [2, 4] },
    { id: 'kurokai-zakkyo-n', name: '北口雑居ビル', entrance: [7, 4] },
    { id: 'kurokai-tower-office', name: '黒会セントラルタワー', entrance: [15, 4] },
    { id: 'kurokai-tower-mansion', name: 'スカイレジデンス黒会', entrance: [20, 4] },
    // ── 大通り沿い(北) ──
    { id: 'kurokai-office-w', name: '西口オフィスビル', entrance: [1, 8] },
    { id: 'kurokai-mansion-w', name: 'パークマンション黒会', entrance: [6, 8] },
    { id: 'kurokai-konbini', name: 'コンビニ黒会駅南店', entrance: [15, 8] },
    { id: 'kurokai-shop-n', name: '大通りテナント', entrance: [19, 8] },
    { id: 'kurokai-souko', name: '東倉庫', entrance: [23, 8] },
    // ── 大通り沿い(南) ──
    { id: 'kurokai-agency', name: '黒会不動産(事務所)', entrance: [1, 15] },
    { id: 'kurokai-zakkyo-s', name: '南口雑居ビル', entrance: [6, 15] },
    { id: 'kurokai-shop-s', name: '南商店', entrance: [15, 15] },
    { id: 'kurokai-zakkyo-e', name: '東雑居ビル', entrance: [19, 15] },
  ],
  signs: [
    { id: 'kurokai-vacant-east', x: 23, y: 17 },
    { id: 'kurokai-parking', x: 9, y: 17 },
  ],
  // 第2世代の住民が増えたらここに足す(IDは content 側と合わせる)
  residentSpots: {
    umizawa: [2, 16], // 海沢 → 事務所の前
  },
  spareSpots: [
    [5, 16], [7, 16], [4, 12], [8, 12], [16, 16], [20, 16],
    [3, 9], [15, 5], [5, 5], [17, 12],
  ],
  start: [5, 17],
  signTile: 283,
  outsideColor: '#3f4650',
}

export const KUROKAI: GameMap = assertMap(defineMap(SPEC), SPEC)
export const KUROKAI_SPEC = SPEC
