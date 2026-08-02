// 自動生成: scripts/make-winter-tiles.py。手で編集しない。
// 雪版シートにだけ存在するタイル番号。
//   snow          … 雪が積もったマス(中心は白ベタ、ふちだけディザ)。模様違いが2枚
//   rutH / rutV   … 轍(わだち)が残った道。横の道 / 縦の道
//   snowman       … 雪だるま
//   bareTree      … 葉を落とした落葉樹(枝に雪)。常緑樹は元のタイルに雪が乗るので不要

/** 元のタイル番号 → 冬のタイル候補 */
export type SnowTable = Readonly<Record<number, readonly number[]>>

/** 雪版シートの大きさ(足したタイルのぶん、元より縦に長い) */
export const TOWN_WINTER_SIZE = { cols: 12, rows: 13 }
export const CITY_WINTER_SIZE = { cols: 37, rows: 29 }

export const TOWN_SNOWMAN = 132
export const CITY_SNOWMAN = 1036

export const TOWN_BARE_TREE = 133
export const CITY_BARE_TREE = 1037

export const TOWN_SNOW: SnowTable = {
  0: [134, 135],
  1: [136, 137],
  2: [138, 139],
  39: [140, 141],
  41: [142, 143],
}

export const CITY_SNOW: SnowTable = {
  741: [1038, 1039],
  890: [1040, 1041],
  892: [1042, 1043],
  889: [1044, 1045],
  704: [1046, 1047],
  705: [1048, 1049],
  707: [1050, 1051],
  708: [1052, 1053],
}

export const TOWN_RUT_H: SnowTable = {
  25: [144],
}

export const TOWN_RUT_V: SnowTable = {
  25: [145],
}

export const CITY_RUT_H: SnowTable = {
  714: [1054],
  712: [1056],
  749: [1058],
  827: [1060],
  824: [1062],
  838: [1064],
}

export const CITY_RUT_V: SnowTable = {
  714: [1055],
  712: [1057],
  749: [1059],
  827: [1061],
  824: [1063],
  838: [1065],
}

