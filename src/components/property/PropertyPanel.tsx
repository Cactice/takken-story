import { useEffect } from 'react'
import type { PropertySpec } from '../../lib/properties'
import './property.css'

interface Props {
  spec: PropertySpec
  /** 埋まっている戸数(未指定なら空き家) */
  occupied?: number
  onClose: () => void
}

/** 「空き家」「3/8戸 入居中」「満室」 */
export function occupancyLabel(spec: PropertySpec, occupied: number): string {
  if (occupied <= 0) return spec.units > 1 ? `空き家(全${spec.units}戸)` : '空き家'
  if (occupied >= spec.units) return spec.units > 1 ? `満室(${spec.units}/${spec.units}戸)` : '入居中(満室)'
  return `${occupied}/${spec.units}戸 入居中`
}

type Row = [label: string, value: string]

function rowsOf(p: PropertySpec): Row[] {
  const rows: Row[] = [['種別', p.category]]
  if (p.structure) rows.push(['構造', p.structure])
  if (p.floors) rows.push(['階数', p.floors])
  if (p.age) rows.push(['築年数', p.age])
  if (p.kind === 'building') rows.push(['面積', p.area])
  if (p.landArea) rows.push(['土地', p.landArea])
  rows.push(['用途地域', p.zoning])
  rows.push(['建蔽率', p.coverage])
  rows.push(['容積率', p.floorAreaRatio])
  rows.push([p.price.includes('賃料') ? '賃料' : '価格', p.price])
  if (p.deposit) rows.push(['敷金礼金', p.deposit])
  rows.push(['接道', p.road])
  return rows
}

/** 建物・土地のスペック一覧。矢印かスペースで閉じる(操作は矢印+スペースのみ) */
export function PropertyPanel({ spec, occupied = 0, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === ' ' ||
        e.key === 'Enter' ||
        e.key === 'Escape' ||
        e.key.startsWith('Arrow')
      ) {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="prop-overlay" role="dialog" aria-label={`${spec.name}の物件情報`}>
      <div className="prop-panel">
        <h2 className="prop-title">
          <span className="prop-icon">{spec.kind === 'land' ? '🪧' : '🏠'}</span>
          {spec.name}
        </h2>

        <dl className="prop-rows">
          {[['入居状況', occupancyLabel(spec, occupied)] as Row, ...rowsOf(spec)].map(([label, value]) => (
            <div key={label} className="prop-row">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        {spec.features.length > 0 && (
          <section className="prop-section">
            <h3>設備・特徴</h3>
            <ul>
              {spec.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="prop-section prop-legal">
          <h3>⚖️ 法的な注意点</h3>
          <ul>
            {spec.legalNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>

        <p className="prop-hint">矢印キーかスペースで閉じる</p>
      </div>
    </div>
  )
}
