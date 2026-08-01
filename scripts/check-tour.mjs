#!/usr/bin/env node
// 物件案内(世帯単位)の自己チェック。node scripts/check-tour.mjs
// Node 24 の型ストリップでそのまま .ts を読む(テストフレームワークは入れない)。
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { PROPERTIES } from '../src/lib/properties.ts';
import {
  HP_BONUS_ALL_LIKE,
  HP_MAX,
  HP_PENALTY_DISLIKE,
  HP_PENALTY_MEH,
  toTourMember,
  briefingLines,
  followerLine,
  hpDeltaFor,
  householdReaction,
  initTour,
  isInspected,
  toTourProperty,
  tourReducer,
} from '../src/lib/tour.ts';

const member = (id, name, liked, disliked, style = 'polite') => ({
  id,
  name,
  age: 30,
  demands: `${liked.join('と')}がいい`,
  likedFeatures: liked,
  dislikedFeatures: disliked,
  voice: { style, focus: liked[0] ?? '日当たり' },
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
  assert.equal(hr.mood, 'dislike', '嫌がる人がいたら契約候補にならない');
  assert.equal(hr.candidate, false);
  assert.equal(hr.dislikes, 1);
  assert.match(hr.line, /折り合/, '割れたときは折衷の反応が出る');
  assert.equal(hpDeltaFor(hr), -HP_PENALTY_DISLIKE, '嫌がったのは1人ぶんだけ減る');
  assert.ok(hpDeltaFor(hr) !== 0, '内見の結果が「何も起きない」にはならない');
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
  assert.equal(hr.candidate, true, '嫌がる人がいなければ契約候補');
  assert.equal(hpDeltaFor(hr), HP_BONUS_ALL_LIKE * 2, '気に入った人数分プラス');
}

// --- 4. 予算は世帯合計で判定する --------------------------------------------
{
  const h = household([member('m-a', 'A', ['防音'], [])], 5); // 賃料9万 > 予算5万
  const hr = householdReaction(h, mansion);
  assert.deepEqual(hr.each[0].reaction.misses, ['家賃が高い']);
  assert.equal(hr.mood, 'meh', 'like 1 / miss 1 で相殺 → ピンと来ない');
  assert.equal(hpDeltaFor(hr), -HP_PENALTY_MEH, 'ピンと来ないでも必ず機嫌は下がる');
}

// --- 5. 面談は世帯名・引越し理由・メンバー全員の要望・予算 ---------------------
{
  const h = household([member('m-a', 'A', ['防音'], []), member('m-b', 'B', ['駅近'], [])]);
  const lines = briefingLines(h);
  assert.ok(lines.some((l) => l.includes('テスト世帯')));
  assert.ok(lines.some((l) => l.includes('越してくる')), '引越し理由を話す');
  assert.ok(h.members.every((m) => lines.some((l) => l.includes(m.demands))), '全員の要望が出る');
  assert.ok(lines.some((l) => l.includes('世帯で月10万円')), '予算を伝える');
}

// --- 6. 状態機械: 面談 → マップへ → 内見でHPが動く / 2回目は動かない -----------
{
  const h = household([
    member('m-a', 'A', ['駅近'], []),
    member('m-b', 'B', [], ['駅近']),
  ]);
  let s = initTour(h);
  assert.equal(s.hp, HP_MAX);
  assert.equal(s.phase.kind, 'arriving', '最初は画面外から来て、ついてくるだけ');
  assert.equal(tourReducer(s, { type: 'tick' }).hp, HP_MAX, '面談前は機嫌が減らない');
  s = tourReducer(s, { type: 'meet' });
  assert.equal(s.phase.kind, 'briefing', '話しかけると面談が始まる');
  for (let i = 0; i < briefingLines(h).length; i++) s = tourReducer(s, { type: 'advance' });
  assert.deepEqual(s.memos, [{ topicId: h.topicId, title: `${h.label}の引越し理由` }]);
  assert.equal(s.phase.kind, 'map', '面談が終わるとマップに出る');

  s = tourReducer(s, { type: 'inspect', property: mansion });
  assert.equal(s.hp, HP_MAX - HP_PENALTY_DISLIKE, '嫌がった1人分だけ減る');
  assert.ok(isInspected(s, mansion.id));
  assert.equal(s.lastVisited.id, mansion.id, '直前に見た物件を覚えている');

  const again = tourReducer(s, { type: 'inspect', property: mansion });
  assert.equal(again.hp, s.hp, '一度内見した物件は再度見てもHPが動かない');

  // 気に入っていない物件では契約に進めない
  assert.equal(
    tourReducer(again, { type: 'contract', property: mansion }).phase.kind,
    'map',
    '契約候補でない物件では35条に進めない',
  );

  // 全員が気に入る世帯なら契約候補になり、契約(35条の読み上げ)に進める
  let ok = tourReducer(initTour(household([member('m-c', 'C', ['防音'], [])])), { type: 'meet' });
  for (let i = 0; i < briefingLines(ok.household).length; i++)
    ok = tourReducer(ok, { type: 'advance' });
  ok = tourReducer(ok, { type: 'inspect', property: mansion });
  assert.deepEqual(ok.candidates, [mansion.id], '気に入った物件が契約候補になる');
  const c = tourReducer(ok, { type: 'contract', property: mansion });
  assert.equal(c.phase.kind, 'disclosure');
  assert.equal(c.contracted.id, mansion.id);

  // 時間経過ではHPが減り続ける
  assert.equal(tourReducer(c, { type: 'tick' }).hp, c.hp - 1);
}

// --- 6b. 追従キャラのセリフは人によって違い、状況で出し分ける -------------------
{
  const h = household([
    member('m-a', 'あかり', ['駅近'], []),
    member('m-b', 'ぼたん', [], ['駅近']),
  ]);
  let s = tourReducer(initTour(h), { type: 'meet' });
  for (let i = 0; i < briefingLines(h).length; i++) s = tourReducer(s, { type: 'advance' });

  h.members[0].voice = { style: 'polite', focus: '日当たり' };
  h.members[1].voice = { style: 'gruff', focus: '通勤のしやすさ' };
  const before = h.members.map((m) => followerLine(s, m));
  assert.notEqual(before[0], before[1], 'メンバーごとに違うことを言う');
  assert.ok(before.every((l) => l.length > 0), '全員が何か言う');

  s = tourReducer(s, { type: 'inspect', property: mansion });
  const after = h.members.map((m) => followerLine(s, m));
  assert.ok(after.every((l) => l.includes(mansion.name)), '直前に見た物件の感想を言う');

  const tired = followerLine({ ...s, hp: 10 }, h.members[0]);
  assert.match(tired, /疲れ/, '機嫌が悪いと疲れたと言う');
}

// --- 6c. マップの物件(PropertySpec)を案内ゲーム用に変換できる -----------------
{
  const spec = {
    id: 'apart-wood',
    name: 'ガストン荘',
    kind: 'building',
    category: '木造アパート(賃貸)',
    structure: '木造',
    floors: '2階建て(全8戸)',
    age: '築26年',
    area: '専有 24㎡(1K・102号室)',
    zoning: '第一種住居地域',
    coverage: '建蔽率 60%',
    floorAreaRatio: '容積率 200%',
    price: '賃料 4.2万円/月(共益費 0.3万円)',
    deposit: '敷金1ヶ月 / 礼金1ヶ月',
    road: '幅員4mの村道に6m接道',
    features: ['エアコン付き'],
    legalNotes: ['通常損耗は貸主負担'],
  };
  const p = toTourProperty(spec);
  assert.equal(p.floors, 2);
  assert.equal(p.ageYears, 26);
  assert.equal(p.area, 24);
  assert.equal(p.buildingCoverage, 60);
  assert.equal(p.floorAreaRatio, 200);
  assert.equal(p.rent, 4.2, '賃料はそのまま万円/月');
  assert.equal(p.depositMonths, 1);
  assert.equal(p.keyMoneyMonths, 1);

  // 土地(価格のみ・カンマ入り)も壊れない
  const land = toTourProperty({
    ...spec,
    id: 'field',
    kind: 'land',
    structure: undefined,
    floors: undefined,
    age: undefined,
    area: '—',
    landArea: '土地 1,900㎡',
    price: '価格 1,450万円',
    deposit: undefined,
  });
  assert.equal(land.area, 1900, 'カンマ入りの土地面積を読める');
  assert.equal(land.rent, 5, '売買物件は価格から月額相当に換算する');
  assert.equal(land.depositMonths, 0);
  assert.equal(land.floors, 1);
}

// --- 6d. 同じ気分でも、口調と着眼点が違えばセリフが変わる ---------------------
{
  const styles = ['polite', 'casual', 'kid', 'elder', 'gruff'];
  const lines = styles.map((style, i) =>
    householdReaction(household([member(`m${i}`, `M${i}`, [], [], style)]), mansion).each[0]
      .reaction.line,
  );
  assert.equal(new Set(lines).size, styles.length, '口調ごとに違うセリフになる');

  // 同じ口調でも着眼点が違えば同じ文にならない
  const a = member('m-a', 'A', [], [], 'polite');
  const b = member('m-b', 'B', [], [], 'polite');
  b.voice = { style: 'polite', focus: '庭と外まわり' };
  const two = householdReaction(household([a, b]), mansion);
  assert.notEqual(two.each[0].reaction.line, two.each[1].reaction.line, '同席者と同じ文にしない');
}

// --- 6e. 難易度: どの世帯も契約に辿り着けるか(実データで通しの検算) ----------
{
  const chars = new Map(
    readdirSync('content/gen1/characters')
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(readFileSync(join('content/gen1/characters', f), 'utf8')))
      .map((c) => [c.id, c]),
  );
  const props = PROPERTIES.map(toTourProperty);
  /** 1件見て回るあいだに時間で減るぶん(約15秒) */
  const DRAIN_PER_VISIT = 5;

  for (const f of readdirSync('content/gen1/households').filter((x) => x.endsWith('.json'))) {
    const raw = JSON.parse(readFileSync(join('content/gen1/households', f), 'utf8'));
    const members = raw.memberIds.map((id) => chars.get(id)).filter(Boolean).map(toTourMember);
    if (members.length === 0) continue;
    const h = { ...raw, members };

    const candidates = props.filter((p) => householdReaction(h, p).candidate);
    assert.ok(candidates.length > 0, `${h.label}: 気に入る物件が1件も無い(契約不可能)`);

    // 端から総当たりする一番下手なプレイでも、契約候補に辿り着くまでHPが保つか
    let hp = HP_MAX;
    for (const p of props) {
      const hr = householdReaction(h, p);
      hp += hpDeltaFor(hr) - DRAIN_PER_VISIT;
      if (hr.candidate) break;
    }
    assert.ok(
      hp > 0,
      `${h.label}: 順番に見て回ると契約前に機嫌が尽きる(残りHP ${hp})。HP_PENALTY_* を緩めること`,
    );
  }
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
