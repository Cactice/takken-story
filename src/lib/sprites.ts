import type { CSSProperties } from 'react'
import type { Gender } from '../types'

// Kenney Tiny Town / Tiny Dungeon (CC0) — 12x11 tiles, 16px, packed
export interface Sheet {
  url: string
  cols: number
  rows: number
}

export const TOWN_SHEET: Sheet = {
  url: `${import.meta.env?.BASE_URL ?? '/'}assets/tiny-town/tilemap_packed.png`,
  cols: 12,
  rows: 11,
}

export const CHAR_SHEET: Sheet = {
  url: `${import.meta.env?.BASE_URL ?? '/'}assets/tiny-dungeon/tilemap_packed.png`,
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

// characterId → Tiny Dungeon の人物タイル。ここに無い家系は種(下)から自動で決まる
const CHARACTER_SPRITES: Record<string, CharSprite> = {
  'hageta-hageta': { tile: 110 },
}

/**
 * 家系ごとに見た目を揃える。同じ家の人は同じスプライトになる。
 * 値がタイル番号ならその絵、characterId ならその人と同じ絵。
 * 既に画面に出ている人を種にしてあるので、その人の見た目は変わらない
 */
const FAMILY_SEED: Record<string, string | CharSprite> = {
  // 既に画面に出ている人に合わせる(その人の見た目は変えない)
  禿鷹: 'hageta-hageta',
  都倉: 'togura-yonnan',
  葉山: 'hayama-oji',
  黒瀬: 'kurose-hagane',
  // 家の性格で選ぶ
  白石: { tile: 108 }, // 青い宇宙人みたいなやつ
  織部: { tile: 84 }, // 魔法使い(織部シルビア)
  見沼: { tile: 100 }, // 白髪の女性
  主: { tile: 87 },
  海沢: { tile: 96 },
  鈴木: { tile: 85 },
  桜井: { tile: 112 },
  水瀬: { tile: 111 },
  岸和田: { tile: 88 },
  田中: { tile: 109 },
  冬野: { tile: 98 },
  安西: { tile: 97, filter: 'hue-rotate(150deg)' },
}

// 種も明示指定もない家系はここからハッシュで自動割当
const FALLBACK_POOL = [85, 86, 87, 88, 99, 100, 84, 97, 96]

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

// characterId → 苗字。全世代ぶんを読む(スプライトは世代をまたいで一貫させたい)
const FAMILY_OF: Record<string, string> = (() => {
  const out: Record<string, string> = {}
  try {
    const mods = import.meta.glob<{ default: { id: string; familyName?: string } }>(
      '../../content/gen*/characters/*.json',
      { eager: true },
    )
    for (const m of Object.values(mods)) {
      if (m.default.familyName) out[m.default.id] = m.default.familyName
    }
  } catch {
    // maps 経由で node のチェックスクリプトからも読まれる。
    // glob は Vite が構文ごと置き換えるものなので、素の node では関数として存在しない
  }
  return out
})()

if (import.meta.env?.DEV) {
  // 家系が漏れるとハッシュに落ちて、別の家と見た目がかぶる
  const missing = [...new Set(Object.values(FAMILY_OF))].filter((f) => !FAMILY_SEED[f])
  if (missing.length) console.error(`FAMILY_SEED に無い家系: ${missing.join('・')}`)
}

function spriteOf(characterId: string): CharSprite {
  const explicit = CHARACTER_SPRITES[characterId]
  if (explicit) return explicit
  const family = FAMILY_OF[characterId]
  if (!family) return { tile: FALLBACK_POOL[hash(characterId) % FALLBACK_POOL.length] }
  // 家系に種があればそれ。無ければ苗字でハッシュ(=家族内で一致する)
  const seed = FAMILY_SEED[family]
  if (typeof seed === 'object') return seed
  if (seed) return CHARACTER_SPRITES[seed] ?? { tile: FALLBACK_POOL[hash(seed) % FALLBACK_POOL.length] }
  return { tile: FALLBACK_POOL[hash(family) % FALLBACK_POOL.length] }
}

export function characterSpriteStyle(characterId: string): CSSProperties {
  const sprite = spriteOf(characterId)
  return { ...sheetStyle(CHAR_SHEET, sprite.tile), filter: sprite.filter }
}

// 主人公: Antifarea 16x18 4方向チャーセット (CC-BY 3.0) — 3列(歩行フレーム)×4行(向き)
export type Facing = 'up' | 'down' | 'left' | 'right'

// シートの行順は 上・右・下・左(実画像で確認済み)
const FACING_ROW: Record<Facing, number> = { up: 0, right: 1, down: 2, left: 3 }

/** 歩行フレーム: 0=左足, 1=立ち, 2=右足。歩くたびに 0→1→2→1→… と踏み替える */
export const WALK_FRAMES = [1, 0, 1, 2] as const

export function playerSpriteStyle(
  gender: Gender,
  facing: Facing = 'down',
  /** 歩数。WALK_FRAMES を巡回して足を踏み替える */
  step = 0,
): CSSProperties {
  const col = WALK_FRAMES[step % WALK_FRAMES.length]
  return {
    backgroundImage: `url(${import.meta.env?.BASE_URL ?? '/'}assets/player/${gender}.png)`,
    backgroundSize: '300% 400%',
    backgroundPosition: `${(col / 2) * 100}% ${(FACING_ROW[facing] / 3) * 100}%`,
  }
}
