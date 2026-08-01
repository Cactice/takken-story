// 開発時の確認用ページ(本番ビルドには入らない。vite build は index.html だけを見る)。
//   http://localhost:5173/takken-story/dev-preview.html?view=gen   世代選択
//   http://localhost:5173/takken-story/dev-preview.html?view=map&id=kurokai   マップ全景
import { createRoot } from 'react-dom/client'
import type { CSSProperties } from 'react'
import { GenerationSelect } from '../components/generation/GenerationSelect'
import { MAPS } from '../lib/maps'
import type { GameMap } from '../lib/maps'
import { sheetStyle } from '../lib/sprites'
import '../index.css'

/** マップ全景。TownView にこの GameMap を繋ぐときの参照実装でもある */
function MapPreview({ map }: { map: GameMap }) {
  return (
    <div style={{ padding: '1rem', background: map.outsideColor, minHeight: '100dvh' }}>
      <h1 style={{ color: '#fff', fontSize: '1rem', marginBottom: '0.5rem' }}>
        {map.name} ({map.cols}x{map.rows}) 建物{map.buildings.length}棟
      </h1>
      <div
        style={
          {
            display: 'grid',
            gridTemplateColumns: `repeat(${map.cols}, var(--t))`,
            gridAutoRows: 'var(--t)',
            '--t': '32px',
            width: 'max-content',
            imageRendering: 'pixelated',
            border: '4px solid #000',
          } as CSSProperties
        }
      >
        {map.ground.flatMap((row, y) =>
          row.map((tile, x) => (
            <div
              key={`g${x}-${y}`}
              style={{ ...sheetStyle(map.sheet, tile), gridColumn: x + 1, gridRow: y + 1 }}
            />
          )),
        )}
        {map.over.flatMap((row, y) =>
          row.map((cell, x) =>
            cell === null ? null : (
              <div
                key={`o${x}-${y}`}
                style={{
                  ...sheetStyle(map.sheet, cell.tile),
                  filter: cell.filter,
                  gridColumn: x + 1,
                  gridRow: y + 1,
                  zIndex: 1,
                }}
              />
            ),
          ),
        )}
        {map.shadows.map(([x, y]) => (
          <div
            key={`s${x}-${y}`}
            style={{
              gridColumn: x + 1,
              gridRow: y + 1,
              background: 'rgb(24 28 48 / 0.3)',
              zIndex: 2,
              pointerEvents: 'none',
            }}
          />
        ))}
        {map.signs.map((s) => (
          <div
            key={s.id}
            style={{
              ...sheetStyle(map.sheet, map.signTile),
              gridColumn: s.x + 1,
              gridRow: s.y + 1,
              zIndex: 3,
            }}
          />
        ))}
        {map.buildings.map((b) => (
          <div
            key={b.id}
            style={{
              gridColumn: b.entrance[0] + 1,
              gridRow: b.entrance[1] + 1,
              zIndex: 4,
              display: 'grid',
              placeItems: 'center',
              color: '#ff3',
              fontSize: '20px',
              textShadow: '2px 2px 0 #000',
            }}
            title={b.name}
          >
            ▼
          </div>
        ))}
        <div
          style={{
            gridColumn: map.start[0] + 1,
            gridRow: map.start[1] + 1,
            zIndex: 3,
            display: 'grid',
            placeItems: 'center',
            color: '#0f0',
            fontSize: '20px',
          }}
        >
          ★
        </div>
      </div>
    </div>
  )
}

const params = new URLSearchParams(location.search)
const view = params.get('view') ?? 'gen'
const unlocked = new Set((params.get('unlocked') ?? '1,2').split(',').map(Number))

createRoot(document.getElementById('root')!).render(
  view === 'map' ? (
    <MapPreview map={MAPS[params.get('id') ?? 'kurokai']} />
  ) : (
    <GenerationSelect unlocked={unlocked} onSelect={(g) => console.log('select', g)} />
  ),
)
