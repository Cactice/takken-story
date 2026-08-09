import { useEffect, useId, useMemo, useRef } from 'react'
import { familyOf, type Hair } from './story'

// 色=家系 / 形と髪型=本人 / 丈と姿勢=年齢。顔は簡素に。動くのは髪だけ。
// 家系からは「色」と「髪の傾向」だけを受け取り、id から決まる乱数で本人ぶんだけずらす。
// だから同じ家族は似ているが、同じ姿にはならない。

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

/** id から決まった乱数を作る(FNV-1a)。同じ人はリロードしても必ず同じ姿になる */
const rng = (id: string) => {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return (n: number) => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return (((h >>> 0) % 1000) / 1000) * n
  }
}

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))

/** k<1 で暗く、k>1 で明るく。服と髪の色は必ずここを通して家系の色から作る。
 *  戻り値も #rrggbb なので、そのまま重ねて掛けられる */
const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map((v) => Math.round(Math.min(255, Math.max(0, k <= 1 ? v * k : v + (255 - v) * (k - 1)))))
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')
}

const SKIN = '#e8ddd0'
const NECK = '#dccbb6'

type Bangs = 'round' | 'seven' | 'center' | 'blunt' | 'up'
type Hem = 'a' | 'straight' | 'box'
type Collar = 'round' | 'v' | 'stand'
type Layer = 'none' | 'apron' | 'haori' | 'obi'

type Props = {
  family?: string
  gender?: 'male' | 'female'
  age: number | null
  seed?: number
  size?: number
  dim?: boolean
  /** 顔まわりだけ切り出す。セリフの横に置くとき用 */
  head?: boolean
  /** この人のid。家系の値を中心に、本人ぶんだけずらす */
  id?: string
}

const DEFAULT_HAIR: Hair = {
  strands: 8, length: 0.3, part: 0, spread: 0.5, curl: 0.2, tie: null, bangs: 0.4, stiff: 0.5,
}

export function Person({ family, gender = 'male', age, seed = 0, size = 120, dim, head, id = '' }: Props) {
  const fam = familyOf.get(family ?? '')
  const cloth = fam?.cloth ?? { base: '#cfcfcf', accent: '#8a8a8a' }
  const base: Hair = fam?.hair[gender] ?? DEFAULT_HAIR
  const female = gender === 'female'

  // 本人ぶんの姿。乱数は呼ぶ順番で値が決まるので、髪も服もこの一箇所でまとめて引く。
  const me = useMemo(() => {
    const r = rng(id || (family ?? '') + gender)
    const pick = <T,>(...xs: T[]): T => xs[Math.min(xs.length - 1, Math.floor(r(xs.length)))]

    // 分け目の強さは家系ごとに保つ。足し算で散らすと強い分け目が薄まって、
    // 左右対称になり、後ろ髪が2つあるように見えてしまう
    const part = clamp(base.part * (0.8 + r(0.45)) + (r(0.18) - 0.09), -1, 1)
    const bangsAmt = clamp(base.bangs + r(0.4) - 0.2)
    // 前髪の形。分け目が強ければ7:3、薄ければ上げ、厚ければぱっつん。
    const bangs: Bangs =
      bangsAmt < 0.16 ? 'up'
      : bangsAmt > 0.74 ? 'blunt'
      : Math.abs(part) > 0.24 ? 'seven'
      // 真ん中分けは男だと女っぽく見えるので七三に寄せる
      : pick<Bangs>('round', female ? 'center' : 'seven', 'round', female ? 'blunt' : 'up')

    const tie0 = base.tie == null
      ? (r(1) < 0.18 ? clamp(0.35 + r(0.6), 0.3, 0.95) : null) // 結ばない家系にも稀に結ぶ人が居る
      : clamp(base.tie + r(0.34) - 0.17, 0.25, 0.98)
    // 男は結わない。ポニーテールもお団子も出さない
    const tie = female ? tie0 : null

    const len0 = base.length * (0.8 + r(0.5))
    const strands = Math.max(4, base.strands + Math.round(r(5) - 2))

    return {
      strands,
      // 房ごとの白髪のなりやすさ。年を取ると小さい値の房から順に白くなる
      grayU: Array.from({ length: strands }, () => r(1)),
      // 男は短髪に寄せる。長さの幅は残すので刈り上げ〜無造作までは出る
      length: female ? len0 : Math.min(len0, 0.24),
      part,
      spread: clamp(base.spread * (0.8 + r(0.5)) * (female ? 1 : 0.8)),
      curl: clamp(base.curl + r(0.3) - 0.15),
      // 縮れ。線に直角の波を足して描く。もともと巻いている家系ほどチリチリになりやすい
      frizz: clamp(r(1) < 0.3 + base.curl * 0.7 ? 0.25 + r(0.8) : r(0.16)),
      tie,
      bangsAmt,
      bangs,
      stiff: clamp(base.stiff + r(0.16) - 0.08),
      tieSide: (r(1) < 0.5 ? -1 : 1) as 1 | -1,

      // 顔
      // 目の開き具合。これひとつで 0=細く縦長 → 0.5=まん丸 → 1=横に細い線 と連続的に変わる
      eyeOpen: clamp(r(1) * 0.85 + 0.08),
      // 左右のずれ。定規で引いたようにしないための崩し
      eyeSkew: r(0.14) - 0.07,
      eyeRot: r(9) - 4.5,      // 目の傾き(度)
      // まつ毛は女性だけ。本数と長さは人による
      lashes: female ? 2 + Math.floor(r(2)) : 0,
      lashLen: 0.85 + r(0.4),
      eyeGap: 3.1 + r(0.9),  // 左右の間隔。頭(半径9)に対して寄せすぎない
      hasBrow: r(1) < 0.62,  // 眉を描かない顔もある
      brow: r(1.6) - 0.5,    // 眉の傾き
      browY: 2.0 + r(0.8),   // 眉の高さ
      tilt: r(0.9) - 0.45,

      // 服。色は家系のまま、形だけ本人ぶん
      // 男は乱数の範囲そのものを狭くして、肩>腰>裾 が崩れる目を最初から引かせない
      sw: female ? 11.5 * (0.84 + r(0.32)) : 15.5 * (0.94 + r(0.22)),  // 肩幅
      ww: female ? 9 * (0.8 + r(0.42)) : 10.4 * (0.86 + r(0.2)),       // 腰の絞り
      hemK: female ? 0.6 + r(1.2) : r(0.35),                            // 裾の広がり
      // 男にAラインは出さない(スカートに見える)
      hem: female ? pick<Hem>('a', 'straight', 'box', 'a') : pick<Hem>('straight', 'straight', 'box', 'straight'),
      short: r(1) < (female ? 0.3 : 0.55),             // 丈。短ければ足が見える
      collar: pick<Collar>('round', 'v', 'stand'),
      layer: pick<Layer>('none', 'apron', 'haori', 'obi', 'obi'),
      sleeve: pick(0, 0.3, 0.62),                      // 袖丈。0なら袖なし
      tone: 0.9 + r(0.22),                             // 同じ色でも人によって少し明暗が違う
    }
  }, [id, family, gender, base, female])

  const { height, spine } = bodyOf(age)
  const a = age ?? 30
  const child = clamp((13 - a) / 9)  // 子どもは頭が大きい
  const old = clamp((a - 60) / 25)   // 年寄りは髪が白み、肩が落ちる

  const lean = spine * 14
  const headR = 9 * (1 + child * 0.2)
  const shoulderY = GROUND - 86
  const headY = shoulderY - headR * 1.6 // 首のぶん離す
  const headX = CX + lean

  // ---- 服 ----------------------------------------------------------------
  const sw = me.sw * (1 - old * 0.12) * (1 - child * 0.1)
  // 男は必ず逆三角形。肩 > 腰 > 裾 の順に細くなるよう強制する
  const ww = female ? me.ww : Math.min(me.ww, sw * 0.7)
  const waistY = shoulderY + 34
  const hemY = me.short ? GROUND - 15 : GROUND
  const hemW0 = me.hem === 'a' ? ww + 7 + me.hemK * 9
    : me.hem === 'box' ? Math.max(sw * 0.98, ww * 1.25)
    : ww * (1.12 + me.hemK * 0.3)
  const hemW = female ? hemW0 : Math.min(hemW0, ww * 0.86)
  const wx = (s: number) => CX + s * ww + lean * 0.3
  const hxAt = (s: number) => CX + s * hemW

  const side = (s: 1 | -1) =>
    me.hem === 'box'
      // 箱型。直線でストンと落とす
      ? ` L ${(CX + s * hemW).toFixed(1)} ${hemY}`
      : ` C ${wx(s)} ${waistY + 12} ${hxAt(s)} ${hemY - 18} ${hxAt(s)} ${hemY}`

  const torso =
    `M ${(headX - sw).toFixed(1)} ${shoulderY}` +
    ` L ${(headX + sw).toFixed(1)} ${shoulderY}` +
    ` C ${(headX + sw).toFixed(1)} ${shoulderY + 14} ${wx(1)} ${waistY - 12} ${wx(1)} ${waistY}` +
    side(1) +
    ` L ${hxAt(-1)} ${hemY}` +
    (me.hem === 'box'
      ? ` L ${wx(-1)} ${waistY}`
      : ` C ${hxAt(-1)} ${hemY - 18} ${wx(-1)} ${waistY + 12} ${wx(-1)} ${waistY}`) +
    ` C ${wx(-1)} ${waistY - 12} ${(headX - sw).toFixed(1)} ${shoulderY + 14} ${(headX - sw).toFixed(1)} ${shoulderY} Z`

  const clipId = useId()
  const cBase = shade(cloth.base, me.tone)
  const cDark = shade(cloth.base, 0.74)
  const cLight = shade(cloth.base, 1.22)
  const cAcc = cloth.accent

  const collarPath =
    me.collar === 'v'
      ? `M ${headX - 4.4} ${shoulderY} L ${headX} ${shoulderY + 8.5} L ${headX + 4.4} ${shoulderY}`
      : me.collar === 'stand'
      ? `M ${headX - 3.4} ${shoulderY - 2.4} L ${headX + 3.4} ${shoulderY - 2.4} L ${headX + 3.4} ${shoulderY + 1.6} L ${headX - 3.4} ${shoulderY + 1.6} Z`
      : `M ${headX - 4.6} ${shoulderY} A 4.6 2.6 0 0 0 ${headX + 4.6} ${shoulderY}`

  // ---- 髪のシミュレーション ------------------------------------------------
  const gRef = useRef<SVGGElement>(null)
  const bun = me.tie != null && me.tie >= 0.72
  const knotX = headX + me.tieSide * headR * (bun ? 0.34 : 0.92)
  const knotY = bun ? headY - headR * 1.24 : headY + headR * (0.8 - (me.tie ?? 0) * 1.5)

  useEffect(() => {
    const paths = [...(gRef.current?.querySelectorAll('path') ?? [])] as SVGPathElement[]
    if (!paths.length) return

    const segLen = (me.length * headR * 3.6) / SEGS * (bun ? 0.55 : 1)
    const strands = paths.map((_, i) => {
      const u = me.strands === 1 ? 0.5 : i / (me.strands - 1)
      // 分け目で左右の分かれ目そのものを動かす。左右対称に房が残ると、
      // 後ろ髪が2つあるように見えてしまう
      // 短い髪は必ず片側へ寄せる。左右に同じ房が残ると、後ろ髪が2つあるように見える
      const cut = me.length < 0.4
        ? (me.part >= 0 ? 0.86 : 0.14)
        : Math.min(0.92, Math.max(0.08, 0.5 + me.part * 0.85))
      const s = u < cut ? -1 : 1
      const v = s < 0 ? u / cut : (1 - u) / (1 - cut) // 0=外側 1=中央寄り
      const minor = (s < 0 ? cut : 1 - cut) < 0.34 ? 0.5 : 1 // 少ないほうの側は短く
      const bias = 1 + s * me.part * 0.35
      const root = {
        x: headX + s * headR * (0.9 - v * 0.45),
        y: headY - headR * (0.5 - v * 0.35),
      }
      // 髪は顔の上に垂れない。頭の外側へ回してから落ちる
      const rest = Array.from({ length: SEGS + 1 }, (_, j) => {
        if (j === 0) return { ...root }
        const out = headR * (0.8 + v * 0.3) + me.spread * 2.4 * j * bias * minor
        const t = Math.min(1, j / 1.2)
        return {
          x: root.x * (1 - t) + (headX + s * out) * t + Math.sin(j * 1.4 + i) * me.curl * segLen * 0.45,
          y: headY - headR * 0.2 + segLen * j * minor,
        }
      })
      return { rest, pts: rest.map((p) => ({ ...p })), prev: rest.map((p) => ({ ...p })), phase: i * 1.9 }
    })

    // 結び目。ここへ房を寄せると、低ければポニーテール、高ければお団子になる
    const tieAt = me.tie == null ? null : { j: bun ? 1 : 2, x: knotX, y: knotY }

    const damp = 0.86
    const gravity = 0.55
    // ponytail: 縮れているときだけ線を細かく刻む。1画面60人でも点数は数千で足りている。
    // 足りなくなったら sub を 2 に落とすか、画面外の人のループを止める。
    const sub = me.frizz > 0.08 ? 3 : 1
    const amp = me.frizz * 2.6
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
          p.x += vx + wind * (1 - me.stiff) * j * 0.14
          p.y += vy + gravity * (1 - me.stiff * 0.5)
          // 硬い髪ほど元の形に戻る = ほとんど動かない
          p.x += (s.rest[j].x - p.x) * me.stiff * 0.35
          p.y += (s.rest[j].y - p.y) * me.stiff * 0.35
        }
        if (tieAt) {
          for (let j = tieAt.j; j <= (bun ? SEGS : tieAt.j); j++) {
            const p = s.pts[j]
            const k = bun ? 0.55 : 0.6
            p.x += (tieAt.x - p.x) * k
            p.y += (tieAt.y - p.y) * k
          }
        }
        for (let it = 0; it < 3; it++) {
          for (let j = 1; j <= SEGS; j++) {
            const a1 = s.pts[j - 1], b1 = s.pts[j]
            const dx = b1.x - a1.x, dy = b1.y - a1.y
            const d = Math.hypot(dx, dy) || 1
            const k = (d - segLen) / d
            b1.x -= dx * k; b1.y -= dy * k
          }
        }
      }

      strands.forEach((s, i) => {
        const pts = s.pts
        let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
        for (let j = 1; j <= SEGS; j++) {
          const a1 = pts[j - 1], b1 = pts[j]
          const dx = b1.x - a1.x, dy = b1.y - a1.y
          const len = Math.hypot(dx, dy) || 1
          // 線に直角の向き。ここに波を足すとチリチリに見える
          const nx = -dy / len, ny = dx / len
          for (let k = 1; k <= sub; k++) {
            const u = k / sub
            const w = amp * Math.sin((j - 1 + u) * 5.1 + s.phase) * Math.min(1, (j - 1 + u) / 1.2)
            d += ` L ${(a1.x + dx * u + nx * w).toFixed(1)} ${(a1.y + dy * u + ny * w).toFixed(1)}`
          }
        }
        paths[i].setAttribute('d', d)
      })
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [headX, headY, headR, me, seed, bun, knotX, knotY])

  // ---- 前髪 --------------------------------------------------------------
  // 白髪。40歳で0、80歳でかなり白い。u が小さい房から先に白くなるので、房ごとに分かれる
  // 白髪は40歳あたりから。45歳でもう数本あるくらいの立ち上がり
  const gray = clamp((a - 38) / 34)
  const hairBase = shade(cloth.accent, 0.62)
  const grayOf = (u: number) => shade(hairBase, 1 + clamp((gray - u * 0.4) * 1.9) * 0.85)
  // 前髪はいちばん目につくので、房より少し早く白くなる。45歳で気づく程度に
  const hairColor = grayOf(0.28)
  const hairLight = shade(hairColor, 1.3)
  const b = me.bangsAmt
  const s7 = me.part >= 0 ? 1 : -1
  // 生え際は目より上。ここから下へ何をしても、額と眉より下には来ない
  const capY = headY - headR * 0.34
  const capX = headR * 0.94
  const cap = `M ${headX - capX} ${capY} A ${headR} ${headR} 0 0 1 ${headX + capX} ${capY}`
  const deep = headR * (0.06 + b * 0.3) // 前髪の深さ
  const bangsPath =
    me.bangs === 'blunt'
      // ぱっつん。まっすぐ切りそろえる
      ? cap + ` L ${headX + capX} ${capY + deep} Q ${headX} ${capY + deep * 1.25} ${headX - capX} ${capY + deep} Z`
      : me.bangs === 'center'
      // 真ん中分け。中央だけ額が出る
      ? cap +
        ` C ${headX + capX * 0.62} ${capY + deep * 1.8} ${headX + capX * 0.28} ${capY + deep * 0.7} ${headX} ${capY - headR * 0.1}` +
        ` C ${headX - capX * 0.28} ${capY + deep * 0.7} ${headX - capX * 0.62} ${capY + deep * 1.8} ${headX - capX} ${capY} Z`
      : me.bangs === 'seven'
      // 7:3。片側だけ深く垂らして、反対側は額を見せる
      ? cap + ` Q ${headX + s7 * capX * 0.75} ${capY + deep * 3.2} ${headX - capX} ${capY} Z`
      : me.bangs === 'up'
      // 上げている。額を全部出す
      ? cap + ` Q ${headX} ${capY - headR * 0.5} ${headX - capX} ${capY} Z`
      // 丸く自然に垂らす
      : cap + ` Q ${headX} ${capY + deep * 2.1} ${headX - capX} ${capY} Z`

  // 縮尺は足元を軸にかかるので、頭の位置を写してから切り出す
  const hx = CX + (headX - CX) * height
  const hy = GROUND + (headY - GROUND) * height
  const headBox = `${(hx - 19).toFixed(1)} ${(hy - 17).toFixed(1)} 38 38`
  const ey = headY + headR * 0.2 // 目の高さ。頭の中心よりわずかに下
  const wrinkle = clamp((a - 38) / 32) // シワの深さ

  // 目。黒目だけを肌の上に置く簡素な顔。開き具合 k ひとつで
  // 細く縦長(k小) → まん丸(k=1) → 横に細い線(k大) と連続的に変わる。
  // rx=R*k, ry=R/k なので面積は変わらない。丸のときだけ目が肥大する事故が起きない。
  const eyeAt = (s: 1 | -1) => {
    // 横に潰しすぎると目を閉じて見えるので、上限は 1.7 まで
    const k = 0.6 + 1.1 * clamp(me.eyeOpen + s * me.eyeSkew) // 左右をわずかに崩す
    const R = 0.75
    const cx = headX + s * me.eyeGap
    const cy = ey - s * me.tilt
    const rot = me.eyeRot * s + s * 1.2
    return (
      <g key={s} transform={`rotate(${rot.toFixed(1)} ${cx.toFixed(2)} ${cy.toFixed(2)})`}>
        <ellipse cx={cx} cy={cy} rx={R * k} ry={R / k} fill="#3a342c" />
        {/* まつ毛は女性だけ。細く短く、外側ほど長い */}
        {Array.from({ length: me.lashes }, (_, i) => {
          const u = 0.45 + i * 0.28 // 外側の上ふちに沿って生やす
          const lx = cx + s * R * k * u
          const ly = cy - (R / k) * Math.sqrt(Math.max(0, 1 - u * u))
          const l = me.lashLen * (0.75 + u * 0.35)
          return (
            <path
              key={i}
              d={`M ${lx.toFixed(2)} ${ly.toFixed(2)} l ${(s * 0.8 * l).toFixed(2)} ${(-0.65 * l).toFixed(2)}`}
              fill="none" stroke="#3a342c" strokeWidth={0.45} strokeLinecap="round"
            />
          )
        })}
      </g>
    )
  }

  return (
    <svg
      viewBox={head ? headBox : '14 30 72 126'}
      width={head ? size : size * 0.57}
      height={size}
      className={dim ? 'person dim' : 'person'}
    >
      <g transform={`translate(${CX} ${GROUND}) scale(${height.toFixed(3)}) translate(${-CX} ${-GROUND})`}>
        {/* 足。丈が短ければ見える */}
        {me.short && (
          <g fill={NECK}>
            <rect x={CX - 5.2} y={hemY - 2} width={4.2} height={GROUND - hemY + 2} />
            <rect x={CX + 1.0} y={hemY - 2} width={4.2} height={GROUND - hemY + 2} />
          </g>
        )}
        {/* 首 */}
        <rect x={headX - 2.2} y={headY} width={4.4} height={shoulderY - headY + 2} fill={NECK} />

        {/* 袖。肩から外へ張り出す。丈は本人ぶん */}
        {me.sleeve > 0 && (() => {
          const len = (GROUND - shoulderY) * me.sleeve
          // 女は袖が外へ張り出す。男は肩が一番広いまま下へ細るので、外へは出さない
          const mid = female ? sw + 2.6 + me.sleeve * 4 : sw * 0.94
          const end = female ? sw + (2.6 + me.sleeve * 4) * 0.55 : sw * 0.8
          return (
            <g fill={shade(cloth.base, me.tone * 0.93)}>
              {[-1, 1].map((s) => (
                <path
                  key={s}
                  d={`M ${headX + s * sw * (female ? 0.75 : 1)} ${shoulderY}` +
                     ` L ${headX + s * mid} ${shoulderY + len * 0.55}` +
                     ` L ${headX + s * end} ${shoulderY + len}` +
                     ` L ${headX + s * sw * 0.45} ${shoulderY + len * 0.85} Z`}
                />
              ))}
            </g>
          )
        })()}
        {/* 胴 */}
        <path d={torso} fill={cBase} />
        {/* 重ね着。服の輪郭で切り抜くので、どんな形を置いてもはみ出さない */}
        <clipPath id={clipId}><path d={torso} /></clipPath>
        <g clipPath={`url(#${clipId})`}>
          {me.layer === 'haori' && (
            // 羽織り。左右の前身頃だけ濃い色で重なる
            <>
              <rect x={CX - hemW - 8} y={shoulderY} width={hemW + 8 - ww * 0.34} height={hemY - shoulderY} fill={cDark} />
              <rect x={CX + ww * 0.34} y={shoulderY} width={hemW + 8} height={hemY - shoulderY} fill={cDark} />
            </>
          )}
          {me.layer === 'apron' && (
            // 前掛け
            <path
              d={`M ${CX - ww * 0.7} ${waistY - 13} L ${CX + ww * 0.7} ${waistY - 13}` +
                 ` L ${CX + hemW * 0.66} ${hemY - 3} L ${CX - hemW * 0.66} ${hemY - 3} Z`}
              fill={cLight}
            />
          )}
          {(me.layer === 'obi' || me.layer === 'apron') && (
            // 帯
            <rect x={CX - hemW - 8} y={waistY - 4} width={hemW * 2 + 16} height={me.layer === 'obi' ? 6 : 3.2} fill={cAcc} />
          )}
        </g>
        {/* 肩の切り替え */}
        <path
          d={`M ${headX - sw} ${shoulderY} L ${headX + sw} ${shoulderY} L ${headX + sw * 0.9} ${shoulderY + 3.2} L ${headX - sw * 0.9} ${shoulderY + 3.2} Z`}
          fill={cAcc}
        />
        {/* 襟 */}
        <path d={collarPath} fill="none" stroke={shade(cloth.accent, 0.7)} strokeWidth={1} strokeLinecap="round" />

        {/* 髪は服の上に落ちる。顔にはかからない */}
        <g ref={gRef} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none">
          {Array.from({ length: me.strands }, (_, i) => (
            <path key={i} stroke={grayOf(me.grayU[i] ?? 0.5)} />
          ))}
        </g>

        <circle cx={headX} cy={headY} r={headR} fill={SKIN} />

        {/* 目と眉。左右をわずかに崩すと手で描いたように見える */}
        <g stroke="#3a342c" strokeWidth={1} strokeLinecap="round" fill="none">
          {([-1, 1] as const).map(eyeAt)}
          {me.hasBrow && (
            <g strokeWidth={0.7} opacity={0.6}>
              <path d={`M ${headX - me.eyeGap - 1.5} ${ey - me.browY} Q ${headX - me.eyeGap} ${ey - me.browY - me.brow} ${headX - me.eyeGap + 1.5} ${ey - me.browY + me.brow * 0.3}`} />
              <path d={`M ${headX + me.eyeGap - 1.5} ${ey - me.browY + me.brow * 0.3} Q ${headX + me.eyeGap} ${ey - me.browY - me.brow * 0.9} ${headX + me.eyeGap + 1.5} ${ey - me.browY}`} />
            </g>
          )}
        </g>

        {/* 前髪 */}
        {/* シワ。40歳あたりから目尻に1本、深くなると口元にも1本 */}
        {wrinkle > 0.02 && (
          <g stroke="#b9a894" strokeLinecap="round" fill="none" opacity={0.45 + wrinkle * 0.45}>
            <path strokeWidth={0.52} d={`M ${headX - me.eyeGap - 2.2} ${ey + 0.6} q -0.9 0.8 -1.1 1.9`} />
            <path strokeWidth={0.52} d={`M ${headX + me.eyeGap + 2.2} ${ey + 0.6} q 0.9 0.8 1.1 1.9`} />
            {wrinkle > 0.45 && (
              <>
                <path strokeWidth={0.4} d={`M ${headX - 2.6} ${ey + 2.8} q -1.3 1.9 -1.1 3.4`} />
                <path strokeWidth={0.4} d={`M ${headX + 2.6} ${ey + 2.8} q 1.3 1.9 1.1 3.4`} />
              </>
            )}
          </g>
        )}
        <path d={bangsPath} fill={hairColor} />
        {me.bangs === 'seven' && (
          // 分け目。7の側から入れる
          <path
            d={`M ${headX + s7 * headR * 0.18} ${headY - headR * 0.7} L ${headX + s7 * headR * 0.42} ${capY + deep * 0.5}`}
            stroke={hairLight}
            strokeWidth={0.7}
            opacity={0.5}
            strokeLinecap="round"
          />
        )}
        {me.bangs === 'up' && (
          <g stroke={hairLight} strokeWidth={0.9} strokeLinecap="round" fill="none" opacity={0.8}>
            <path d={`M ${headX - headR * 0.4} ${headY - headR * 0.55} Q ${headX - headR * 0.25} ${headY - headR * 0.9} ${headX - headR * 0.05} ${headY - headR * 1.0}`} />
            <path d={`M ${headX + headR * 0.35} ${headY - headR * 0.6} Q ${headX + headR * 0.5} ${headY - headR * 0.9} ${headX + headR * 0.72} ${headY - headR * 0.92}`} />
          </g>
        )}

        {/* 結び目。低ければポニーテールの根本、高ければお団子 */}
        {me.tie != null && bun && (
          <>
            <circle cx={knotX} cy={knotY} r={headR * 0.42} fill={hairColor} />
            <circle cx={knotX} cy={knotY + headR * 0.42} r={1.6} fill={cAcc} />
          </>
        )}
        {me.tie != null && !bun && <circle cx={knotX} cy={knotY} r={2.1} fill={cAcc} />}
      </g>
    </svg>
  )
}
