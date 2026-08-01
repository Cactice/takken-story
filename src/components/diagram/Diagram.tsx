import type { DiagramSpec } from '../../types'
import './diagram.css'

/**
 * ハゲタの解説につける簡易図。外部ライブラリなしの手描きSVG。
 * ドット絵に馴染むよう crispEdges + 太線 + 少ない色で描く。
 */
const W = 320
const H = 150

export function Diagram({ spec }: { spec: DiagramSpec }) {
  const l = spec.labels ?? []
  const v = spec.values ?? []
  return (
    <svg
      className="dg"
      viewBox={`0 0 ${W} ${H}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={l.join(' / ')}
    >
      <rect x="0" y="0" width={W} height={H} className="dg-bg" />
      {spec.type === 'area' && <Area labels={l} values={v} />}
      {spec.type === 'land' && <Land labels={l} />}
      {spec.type === 'timeline' && <Timeline labels={l} values={v} />}
      {spec.type === 'parties' && <Parties labels={l} />}
      {spec.type === 'money' && <Money labels={l} values={v} />}
      {spec.type === 'floorplan' && <Floorplan labels={l} values={v} />}
    </svg>
  )
}

function T({ x, y, children, anchor = 'middle', small = false }: {
  x: number
  y: number
  children: string
  anchor?: 'start' | 'middle' | 'end'
  small?: boolean
}) {
  return (
    <text x={x} y={y} textAnchor={anchor} className={small ? 'dg-t dg-t-s' : 'dg-t'}>
      {children}
    </text>
  )
}

/** 敷地に対する建築面積(建蔽率)と延べ面積(容積率)を四角で図示 */
function Area({ labels, values }: { labels: string[]; values: number[] }) {
  const kenpei = values[0] ?? 50
  const yoseki = values[1] ?? 100
  const side = 92
  const bx = 22
  const by = 30
  const inner = side * Math.sqrt(Math.min(kenpei, 100) / 100)
  const floors = Math.max(1, Math.round(yoseki / Math.max(kenpei, 1)))
  const fh = Math.min(22, 92 / floors)

  return (
    <>
      <T x={bx + side / 2} y={20}>{labels[0] ?? '敷地'}</T>
      <rect x={bx} y={by} width={side} height={side} className="dg-line" />
      <rect x={bx} y={by + side - inner} width={inner} height={inner} className="dg-fill-a" />
      <T x={bx + side / 2} y={by + side + 18} small>
        {labels[1] ?? `建築面積 ${kenpei}%`}
      </T>

      <T x={228} y={20}>{labels[2] ?? '延べ面積'}</T>
      {Array.from({ length: floors }, (_, i) => (
        <rect
          key={i}
          x={182}
          y={by + side - fh * (i + 1)}
          width={92}
          height={fh}
          className="dg-fill-b"
        />
      ))}
      <T x={228} y={by + side + 18} small>{labels[3] ?? `${floors}層ぶん = ${yoseki}%`}</T>
    </>
  )
}

/** 土地と境界線・隣地 */
function Land({ labels }: { labels: string[] }) {
  return (
    <>
      <rect x="18" y="26" width="130" height="76" className="dg-fill-a" />
      <rect x="172" y="26" width="130" height="76" className="dg-fill-c" />
      <line x1="160" y1="18" x2="160" y2="110" className="dg-border" />
      <T x={83} y={68}>{labels[0] ?? '自分の土地'}</T>
      <T x={237} y={68}>{labels[1] ?? '隣地'}</T>
      <T x={160} y={14} small>{labels[2] ?? '境界線'}</T>
      <rect x="18" y="112" width="284" height="20" className="dg-road" />
      <T x={160} y={126} small>{labels[3] ?? '道路'}</T>
    </>
  )
}

/** 期間・期限 */
function Timeline({ labels, values }: { labels: string[]; values: number[] }) {
  const pts = labels.length > 0 ? labels : ['開始', '期限']
  const x = (i: number) =>
    30 + ((values[i] ?? (pts.length === 1 ? 50 : (i / (pts.length - 1)) * 100)) / 100) * 260

  return (
    <>
      <line x1="20" y1="76" x2="300" y2="76" className="dg-line-thick" />
      <polygon points="300,66 316,76 300,86" className="dg-arrow" />
      {pts.map((label, i) => (
        <g key={label + i}>
          <line x1={x(i)} y1="60" x2={x(i)} y2="92" className="dg-border" />
          <circle cx={x(i)} cy="76" r="6" className="dg-fill-a" />
          <text
            x={x(i)}
            y={i % 2 === 0 ? 44 : 116}
            textAnchor="middle"
            className="dg-t dg-t-s"
          >
            {label}
          </text>
        </g>
      ))}
    </>
  )
}

/** 登場人物の関係 */
function Parties({ labels }: { labels: string[] }) {
  const a = labels[0] ?? '売主'
  const b = labels[1] ?? '買主'
  const rel = labels[2] ?? ''
  const mid = labels[3]
  return (
    <>
      <rect x="14" y="34" width="96" height="40" className="dg-fill-a" />
      <T x={62} y={59}>{a}</T>
      <rect x="210" y="34" width="96" height="40" className="dg-fill-c" />
      <T x={258} y={59}>{b}</T>
      <line x1="112" y1="54" x2="200" y2="54" className="dg-line-thick" />
      <polygon points="200,46 214,54 200,62" className="dg-arrow" />
      {rel !== '' && <T x={160} y={40} small>{rel}</T>}
      {mid !== undefined && (
        <>
          <rect x="110" y="102" width="100" height="34" className="dg-fill-b" />
          <T x={160} y={124} small>{mid}</T>
          <line x1="62" y1="76" x2="120" y2="100" className="dg-dash" />
          <line x1="258" y1="76" x2="200" y2="100" className="dg-dash" />
        </>
      )}
    </>
  )
}

/** お金の流れ */
function Money({ labels, values }: { labels: string[]; values: number[] }) {
  const amount = values[0]
  return (
    <>
      <rect x="10" y="46" width="96" height="44" className="dg-fill-a" />
      <T x={58} y={73}>{labels[0] ?? '払う人'}</T>
      <rect x="214" y="46" width="96" height="44" className="dg-fill-c" />
      <T x={262} y={73}>{labels[1] ?? '受け取る人'}</T>
      <line x1="108" y1="68" x2="200" y2="68" className="dg-line-thick" />
      <polygon points="200,58 216,68 200,78" className="dg-arrow" />
      <circle cx="160" cy="42" r="14" className="dg-coin" />
      <T x={160} y={47}>¥</T>
      <T x={160} y={104} small>
        {labels[2] ?? (amount !== undefined ? `${amount}万円` : 'お金')}
      </T>
      {amount !== undefined && labels[2] !== undefined && (
        <T x={160} y={124} small>{`${amount}万円`}</T>
      )}
    </>
  )
}

/** 間取り・部屋の区分 */
function Floorplan({ labels, values }: { labels: string[]; values: number[] }) {
  const rooms = (labels.length > 0 ? labels : ['部屋']).slice(0, 4)
  const cols = rooms.length <= 2 ? rooms.length : 2
  const rowsN = Math.ceil(rooms.length / cols)
  const w = 284 / cols
  const h = 108 / rowsN
  return (
    <>
      {rooms.map((r, i) => {
        const cx = 18 + (i % cols) * w
        const cy = 20 + Math.floor(i / cols) * h
        return (
          <g key={r + i}>
            <rect x={cx} y={cy} width={w} height={h} className={i === 0 ? 'dg-fill-a' : 'dg-fill-c'} />
            <T x={cx + w / 2} y={cy + h / 2 + 4} small>{r}</T>
            {values[i] !== undefined && (
              <T x={cx + w / 2} y={cy + h / 2 + 20} small>{`${values[i]}㎡`}</T>
            )}
          </g>
        )
      })}
      <rect x="18" y="20" width="284" height={108} className="dg-line" />
    </>
  )
}
