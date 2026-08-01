#!/usr/bin/env node
// 演出イベント(カットシーン)の自己チェック。node scripts/check-staging.mjs
import assert from 'node:assert/strict';
import { PLAYER_HOME, isSolid, inBounds } from '../src/lib/map.ts';

const canStand = (x, y) => inBounds(x, y) && !isSolid(x, y);
import {
  LEAD_GAP,
  OPENING,
  arrivalStaging,
  distance,
  findPath,
  playerCanMove,
  stepToward,
  wanderStep,
  WANDER_RADIUS,
} from '../src/lib/staging.ts';

// --- 1. 経路探索は壁を通らず、隣り合ったタイルだけを繋ぐ ---------------------
{
  const from = [3, 13];
  const to = [PLAYER_HOME.entrance[0], PLAYER_HOME.entrance[1] + 1];
  const path = findPath(from, to, canStand);
  assert.ok(path.length > 0, '自宅の前まで道がある');
  assert.deepEqual([...path.at(-1)], to, '最後は目的地');
  let prev = from;
  for (const step of path) {
    assert.equal(distance(prev, step), 1, '1歩ずつ隣のタイルへ進む');
    assert.ok(inBounds(...step) && !isSolid(...step), '壁の中は通らない');
    prev = step;
  }
}

// --- 2. 目的地が建物の中なら、行けるところまでで止まる(無限ループしない) ----
{
  const inside = PLAYER_HOME.entrance; // 建物タイル
  const path = findPath([3, 13], inside, canStand);
  assert.ok(path.length > 0);
  assert.ok(path.every((p) => !isSolid(...p)), '建物の中には入らない');
}

// --- 3. 同じ場所なら歩かない -------------------------------------------------
assert.deepEqual(findPath([5, 8], [5, 8], canStand), []);

// --- 4. 画面外からの1歩(スポーンはマップ外でもよい) ------------------------
{
  assert.deepEqual(stepToward([12, -3], [12, 7]), [12, -2]);
  assert.deepEqual(stepToward([30, 5], [12, 5]), [29, 5]);
  assert.deepEqual(stepToward([12, 7], [12, 7]), [12, 7]);
}

// --- 5. 操作制限: lead 中だけ主人公が動ける ---------------------------------
{
  assert.equal(playerCanMove({ cmd: 'lead', actor: 'a', to: [1, 1] }), true);
  assert.equal(playerCanMove({ cmd: 'walkTo', actor: 'a', to: [1, 1] }), false);
  assert.equal(playerCanMove({ cmd: 'say', actor: 'a', text: 'x' }), false);
  assert.equal(playerCanMove(undefined), true, '演出が終われば自由行動');
  assert.ok(LEAD_GAP > 0);
}

// --- 6. オープニング: spawn → say → lead(自宅の前)→ say ------------------
{
  const kinds = OPENING.script.map((c) => c.cmd);
  assert.equal(kinds[0], 'spawn');
  assert.ok(kinds.includes('lead'), 'ハゲ田が先導する');
  const lead = OPENING.script.find((c) => c.cmd === 'lead');
  assert.deepEqual(
    [...lead.to],
    [PLAYER_HOME.entrance[0], PLAYER_HOME.entrance[1] + 1],
    'OPENING の行き先が自宅の入口前からずれている',
  );
  assert.ok(!isSolid(...lead.to), '先導先は歩けるタイル');
  assert.ok(findPath([3, 13], lead.to, canStand).length > 0);
  assert.ok(
    OPENING.script.some((c) => c.cmd === 'say' && c.text.includes('5万円')),
    '家賃を説明する',
  );
  for (const c of OPENING.script) {
    assert.ok(OPENING.actors.some((a) => a.id === c.actor), `登場人物にいない: ${c.actor}`);
  }
}

// --- 7. 転入者は画面外から歩いてきて、最後に追従列へ加わる -------------------
{
  const members = [
    { id: 'nc-a', name: 'A' },
    { id: 'nc-b', name: 'B' },
  ];
  const st = arrivalStaging(members, [12, 7]);
  assert.equal(st.script.filter((c) => c.cmd === 'spawn').length, 2, '全員が登場する');
  assert.ok(st.script.filter((c) => c.cmd === 'spawn').every((c) => c.alert), '頭上に「!」');
  assert.equal(st.script.filter((c) => c.cmd === 'follow').length, 2, '全員が追従列に加わる');
  assert.equal(st.script.at(-1).cmd, 'follow', '最後は追従で終わる');
}

// --- 8. 住民のうろつきは持ち場の周りだけ、壁には入らない -----------------------
{
  const base = [9, 16];
  let cur = base;
  for (let i = 0; i < 200; i++) {
    const next = wanderStep(base, cur, i * 7, canStand);
    assert.ok(canStand(...next), '壁の中には入らない');
    assert.ok(distance(base, next) <= WANDER_RADIUS, '持ち場から離れすぎない');
    assert.ok(distance(cur, next) <= 1, '1歩ずつしか動かない');
    cur = next;
  }
  // 全方向が塞がっていればその場に留まる
  assert.deepEqual([...wanderStep(base, base, 0, () => false)], base);
}

console.log('check-staging: OK');
