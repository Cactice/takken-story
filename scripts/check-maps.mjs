#!/usr/bin/env node
// マップ定義の自己チェック。node scripts/check-maps.mjs
// Node 24 の型ストリップでそのまま .ts を読む(テストフレームワークは入れない)。
// 行の長さ・凡例に無い文字・入口の位置・道が繋がっているかを機械的に見る。
import assert from 'node:assert/strict';
import { checkMap } from '../src/lib/maps/types.ts';
import { KUROKAI, KUROKAI_SPEC } from '../src/lib/maps/kurokai.ts';

const errors = checkMap(KUROKAI, KUROKAI_SPEC);
assert.deepEqual(errors, [], `黒会市のマップ定義が不正:\n- ${errors.join('\n- ')}`);

// 建物・看板・住民の立ち位置に、開始位置から歩いて行けること(checkMap 内で検証済み)
assert.ok(KUROKAI.buildings.length >= 8, '都会なのに建物が少なすぎる');
assert.equal(KUROKAI.cols, 25);
assert.equal(KUROKAI.rows, 25);

// スカイライン: 超高層と低層が混ざっていること(全部同じ高さだと平べったく見える)
const floors = KUROKAI.buildings.map((b) => b.floors);
assert.ok(Math.max(...floors) >= 10, `一番高いビルが ${Math.max(...floors)}階しかない`);
assert.ok(Math.min(...floors) <= 2, '低層の建物が無い');
// 高いビルほど長い影を落とす
assert.ok(KUROKAI.shadows.length > 40, `影のマスが ${KUROKAI.shadows.length} しかない`);

// 入口タイルは必ずその建物の物件IDを返す(スペースで物件情報を開けること)
for (const b of KUROKAI.buildings) {
  assert.equal(KUROKAI.propertyIdAt(...b.entrance), b.id, `${b.name} の入口が物件に紐づいていない`);
}

console.log(`OK: 黒会市 ${KUROKAI.cols}x${KUROKAI.rows} / 建物 ${KUROKAI.buildings.length}棟 / 看板 ${KUROKAI.signs.length}本`);
