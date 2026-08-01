import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Character, Gender } from '../../types'
import { TOWN_SHEET, characterSpriteStyle, playerSpriteStyle, sheetStyle } from '../../lib/sprites'
import type { Facing } from '../../lib/sprites'
import {
  BUILDINGS,
  DECOR,
  GROUND,
  GROUND_TILE,
  HIBARI,
  LAND_SIGNS,
  MAP_COLS,
  MAP_ROWS,
  RESIDENT_SPOTS,
  SPARE_SPOTS,
  START_POS,
  T,
  inBounds,
  isSolid,
  propertyIdAt,
} from '../../lib/map'
import { propertyById } from '../../lib/properties'
import {
  SCATTER_IDLE_MS,
  advanceTrail,
  followerPositions,
  scatterPositions,
  trailLength,
} from '../../lib/follower'
import type { Follower, Pos } from '../../lib/follower'
import { LEAD_GAP, distance, findPath, playerCanMove, stepToward, wanderStep } from '../../lib/staging'
import type { Staging } from '../../lib/staging'
import { PropertyPanel } from '../property/PropertyPanel'
import './town.css'

interface Props {
  characters: Character[]
  gender: Gender
  /** 相談が控えている住民のID(頭に「!」を表示) */
  alertIds: ReadonlySet<string>
  /** 会話中は移動・決定キーを無効化 */
  inputLocked: boolean
  /** 会社(ひばり不動産)の頭上に「!」を出す(新しい転入者のサイン) */
  companyAlert?: boolean
  /** 主人公のすぐ後ろを一列でついてくるもの(案内中の世帯・ハゲ田のメモ) */
  followers?: readonly Follower[]
  /** 建物ID → 埋まっている戸数(物件パネルに入居状況を出す) */
  occupancy?: Readonly<Record<string, number>>
  /** 住民ID → 契約した家の前の立ち位置。無ければ既定の立ち位置 */
  homeSpots?: Readonly<Record<string, [number, number]>>
  /** 再生中の演出イベント(カットシーン) */
  staging?: Staging | null
  /** staging の follow 命令で、そのキャラが追従列に加わった */
  onStageFollow?: (actorId: string) => void
  /** staging を最後まで再生し終えた */
  onStagingEnd?: () => void
  onTapCharacter: (c: Character) => void
  /** 追従キャラに隣接して向いてスペース */
  onTalkFollower?: (f: Follower) => void
  /** 建物・看板の物件パネルを閉じたとき(案内中なら内見するか聞く) */
  onPropertyViewed?: (propertyId: string) => void
}

/** 住民が1歩うろつく間隔 */
const WANDER_MS = 2500

/** 歩けるタイルか(カットシーンの経路探索に渡す) */
const canStand = (x: number, y: number) => inBounds(x, y) && !isSolid(x, y)

/** カットシーンの1歩ぶんの間隔 */
const STAGE_STEP_MS = 200

const KEY_DIR: Record<string, [number, number, Facing]> = {
  ArrowUp: [0, -1, 'up'],
  ArrowDown: [0, 1, 'down'],
  ArrowLeft: [-1, 0, 'left'],
  ArrowRight: [1, 0, 'right'],
}

const FACE_DELTA: Record<Facing, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
}

export function TownView({
  characters,
  gender,
  alertIds,
  inputLocked,
  companyAlert = false,
  followers = [],
  occupancy = {},
  homeSpots = {},
  staging = null,
  onStageFollow,
  onStagingEnd,
  onTapCharacter,
  onTalkFollower,
  onPropertyViewed,
}: Props) {
  const [player, setPlayer] = useState<[number, number]>(START_POS)
  const [facing, setFacing] = useState<Facing>('up')
  /** 歩数。1歩ごとに増やして足を踏み替える */
  const [step, setStep] = useState(0)
  const [openProperty, setOpenProperty] = useState<string | null>(null)
  /** 主人公が通ったタイルの履歴(先頭が現在地)。後続はこれを1歩ずれでたどる */
  const [trail, setTrail] = useState<Pos[]>([START_POS])

  // 1歩動くたびに足跡を伸ばす。同じタイルなら advanceTrail が何もしない
  useEffect(() => {
    setTrail((t) => advanceTrail(t, player, trailLength(followers.length)))
  }, [player, followers.length])

  // 立ち止まると隊列がほどけて主人公の周りに広がる(全員に話しかけられるように)
  const [idle, setIdle] = useState(false)
  useEffect(() => {
    setIdle(false)
    const id = setTimeout(() => setIdle(true), SCATTER_IDLE_MS)
    return () => clearTimeout(id)
  }, [player, followers.length])

  const followerAt = new Map<string, Follower>()
  const followerSpots = idle
    ? scatterPositions(player, followers.length, (x, y) => inBounds(x, y) && !isSolid(x, y))
    : followerPositions(trail, followers.length)
  followers.forEach((f, i) => {
    const [fx, fy] = followerSpots[i]
    // 先頭を優先(団子のときは先頭の1人と話す)
    if (!followerAt.has(`${fx},${fy}`)) followerAt.set(`${fx},${fy}`, f)
  })

  // 住民は悩みに合った建物の前へ。未登録のIDは予備の立ち位置に回す
  let spare = 0
  const allResidents = characters.map((c) => ({
    character: c,
    spot: homeSpots[c.id] ?? RESIDENT_SPOTS[c.id] ?? SPARE_SPOTS[spare++ % SPARE_SPOTS.length],
  }))

  /* ---------------- 演出イベント(カットシーン)の再生 ---------------- */
  const [stageActors, setStageActors] = useState<Record<string, { pos: Pos; alert?: boolean }>>({})

  // 演出で歩いている/追従しているキャラは、定位置の住民としては描かない(二重に出るため)
  const elsewhere = new Set([...Object.keys(stageActors), ...followers.map((f) => f.id)])
  const residents = allResidents.filter((r) => !elsewhere.has(r.character.id))
  const [pc, setPc] = useState(0)
  const [sayLine, setSayLine] = useState<{ actor: string; text: string } | null>(null)
  const stagingId = staging?.id ?? null

  useEffect(() => {
    setStageActors({})
    setPc(0)
    setSayLine(null)
  }, [stagingId])

  const cmd = staging?.script[pc]

  // 1テンポずつ命令を進める。歩行はここで1タイルずつ
  useEffect(() => {
    if (!staging) return
    if (cmd === undefined) {
      onStagingEnd?.()
      return
    }
    if (cmd.cmd === 'say') {
      setSayLine({ actor: cmd.actor, text: cmd.text })
      return // スペース待ち
    }
    const timer = setTimeout(() => {
      if (cmd.cmd === 'spawn') {
        setStageActors((a) => ({ ...a, [cmd.actor]: { pos: cmd.at, alert: cmd.alert } }))
        setPc((n) => n + 1)
        return
      }
      if (cmd.cmd === 'wait') {
        setPc((n) => n + 1)
        return
      }
      if (cmd.cmd === 'camera') {
        // ponytail: カメラは常に主人公を追う。寄せの演出が要るまでは no-op
        setPc((n) => n + 1)
        return
      }
      if (cmd.cmd === 'follow') {
        setStageActors((a) => {
          const { [cmd.actor]: _gone, ...rest } = a
          return rest
        })
        onStageFollow?.(cmd.actor)
        setPc((n) => n + 1)
        return
      }
      // walkTo / lead: 1タイルだけ進む
      const cur = stageActors[cmd.actor]?.pos
      if (!cur) {
        setPc((n) => n + 1)
        return
      }
      if (cur[0] === cmd.to[0] && cur[1] === cmd.to[1]) {
        setPc((n) => n + 1)
        return
      }
      // 先導中に主人公が離れすぎたら立ち止まって待つ
      if (cmd.cmd === 'lead' && distance(cur, player) > LEAD_GAP) return
      const next = inBounds(cur[0], cur[1])
        ? (findPath(cur, cmd.to, canStand)[0] ?? cmd.to)
        : stepToward(cur, cmd.to)
      setStageActors((a) => ({ ...a, [cmd.actor]: { ...a[cmd.actor], pos: next } }))
    }, STAGE_STEP_MS)
    return () => clearTimeout(timer)
  }, [staging, cmd, pc, stageActors, player, onStageFollow, onStagingEnd])

  // セリフはスペースで送る
  useEffect(() => {
    if (!sayLine) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'Enter') return
      e.preventDefault()
      setSayLine(null)
      setPc((n) => n + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sayLine])

  /** カットシーン中は原則動けない(lead 中だけは主人公が追いかける必要がある) */
  const stageLock = staging !== null && (sayLine !== null || !playerCanMove(cmd))

  /* ---------------- 住民のうろつき ---------------- */
  // 持ち場の周りを数秒に1歩。相談を持っている住民(「!」)は動かない(逃げ回ると理不尽)
  const [wander, setWander] = useState<Record<string, Pos>>({})
  const frozen = inputLocked || staging !== null
  useEffect(() => {
    if (frozen) return
    const id = setInterval(() => {
      setWander((w) => {
        const movable = residents.filter((r) => !alertIds.has(r.character.id))
        if (movable.length === 0) return w
        const pick = movable[Math.floor(Math.random() * movable.length)]
        const cid = pick.character.id
        const cur = w[cid] ?? pick.spot
        const next = wanderStep(pick.spot, cur, Math.floor(Math.random() * 4), canStand)
        return next === cur ? w : { ...w, [cid]: next }
      })
    }, WANDER_MS)
    return () => clearInterval(id)
    // residents は characters からの導出で毎回同値
  }, [frozen, characters, alertIds]) // eslint-disable-line react-hooks/exhaustive-deps

  const panelOpen = openProperty !== null

  useEffect(() => {
    if (inputLocked || panelOpen || stageLock) return
    const residentAt = new Map(
      residents.map((r) => {
        const [x, y] = wander[r.character.id] ?? r.spot
        return [`${x},${y}`, r.character] as const
      }),
    )

    const onKey = (e: KeyboardEvent) => {
      const dir = KEY_DIR[e.key]
      if (dir) {
        e.preventDefault()
        setFacing(dir[2])
        setPlayer(([x, y]) => {
          const nx = x + dir[0]
          const ny = y + dir[1]
          if (!inBounds(nx, ny)) return [x, y]
          if (isSolid(nx, ny) || residentAt.has(`${nx},${ny}`)) return [x, y]
          setStep((s) => s + 1)
          return [nx, ny]
        })
        return
      }
      if (e.key !== ' ' && e.key !== 'Enter') return
      e.preventDefault()
      setPlayer(([x, y]) => {
        const [dx, dy] = FACE_DELTA[facing]
        const fx = x + dx
        const fy = y + dy
        // 1. 向いている先に住民 → 会話
        const faced = residentAt.get(`${fx},${fy}`)
        if (faced) {
          onTapCharacter(faced)
          return [x, y]
        }
        // 2. 向いている先に追従キャラ → 会話
        const facedFollower = followerAt.get(`${fx},${fy}`)
        if (facedFollower) {
          onTalkFollower?.(facedFollower)
          return [x, y]
        }
        // 3. 向いている先が建物 or 空き地の看板 → 物件ステータス
        const propId = propertyIdAt(fx, fy)
        if (propId) {
          setOpenProperty(propId)
          return [x, y]
        }
        // 4. 向きが合っていなくても隣の住民・追従キャラとは話せる(取り回し優先)
        const around = [
          [x, y - 1],
          [x, y + 1],
          [x - 1, y],
          [x + 1, y],
        ] as const
        const neighbor = around
          .map(([nx, ny]) => residentAt.get(`${nx},${ny}`))
          .find((c) => c !== undefined)
        if (neighbor) {
          onTapCharacter(neighbor)
          return [x, y]
        }
        const nearFollower = around
          .map(([nx, ny]) => followerAt.get(`${nx},${ny}`))
          .find((f) => f !== undefined)
        if (nearFollower) onTalkFollower?.(nearFollower)
        return [x, y]
      })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // residents は characters から導出で毎回同値
  }, [inputLocked, panelOpen, stageLock, wander, facing, characters, onTapCharacter, onTalkFollower, followers, trail, idle]) // eslint-disable-line react-hooks/exhaustive-deps

  const openSpec = openProperty === null ? undefined : propertyById(openProperty)

  return (
    <section className="town" aria-label="町">
      <div className="town-viewport">
        {/* カメラ: 主人公が常に中央。--px/--py でマップ側を逆方向に translate */}
        <div
          className="town-grid"
          style={
            {
              '--px': player[0],
              '--py': player[1],
              '--cols': MAP_COLS,
              '--rows': MAP_ROWS,
            } as CSSProperties
          }
        >
          {GROUND.flatMap((row, y) =>
            [...row].map((ch, x) => (
              <div
                key={`${x}-${y}`}
                className="tile"
                style={{
                  ...sheetStyle(TOWN_SHEET, GROUND_TILE[ch] ?? T.grass),
                  gridColumn: x + 1,
                  gridRow: y + 1,
                }}
              />
            )),
          )}

          {DECOR.map((d, i) => (
            <div
              key={`d${i}`}
              className="tile obj"
              style={{ ...sheetStyle(TOWN_SHEET, d.tile), gridColumn: d.x + 1, gridRow: d.y + 1 }}
            />
          ))}

          {BUILDINGS.flatMap((b) =>
            b.cells.flatMap((row, dy) =>
              row.map((tile, dx) =>
                tile < 0 ? null : (
                  <div
                    key={`${b.id}-${dx}-${dy}`}
                    className="tile obj"
                    style={{
                      ...sheetStyle(TOWN_SHEET, tile),
                      gridColumn: b.x + dx + 1,
                      gridRow: b.y + dy + 1,
                      filter: b.filter,
                    }}
                  />
                ),
              ),
            ),
          )}

          {LAND_SIGNS.map((sign) => (
            <div
              key={sign.id}
              className="tile obj land-sign"
              style={{
                ...sheetStyle(TOWN_SHEET, T.sign),
                gridColumn: sign.x + 1,
                gridRow: sign.y + 1,
              }}
              aria-label="土地の看板"
            />
          ))}

          {companyAlert && (
            <div
              className="building-alert"
              style={{ gridColumn: HIBARI.x + 2, gridRow: HIBARI.y }}
              aria-label="会社に用事あり"
            >
              !
            </div>
          )}

          {residents.map(({ character: c, spot }) => {
            const [x, y] = wander[c.id] ?? spot
            return (
            <button
              key={c.id}
              type="button"
              className="resident"
              style={{ '--fx': x, '--fy': y } as CSSProperties}
              onClick={() => onTapCharacter(c)}
              aria-label={`${c.name}と話す`}
            >
              {alertIds.has(c.id) && (
                <span className="resident-alert" aria-label="相談あり">
                  !
                </span>
              )}
              <span className="char-sprite" style={characterSpriteStyle(c.id)} />
              <span className="resident-name">{c.name}</span>
            </button>
            )
          })}

          {/* 演出イベントで歩いているキャラ */}
          {Object.entries(stageActors).map(([id, a]) => (
            <div
              key={`stage-${id}`}
              className="follower"
              style={{ '--fx': a.pos[0], '--fy': a.pos[1] } as CSSProperties}
              aria-label={staging?.actors.find((x) => x.id === id)?.name ?? id}
            >
              {a.alert && (
                <span className="resident-alert" aria-label="用事あり">
                  !
                </span>
              )}
              <span className="char-sprite" style={characterSpriteStyle(id)} />
              <span className="resident-name">
                {staging?.actors.find((x) => x.id === id)?.name ?? id}
              </span>
            </div>
          ))}

          {/* 追従キャラ。当たり判定は持たない(主人公も住民もすり抜ける) */}
          {followers.map((f, i) => {
            const [fx, fy] = followerSpots[i]
            return (
              <div
                key={f.id}
                className="follower"
                style={{ '--fx': fx, '--fy': fy } as CSSProperties}
                aria-label={f.name ?? 'ハゲ田のメモ'}
              >
                {f.alert && (
                  <span className="resident-alert" aria-label="用事あり">
                    !
                  </span>
                )}
                {f.kind === 'member' ? (
                  <span className="char-sprite" style={characterSpriteStyle(f.id)} />
                ) : (
                  // ponytail: Kenney の素材に本らしいタイルが無かったので、
                  // 背表紙付きの小さな四角をCSSで描いて代用している
                  <span className="follower-book" />
                )}
                {f.name && <span className="resident-name">{f.name}</span>}
              </div>
            )
          })}

          <div className="player" aria-label="主人公">
            <span className="char-sprite player-sprite" style={playerSpriteStyle(gender, facing, step)} />
          </div>
        </div>
      </div>

      {sayLine && (
        <div className="stage-say" role="status">
          <span className="char-sprite stage-say-face" style={characterSpriteStyle(sayLine.actor)} />
          <p>
            <strong>{staging?.actors.find((x) => x.id === sayLine.actor)?.name ?? ''}</strong>
            「{sayLine.text}」
            <span className="tour-next" aria-hidden="true">
              ▼
            </span>
          </p>
        </div>
      )}

      <p className="town-help">
        矢印キーで移動 / 住民・連れのとなりでスペースで会話 / 建物・看板を向いてスペースで物件情報
      </p>

      {openSpec && (
        <PropertyPanel
          spec={openSpec}
          occupied={occupancy[openSpec.id] ?? 0}
          onClose={() => {
            setOpenProperty(null)
            onPropertyViewed?.(openSpec.id)
          }}
        />
      )}
    </section>
  )
}
