import { EXAM_DAY, EXAM_MONTH } from '../../types'
import './hud.css'

interface Props {
  month: number
  day: number
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

export function DateMeter({ month, day }: Props) {
  return (
    <div className="date-meter" aria-label={`現在 ${month}月${day}日`}>
      <div className="date-meter-track">
        {MONTHS.map((m) => (
          <span
            key={m}
            className={[
              'date-meter-seg',
              m < month ? 'is-past' : '',
              m === month ? 'is-current' : '',
              m === EXAM_MONTH ? 'is-exam' : '',
            ].join(' ')}
            title={m === EXAM_MONTH ? `${EXAM_MONTH}月${EXAM_DAY}日 宅建試験` : `${m}月`}
          />
        ))}
      </div>
      <span className="date-meter-label">
        {month}月{day}日
      </span>
    </div>
  )
}
