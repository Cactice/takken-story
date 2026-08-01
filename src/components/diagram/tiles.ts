import type { CSSProperties } from 'react'
import { CHAR_SHEET, TOWN_SHEET, sheetStyle } from '../../lib/sprites'

/**
 * 図解で使う Kenney タイルの番号。
 * 図の中の「人・家・土地・お金」は棒人間ではなく**ゲーム内と同じドット絵**で描く。
 * 番号の根拠は public/assets/CREDITS.md と docs/DESIGN.md を参照。
 */
export const TOWN_TILE = {
  grass: 0,
  grassFlower: 2,
  dirt: 40,
  dirtRough: 41,
  gravel: 43,
  sign: 83,
  roofWarm: 67,
  roofCool: 63,
  wallDoorWarm: 87,
  wallDoorCool: 91,
  wallWindowWarm: 84,
  wallWindowCool: 88,
  floorWarm: 73,
  floorCool: 77,
  fence: 81,
  coin: 93,
} as const

/** 硬貨は Tiny Town の金塊タイル。Dungeon の 82 番は樽に見えて金に読めない */
export const MONEY_TILE = TOWN_TILE.coin

export function townTile(index: number): CSSProperties {
  return sheetStyle(TOWN_SHEET, index)
}

export function charTile(index: number): CSSProperties {
  return sheetStyle(CHAR_SHEET, index)
}

/**
 * 敷き詰める地面。パックシートは繰り返せないので、使う5枚だけ単体PNGに切り出してある
 * (public/assets/diagram/*.png ← tiny-town から抽出、同じCC0)。
 */
export type Ground = 'grass' | 'dirt' | 'road' | 'gravel' | 'floor-warm' | 'floor-cool'

/**
 * 図の中の役名(売主・妻・長男…)に固定のドット絵を割り当てる。
 * 割り当てがないものは lib/sprites.ts のハッシュ配分に任せる(同じ名前なら常に同じ顔)。
 * これがないと「妻」に騎士の顔が出るなど、世界観が壊れる。
 */
const ROLE_TILE: Record<string, number> = {
  夫: 86,
  妻: 84,
  父: 100,
  母: 84,
  長男: 112,
  次男: 109,
  長女: 99,
  次女: 99,
  子: 112,
  売主: 86,
  買主: 99,
  貸主: 100,
  借主: 112,
  家主: 100,
  借地人: 112,
  相続人: 99,
  第三者: 96,
}

export function roleSpriteStyle(label: string): CSSProperties | undefined {
  // 「夫(亡)」「妻(配偶者)」のような注記つきでも拾えるように前方一致で見る
  const key = Object.keys(ROLE_TILE).find((k) => label.startsWith(k))
  return key === undefined ? undefined : sheetStyle(CHAR_SHEET, ROLE_TILE[key])
}

export function groundStyle(ground: Ground, tilePx = 16): CSSProperties {
  return {
    backgroundImage: `url(${import.meta.env.BASE_URL}assets/diagram/${ground}.png)`,
    backgroundSize: `${tilePx}px ${tilePx}px`,
    backgroundRepeat: 'repeat',
    imageRendering: 'pixelated',
  }
}
