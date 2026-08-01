#!/usr/bin/env node
// 物件案内(世帯単位)の自己チェック。node scripts/check-tour.mjs
// Node 24 の型ストリップでそのまま .ts を読む(テストフレームワークは入れない)。
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import {
  HP_BONUS_ALL_LIKE,
  HP_MAX,
  HP_PENALTY_DISLIKE,
  briefingLines,
  hpDeltaFor,
  householdReaction,
  initTour,
  tourReducer,
} from '../src/lib/tour.ts';

const member = (id, name, liked, disliked) => ({
  id,
  name,
  age: 30,
  demands: `${liked.join('と')}がいい`,
  likedFeatures: liked,
  dislikedFeatures: disliked,
});

const household = (members, budget = 10) => ({
  id: 'hh-test',
  kind: members.length > 1 ? 'couple' : 'single',
  label: 'テスト世帯',
  moveReason: '試験のために越してくる',
  topicId: 'minpo-chintai',
  budget,
  members,
});

/** 特徴: RC造 / 防音 / 駅近 / 築浅、賃料9万円 */
const mansion = {
  id: 'p-test-mansion',
  name: 'テストマンション',
  structure: 'RC造',
  floors: 5,
  ageYears: 3,
  area: 55,
  zoning: '近隣商業地域',
  buildingCoverage: 80,
  floorAreaRatio: 300,
  rent: 9,
  depositMonths: 2,
  keyMoneyMonths: 1,
  features: ['RC造', '防音', '駅近', '築浅'],
  legalNotes: ['管理規約でリフォームに制限あり'],
};

// --- 1. 希望が割れるケース: 片方が気に入り、片方が嫌がる -----------------------
{
  const h = household([
    member('m-otto', '夫', ['駅近'], ['木造']),
    member('m-tsuma', '妻', ['静か'], ['駅近']),
  ]);
  const hr = householdReaction(h, mansion);
  assert.equal(hr.each.length, 2, '反応はメンバー全員分出る');
  assert.equal(hr.each[0].reaction.mood, 'like');
  assert.equal(hr.each[1].reaction.mood, 'dislike');
  assert.equal(hr.mood, 'neutral', '割れたら世帯としては neutral');
  assert.equal(hr.allLike, false);
  assert.equal(hr.dislikes, 1);
  assert.match(hr.line, /折り合い/, '割れたときは折衷の反応が出る');
  assert.equal(hpDeltaFor(hr), -HP_PENALTY_DISLIKE, '嫌がったのは1人ぶんだけ減る');
}

// --- 2. 2人とも嫌がったら2人分減る ------------------------------------------
{
  const h = household([
    member('m-a', 'A', [], ['駅近']),
    member('m-b', 'B', [], ['RC造']),
  ]);
  const hr = householdReaction(h, mansion);
  assert.equal(hr.dislikes, 2);
  assert.equal(hr.mood, 'dislike');
  assert.equal(hpDeltaFor(hr), -HP_PENALTY_DISLIKE * 2);
}

// --- 3. 全員 like なら大きくプラス ------------------------------------------
{
  const h = household([
    member('m-a', 'A', ['防音'], ['木造']),
    member('m-b', 'B', ['駅近'], ['木造']),
  ]);
  const hr = householdReaction(h, mansion);
  assert.equal(hr.allLike, true);
  assert.equal(hpDeltaFor(hr), HP_BONUS_ALL_LIKE * 2, '全員 like は人数分プラス');
}

// --- 4. 予算は世帯合計で判定する --------------------------------------------
{
  const h = household([member('m-a', 'A', ['防音'], [])], 5); // 賃料9万 > 予算5万
  const hr = householdReaction(h, mansion);
  assert.deepEqual(hr.each[0].reaction.misses, ['家賃が高い']);
  assert.equal(hr.mood, 'neutral', 'like 1 / miss 1 で相殺');
}

// --- 5. 面談は世帯名・引越し理由・メンバー全員の要望・予算 ---------------------
{
  const h = household([member('m-a', 'A', ['防音'], []), member('m-b', 'B', ['駅近'], [])]);
  const lines = briefingLines(h);
  assert.equal(lines.length, 2 + h.members.length + 1);
  assert.match(lines[0], /テスト世帯/);
  assert.match(lines[1], /越してくる/);
  assert.ok(h.members.every((m) => lines.some((l) => l.includes(m.demands))), '全員の要望が出る');
  assert.match(lines.at(-1), /世帯で月10万円/);
}

// --- 6. 状態機械: 面談 → メモ獲得 → 内見でHPが動く --------------------------
{
  const h = household([
    member('m-a', 'A', ['駅近'], []),
    member('m-b', 'B', [], ['駅近']),
  ]);
  let s = initTour(h, [mansion]);
  assert.equal(s.hp, HP_MAX);
  for (let i = 0; i < briefingLines(h).length; i++) s = tourReducer(s, { type: 'advance' });
  assert.deepEqual(s.memos, [{ topicId: h.topicId, title: `${h.label}の引越し理由` }]);
  assert.equal(s.phase.kind, 'visit');
  s = tourReducer(s, { type: 'advance' }); // spec → reaction
  s = tourReducer(s, { type: 'advance' }); // reaction の加減点
  assert.equal(s.hp, HP_MAX - HP_PENALTY_DISLIKE, '嫌がった1人分だけ減る');
  assert.deepEqual(s.scored, [mansion.id]);
}

// --- 7. コンテンツ: 世帯の memberIds が実在の人物を指しているか ---------------
{
  const errors = [];
  for (const gen of [1, 2, 3, 4, 5]) {
    const hhDir = `content/gen${gen}/households`;
    const chDir = `content/gen${gen}/characters`;
    if (!existsSync(hhDir)) continue;
    const read = (dir) =>
      existsSync(dir)
        ? readdirSync(dir)
            .filter((f) => f.endsWith('.json'))
            .map((f) => ({ path: join(dir, f), data: JSON.parse(readFileSync(join(dir, f), 'utf8')) }))
        : [];
    const chars = new Map(read(chDir).map((c) => [c.data.id, c.data]));
    for (const { path, data } of read(hhDir)) {
      if (data.id !== basename(path, '.json')) errors.push(`${path}: id がファイル名と不一致`);
      if (!Array.isArray(data.memberIds) || data.memberIds.length === 0)
        errors.push(`${path}: memberIds がない`);
      for (const id of data.memberIds ?? []) {
        if (!chars.has(id)) errors.push(`${path}: メンバー "${id}" が gen${gen}/characters にいない`);
        else if (!chars.get(id).moveIn) errors.push(`${path}: メンバー "${id}" に moveIn がない`);
      }
    }
  }
  for (const e of errors) console.error('ERROR ' + e);
  if (errors.length) process.exit(1);
}

console.log('check-tour: OK');
