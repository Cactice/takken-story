import { Area, Floorplan, Land, Money, Parties, Ratio, Timeline } from './figures'
import { useDotFont } from './useDotFont'
import './diagram.css'

/**
 * ハゲ田の解説につける図。会話ウィンドウでも自宅の復習画面でも同じものを使う。
 * デザイン方針は docs/DESIGN.md。
 */
export interface DiagramInput {
  /** docs/CONTENT_SCHEMA.md の diagram.type */
  type: string
  labels?: string[]
  values?: number[]
}

interface Props {
  spec: DiagramInput
  /** sm = 会話ウィンドウ内 / lg = 復習画面 */
  size?: 'sm' | 'lg'
}

export function Diagram({ spec, size = 'sm' }: Props) {
  useDotFont()
  const labels = spec.labels ?? []
  const values = spec.values ?? []

  return (
    <div className={size === 'lg' ? 'dg dg-lg' : 'dg'}>
      {spec.type === 'parties' && <Parties labels={labels} />}
      {spec.type === 'ratio' && <Ratio labels={labels} values={values} />}
      {spec.type === 'area' && <Area labels={labels} values={values} />}
      {spec.type === 'timeline' && <Timeline labels={labels} values={values} />}
      {spec.type === 'money' && <Money labels={labels} values={values} />}
      {spec.type === 'land' && <Land labels={labels} values={values} />}
      {spec.type === 'floorplan' && <Floorplan labels={labels} values={values} />}
    </div>
  )
}
