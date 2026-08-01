import { Arrow, Box, Coins, House, LegendItem, Num, Person, Sheet, Sign, Storeys } from './primitives'
import { groundStyle } from './tiles'

/**
 * 7種類の図。すべて primitives.tsx の部品とトークンだけで組む。
 * ここに新しい色・新しい線幅・新しいフォントを足さないこと。
 */

const pct = (n: number) => `${Math.round(n)}%`

/** 宅建で出る割合は分数で覚えるものなので、きれいな値は分数も添える */
const FRACTIONS: Record<number, string> = {
  75: '3/4',
  67: '2/3',
  66: '2/3',
  50: '1/2',
  33: '1/3',
  34: '1/3',
  25: '1/4',
  20: '1/5',
  17: '1/6',
  13: '1/8',
  12: '1/8',
}

/** 網掛けの段階。色ではなくディザ(市松)で隣り合う区画を見分ける */
const DITHER = ['', ' dg-dither-1', ' dg-dither-2', ' dg-dither-3']

// ────────────────────────────────────────────────────────── parties
/** 当事者の関係。labels[0] が起点、以降が相手方 */
export function Parties({ labels }: { labels: string[] }) {
  const [head = '当事者', ...rest] = labels
  const others = rest.length > 0 ? rest : ['相手方']

  return (
    <Sheet tab="だれとだれ" summary={`${head} と ${others.join('・')} の関係`}>
      <div className="dg-parties">
        <div className="dg-parties-head">
          <Person id={head} label={head} />
          <Box role="own">{head}</Box>
        </div>
        {/* 相手が複数なら幹線(縦線)から枝分かれさせる = 家系図の読み方 */}
        <div className={`dg-parties-rows${others.length > 1 ? ' dg-parties-fan' : ''}`}>
          {others.map((name, i) => (
            <div className="dg-parties-row" key={name + i}>
              <Arrow role="right" />
              <div className="dg-parties-node">
                <Person id={name} label={name} />
                <Box role="right">{name}</Box>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Sheet>
  )
}

// ─────────────────────────────────────────────────────────── ratio
/** 割合。持分はすべて同じ「所有」なので、色ではなく網掛けで区別する */
export function Ratio({ labels, values }: { labels: string[]; values: number[] }) {
  const total = values.reduce((a, b) => a + b, 0) || 100
  const parts = labels.map((name, i) => ({
    name,
    value: values[i] ?? 0,
    share: ((values[i] ?? 0) / total) * 100,
  }))

  return (
    <Sheet
      tab="わりあい"
      summary={parts.map((p) => `${p.name} ${pct(p.share)}`).join('、')}
      legend={parts.map((p, i) => (
        <span className="dg-legend-item" key={p.name + i}>
          <span className={`dg-swatch dg-own${DITHER[i % DITHER.length]}`} />
          {p.name}
          <b>{FRACTIONS[Math.round(p.share)] ?? pct(p.share)}</b>
        </span>
      ))}
    >
      <div className="dg-ratio-bar">
        {parts.map((p, i) => (
          <div
            className={`dg-box dg-own dg-ratio-seg${DITHER[i % DITHER.length]}`}
            style={{ flexGrow: Math.max(p.share, 4) }}
            key={p.name + i}
          >
            <Num>{pct(p.share)}</Num>
          </div>
        ))}
      </div>
      <div className="dg-ratio-scale" aria-hidden="true">
        <span>0</span>
        <span>1/4</span>
        <span>1/2</span>
        <span>3/4</span>
        <span>全部</span>
      </div>
    </Sheet>
  )
}

// ──────────────────────────────────────────────────────────── area
/** 建蔽率(敷地の何割を建物が覆えるか)と容積率(延べ面積) */
export function Area({ labels, values }: { labels: string[]; values: number[] }) {
  const kenpei = Math.min(values[0] ?? 60, 100)
  const yoseki = values[1] ?? 200
  const floors = Math.max(1, Math.min(8, Math.round(yoseki / Math.max(kenpei, 1))))
  const side = Math.sqrt(kenpei / 100) * 100

  return (
    <Sheet
      tab="めんせき"
      summary={`敷地に対して建蔽率${kenpei}%まで建てられ、容積率${yoseki}%なので延べ床は約${floors}階分になる`}
      legend={
        <>
          <LegendItem role="land" name="敷地" />
          <LegendItem role="own" name="建てられる部分" />
        </>
      }
    >
      <div className="dg-area">
        <div className="dg-area-panel">
          <span className="dg-area-title">
            建蔽率 <Num>{pct(kenpei)}</Num>
          </span>
          <div className="dg-area-lot" style={groundStyle('grass')}>
            <div
              className="dg-box dg-own dg-area-foot"
              style={{ width: `${side}%`, height: `${side}%` }}
            >
              <House />
            </div>
          </div>
          <span className="dg-note">{labels[0] ?? '真上から見た敷地'}</span>
        </div>

        <div className="dg-area-panel">
          <span className="dg-area-title">
            容積率 <Num>{pct(yoseki)}</Num>
          </span>
          <div className="dg-area-lot dg-area-side" style={groundStyle('dirt')}>
            <Storeys floors={floors} />
          </div>
          <span className="dg-note">
            {labels[1] ?? `延べ床は敷地の${yoseki / 100}倍 = ${floors}階分`}
          </span>
        </div>
      </div>
    </Sheet>
  )
}

// ──────────────────────────────────────────────────────── timeline
/** 期間・期限。values は起点からの日数 */
export function Timeline({ labels, values }: { labels: string[]; values: number[] }) {
  const points = (labels.length > 0 ? labels : ['契約', '期限']).map((name, i) => ({
    name,
    day: values[i] ?? (i === 0 ? 0 : 8),
  }))
  const max = Math.max(...points.map((p) => p.day), 1)
  const at = (day: number) => `${(day / max) * 100}%`
  const ticks = max <= 31 ? max : 0

  return (
    <Sheet
      tab="きげん"
      summary={points.map((p) => `${p.name}=${p.day}日目`).join('、')}
      legend={<LegendItem role="time" name="この期間のうちに" value={`${max}日`} />}
    >
      <div className="dg-time-track">
        <div
          className="dg-time-axis"
          style={ticks > 0 ? { ['--dg-tick' as string]: `${100 / ticks}%` } : undefined}
        >
          <span className="dg-time-span" style={{ width: at(points[points.length - 1].day) }} />
        </div>
        {points.map((p, i) => {
          const last = i === points.length - 1
          // 端のラベルは枠からはみ出すので、外側ではなく内側へ寄せる
          const align = i === 0 ? ' dg-time-point-start' : last ? ' dg-time-point-end' : ''
          const down = i % 2 === 1 ? ' dg-time-point-down' : ''
          return (
            <div className={`dg-time-point${down}${align}`} style={{ left: at(p.day) }} key={p.name + i}>
              <span className="dg-tag">
                {p.name}
                <Num>{p.day}日</Num>
              </span>
              <span className="dg-time-stem" />
              <span className={`dg-time-pin dg-${last ? 'time' : 'own'}`} />
            </div>
          )
        })}
      </div>
    </Sheet>
  )
}

// ─────────────────────────────────────────────────────────── money
/** お金の流れ。labels[0]=払う人 labels[1]=受け取る人 labels[2..]=内訳の名目 */
export function Money({ labels, values }: { labels: string[]; values: number[] }) {
  const from = labels[0] ?? '払う人'
  const to = labels[1] ?? '受け取る人'
  const items = labels.slice(2).map((name, i) => ({ name, value: values[i] ?? 0 }))
  const total = items.length > 0 ? items.reduce((a, b) => a + b.value, 0) : (values[0] ?? 0)

  return (
    <Sheet
      tab="おかね"
      summary={`${from} が ${to} に ${total}万円を払う`}
      legend={<LegendItem role="money" name="お金の向き" value={`${total}万円`} />}
    >
      <div className="dg-money-flow">
        <div className="dg-money-node">
          <Person id={from} label={from} />
          <Box role="own">{from}</Box>
        </div>
        <div className="dg-money-mid">
          <span className="dg-money-amount">
            <Coins />
            <Num big>{total}万円</Num>
          </span>
          <span className="dg-money-arrow">
            <Arrow role="money" />
          </span>
        </div>
        <div className="dg-money-node">
          <Person id={to} label={to} />
          <Box role="right">{to}</Box>
        </div>
      </div>

      {items.length > 0 && (
        <dl className="dg-ledger">
          {items.map((it, i) => (
            <div className="dg-ledger-row" key={it.name + i}>
              <dt>{it.name}</dt>
              <dd>
                <Num>{it.value}万円</Num>
              </dd>
            </div>
          ))}
          <div className="dg-ledger-row dg-ledger-total">
            <dt>合計</dt>
            <dd>
              <Num big>{total}万円</Num>
            </dd>
          </div>
        </dl>
      )}
    </Sheet>
  )
}

// ──────────────────────────────────────────────────────────── land
/** 土地と境界・隣地・接道。labels[0] が自分の土地 */
export function Land({ labels, values }: { labels: string[]; values: number[] }) {
  const parcels = (labels.length > 0 ? labels : ['自分の土地', '隣地']).map((name, i) => ({
    name,
    area: values[i],
    own: i === 0,
  }))

  return (
    <Sheet
      tab="とち"
      summary={`${parcels.map((p) => p.name).join('と')}。境目に境界標があり、南側が道路に接している`}
      legend={
        <>
          <LegendItem role="own" name="自分の土地" />
          <LegendItem role="other" name="隣の土地" />
          <LegendItem role="time" name="境界線" />
        </>
      }
    >
      <div className="dg-land">
        {parcels.map((p, i) => (
          <div className="dg-land-cell" key={p.name + i}>
            {i > 0 && (
              <span className="dg-land-border" aria-hidden="true">
                <Sign />
              </span>
            )}
            {/* どちらも土地なので地面の絵は同じ。持ち主の違いは枠の色と名札で示す */}
            <div
              className={`dg-land-parcel dg-${p.own ? 'own' : 'other'}`}
              style={groundStyle('grass')}
            >
              <House tone={p.own ? 'warm' : 'cool'} />
              <span className="dg-tag">{p.name}</span>
              {p.area !== undefined && <Num>{p.area}㎡</Num>}
            </div>
          </div>
        ))}
      </div>
      <div className="dg-land-road" style={groundStyle('road')}>
        <span className="dg-tag">道路</span>
      </div>
    </Sheet>
  )
}

// ─────────────────────────────────────────────────────── floorplan
const PLANS: Record<number, string> = {
  1: '"a a a" "a a a"',
  2: '"a a b" "a a b"',
  3: '"a a b" "a a c"',
  4: '"a a b" "c d d"',
  5: '"a a b" "c d e"',
  6: '"a b c" "d e f"',
}

/** 間取り・区分所有 */
export function Floorplan({ labels, values }: { labels: string[]; values: number[] }) {
  const rooms = (labels.length > 0 ? labels : ['居室']).slice(0, 6)
  const areas = values.slice(0, rooms.length)
  const total = areas.reduce((a, b) => a + b, 0)

  return (
    <Sheet
      tab="まどり"
      summary={rooms
        .map((r, i) => (areas[i] !== undefined ? `${r} ${areas[i]}㎡` : r))
        .join('、')}
      legend={
        total > 0 ? <LegendItem role="land" name="専有面積の合計" value={`${total}㎡`} /> : undefined
      }
    >
      <div
        className="dg-plan"
        style={{ gridTemplateAreas: PLANS[rooms.length] ?? PLANS[6] }}
      >
        {rooms.map((name, i) => (
          <div
            className="dg-plan-room"
            style={{
              gridArea: String.fromCharCode(97 + i),
              ...groundStyle(i === 0 ? 'floor-warm' : 'floor-cool'),
            }}
            key={name + i}
          >
            <span className="dg-tag">{name}</span>
            {areas[i] !== undefined && <Num>{areas[i]}㎡</Num>}
          </div>
        ))}
        <span className="dg-plan-door" aria-label="玄関">
          玄関
        </span>
      </div>
    </Sheet>
  )
}
