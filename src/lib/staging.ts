/**
 * 演出イベント(カットシーン)。
 * NPCがマップ上を自動で歩く演出を、コードではなくデータで書けるようにする。
 * ここは純粋関数だけ(経路探索と1ステップ進行)。タイマーと描画は TownView が持つ。
 *
 * ponytail: いまは staging データを src 内(下の OPENING など)に置いている。
 * content/ 側に `staging` を持つイベントが入ったら、JSON をそのまま Staging 型に
 * 流し込むだけでよい(命令名は docs/SYSTEMS.md の表と同じ)。
 */

import type { Pos } from './follower'

/** そのタイルに立てるか。マップの都合(map.ts)は呼び出し側から渡す */
export type CanStand = (x: number, y: number) => boolean

export type StageCommand =
  /** キャラを指定位置(画面外可)に出す。alert で頭上に「!」 */
  | { cmd: 'spawn'; actor: string; at: Pos; alert?: boolean }
  /** 指定タイルまで自動で歩かせる(経路探索) */
  | { cmd: 'walkTo'; actor: string; to: Pos }
  /** 先導する。主人公が離れすぎたら立ち止まって待つ */
  | { cmd: 'lead'; actor: string; to: Pos }
  /** 主人公の追従列に加わる */
  | { cmd: 'follow'; actor: string }
  /** セリフ(スペースで送る) */
  | { cmd: 'say'; actor: string; text: string }
  /** 一定時間待つ */
  | { cmd: 'wait'; ms: number }
  /** カメラを一時的に指定キャラへ寄せる(actor 省略で主人公に戻す) */
  | { cmd: 'camera'; actor?: string }

export interface StageActor {
  id: string
  name: string
  /** characterSpriteStyle に渡すID(省略時は id) */
  spriteId?: string
}

export interface Staging {
  id: string
  actors: StageActor[]
  script: StageCommand[]
}

/** その命令の間、主人公を動かしてよいか(lead はついていく必要があるので動かせる) */
export function playerCanMove(cmd: StageCommand | undefined): boolean {
  return cmd === undefined || cmd.cmd === 'lead'
}

/** 先導役がこれ以上離れたら立ち止まって待つ(タイル) */
export const LEAD_GAP = 3

export function distance(a: Pos, b: Pos): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])
}

/**
 * BFSの最短経路(from は含まない)。マップが小さいので素直に全探索でよい。
 * 目的地が塞がっていたら、その隣で一番近いところまで歩く。
 */
export function findPath(from: Pos, to: Pos, canStand: CanStand): Pos[] {
  const key = (x: number, y: number) => `${x},${y}`
  const prev = new Map<string, Pos>()
  const seen = new Set<string>([key(...from)])
  const queue: Pos[] = [from]
  let best: Pos = from
  let bestDist = distance(from, to)

  while (queue.length > 0) {
    const cur = queue.shift()!
    const d = distance(cur, to)
    if (d < bestDist) {
      bestDist = d
      best = cur
    }
    if (d === 0) break
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
      const nx = cur[0] + dx
      const ny = cur[1] + dy
      const k = key(nx, ny)
      if (!canStand(nx, ny) || seen.has(k)) continue
      seen.add(k)
      prev.set(k, cur)
      queue.push([nx, ny])
    }
  }

  const path: Pos[] = []
  let cur: Pos | undefined = bestDist === 0 ? to : best
  while (cur && key(...cur) !== key(...from)) {
    path.unshift(cur)
    cur = prev.get(key(...cur))
  }
  return path
}

/** 画面外からマップ内へ入ってくるときの最初の1歩(スポーン地点はマップ外でもよい) */
export function stepToward(from: Pos, to: Pos): Pos {
  if (from[0] !== to[0]) return [from[0] + Math.sign(to[0] - from[0]), from[1]]
  if (from[1] !== to[1]) return [from[0], from[1] + Math.sign(to[1] - from[1])]
  return from
}

/* ------------------------------------------------------------------ *
 * オープニング(自宅 → 職場 → 最初の客)
 * 家を教わる → 職場を教わる → 初めての客を案内する、を一続きで体験させる。
 * 座標は map.ts 側から渡す(このモジュールはマップに依存しない)。
 * ------------------------------------------------------------------ */
export interface OpeningPlaces {
  /** 自宅(ボロ屋)の前 */
  homeFront: Pos
  /** ひばり不動産の前 */
  officeFront: Pos
  /** 転入者が歩いて入ってくる村の入口(マップ外でもよい) */
  gate: Pos
}

/**
 * @param members 最初の転入世帯。世帯IDは決め打ちしない(コンテンツが差し替わっても壊れない)
 */
export function openingStaging(places: OpeningPlaces, members: StageActor[]): Staging {
  const boss = 'tencho-gozo'
  const newcomers = members.length > 0
  return {
    id: 'opening-gen1',
    actors: [{ id: boss, name: 'ハゲタ' }, ...members],
    script: [
      { cmd: 'spawn', actor: boss, at: [places.homeFront[0] + 1, places.homeFront[1] - 4] },
      { cmd: 'say', actor: boss, text: '新人! お前が今日から入るやつだな。ついて来い!' },
      { cmd: 'lead', actor: boss, to: places.homeFront },
      {
        cmd: 'say',
        actor: boss,
        text: 'ここがお前の家だ。ボロだが雨は…まあ、たまに漏る。家賃は月5万円、毎月きっちり引かれるからな。',
      },
      { cmd: 'say', actor: boss, text: '荷物は置いたな? 次は職場だ。ついて来い!' },
      { cmd: 'lead', actor: boss, to: places.officeFront },
      {
        cmd: 'say',
        actor: boss,
        text: 'ここが職場、ひばり不動産だ。村で唯一の不動産屋…つまり、逃げ場はない。',
      },
      ...(newcomers
        ? [
            ...members.map((m, i): StageCommand => ({
              cmd: 'spawn',
              actor: m.id,
              at: [places.gate[0] + i, places.gate[1]],
              alert: true,
            })),
            { cmd: 'say', actor: boss, text: 'おい、噂をすれば…あれを見ろ。村に越してきたいって連中だ。' } as StageCommand,
            { cmd: 'walkTo', actor: members[0].id, to: places.officeFront } as StageCommand,
            ...members.map((m): StageCommand => ({ cmd: 'follow', actor: m.id })),
            {
              cmd: 'say',
              actor: boss,
              text: 'さっそく客だ。話を聞いて、物件を案内してこい。…それが一番の勉強になる。',
            } as StageCommand,
          ]
        : []),
    ],
  }
}

/** 転入者が画面外から歩いてきて、そのまま主人公についてくる(2組目以降の転入) */
export function arrivalStaging(members: StageActor[], near: Pos, gate: Pos = [12, 0]): Staging {
  return {
    id: `arrival/${members.map((m) => m.id).join('+')}`,
    actors: members,
    script: [
      ...members.map((m, i): StageCommand => ({
        cmd: 'spawn',
        actor: m.id,
        at: [gate[0] + i, gate[1]],
        alert: true,
      })),
      // ponytail: 歩いてくるのは先頭の1人だけ。残りは追従列で後ろに並ぶので、
      // 全員ぶん歩かせても待ち時間が人数分になるだけ
      { cmd: 'walkTo', actor: members[0].id, to: near },
      ...members.map((m): StageCommand => ({ cmd: 'follow', actor: m.id })),
    ],
  }
}

/* ------------------------------------------------------------------ *
 * 住民のうろつき(ポケモンのNPCと同じ、持ち場の周りを1歩ずつ)
 * ------------------------------------------------------------------ */

/** 持ち場からこれ以上離れない(探しに行けなくなるので遠出させない) */
export const WANDER_RADIUS = 2

/**
 * うろつきの1歩。行けなければその場に留まる(たまに立ち止まって見える)。
 * dir は 0〜3(上下左右)。乱数は呼び出し側が持つ = ここは純粋関数。
 */
export function wanderStep(base: Pos, cur: Pos, dir: number, canStand: CanStand): Pos {
  const [dx, dy] = ([[0, -1], [0, 1], [-1, 0], [1, 0]] as const)[((dir % 4) + 4) % 4]
  const next: Pos = [cur[0] + dx, cur[1] + dy]
  if (!canStand(next[0], next[1])) return cur
  if (distance(base, next) > WANDER_RADIUS) return cur
  return next
}
