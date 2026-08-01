import type { Character } from '../../types'
import { spriteGlyph } from '../../lib/content'
import './town.css'

interface Props {
  characters: Character[]
  onTapCharacter: (c: Character) => void
}

// ponytail: 固定タイルマップ。マップデータ外部化はマップが増えたら
const TILES = [
  'GGRGGGGG',
  'GHRGGHGG',
  'GGRRRRRG',
  'GGGGGRGG',
  'GHGGGRHG',
  'GGGGGRGG',
] as const

const TILE_CLASS: Record<string, string> = {
  G: 'tile-grass',
  R: 'tile-road',
  H: 'tile-house',
}

// 住民の立ち位置(タイル座標)
const SPOTS: [number, number][] = [
  [2, 3],
  [5, 1],
  [1, 4],
  [6, 4],
  [4, 0],
  [0, 2],
  [3, 5],
  [7, 2],
]

export function TownView({ characters, onTapCharacter }: Props) {
  return (
    <section className="town" aria-label="町">
      <div className="town-grid">
        {TILES.flatMap((row, y) =>
          [...row].map((t, x) => (
            <div key={`${x}-${y}`} className={`tile ${TILE_CLASS[t]}`}>
              {t === 'H' && <span className="tile-emoji">🏠</span>}
            </div>
          )),
        )}
        {characters.map((c, i) => {
          const [x, y] = SPOTS[i % SPOTS.length]
          return (
            <button
              key={c.id}
              type="button"
              className="resident"
              style={{ gridColumn: x + 1, gridRow: y + 1 }}
              onClick={() => onTapCharacter(c)}
              aria-label={`${c.name}と話す`}
            >
              <span className="resident-sprite">{spriteGlyph(c)}</span>
              <span className="resident-name">{c.name}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
