import { useEffect, useRef } from 'react'
import { familyOf, type Hair } from './story'

// 色=家系 / 形=性別 / 丈と姿勢=年齢。顔は描かない。動くのは髪だけ。

const GROUND = 152
const CX = 50
const SEGS = 5

/** 年齢から背丈と腰の曲がりを出す。データでは持たない。 */
export const bodyOf = (age: number | null) => {
  const a = age ?? 30
  return {
    height: 0.55 + 0.45 * Math.min(a / 18, 1) - Math.max(0, a - 60) * 0.002,
    spine: Math.max(0, (a - 55) / 45),
  }
}

const darken = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * k))
  return `rgb(${c.join(',')})`
}

type Props = {
  family?: string
  gender?: 'male' | 'female'
  age: number | null
  seed?: number
  size?: number
  dim?: boolean
}

export function Person({ family, gender = 'male', age, seed = 0, size = 120, dim }: Props) {
  const fam = familyOf.get(family ?? '')
  const cloth = fam?.cloth ?? { base: '#cfcfcf', accent: '#8a8a8a' }
  const hair: Hair = fam?.hair[gender] ?? { strands: 8, length: .3, part: 0, spread: .5, curl: .2, tie: null, bangs: .4, stiff: .5 }
  const { height, spine } = bodyOf(age)

  const lean = spine * 14
  const headR = 9
  const shoulderY = GROUND - 86
  const headY = shoulderY - headR * 1.9 // 首のぶん離す
  const headX = CX + lean
  const sw = gender === 'female' ? 9.5 : 11
  const hw = gender === 'female' ? 20 : 13 // 裾。女は広がり、男は直線

  const torso =
    `M ${CX - hw} ${GROUND}` +
    ` C ${CX - hw * 0.8 + lean * 0.3} ${GROUND - 40} ${headX - sw * 1.05} ${shoulderY + 18} ${headX - sw} ${shoulderY}` +
    ` L ${headX + sw} ${shoulderY}` +
    ` C ${headX + sw * 1.05} ${shoulderY + 18} ${CX + hw * 0.8 + lean * 0.3} ${GROUND - 40} ${CX + hw} ${GROUND} Z`

  const gRef = useRef<SVGGElement>(null)

  useEffect(() => {
    const paths = [...(gRef.current?.querySelectorAll('path') ?? [])] as SVGPathElement[]
    if (!paths.length) return

    const segLen = (hair.length * headR * 3.6) / SEGS
    const strands = paths.map((_, i) => {
      const u = hair.strands === 1 ? 0.5 : i / (hair.strands - 1)
      const side = u < 0.5 ? -1 : 1
      const v = side < 0 ? u * 2 : (1 - u) * 2 // 0=外側 1=中央寄り
      // 分け目は左右の量を偏らせる
      const bias = 1 + side * hair.part * 0.35
      const root = {
        x: headX + side * headR * (0.9 - v * 0.45),
        y: headY - headR * (0.5 - v * 0.35),
      }
      // 髪は顔の上に垂れない。頭の外側へ回してから落ちる
      const rest = Array.from({ length: SEGS + 1 }, (_, j) => {
        if (j === 0) return { ...root }
        const out = headR * (0.8 + v * 0.3) + hair.spread * 2.4 * j * bias
        const t = Math.min(1, j / 1.2)
        return {
          x: root.x * (1 - t) + (headX + side * out) * t
            + Math.sin(j * 1.4 + i) * hair.curl * segLen * 0.45,
          y: headY - headR * 0.2 + segLen * j,
        }
      })
      return { rest, pts: rest.map((p) => ({ ...p })), prev: rest.map((p) => ({ ...p })) }
    })

    // 結び目。ここに引き寄せるとポニーテールにも団子にもなる
    const tieAt = hair.tie == null ? null : {
      j: Math.max(1, Math.round(hair.tie * SEGS)),
      x: headX - hair.part * 6,
      y: headY + headR * (1.1 - hair.tie * 1.4),
    }

    const damp = 0.86
    const gravity = 0.55
    let raf = 0
    const t0 = performance.now()

    const frame = (now: number) => {
      const t = (now - t0) / 1000
      const wind = Math.sin(t * 1.15 + seed) * 0.5 + Math.sin(t * 2.7 + seed * 3) * 0.18

      for (const s of strands) {
        for (let j = 1; j <= SEGS; j++) {
          const p = s.pts[j], q = s.prev[j]
          const vx = (p.x - q.x) * damp, vy = (p.y - q.y) * damp
          q.x = p.x; q.y = p.y
          p.x += vx + wind * (1 - hair.stiff) * j * 0.14
          p.y += vy + gravity * (1 - hair.stiff * 0.5)
          // 硬い髪ほど元の形に戻る = ほとんど動かない
          p.x += (s.rest[j].x - p.x) * hair.stiff * 0.35
          p.y += (s.rest[j].y - p.y) * hair.stiff * 0.35
        }
        if (tieAt) {
          const p = s.pts[tieAt.j]
          p.x += (tieAt.x - p.x) * 0.5
          p.y += (tieAt.y - p.y) * 0.5
        }
        for (let it = 0; it < 3; it++) {
          for (let j = 1; j <= SEGS; j++) {
            const a = s.pts[j - 1], b = s.pts[j]
            const dx = b.x - a.x, dy = b.y - a.y
            const d = Math.hypot(dx, dy) || 1
            const k = (d - segLen) / d
            b.x -= dx * k; b.y -= dy * k
          }
        }
      }
      strands.forEach((s, i) => {
        paths[i].setAttribute('d', s.pts.map((p, j) => `${j ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '))
      })
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [headX, headY, hair, seed])

  const hairColor = darken(cloth.accent, 0.55)

  return (
    <svg viewBox="14 30 72 126" width={size * 0.57} height={size} className={dim ? 'person dim' : 'person'}>
      <g transform={`translate(${CX} ${GROUND}) scale(${height.toFixed(3)}) translate(${-CX} ${-GROUND})`}>
        {/* 首 */}
        <rect x={headX - 2.2} y={headY} width={4.4} height={shoulderY - headY + 2} fill="#e0d3c2" />
        <path d={torso} fill={cloth.base} />
        <path
          d={`M ${headX - sw} ${shoulderY} L ${headX + sw} ${shoulderY} L ${headX + sw * 0.9} ${shoulderY + 3.2} L ${headX - sw * 0.9} ${shoulderY + 3.2} Z`}
          fill={cloth.accent}
        />
        {/* 髪は服の上に落ちる。顔にはかからない */}
        <g ref={gRef} stroke={hairColor} strokeWidth={2} strokeLinecap="round" fill="none">
          {Array.from({ length: hair.strands }, (_, i) => <path key={i} />)}
        </g>
        <circle cx={headX} cy={headY} r={headR} fill="#e8ddd0" />
        {/* 頭頂の面。前髪の量だけで印象が変わるので1枚で足りる。顔は描かない */}
        <path
          d={`M ${headX - headR} ${headY}
              A ${headR} ${headR} 0 0 1 ${headX + headR} ${headY}
              Q ${headX} ${headY + headR * (hair.bangs * 1.5 - 0.35)} ${headX - headR} ${headY} Z`}
          fill={hairColor}
        />
      </g>
    </svg>
  )
}
