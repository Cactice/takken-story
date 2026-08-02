import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Character, Gender } from '../../types'
import { characterSpriteStyle, playerSpriteStyle, sheetStyle } from '../../lib/sprites'
import type { Facing } from '../../lib/sprites'
import { ARIKITA } from '../../lib/maps'
import type { GameMap, Season } from '../../lib/maps'
import { isVacant, propertyById } from '../../lib/properties'
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
  /** 舞台。世代で切り替わる(第1世代=ありきた村 / 第2・4世代=黒会市) */
  map?: GameMap
  /** 季節。地面と重ね物のタイルが差し替わる(冬は雪) */
  season?: Season
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
  /**
   * 中に入れる建物のID(自宅・会社)。入口タイルを向いてスペースで入る。
   * 物件パネルは出さず、そのまま内装シーンへ渡す(判断は App 側)
   */
  enterableIds?: ReadonlySet<string>
  /** 入口タイルを向いてスペース(中に入る) */
  onEnterBuilding?: (buildingId: string) => void
  /** 物件パネルの開閉(開いている間は客の機嫌を減らさない) */
  onPropertyPanel?: (propertyId: string | null) => void
}

/** 住民が1歩うろつく間隔 */
const WANDER_MS = 2500

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
  map = ARIKITA,
  season = 'spring',
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
  enterableIds,
  onEnterBuilding,
  onPropertyPanel,
}: Props) {
  // 季節ごとに地面と重ね物のタイルが差し替わる(冬は雪のシート)
  const layer = map.layers?.[season] ?? map
  const inBounds = map.inBounds
  const isSolid = map.isSolid
  const canStand = (x: number, y: number) => inBounds(x, y) && !isSolid(x, y)
  const [player, setPlayer] = useState<[number, number]>([map.start[0], map.start[1]])

  // 舞台が変わったら開始位置へ
  useEffect(() => {
    setPlayer([map.start[0], map.start[1]])
  }, [map])
  const [facing, setFacing] = useState<Facing>('up')
  /** 歩数。1歩ごとに増やして足を踏み替える */
  const [step, setStep] = useState(0)
  const [openProperty, setOpenProperty] = useState<string | null>(null)
  /** 主人公が通ったタイルの履歴(先頭が現在地)。後続はこれを1歩ずれでたどる */
  const [trail, setTrail] = useState<Pos[]>([map.start])

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
    spot: (homeSpots[c.id] ??
      map.residentSpots[c.id] ??
      map.spareSpots[spare++ % map.spareSpots.length]) as [number, number],
  }))

  /**
   * 空き物件(案内できる家)。建物は棟全体を囲み、土地は看板1マスを囲む。
   * 満室・案内対象外(会社・自宅)は出さない。
   */
  const vacantSpots = [
    ...map.buildings
      .filter((b) => isVacant(b.id, occupancy))
      .map((b) => ({
        id: b.id,
        x: b.rect.x0,
        y: b.rect.y0,
        w: b.rect.x1 - b.rect.x0 + 1,
        h: b.rect.y1 - b.rect.y0 + 1,
      })),
    ...map.signs
      .filter((s) => isVacant(s.id, occupancy))
      .map((s) => ({ id: s.id, x: s.x, y: s.y, w: 1, h: 1 })),
  ]

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

  // 1テンポずつ命令を進める。歩行はここで1タイルずつ。
  // ref 経由で最新値を読む: 主人公が動くたびにタイマーを張り直すと、
  // キーを押し続けているあいだNPCが一歩も進めなくなる
  const stageRef = useRef({ staging, cmd, stageActors, player })
  stageRef.current = { staging, cmd, stageActors, player }

  useEffect(() => {
    if (!staging) return
    const tick = () => {
      const { cmd: c, stageActors: actors, player: pl } = stageRef.current
      if (c === undefined) {
        onStagingEnd?.()
        return
      }
      // say はスペース待ち、banner は時間待ち(どちらも表示は下の効果が出す)
      if (c.cmd === 'say' || c.cmd === 'banner') return
      if (c.cmd === 'spawn') {
        setStageActors((a) => ({ ...a, [c.actor]: { pos: c.at, alert: c.alert } }))
        setPc((n) => n + 1)
        return
      }
      if (c.cmd === 'wait' || c.cmd === 'camera') {
        // ponytail: camera は常に主人公を追う。寄せの演出が要るまでは no-op
        setPc((n) => n + 1)
        return
      }
      if (c.cmd === 'follow') {
        setStageActors((a) => {
          const { [c.actor]: _gone, ...rest } = a
          return rest
        })
        onStageFollow?.(c.actor)
        setPc((n) => n + 1)
        return
      }
      // walkTo / lead: 1タイルだけ進む
      if (c.cmd !== 'walkTo' && c.cmd !== 'lead') return
      const cur = actors[c.actor]?.pos
      if (!cur || (cur[0] === c.to[0] && cur[1] === c.to[1])) {
        setPc((n) => n + 1)
        return
      }
      // 先導中に主人公が離れすぎたら立ち止まって待つ
      if (c.cmd === 'lead' && distance(cur, pl) > LEAD_GAP) return
      const next = inBounds(cur[0], cur[1])
        ? findPath(cur, c.to, canStand)[0]
        : stepToward(cur, c.to)
      // これ以上近づけない(行き止まり)なら、その命令は終わりにする
      if (!next) {
        setPc((n) => n + 1)
        return
      }
      setStageActors((a) => ({ ...a, [c.actor]: { ...a[c.actor], pos: next } }))
    }
    const id = setInterval(tick, STAGE_STEP_MS)
    return () => clearInterval(id)
  }, [stagingId, staging, onStageFollow, onStagingEnd])

  // say は表示だけ(送るのは下のキー処理)
  useEffect(() => {
    if (cmd?.cmd === 'say') setSayLine({ actor: cmd.actor, text: cmd.text })
  }, [cmd])

  // banner: 画面中央に大きな見出しを短く出し、時間が来たら勝手に次へ進む
  const [banner, setBanner] = useState<{ text: string; sub?: string } | null>(null)
  useEffect(() => {
    if (cmd?.cmd !== 'banner') return
    setBanner({ text: cmd.text, sub: cmd.sub })
    const id = setTimeout(() => {
      setBanner(null)
      setPc((n) => n + 1)
    }, cmd.ms ?? 1800)
    return () => clearTimeout(id)
  }, [cmd])

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

  // 物件パネルの開閉を外へ知らせる(読んでいる間は客の機嫌を止めるため)
  useEffect(() => {
    onPropertyPanel?.(openProperty)
    // onPropertyPanel は App 側で毎回作られるので依存に入れない(開閉のたびだけ通知する)
  }, [openProperty]) // eslint-disable-line react-hooks/exhaustive-deps

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
        // 3. 向いている先が入口タイル、かつ中に入れる建物 → そのまま中へ
        const door = map.buildings.find(
          (b) => b.entrance[0] === fx && b.entrance[1] === fy && enterableIds?.has(b.id),
        )
        if (door) {
          onEnterBuilding?.(door.id)
          return [x, y]
        }
        // 4. 向いている先が建物 or 空き地の看板 → 物件ステータス
        const propId = map.propertyIdAt(fx, fy)
        if (propId) {
          setOpenProperty(propId)
          return [x, y]
        }
        // 5. 向きが合っていなくても隣の住民・追従キャラとは話せる(取り回し優先)
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
              '--cols': map.cols,
              '--rows': map.rows,
            } as CSSProperties
          }
        >
          {layer.ground.flatMap((row, y) =>
            row.map((tile, x) => (
              <div
                key={`g${x}-${y}`}
                className="tile"
                style={{ ...sheetStyle(layer.sheet, tile), gridColumn: x + 1, gridRow: y + 1 }}
              />
            )),
          )}

          {layer.over.flatMap((row, y) =>
            row.map((cell, x) =>
              cell === null ? null : (
                <div
                  key={`o${x}-${y}`}
                  className="tile obj"
                  style={{
                    ...sheetStyle(layer.sheet, cell.tile),
                    filter: cell.filter,
                    gridColumn: x + 1,
                    gridRow: y + 1,
                  }}
                />
              ),
            ),
          )}

          {/* 建物が落とす影 */}
          {(map.shadows ?? []).map(([x, y]) => (
            <div key={`s${x}-${y}`} className="tile map-shadow" style={{ gridColumn: x + 1, gridRow: y + 1 }} />
          ))}

          {map.signs.map((sign) => (
            <div
              key={sign.id}
              className="tile obj land-sign"
              style={{
                ...sheetStyle(layer.sheet, map.signTile),
                gridColumn: sign.x + 1,
                gridRow: sign.y + 1,
              }}
              aria-label="土地の看板"
            />
          ))}

          {/* 空き物件は「空」の札を出して枠を光らせる。ひと目で案内できる家が分かること
              (docs/SYSTEMS.md「物件の空き状況」) */}
          {vacantSpots.map(({ id, x, y, w, h }) => (
            <div key={`v${id}`} className="building-vacant" style={{ gridColumn: `${x + 1} / span ${w}`, gridRow: `${y + 1} / span ${h}` }}>
              <span className="building-vacant-tag">空</span>
            </div>
          ))}

          {companyAlert && (
            <div
              className="building-alert"
              style={{
                gridColumn: (map.buildings.find((b) => b.id === 'hibari')?.entrance[0] ?? 3) + 1,
                gridRow: (map.buildings.find((b) => b.id === 'hibari')?.entrance[1] ?? 6) - 1,
              }}
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
        {banner && (
          <div className="stage-banner" role="status">
            <div className="stage-banner-band">
              <strong className="stage-banner-title">{banner.text}</strong>
              {banner.sub && <span className="stage-banner-sub">{banner.sub}</span>}
            </div>
          </div>
        )}

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

      </div>

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
