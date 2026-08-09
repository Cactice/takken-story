import type React from 'react'

// 図に置く物の絵。線は細く、面は少なく。人物と同じ調子で揃える。
// 文字の記号(▭ ⌂ ¥)では素人に伝わらないので、輪郭のある絵にする。

export type IconName =
  | 'land' | 'house' | 'building' | 'money' | 'paper' | 'stamp' | 'key'
  | 'clock' | 'road' | 'tree' | 'fence' | 'slope' | 'office' | 'court'
  | 'bank' | 'shop' | 'farm' | 'warn'

const INK = '#6b6355'
const FILL = '#e6e0d4'

const SHAPES: Record<IconName, React.ReactElement> = {
  land: <><rect x="4" y="12" width="32" height="18" /><path d="M4 21h32M20 12v18" /></>,
  house: <><path d="M6 20 20 8l14 12" /><rect x="10" y="20" width="20" height="14" /><rect x="17" y="26" width="6" height="8" /></>,
  building: <><rect x="9" y="6" width="22" height="28" /><path d="M14 12h4M22 12h4M14 18h4M22 18h4M14 24h4M22 24h4" /></>,
  money: <><rect x="5" y="11" width="30" height="19" rx="1.5" /><circle cx="20" cy="20.5" r="5" /><path d="M9 15h2M29 26h2" /></>,
  paper: <><path d="M11 5h13l6 6v24H11z" /><path d="M24 5v6h6" /><path d="M15 20h11M15 26h11" /></>,
  stamp: <><rect x="13" y="6" width="14" height="9" rx="1" /><path d="M20 15v8" /><rect x="8" y="23" width="24" height="6" rx="1" /><path d="M6 33h28" /></>,
  key: <><circle cx="13" cy="17" r="6" /><path d="M17 21 31 35M27 31l4-4M23 27l3-3" /></>,
  clock: <><circle cx="20" cy="20" r="13" /><path d="M20 12v9l6 4" /></>,
  road: <><path d="M12 34 16 6M28 34 24 6" /><path d="M20 9v4M20 17v4M20 25v4" /></>,
  tree: <><path d="M20 30V17" /><path d="M20 6c6 4 8 8 8 11H12c0-3 2-7 8-11z" /><path d="M13 34h14" /></>,
  fence: <><path d="M9 14v20M20 14v20M31 14v20M5 19h30M5 26h30" /></>,
  slope: <><path d="M4 32h12l10-14h10" /><path d="M4 32h32" /><path d="M18 32V22" strokeDasharray="2 2" /></>,
  office: <><path d="M6 16 20 7l14 9" /><rect x="9" y="16" width="22" height="18" /><path d="M15 34V24h4v10M25 22h2M25 28h2" /></>,
  court: <><path d="M20 7v27M10 34h20" /><path d="M8 14h24" /><path d="M8 14 4 24h8zM32 14l-4 10h8" /></>,
  bank: <><path d="M5 16 20 7l15 9" /><path d="M8 16v16M16 16v16M24 16v16M32 16v16" /><path d="M4 34h32" /></>,
  shop: <><path d="M8 15h24l2 5H6z" /><rect x="9" y="20" width="22" height="14" /><rect x="14" y="25" width="7" height="9" /></>,
  farm: <><path d="M4 26h32M4 31h32" /><path d="M10 26v-6M18 26v-8M26 26v-6M34 26v-8" /></>,
  warn: <><path d="M20 6 34 32H6z" /><path d="M20 16v8M20 28v.5" /></>,
}

export function Icon({ name, size = 40 }: { name: IconName; size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} className="icon" aria-hidden>
      <g fill={FILL} stroke={INK} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round">
        {SHAPES[name] ?? SHAPES.land}
      </g>
    </svg>
  )
}
