import type { CSSProperties } from 'react'
import type { Gender } from '../types'

// Kenney Tiny Town / Tiny Dungeon (CC0) — 12x11 tiles, 16px, packed
export interface Sheet {
  url: string
  cols: number
  rows: number
}

export const TOWN_SHEET: Sheet = {
  url: `${import.meta.env.BASE_URL}assets/tiny-town/tilemap_packed.png`,
  cols: 12,
  rows: 11,
}

export const CHAR_SHEET: Sheet = {
  url: `${import.meta.env.BASE_URL}assets/tiny-dungeon/tilemap_packed.png`,
  cols: 12,
  rows: 11,
}

/** シートの index 番タイルを要素いっぱいに表示する background スタイル */
export function sheetStyle(sheet: Sheet, index: number): CSSProperties {
  const col = index % sheet.cols
  const row = Math.floor(index / sheet.cols)
  return {
    backgroundImage: `url(${sheet.url})`,
    backgroundSize: `${sheet.cols * 100}% ${sheet.rows * 100}%`,
    backgroundPosition: `${(col / (sheet.cols - 1)) * 100}% ${(row / (sheet.rows - 1)) * 100}%`,
  }
}

interface CharSprite {
  tile: number
  filter?: string
}

// characterId → Tiny Dungeon の人物タイル
const CHARACTER_SPRITES: Record<string, CharSprite> = {
  hinata: { tile: 99 },
  koji: { tile: 87 },
  'kr-genta': { tile: 86 },
  'kr-yoshie': { tile: 84 },
  misaki: { tile: 98, filter: 'hue-rotate(150deg)' },
  ren: { tile: 97 },
  tanaka: { tile: 88 },
  tetsujiro: { tile: 100 },
  'tencho-gozo': { tile: 110 },
}

// 未知のIDはここからハッシュで自動割当(住民は今後増える)
const FALLBACK_POOL = [85, 86, 87, 88, 99, 100, 84, 97, 96]

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function characterSpriteStyle(characterId: string): CSSProperties {
  const sprite =
    CHARACTER_SPRITES[characterId] ?? {
      tile: FALLBACK_POOL[hash(characterId) % FALLBACK_POOL.length],
    }
  return { ...sheetStyle(CHAR_SHEET, sprite.tile), filter: sprite.filter }
}

// 主人公: Antifarea 16x18 4方向チャーセット (CC-BY 3.0) — 3列(歩行フレーム)×4行(向き)
export type Facing = 'up' | 'down' | 'left' | 'right'

const FACING_ROW: Record<Facing, number> = { up: 0, left: 1, down: 2, right: 3 }

export function playerSpriteStyle(gender: Gender, facing: Facing = 'down'): CSSProperties {
  return {
    backgroundImage: `url(${import.meta.env.BASE_URL}assets/player/${gender}.png)`,
    backgroundSize: '300% 400%',
    // 中央列 = 立ちポーズ
    backgroundPosition: `50% ${(FACING_ROW[facing] / 3) * 100}%`,
  }
}
