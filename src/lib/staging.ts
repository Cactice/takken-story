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
 * 第1世代のオープニング(ハゲ田が自宅まで案内する)
 * ------------------------------------------------------------------ */
// 自宅(ボロ屋)の入口の真下。map.ts の PLAYER_HOME と一致していることは check-staging.mjs で検算する
const HOME_FRONT: Pos = [2, 17]

export const OPENING: Staging = {
  id: 'opening-gen1',
  actors: [{ id: 'tencho-gozo', name: 'ハゲタ' }],
  script: [
    { cmd: 'spawn', actor: 'tencho-gozo', at: [3, 12] },
    { cmd: 'say', actor: 'tencho-gozo', text: '新人! お前が今日から入るやつだな。ついて来い!' },
    { cmd: 'lead', actor: 'tencho-gozo', to: HOME_FRONT },
    {
      cmd: 'say',
      actor: 'tencho-gozo',
      text: 'ここがお前の家だ。ボロだが雨は…まあ、たまに漏る。家賃は月5万円、毎月きっちり引かれるからな。',
    },
    {
      cmd: 'say',
      actor: 'tencho-gozo',
      text: 'ここを拠点に、村の連中の困りごとを片付けろ。宅建の勉強はそれが一番早い。行け!',
    },
  ],
}

/** 転入者が画面外から歩いてきて、そのまま主人公についてくる */
export function arrivalStaging(members: StageActor[], near: Pos): Staging {
  // 村の入口(北の道)から歩いてくる
  const gate: Pos = [12, 0]
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
      // ponytail: 歩いてくるのは先頭の1人だけ。残りは同じ場所に湧いて、追従列で後ろに並ぶ。
      // 全員ぶん歩かせると待ち時間が人数分になるだけで、見た目はほとんど変わらない
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
