// 自動生成: scripts/make-winter-tiles.py。手で編集しない。
// 雪版シートにだけ存在するタイル番号。
//   snow          … 雪が積もったマス(中心は白ベタ、ふちだけディザ)。模様違いが2枚
//   rutH / rutV   … 轍(わだち)が残った道。横の道 / 縦の道
//   snowman       … 雪だるま

/** 元のタイル番号 → 冬のタイル候補 */
export type SnowTable = Readonly<Record<number, readonly number[]>>

/** 雪版シートの大きさ(足したタイルのぶん、元より縦に長い) */
export const TOWN_WINTER_SIZE = { cols: 12, rows: 13 }
export const CITY_WINTER_SIZE = { cols: 37, rows: 29 }

export const TOWN_SNOWMAN = 132
export const CITY_SNOWMAN = 1036

export const TOWN_SNOW: SnowTable = {
  0: [133, 134],
  1: [135, 136],
  2: [137, 138],
  39: [139, 140],
  41: [141, 142],
}

export const CITY_SNOW: SnowTable = {
  741: [1037, 1038],
  890: [1039, 1040],
  892: [1041, 1042],
  889: [1043, 1044],
  704: [1045, 1046],
  705: [1047, 1048],
  707: [1049, 1050],
  708: [1051, 1052],
}

export const TOWN_RUT_H: SnowTable = {
  25: [143],
}

export const TOWN_RUT_V: SnowTable = {
  25: [144],
}

export const CITY_RUT_H: SnowTable = {
  714: [1053],
  712: [1055],
  749: [1057],
  827: [1059],
  824: [1061],
  838: [1063],
}

export const CITY_RUT_V: SnowTable = {
  714: [1054],
  712: [1056],
  749: [1058],
  827: [1060],
  824: [1062],
  838: [1064],
}

