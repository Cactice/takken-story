#!/usr/bin/env node
// content/gen<N>/places/*.json の自己チェック。node scripts/check-places.mjs
// Node 24 の型ストリップでそのまま .ts を読む(テストフレームワークは入れない)。
//
// 見るもの:
//   1. id とファイル名の一致 / マップ上の建物・看板IDと一致しているか / 階数がマップと同じか
//   2. 開始時の空きが3件前後あるか
//   3. **世帯 × 物件**: どの世帯にも要望に合う物件が必ずあり、歩いて回っても機嫌が保つか
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { KUROKAI } from '../src/lib/maps/kurokai.ts';
import { toPropertySpec } from '../src/lib/places.ts';
import {
  HP_DRAIN_PER_TICK,
  HP_MAX,
  HP_TICK_MS,
  TILES_PER_SEC,
  hpDeltaFor,
  householdReaction,
  toTourMember,
  toTourProperty,
} from '../src/lib/tour.ts';

/** 世代 → マップ。物件IDはマップ側の建物ID・看板IDと一致していること */
const MAPS = { 2: KUROKAI };

const readAll = (dir) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith('.json'))
        .sort()
        .map((f) => ({ file: join(dir, f), data: JSON.parse(readFileSync(join(dir, f), 'utf8')) }))
    : [];

/** 1タイル歩くのに減る機嫌 */
const DRAIN_PER_TILE = ((HP_DRAIN_PER_TICK / HP_TICK_MS) * 1000) / TILES_PER_SEC;

/** 開始位置からの歩行距離(タイル)を測る */
function distances(map) {
  const key = (x, y) => `${x},${y}`;
  const dist = new Map([[key(...map.start), 0]]);
  const queue = [[...map.start]];
  while (queue.length > 0) {
    const [x, y] = queue.shift();
    const d = dist.get(key(x, y));
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!map.inBounds(nx, ny) || map.isSolid(nx, ny) || dist.has(key(nx, ny))) continue;
      dist.set(key(nx, ny), d + 1);
      queue.push([nx, ny]);
    }
  }
  const walkTo = (x, y) =>
    Math.min(
      ...[[0, -1], [0, 1], [-1, 0], [1, 0]].map(([dx, dy]) => dist.get(key(x + dx, y + dy)) ?? Infinity),
    );
  return new Map([
    ...map.buildings.map((b) => [b.id, walkTo(...b.entrance)]),
    ...map.signs.map((s) => [s.id, walkTo(s.x, s.y)]),
  ]);
}

let checked = 0;
for (const gen of [1, 2, 3, 4, 5]) {
  const places = readAll(`content/gen${gen}/places`);
  if (places.length === 0) continue;
  checked++;
  const map = MAPS[gen];
  assert.ok(map, `gen${gen} の物件があるのにマップが登録されていない(MAPS に足すこと)`);
  const tilesTo = distances(map);

  // --- 1. 物件データそのもの ------------------------------------------------
  const seen = new Set();
  for (const { file, data } of places) {
    assert.equal(data.id, basename(file, '.json'), `${file}: id がファイル名と不一致`);
    assert.ok(!seen.has(data.id), `${file}: id が重複している`);
    seen.add(data.id);
    assert.equal(data.generation, gen, `${file}: generation がフォルダと不一致`);
    assert.ok(tilesTo.has(data.id), `${file}: マップ上に建物・看板 "${data.id}" が無い`);
    assert.ok(Number.isFinite(tilesTo.get(data.id)), `${file}: その物件まで歩いて行けない`);
    const building = map.buildings.find((b) => b.id === data.id);
    if (building)
      assert.equal(
        data.spec.floors,
        building.floors,
        `${file}: 階数がマップ(${building.floors}階)と食い違う`,
      );
    assert.ok(data.spec.features.length > 0, `${file}: features がない`);
    assert.ok(data.spec.legalNotes.length > 0, `${file}: legalNotes がない`);
    assert.ok(
      data.spec.rent != null || data.spec.price != null,
      `${file}: 賃料も価格も無い`,
    );
  }
  // マップの建物に物件データがあるか(駅など、案内に関係しないものは除く)
  for (const b of map.buildings) {
    if (b.id.endsWith('-station')) continue;
    assert.ok(seen.has(b.id), `content/gen${gen}/places に "${b.id}"(${b.name})が無い`);
  }

  // --- 2. 開始時の空き ------------------------------------------------------
  const forRent = places.filter((p) => p.data.forRent !== false);
  const vacant = forRent.filter((p) => (p.data.vacantUnitsAtStart ?? 0) > 0);
  assert.ok(
    vacant.length >= 2 && vacant.length <= 4,
    `gen${gen}: 開始時の空きが ${vacant.length} 件(3件前後に保つこと)`,
  );

  // --- 3. 世帯 × 物件 -------------------------------------------------------
  const chars = new Map(readAll(`content/gen${gen}/characters`).map(({ data }) => [data.id, data]));
  const props = forRent.map(({ data }) => toTourProperty(toPropertySpec(data)));
  const vacantProps = vacant.map(({ data }) => toTourProperty(toPropertySpec(data)));

  for (const { file, data } of readAll(`content/gen${gen}/households`)) {
    const members = data.memberIds.map((id) => chars.get(id)).filter(Boolean).map(toTourMember);
    assert.equal(members.length, data.memberIds.length, `${file}: 実在しないメンバーがいる`);
    const h = { ...data, members };

    const candidates = props.filter((p) => householdReaction(h, p).candidate);
    assert.ok(candidates.length > 0, `${h.label}: 気に入る物件が1件も無い(契約不可能)`);

    // 開始時の空きだけでも1件は気に入ること(案内が詰まない)
    assert.ok(
      vacantProps.some((p) => householdReaction(h, p).candidate),
      `${h.label}: 開始時の空き物件に気に入るものが1件も無い(案内が詰む)`,
    );

    // 近い順に総当たりする「ふつうのプレイ」でも、契約前に機嫌が尽きないこと
    const byDistance = [...props].sort(
      (a, b) => (tilesTo.get(a.id) ?? 1e9) - (tilesTo.get(b.id) ?? 1e9),
    );
    let hp = HP_MAX;
    let at = 0;
    let visits = 0;
    for (const p of byDistance) {
      hp -= Math.abs((tilesTo.get(p.id) ?? 0) - at) * DRAIN_PER_TILE;
      at = tilesTo.get(p.id) ?? 0;
      const hr = householdReaction(h, p);
      hp += hpDeltaFor(hr);
      visits++;
      if (hr.candidate) break;
    }
    assert.ok(
      hp > 0,
      `${h.label}: 近い順に${visits}件見て回ると契約前に機嫌が尽きる(残り ${Math.round(hp)})`,
    );
    console.log(
      `gen${gen} ${h.label}(予算${h.budget}万): 候補 ${candidates.map((p) => p.name).join(' / ')}`,
    );
  }
  console.log(`gen${gen}: 物件 ${places.length}件 / 開始時の空き ${vacant.map((p) => p.data.name).join(' / ')}`);
}

console.log(`check-places: OK(${checked}世代)`);
