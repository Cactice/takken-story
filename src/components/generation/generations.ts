// 5世代のステージ情報。docs/STORY.md の内容をそのままデータにしたもの。
import { TOWN_SHEET, type Sheet } from '../../lib/sprites'
import { CITY_SHEET } from '../../lib/maps/kurokai'
import { T } from '../../lib/map'

/** サムネイル: ドット絵タイルを 8x5 で並べてその世代の舞台を1枚絵にする */
export interface Thumb {
  sheet: Sheet
  /** [行][列] のタイル番号 */
  tiles: readonly (readonly number[])[]
  /** 世代の空気を出すための色調(サスペンス回は暗く、など) */
  filter?: string
}

export interface GenerationInfo {
  generation: number
  title: string
  /** 舞台(マップID) */
  stage: string
  stageName: string
  goal: string
  tone: string
  summary: string
  /** 学習方針 */
  study: string
  thumb: Thumb
}

const g = T.grass
const t = T.grassTuft
const P = T.path
const S = T.soil

/** 村のサムネイル(赤屋根の家 + 木 + 畑) */
const villageTiles = [
  [g, T.treeGreen, g, g, T.treeOrange, g, g, T.treeGreen],
  [g, g, T.roofRedL, T.roofRedM, T.roofRedR, g, g, g],
  [g, T.bush, T.wallWoodWindow, T.doorWood, T.wallWoodWindow, g, T.flowers, g],
  [P, P, P, P, P, P, P, P],
  [g, t, S, S, S, T.sprout, g, T.mushroom],
]

/** 都会のサムネイル(ビル + アスファルト + 横断歩道) */
const cityTiles = (roofTop: number) => [
  [53, 54, 55, 61, 62, 63, roofTop, roofTop + 1],
  [90, 91, 92, 98, 99, 100, 87, 88],
  [127, 128, 129, 135, 136, 137, 124, 125],
  [308, 309, 311, 304, 305, 307, 300, 301],
  [741, 741, 838, 827, 838, 838, 741, 741],
]

export const GENERATIONS: readonly GenerationInfo[] = [
  {
    generation: 1,
    title: 'ほのぼの村移住編',
    stage: 'arikita',
    stageName: 'ありきた村',
    goal: '資産1億円',
    tone: '原点と基礎',
    summary:
      '自然豊かな村に移住してきた主人公。村の不動産屋「ハゲ田社長」に拾われ、\n村人の小さな住まいの悩みを解きながら、地域密着の不動産業を引き継ぐ。',
    study: '宅建業法・権利関係の基礎',
    thumb: { sheet: TOWN_SHEET, tiles: villageTiles },
  },
  {
    generation: 2,
    title: '都会の洗礼と野望編',
    stage: 'kurokai',
    stageName: '黒会市',
    goal: '資産1億円 + ノルマ達成',
    tone: 'スピードと誘惑',
    summary:
      '過疎の村に限界を感じた2代目は、大都会「黒会市」で独立。\n胡散臭いコンサル「海沢」の助言で大金を掴むが、業法のタブーに足を踏み入れる。',
    study: '宅建業法の禁止事項を「やってしまう側」から',
    thumb: { sheet: CITY_SHEET, tiles: cityTiles(50) },
  },
  {
    generation: 3,
    title: '過去の遺産と村の謎編',
    stage: 'arikita',
    stageName: 'ありきた村',
    goal: '事件の解決',
    tone: 'サスペンス',
    summary:
      'おじいちゃんの急死をきっかけに、村の古株「見沼家」と新住民「鈴木家」の\n土地と境界を巡るドロドロの権利争いが勃発する。',
    study: '民法(相続・共有・境界・時効)',
    thumb: {
      sheet: TOWN_SHEET,
      tiles: villageTiles,
      filter: 'saturate(0.4) brightness(0.6) sepia(0.35) contrast(1.1)',
    },
  },
  {
    generation: 4,
    title: '没落からの大逆転編',
    stage: 'kurokai',
    stageName: '黒会市',
    goal: '資産10億円',
    tone: '都市開発・再建',
    summary:
      '2代目がついに欠格事由に該当し免許取り消し。ボロボロの会社を立て直すため、\n4代目は正当な「法令上の制限」を武器に巨大プロジェクトへ挑む。',
    study: '法令上の制限・免許制度(欠格事由)',
    thumb: { sheet: CITY_SHEET, tiles: cityTiles(37), filter: 'contrast(1.15) saturate(1.1)' },
  },
  {
    generation: 5,
    title: '新幹線誘致と村の最終決戦編',
    stage: 'arikita',
    stageName: 'ありきた村 & 黒会市 & 白夜村',
    goal: '新幹線の誘致',
    tone: '集大成・総力戦',
    summary:
      '黒幕・海沢が人工リゾート「白夜村」を掲げて新幹線を奪いにくる。\n歴代のキャラを総動員し、空き家バンクとリノベで村の人口を爆発させろ。',
    study: '農地法・税制優遇・全範囲の総復習',
    thumb: {
      sheet: TOWN_SHEET,
      tiles: [
        [g, T.treeGreen, g, T.roofBlueL, T.roofBlueM, T.roofBlueR, g, T.treeOrange],
        [g, g, g, T.wallStoneWindow, T.wallStone, T.wallStoneWindow, g, g],
        [g, T.roofRedL, T.roofRedR, T.wallStoneWindow, T.wallStoneOpening, T.wallStoneWindow, T.bush, g],
        [P, T.wallWoodWindow, T.doorWood, P, P, P, P, P],
        [g, t, g, T.flowers, g, T.sprout, g, t],
      ],
      filter: 'saturate(1.2) brightness(1.05)',
    },
  },
]
