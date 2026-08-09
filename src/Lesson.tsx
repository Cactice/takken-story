import { useLayoutEffect, useRef, useState } from 'react'
import { castOf, ageAt, generations } from './story'
import { Person } from './Person'
import { Icon, type IconName } from './Icon'

// 論点の図解。人はそのまま物語の住人を借りる。
// 図には5つの型がある。関係・時間・段・断面・分かれ道。
// 1つの型で全部やろうとすると、どの論点も同じ絵になって頭に残らない。

export type Node =
  | { kind: 'person'; who: string; label: string; sub?: string }
  | { kind: 'thing'; icon: IconName; label: string; sub?: string }
export type Link = { from: number; to: number; label?: string; style?: 'solid' | 'dashed' }

/** 関係図。誰と誰が、どうつながっているか */
type Relation = { kind?: 'relation'; caption: string; nodes: Node[]; links?: Link[]; note?: string }
/** 時間軸。いつ何が起きて、いつまでに何をするか */
type Timeline = {
  kind: 'timeline'
  caption: string
  steps: { at: string; label: string; note?: string; mark?: 'ok' | 'ng' | 'limit' }[]
  note?: string
}
/** 段。こういうときはこう、が何段かあるもの */
type Tiers = {
  kind: 'tiers'
  caption: string
  head?: [string, string]
  rows: { when: string; then: string; note?: string }[]
  note?: string
}
/** 断面。土地と建物を横から見た絵。面積や高さの話に効く */
type Section = {
  kind: 'section'
  caption: string
  boxes: { x: number; w: number; h: number; label?: string; type?: 'building' | 'land' | 'road' | 'fill' }[]
  dims?: { from: number; to: number; label: string; at?: 'top' | 'bottom' }[]
  ground?: string
  note?: string
}
/** 分かれ道。条件でどちらに転ぶか */
type Branch = {
  kind: 'branch'
  caption: string
  ask: string
  yes: { label: string; result: string }
  no: { label: string; result: string }
  note?: string
}
export type Panel = Relation | Timeline | Tiers | Section | Branch

export type LessonData = {
  topicId: string
  summary: string
  panels: Panel[]
  points: string[]
  traps?: string[]
}

/** その人が一番よく出る世代の年齢で描く */
const ageOf = (id: string) => {
  const c = castOf.get(id)
  const g = generations.find((x) => x.gen === (c?.appearsIn[0] ?? 1))
  return ageAt(c, g?.startYear ?? 1015)
}

function NodeBox({ n }: { n: Node }) {
  return (
    <div className="node" data-node>
      {n.kind === 'person' ? (
        <Person id={n.who} family={castOf.get(n.who)?.family}
          gender={castOf.get(n.who)?.gender} age={ageOf(n.who)} size={52} head />
      ) : (
        <Icon name={n.icon} size={44} />
      )}
      <b>{n.label}</b>
      {n.sub && <small>{n.sub}</small>}
    </div>
  )
}

function RelationFig({ panel }: { panel: Relation }) {
  const wrap = useRef<HTMLDivElement>(null)
  const [seg, setSeg] = useState<{ x1: number; y1: number; x2: number; y2: number; l?: string; d?: boolean }[]>([])

  // 線は実際に置かれた位置から引く。並びが変わっても追随する
  useLayoutEffect(() => {
    const draw = () => {
      const box = wrap.current?.getBoundingClientRect()
      const els = [...(wrap.current?.querySelectorAll('[data-node]') ?? [])] as HTMLElement[]
      if (!box || !els.length) return
      setSeg((panel.links ?? []).flatMap((k) => {
        const a = els[k.from]?.getBoundingClientRect()
        const b = els[k.to]?.getBoundingClientRect()
        if (!a || !b) return []
        return [{
          x1: a.left + a.width / 2 - box.left, y1: a.bottom - box.top - 6,
          x2: b.left + b.width / 2 - box.left, y2: b.bottom - box.top - 6,
          l: k.label, d: k.style === 'dashed',
        }]
      }))
    }
    draw()
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [panel])

  return (
    <div className="stagebox" ref={wrap}>
      <svg className="wires">
        {seg.map((s, i) => {
          const dip = 26 + Math.abs(s.x2 - s.x1) * 0.06
          const mx = (s.x1 + s.x2) / 2
          const my = Math.max(s.y1, s.y2) + dip
          return (
            <g key={i}>
              <path d={`M ${s.x1} ${s.y1} Q ${mx} ${my} ${s.x2} ${s.y2}`}
                fill="none" stroke="var(--faint)" strokeWidth={1}
                strokeDasharray={s.d ? '3 3' : undefined} />
              {s.l && <text x={mx} y={my - 2} textAnchor="middle" className="wire-label">{s.l}</text>}
            </g>
          )
        })}
      </svg>
      <div className="nodes">
        {panel.nodes.map((n, i) => <NodeBox key={i} n={n} />)}
      </div>
    </div>
  )
}

const MARK = { ok: '○', ng: '×', limit: '⌛' }

function TimelineFig({ panel }: { panel: Timeline }) {
  return (
    <ol className="tl">
      {panel.steps.map((s, i) => (
        <li key={i} className={s.mark ? `m-${s.mark}` : ''}>
          <span className="at">{s.at}</span>
          <span className="dot">{s.mark ? MARK[s.mark] : ''}</span>
          <span className="body">
            <b>{s.label}</b>
            {s.note && <small>{s.note}</small>}
          </span>
        </li>
      ))}
    </ol>
  )
}

function TiersFig({ panel }: { panel: Tiers }) {
  return (
    <table className="tiers">
      {panel.head && <thead><tr><th>{panel.head[0]}</th><th>{panel.head[1]}</th></tr></thead>}
      <tbody>
        {panel.rows.map((r, i) => (
          <tr key={i}>
            <th>{r.when}</th>
            <td>
              <b>{r.then}</b>
              {r.note && <small>{r.note}</small>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const SECTION_FILL = {
  building: '#cfc6b4', land: '#e6e0d4', road: '#d8d3c8', fill: '#c4b79a',
}

function SectionFig({ panel }: { panel: Section }) {
  const W = 320, H = 130, GY = 104
  return (
    <svg className="section" viewBox={`0 0 ${W} ${H}`} role="img">
      <line x1={0} y1={GY} x2={W} y2={GY} stroke="var(--ink)" strokeWidth={1} />
      {panel.ground && <text x={W - 2} y={GY + 12} textAnchor="end" className="dim">{panel.ground}</text>}
      {panel.boxes.map((b, i) => {
        const x = b.x * W, w = b.w * W, h = b.h * (GY - 14)
        return (
          <g key={i}>
            <rect x={x} y={GY - h} width={w} height={h}
              fill={SECTION_FILL[b.type ?? 'building']} stroke="var(--ink)" strokeWidth={1} />
            {b.label && (
              <text x={x + w / 2} y={GY - h - 5} textAnchor="middle" className="dim">{b.label}</text>
            )}
          </g>
        )
      })}
      {(panel.dims ?? []).map((d, i) => {
        const y = d.at === 'top' ? 12 : GY + 18
        const x1 = d.from * W, x2 = d.to * W
        return (
          <g key={i}>
            <path d={`M ${x1} ${y} H ${x2}`} stroke="var(--faint)" strokeWidth={1} />
            <path d={`M ${x1} ${y - 3} v 6 M ${x2} ${y - 3} v 6`} stroke="var(--faint)" strokeWidth={1} />
            <text x={(x1 + x2) / 2} y={y - 5} textAnchor="middle" className="dim">{d.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

function BranchFig({ panel }: { panel: Branch }) {
  return (
    <div className="branch">
      <p className="ask">{panel.ask}</p>
      <div className="ways">
        {([['yes', panel.yes], ['no', panel.no]] as const).map(([k, v]) => (
          <div key={k} className={`way ${k}`}>
            <b>{v.label}</b>
            <span>{v.result}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Figure({ panel }: { panel: Panel }) {
  return (
    <figure className="panel">
      {panel.caption && <figcaption>{panel.caption}</figcaption>}
      {panel.kind === 'timeline' ? <TimelineFig panel={panel} />
        : panel.kind === 'tiers' ? <TiersFig panel={panel} />
        : panel.kind === 'section' ? <SectionFig panel={panel} />
        : panel.kind === 'branch' ? <BranchFig panel={panel} />
        : <RelationFig panel={panel} />}
      {panel.note && <p className="note">{panel.note}</p>}
    </figure>
  )
}

export function Lesson({ data }: { data: LessonData }) {
  return (
    <div className="lesson">
      <p className="summary">{data.summary}</p>
      {data.panels.map((p, i) => <Figure key={i} panel={p} />)}
      <div className="cols">
        <section>
          <h4>覚えること</h4>
          <ul>{data.points.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </section>
        {data.traps && data.traps.length > 0 && (
          <section className="traps">
            <h4>引っかけ方</h4>
            <ul>{data.traps.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </section>
        )}
      </div>
    </div>
  )
}
