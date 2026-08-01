#!/usr/bin/env node
// 追従(ついてくる)システムの自己チェック。node scripts/check-follower.mjs
import assert from 'node:assert/strict';
import {
  advanceTrail,
  followerPositions,
  scatterPositions,
  trailLength,
} from '../src/lib/follower.ts';

const eq = (a, b, msg) => assert.deepEqual([...a], [...b], msg);

// --- 1. 足跡は先頭が現在地。歩くたびに1歩ずつずれる ---------------------------
{
  let trail = [[3, 13]];
  const len = trailLength(2); // 後続2体
  trail = advanceTrail(trail, [3, 12], len);
  eq(trail[0], [3, 12], '先頭は主人公の現在地');
  eq(followerPositions(trail, 2)[0], [3, 13], '1体目は1歩前にいた場所');
  eq(followerPositions(trail, 2)[1], [3, 13], '足跡が足りないうちは最後尾に重なる');

  trail = advanceTrail(trail, [3, 11], len);
  const spots = followerPositions(trail, 2);
  eq(spots[0], [3, 12]);
  eq(spots[1], [3, 13], '2体目は2歩前にいた場所');
}

// --- 2. 同じタイルに留まったら隊列は動かない(壁・向き変えだけ) ---------------
{
  const trail = [[5, 5], [5, 6], [5, 7]];
  const same = advanceTrail(trail, [5, 5], 3);
  assert.deepEqual(same, trail, '同じ位置なら足跡は伸びない');
}

// --- 3. 足跡は必要な長さで打ち切られる(無限に伸びない) -----------------------
{
  let trail = [[0, 0]];
  for (let i = 1; i <= 20; i++) trail = advanceTrail(trail, [i, 0], trailLength(3));
  assert.equal(trail.length, 4, '主人公 + 後続3体ぶんだけ持つ');
  eq(trail[0], [20, 0]);
  eq(trail[3], [17, 0]);
}

// --- 4. 曲がっても同じ道をたどる(FF方式) -----------------------------------
{
  const path = [[1, 1], [2, 1], [3, 1], [3, 2], [3, 3]];
  let trail = [path[0]];
  const seen = [];
  for (const pos of path.slice(1)) {
    trail = advanceTrail(trail, pos, trailLength(1));
    seen.push(followerPositions(trail, 1)[0]);
  }
  // 後続は主人公が1歩前にいた場所を順になぞる
  assert.deepEqual(seen.map((p) => [...p]), path.slice(0, -1).map((p) => [...p]));
}

// --- 5. 追従が0体でも壊れない -------------------------------------------------
{
  const trail = advanceTrail([[2, 2]], [2, 3], trailLength(0));
  assert.equal(trail.length, 1);
  assert.deepEqual(followerPositions(trail, 0), []);
}

// --- 6. 立ち止まると主人公の周りに散らばる(全員に話しかけられる) -------------
{
  const open = () => true;
  const spots = scatterPositions([5, 5], 3, open);
  const orth = [[5, 4], [5, 6], [4, 5], [6, 5]].map((p) => p.join(','));
  assert.ok(
    spots.slice(0, 3).every((p) => orth.includes(p.join(','))),
    '先頭3体は上下左右(= 向いて話しかけられる位置)に立つ',
  );
  assert.equal(new Set(spots.map((p) => p.join(','))).size, 3, '重ならない');

  // 壁で埋まっていたら空いているところだけ使う
  const wall = (x, y) => y !== 4 && x !== 4; // 上と左は壁
  const tight = scatterPositions([5, 5], 4, wall);
  assert.ok(tight.every(([x, y]) => wall(x, y) || (x === 5 && y === 5)), '壁の中には立たない');
  assert.equal(tight.length, 4);

  // 全部壁なら主人公の足元に重なる(落ちない)
  assert.deepEqual(scatterPositions([1, 1], 2, () => false), [[1, 1], [1, 1]]);
}

console.log('check-follower: OK');
