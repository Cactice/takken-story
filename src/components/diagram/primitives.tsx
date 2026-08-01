import type { CSSProperties, ReactNode } from 'react'
import { characterSpriteStyle } from '../../lib/sprites'
import { MONEY_TILE, TOWN_TILE, roleSpriteStyle, townTile } from './tiles'

/**
 * 図解の共通プリミティブ。すべての図はここにある部品の組み合わせだけで描く。
 * 各図が独自のスタイルを持つことは禁止(docs/DESIGN.md)。
 */

/** 意味の色。装飾では使わない */
export type Role = 'own' | 'right' | 'money' | 'time' | 'land' | 'other'

/** 野帳の1ページ。方眼紙 + インクの枠 + 見出しタブ */
export function Sheet({
  tab,
  summary,
  children,
  legend,
}: {
  tab: string
  /** スクリーンリーダー用の一文。図の意味を必ず言葉でも持たせる */
  summary: string
  children: ReactNode
  legend?: ReactNode
}) {
  return (
    <figure className="dg-page" role="group" aria-label={summary}>
      <span className="dg-tab">{tab}</span>
      <div className="dg-sheet">
        {children}
        {legend !== undefined && <div className="dg-legend">{legend}</div>}
      </div>
      <figcaption className="dg-sr">{summary}</figcaption>
    </figure>
  )
}

/** ラベル箱 */
export function Box({
  role = 'other',
  children,
  className = '',
  style,
}: {
  role?: Role
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <div className={`dg-box dg-${role} ${className}`} style={style}>
      {children}
    </div>
  )
}

/** 数値。ドットフォントで押した野帳の数字 */
export function Num({ children, big = false }: { children: ReactNode; big?: boolean }) {
  return <span className={big ? 'dg-num dg-num-lg' : 'dg-num'}>{children}</span>
}

/**
 * 人物チップ。ゲーム内の住民スプライトをそのまま出す。
 * 役名(売主・妻…)には固定の顔、それ以外は住民と同じハッシュ割当。
 */
export function Person({ id, label }: { id: string; label?: string }) {
  return (
    <span
      className="dg-chip dg-chip-person"
      style={roleSpriteStyle(id) ?? characterSpriteStyle(id)}
      role="img"
      aria-label={label ?? id}
    />
  )
}

/** 建物チップ。屋根タイル + 壁タイルを縦に積む */
export function House({ tone = 'warm' }: { tone?: 'warm' | 'cool' }) {
  const roof = tone === 'warm' ? TOWN_TILE.roofWarm : TOWN_TILE.roofCool
  const wall = tone === 'warm' ? TOWN_TILE.wallDoorWarm : TOWN_TILE.wallDoorCool
  return (
    <span className="dg-house" aria-hidden="true">
      <span style={townTile(roof)} />
      <span style={townTile(wall)} />
    </span>
  )
}

/** 建物の側面(容積率の階数表示に使う)。壁を n 段積んで屋根をのせる */
export function Storeys({ floors, tone = 'warm' }: { floors: number; tone?: 'warm' | 'cool' }) {
  const roof = tone === 'warm' ? TOWN_TILE.roofWarm : TOWN_TILE.roofCool
  const wall = tone === 'warm' ? TOWN_TILE.wallWindowWarm : TOWN_TILE.wallWindowCool
  const door = tone === 'warm' ? TOWN_TILE.wallDoorWarm : TOWN_TILE.wallDoorCool
  return (
    <span className="dg-house dg-storeys" aria-hidden="true">
      <span style={townTile(roof)} />
      {Array.from({ length: Math.max(0, floors - 1) }, (_, i) => (
        <span key={i} style={townTile(wall)} />
      ))}
      {floors > 0 && <span style={townTile(door)} />}
    </span>
  )
}

/** 看板・境界標 */
export function Sign() {
  return <span className="dg-chip" style={townTile(TOWN_TILE.sign)} aria-hidden="true" />
}

/** 硬貨の山 */
export function Coins() {
  return <span className="dg-chip" style={townTile(MONEY_TILE)} aria-hidden="true" />
}

/** 矢印。label は線の上に出る */
export function Arrow({
  label,
  role,
  back = false,
  dashed = false,
}: {
  label?: string
  role?: Role
  back?: boolean
  dashed?: boolean
}) {
  const color = role === undefined ? undefined : `var(--dg-${role}-edge)`
  return (
    <span className="dg-flow" style={{ ['--dg-arrow-color' as string]: color }}>
      {back && <span className="dg-arrow-head dg-arrow-head-left" />}
      <span className={`dg-arrow-line${dashed ? ' dg-dashed' : ''}`} />
      {!back && <span className="dg-arrow-head" />}
      {label !== undefined && label !== '' && <span className="dg-arrow-label">{label}</span>}
    </span>
  )
}

/** 凡例の1項目 */
export function LegendItem({ role, name, value }: { role: Role; name: string; value?: string }) {
  return (
    <span className="dg-legend-item">
      <span className={`dg-swatch dg-${role}`} />
      {name}
      {value !== undefined && <b>{value}</b>}
    </span>
  )
}
