import { useLayoutEffect, useRef, useState } from 'react'
import { castOf, ageAt, generations } from './story'
import { Person } from './Person'

// 論点の図解。人はそのまま物語の住人を借りる。
// 抽象の話でも、知っている顔が出てくると頭に残る。

export type Node =
  | { kind: 'person'; who: string; label: string; sub?: string }
  | { kind: 'thing'; icon: Icon; label: string; sub?: string }
export type Icon = 'land' | 'house' | 'money' | 'paper' | 'key' | 'time'
export type Link = { from: number; to: number; label?: string; style?: 'solid' | 'dashed' }
export type Panel = { caption: string; nodes: Node[]; links?: Link[]; note?: string }
export type LessonData = {
  topicId: string
  summary: string
  panels: Panel[]
  points: string[]
  traps?: string[]
}

const GLYPH: Record<Icon, string> = {
  land: '▭', house: '⌂', money: '¥', paper: '▤', key: '⚿', time: '⏳',
}

/** その人が一番よく出る世代の年齢で描く */
const ageOf = (id: string) => {
  const c = castOf.get(id)
  const g = generations.find((x) => x.gen === (c?.appearsIn[0] ?? 1))
  return ageAt(c, g?.startYear ?? 1015)
}

function Diagram({ panel }: { panel: Panel }) {
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
    <figure className="panel">
      <figcaption>{panel.caption}</figcaption>
      <div className="stagebox" ref={wrap}>
        <svg className="wires">
          {seg.map((s, i) => {
            const dip = 26 + Math.abs(s.x2 - s.x1) * 0.06
            const mx = (s.x1 + s.x2) / 2
            const my = Math.max(s.y1, s.y2) + dip
            return (
              <g key={i}>
                <path
                  d={`M ${s.x1} ${s.y1} Q ${mx} ${my} ${s.x2} ${s.y2}`}
                  fill="none" stroke="var(--faint)" strokeWidth={1}
                  strokeDasharray={s.d ? '3 3' : undefined}
                />
                {s.l && <text x={mx} y={my - 2} textAnchor="middle" className="wire-label">{s.l}</text>}
              </g>
            )
          })}
        </svg>
        <div className="nodes">
          {panel.nodes.map((n, i) => (
            <div className="node" data-node key={i}>
              {n.kind === 'person' ? (
                <Person id={n.who} family={castOf.get(n.who)?.family}
                  gender={castOf.get(n.who)?.gender} age={ageOf(n.who)} size={52} head />
              ) : (
                <span className="glyph">{GLYPH[n.icon] ?? '▭'}</span>
              )}
              <b>{n.label}</b>
              {n.sub && <small>{n.sub}</small>}
            </div>
          ))}
        </div>
      </div>
      {panel.note && <p className="note">{panel.note}</p>}
    </figure>
  )
}

export function Lesson({ data }: { data: LessonData }) {
  return (
    <div className="lesson">
      <p className="summary">{data.summary}</p>
      {data.panels.map((p, i) => <Diagram key={i} panel={p} />)}
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
