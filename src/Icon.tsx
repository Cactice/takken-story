import type React from 'react'

// 図に置く物の絵。線は細く、面は少なく。人物と同じ調子で揃える。
// 文字の記号(▭ ⌂ ¥)では素人に伝わらないので、輪郭のある絵にする。

export type IconName =
  | 'land' | 'house' | 'building' | 'money' | 'paper' | 'stamp' | 'key'
  | 'clock' | 'road' | 'tree' | 'fence' | 'slope' | 'office' | 'court'
  | 'bank' | 'shop' | 'farm' | 'warn'
  | 'lock' | 'group'
  | 'card' | 'sign' | 'book' | 'tent' | 'ban' | 'check' | 'shield'
  | 'handshake' | 'calendar' | 'mail'

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
  // 宅建士証・従業者証明書。顔写真のある札
  card: <><rect x="5" y="10" width="30" height="20" rx="2" /><circle cx="14" cy="18" r="3.5" /><path d="M9 27c1.5-3 8-3 9.5 0" /><path d="M23 17h8M23 22h8" /></>,
  // 標識。掲げる板
  sign: <><rect x="6" y="7" width="28" height="17" rx="1.5" /><path d="M11 13h18M11 18h11" /><path d="M20 24v10M14 34h12" /></>,
  // 従業者名簿・帳簿。綴じた帳面
  book: <><path d="M8 7h20a3 3 0 0 1 3 3v23H11a3 3 0 0 1-3-3z" /><path d="M8 27h23" /><path d="M15 13h10M15 19h10" /></>,
  // テント張りの案内所。土地に定着していない
  tent: <><path d="M20 8 5 32h30z" /><path d="M20 8v24" /><path d="M20 32l-6-11M20 32l6-11" strokeDasharray="2 2" /></>,
  // 禁止。やってはいけない
  ban: <><circle cx="20" cy="20" r="13" /><path d="M11 11l18 18" /></>,
  // 認められる。合っている
  check: <><circle cx="20" cy="20" r="13" /><path d="M13 20.5l5 5 9-11" fill="none" /></>,
  // 保全措置・保証。守る盾
  shield: <><path d="M20 6l12 4v11c0 7-5 11-12 13-7-2-12-6-12-13V10z" /><path d="M14 20.5l4.5 4.5L27 16" fill="none" /></>,
  // 契約が成立した。握手
  handshake: <><path d="M3 21h10l3 3" fill="none" /><path d="M37 21H27l-3 3" fill="none" /><rect x="12" y="19" width="16" height="11" rx="4" /><path d="M17 24.5h6" /></>,
  // 期限・基準日。日めくり
  calendar: <><rect x="6" y="10" width="28" height="24" rx="2" /><path d="M6 18h28" /><path d="M13 6v7M27 6v7" /><path d="M13 24h5M23 24h5M13 29h5" /></>,
  // 書面を発した。封書
  mail: <><rect x="5" y="12" width="30" height="19" rx="1.5" /><path d="M5 14l15 11 15-11" fill="none" /></>,
  // 担保に取る。南京錠
  lock: <><rect x="9" y="18" width="22" height="16" rx="2" /><path d="M14 18v-4a6 6 0 0 1 12 0v4" fill="none" /><path d="M20 24v4" /></>,
  // 何人かで持つ・集まって決める
  group: <><circle cx="13" cy="15" r="5" /><path d="M4 31c0-5 4-8 9-8s9 3 9 8" /><circle cx="27" cy="18" r="4" /><path d="M20 31c0-4 3-6 7-6s9 2 9 6" /></>,
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
