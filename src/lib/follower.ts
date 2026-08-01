/**
 * 追従(ついてくる)システム。FF方式のパンくず追従。
 * 主人公が通ったタイルの履歴を保持し、後続は1歩ずれで同じ道をたどる。
 * 純粋関数だけ。描画も当たり判定も持たない(追従キャラは移動の障害にならない)。
 */

export type Pos = readonly [number, number]

/** 追従するもの。世帯のメンバーもハゲ田のメモ(本)も同じ仕組みで並ぶ */
export interface Follower {
  id: string
  kind: 'member' | 'book'
  /** 話しかけたときの表示名(本は無し) */
  name?: string
}

/** 足跡の必要な長さ(先頭 = 主人公の現在地 + 後続の人数) */
export function trailLength(followerCount: number): number {
  return followerCount + 1
}

/**
 * 足跡を1歩進める。trail[0] が主人公の現在地、trail[i] が i 番目の後続の位置。
 * 同じタイルに留まった(壁にぶつかった・向きを変えただけ)ときは何も動かさない。
 */
export function advanceTrail(trail: readonly Pos[], pos: Pos, length: number): Pos[] {
  const head = trail[0]
  if (head && head[0] === pos[0] && head[1] === pos[1]) return [...trail].slice(0, Math.max(1, length))
  return [pos, ...trail].slice(0, Math.max(1, length))
}

/**
 * 後続 count 体の立ち位置。歩き始めで足跡が足りないうちは最後尾に重なる
 * (FFでも隊列は歩き出すまで団子になる)。
 */
export function followerPositions(trail: readonly Pos[], count: number): Pos[] {
  const last = trail[trail.length - 1] ?? ([0, 0] as Pos)
  return Array.from({ length: count }, (_, i) => trail[i + 1] ?? last)
}

/** これだけ立ち止まると、一列だった追従キャラが主人公の周りに散らばる */
export const SCATTER_IDLE_MS = 3000

/** 上下左右を先に埋めてから斜め。話しかけられるのは上下左右なので先頭ほど話しやすい */
const AROUND: readonly Pos[] = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
]

/**
 * 立ち止まったときの立ち位置。一列のままだと2人目以降が主人公から2マス以上離れて
 * 話しかけられないので、周囲の空きタイルに散らばらせる(先頭 = 世帯のメンバーが
 * 上下左右を取り、本は斜めに回る)。
 */
export function scatterPositions(
  player: Pos,
  count: number,
  canStand: (x: number, y: number) => boolean,
): Pos[] {
  const spots: Pos[] = []
  for (const [dx, dy] of AROUND) {
    if (spots.length >= count) break
    const x = player[0] + dx
    const y = player[1] + dy
    if (canStand(x, y)) spots.push([x, y])
  }
  // 壁ぎわで空きが足りないときは最後尾に重ねる(主人公の足元まで戻る)
  while (spots.length < count) spots.push(spots[spots.length - 1] ?? player)
  return spots
}
