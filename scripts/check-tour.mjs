#!/usr/bin/env node
// 物件案内(世帯単位)の自己チェック。node scripts/check-tour.mjs
// Node 24 の型ストリップでそのまま .ts を読む(テストフレームワークは入れない)。
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { NOT_FOR_RENT, PROPERTIES, initialOccupancy, isVacant } from '../src/lib/properties.ts';
import { BUILDINGS, LAND_SIGNS, START_POS, inBounds, isSolid } from '../src/lib/map.ts';
import { INITIAL_HOMES, INITIAL_RESIDENTS } from '../src/types.ts';
import {
  HP_BONUS_ALL_LIKE,
  HP_DRAIN_PER_TICK,
  HP_MAX,
  HP_PENALTY_DISLIKE,
  HP_PENALTY_MEH,
  HP_TICK_MS,
  TILES_PER_SEC,
  disclosureFor,
  missKindFor,
  pickVacancies,
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
  assert.equal(tourReducer(c, { type: 'tick' }).hp, c.hp - HP_DRAIN_PER_TICK);
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

// --- 6e. 難易度: 機嫌が10倍速く減っても理不尽にならないか(実データで通しの検算) ---
// 機嫌は「マップを自由に歩いている間」だけ減る(パネルや会話を読む時間は減らない)。
// だから難易度 = 歩く距離。実際のマップ上の距離を測って、HPが保つかを検算する。
{
  const chars = new Map(
    readdirSync('content/gen1/characters')
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(readFileSync(join('content/gen1/characters', f), 'utf8')))
      .map((c) => [c.id, c]),
  );
  const props = PROPERTIES.map(toTourProperty);

  /** 1タイル歩くのに減る機嫌 */
  const DRAIN_PER_TILE = (HP_DRAIN_PER_TICK / HP_TICK_MS) * 1000 / TILES_PER_SEC;

  // 物件までの歩行距離(タイル)。開始位置=自宅前の道からのBFS
  const key = (x, y) => `${x},${y}`;
  const dist = new Map([[key(...START_POS), 0]]);
  const queue = [[...START_POS]];
  while (queue.length > 0) {
    const [x, y] = queue.shift();
    const d = dist.get(key(x, y));
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(nx, ny) || isSolid(nx, ny) || dist.has(key(nx, ny))) continue;
      dist.set(key(nx, ny), d + 1);
      queue.push([nx, ny]);
    }
  }
  /** その物件に話しかけられる位置までの歩数 */
  const walkTo = (x, y) =>
    Math.min(...[[0, -1], [0, 1], [-1, 0], [1, 0]].map(([dx, dy]) => dist.get(key(x + dx, y + dy)) ?? Infinity));
  const tilesTo = new Map([
    ...BUILDINGS.map((b) => [b.id, walkTo(...b.entrance)]),
    ...LAND_SIGNS.map((s) => [s.id, walkTo(s.x, s.y)]),
  ]);
  for (const [id, t] of tilesTo) assert.ok(Number.isFinite(t), `物件 ${id} に歩いて行けない`);

  const households = readdirSync('content/gen1/households')
    .filter((x) => x.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join('content/gen1/households', f), 'utf8')))
    .map((raw) => ({
      ...raw,
      members: raw.memberIds.map((id) => chars.get(id)).filter(Boolean).map(toTourMember),
    }))
    .filter((h) => h.members.length > 0);

  for (const h of households) {
    const candidates = props.filter((p) => householdReaction(h, p).candidate);
    assert.ok(candidates.length > 0, `${h.label}: 気に入る物件が1件も無い(契約不可能)`);

    // (1) 要望に合う物件へ最短で向かえば、余裕をもって契約できること
    const nearest = Math.min(...candidates.map((p) => tilesTo.get(p.id) ?? Infinity));
    const straight = HP_MAX - nearest * DRAIN_PER_TILE;
    assert.ok(
      straight >= 50,
      `${h.label}: 一番近い候補(${nearest}タイル)へ直行しても機嫌が ${Math.round(straight)} しか残らない`,
    );

    // (2) 近い順に見て回る「ふつうのプレイ」でも契約に辿り着けること。
    //     外れを引くたびに機嫌が減り、そのぶん歩く距離も積み上がる
    const byDistance = [...props].sort(
      (a, b) => (tilesTo.get(a.id) ?? 1e9) - (tilesTo.get(b.id) ?? 1e9),
    );
    let hp = HP_MAX;
    let at = 0;
    let visits = 0;
    for (const p of byDistance) {
      const tiles = tilesTo.get(p.id) ?? 0;
      hp -= Math.abs(tiles - at) * DRAIN_PER_TILE;
      at = tiles;
      const hr = householdReaction(h, p);
      hp += hpDeltaFor(hr);
      visits++;
      if (hr.candidate) break;
    }
    assert.ok(
      hp > 0,
      `${h.label}: 近い順に${visits}件見て回ると契約前に機嫌が尽きる(残り ${Math.round(hp)})。` +
        'HP_DRAIN_PER_TICK か HP_PENALTY_* を緩めること',
    );
  }

  console.log(
    `難易度: 1タイルあたり機嫌 -${DRAIN_PER_TILE.toFixed(2)} / 全力で歩ける距離 ${Math.floor(HP_MAX / DRAIN_PER_TILE)}タイル`,
  );
}

// --- 6f. 開始時の空きは3件前後で、来る世帯が必ず1件は気に入ること -----------------
{
  const chars = new Map(
    readdirSync('content/gen1/characters')
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(readFileSync(join('content/gen1/characters', f), 'utf8')))
      .map((c) => [c.id, c]),
  );
  const occ = initialOccupancy();
  const vacant = PROPERTIES.filter((p) => isVacant(p.id, occ));
  assert.ok(
    vacant.length >= 2 && vacant.length <= 4,
    `開始時の空きが ${vacant.length} 件(3件前後に保つこと)`,
  );

  // 空きが一箇所に固まっていないこと(村を歩いて回る意味が出るように)
  const spots = vacant.map((p) => {
    const b = BUILDINGS.find((x) => x.id === p.id);
    const s = LAND_SIGNS.find((x) => x.id === p.id);
    return b ? b.entrance : s ? [s.x, s.y] : null;
  });
  assert.ok(spots.every(Boolean), '空き物件がマップ上に存在しない');
  const pairs = spots.flatMap((a, i) => spots.slice(i + 1).map((b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])));
  assert.ok(Math.min(...pairs) >= 4, `空き物件が固まっている(最短 ${Math.min(...pairs)} タイル)`);

  // 開始時から村にいる住民の家は埋まっていること
  for (const [charId, propId] of Object.entries(INITIAL_HOMES)) {
    assert.ok(!isVacant(propId, occ), `${charId} が住んでいる ${propId} が空き扱いになっている`);
  }

  // これから来る世帯(=開始時の住民でない人)は、空き3件のどれかを気に入ること
  const residents = new Set(INITIAL_RESIDENTS);
  const vacantTour = vacant.map(toTourProperty);
  for (const f of readdirSync('content/gen1/households').filter((x) => x.endsWith('.json'))) {
    const raw = JSON.parse(readFileSync(join('content/gen1/households', f), 'utf8'));
    const members = raw.memberIds.map((id) => chars.get(id)).filter(Boolean).map(toTourMember);
    if (members.length === 0 || raw.memberIds.some((id) => residents.has(id))) continue;
    const h = { ...raw, members };
    assert.ok(
      vacantTour.some((p) => householdReaction(h, p).candidate),
      `${h.label}: 開始時の空き物件に気に入るものが1件も無い(案内が詰む)`,
    );
  }
  console.log(`開始時の空き: ${vacant.map((p) => p.name).join(' / ')}`);
}

// --- 6g. 案内する3件は「合うのはちょうど1件」で、外れる理由が別々か ------------
// 3件とも似た物件だと、最初に見た1件で決まってしまい選ぶ意味が無くなる。
{
  const chars = new Map(
    readdirSync('content/gen1/characters')
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(readFileSync(join('content/gen1/characters', f), 'utf8')))
      .map((c) => [c.id, c]),
  );
  const props = PROPERTIES.map(toTourProperty);
  const forbidden = new Set([...NOT_FOR_RENT, ...Object.values(INITIAL_HOMES)]);
  const residents = new Set(INITIAL_RESIDENTS);

  for (const f of readdirSync('content/gen1/households').filter((x) => x.endsWith('.json'))) {
    const raw = JSON.parse(readFileSync(join('content/gen1/households', f), 'utf8'));
    const members = raw.memberIds.map((id) => chars.get(id)).filter(Boolean).map(toTourMember);
    if (members.length === 0 || raw.memberIds.some((id) => residents.has(id))) continue;
    const h = { ...raw, members };
    const slots = pickVacancies(h, props, forbidden, 3);
    assert.equal(slots.length, 3, `${h.label}: 案内できる物件が3件そろわない`);

    const shown = slots.map((v) => props.find((p) => p.id === v.id));
    const fits = shown.filter((p) => householdReaction(h, p).candidate);
    assert.equal(
      fits.length,
      1,
      `${h.label}: 要望に合う物件が ${fits.length} 件ある(ちょうど1件にすること): ${fits.map((p) => p.name).join(',')}`,
    );
    // 外れる2件は、選べる範囲でできるだけ違う理由にする
    const kinds = slots.filter((v) => !v.fit).map((v) => v.miss);
    const availableKinds = new Set(
      props
        .filter((p) => !forbidden.has(p.id) && !householdReaction(h, p).candidate)
        .map((p) => missKindFor(h, p)),
    );
    assert.equal(
      new Set(kinds).size,
      Math.min(kinds.length, availableKinds.size),
      `${h.label}: 外れる理由が偏っている(${kinds} / 選べたのは ${[...availableKinds]})`,
    );
    console.log(
      `  ${h.label}: ◎${shown[0].name} / ${slots.slice(1).map((v, i) => `✗${shown[i + 1].name}(${v.miss})`).join(' ')}`,
    );
  }
}

// --- 6h. 35条クイズ: 連打で正解できないこと / 選択肢が重複しないこと -------------
{
  const props = PROPERTIES.map(toTourProperty);
  const positions = new Set();
  for (const p of props) {
    const items = disclosureFor(p);
    assert.equal(items.length, 3, `${p.name}: 重説が3問ない`);
    for (const it of items) {
      const cs = it.question.choices;
      assert.equal(new Set(cs).size, cs.length, `${p.name}「${it.heading}」: 選択肢が重複している`);
      assert.ok(it.question.correct >= 0 && it.question.correct < cs.length, '正解の位置が範囲外');
      positions.add(it.question.correct);
    }
  }
  assert.ok(positions.size > 1, '正解がいつも同じ位置にある(連打で全問正解できてしまう)');

  // 物件が違えば設問も違う(全物件で同じ3問の使い回しにしない)
  const first = disclosureFor(props[0]).map((i) => i.heading).join('|');
  assert.ok(
    props.some((p) => disclosureFor(p).map((i) => i.heading).join('|') !== first),
    '全物件で同じ設問が出ている',
  );
}

// --- 6i. その年に相談できる相手が村にいるか(勉強していない問題で受験させない) ----
{
  const events = readdirSync('content/gen1/events', { recursive: true })
    .filter((f) => typeof f === 'string' && f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join('content/gen1/events', f), 'utf8')));
  const chars = new Set(
    readdirSync('content/gen1/characters')
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(readFileSync(join('content/gen1/characters', f), 'utf8')).id),
  );
  // 相談の相手は「開始時の住民」か「転入してくる世帯の誰か」= いつか村に来る人であること
  const arrivals = new Set(
    readdirSync('content/gen1/households')
      .filter((f) => f.endsWith('.json'))
      .flatMap((f) => JSON.parse(readFileSync(join('content/gen1/households', f), 'utf8')).memberIds),
  );
  const reachable = new Set([...INITIAL_RESIDENTS, ...arrivals]);
  const unreachable = events
    .filter((e) => chars.has(e.characterId) && !reachable.has(e.characterId))
    .map((e) => `${e.id}(${e.characterId})`);
  assert.deepEqual(
    unreachable,
    [],
    `村に来ない人物の相談があり、体験できないまま試験に出る: ${unreachable.join(', ')}`,
  );
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
