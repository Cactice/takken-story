#!/usr/bin/env node
// docs/events-by-household.md を生成する。
//   node scripts/gen-household-doc.mjs          → 生成して書き出す
//   node scripts/gen-household-doc.mjs --check  → 差分があれば exit 1(書き換えない)
//
// 入力は2つ:
//   1. content/gen*/events/**/*.json  … 実装済みイベント(summary を「どんな話か」に使う)
//   2. docs/household-plan.json       … 手書きの設計(移動の型・まだ無いイベントの計画行)
// このスクリプトは household-plan.json を読むだけで、絶対に書き換えない。
// 計画行を実装したら content に JSON を足し、household-plan.json の planned から消すこと。
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'docs/events-by-household.md';
const PLAN = 'docs/household-plan.json';
const BOSS = '禿鷹'; // 全世代の上司。世帯としては別枠にする
const FIELD_TAG = { kenri: '権利', gyoho: '業法', hourei: '法令', zei: '税その他' };

// --- 入力 -------------------------------------------------------------------
function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.json') ? [join(dir, e.name)] : [],
  );
}

function parseTopics() {
  const heading = { 権利関係: 'kenri', 宅建業法: 'gyoho', 法令上の制限: 'hourei', '税・その他': 'zei' };
  const topics = new Map();
  let field = null;
  for (const line of readFileSync('content/topics.md', 'utf8').split('\n')) {
    const h = line.match(/^## (.+?)(\(|$)/);
    if (h) field = heading[h[1].trim()] ?? null;
    const row = line.match(/^\|\s*([a-z0-9-]+)\s*\|\s*(.+?)\s*\|\s*([ABC])\s*\|/);
    if (row && field) topics.set(row[1], { name: row[2].replace(/\(.*$/, '').trim(), field });
  }
  return topics;
}

const topics = parseTopics();
const topicCell = (id) => {
  const t = topics.get(id);
  return t ? `**${t.name}**〈${FIELD_TAG[t.field]}〉` : `**${id}**`;
};

const characters = walk('content').filter((f) => f.includes('/characters/')).map((f) => JSON.parse(readFileSync(f, 'utf8')));
const byId = new Map(characters.map((c) => [c.id, c]));
const fullName = (c) => `${c.familyName ?? ''}${c.givenName ?? c.name}`;
const genList = (c) => (c.appearsIn?.length ? c.appearsIn : [c.generation]);

const events = walk('content')
  .filter((f) => f.includes('/events/'))
  .map((f) => JSON.parse(readFileSync(f, 'utf8')))
  .sort((a, b) => a.generation - b.generation || a.id.localeCompare(b.id));

const noSummary = events.filter((e) => !e.summary);
if (noSummary.length) {
  console.error(`summary が無いイベントが ${noSummary.length} 件: ${noSummary.map((e) => e.id).join(', ')}`);
  process.exit(1);
}

const plan = JSON.parse(readFileSync(PLAN, 'utf8'));

// --- 移動の型 × 登場世代の舞台 の整合チェック --------------------------------
// 第1・3・5世代 = ありきた村 / 第2・4世代 = 黒会市。どの世代に出るかで住んでいる場所が決まる。
// 型は「家に1つ」ではなく「系統(枝)ごと」。枝の gens は ids の appearsIn と gens の和集合。
const STAGE = { 1: '村', 2: '都会', 3: '村', 4: '都会', 5: '村' };
const branchGens = (b) => {
  const fromIds = (b.ids ?? []).flatMap((id) => (byId.has(id) ? genList(byId.get(id)) : []));
  return [...new Set([...fromIds, ...(b.gens ?? [])])].sort((a, z) => a - z);
};
const MOVE_RULES = {
  村に留まる: (g) => (g.every((x) => STAGE[x] === '村') ? null : '村の世代(1・3・5)にしか出ないはず'),
  都会に留まる: (g) => (g.every((x) => STAGE[x] === '都会') ? null : '都会の世代(2・4)にしか出ないはず'),
  // 住まいは動かないが、仕事で相手側の舞台へ出向く人。どの世代に出てもよい
  '都会に留まり村へ出向く': () => null,
  '村に留まり都会へ出向く': () => null,
  '村→都会': (g) => {
    const v = g.filter((x) => STAGE[x] === '村');
    const c = g.filter((x) => STAGE[x] === '都会');
    if (!v.length || !c.length) return '村の世代と都会の世代の両方に出る必要がある';
    return v[0] < c[0] && STAGE[g.at(-1)] === '都会' ? null : '村が先・都会で終わる並びになっていない';
  },
  '都会→村': (g) => {
    const v = g.filter((x) => STAGE[x] === '村');
    const c = g.filter((x) => STAGE[x] === '都会');
    if (!v.length || !c.length) return '都会の世代と村の世代の両方に出る必要がある';
    return c[0] < v[0] && STAGE[g.at(-1)] === '村' ? null : '都会が先・村で終わる並びになっていない';
  },
  '村→都会→村': (g) => {
    const c = g.filter((x) => STAGE[x] === '都会');
    if (!c.length) return '都会の世代(2・4)に出る必要がある';
    const before = g.some((x) => STAGE[x] === '村' && x < c[0]);
    const after = g.some((x) => STAGE[x] === '村' && x > c.at(-1));
    return before && after ? null : '都会の前と後の両方に村の世代が要る';
  },
  // 白夜村は第4世代に造られ第5世代に完成している。村でも都会でもない第三の行き先。
  '都会→白夜村': (g) =>
    g.some((x) => STAGE[x] === '都会') && g.at(-1) >= 4 ? null : '都会の世代に出て、第4・5世代まで続く必要がある',
  '白夜村→村': (g) => (g.length ? null : '登場世代がない'), // 移動が前史なので並び順は問わない
  絶える: (g) => (g.length ? null : '登場世代がない'), // 家が消える型。並び順は問わない
};
const moveErrors = [];
for (const [name, cfg] of Object.entries(plan.households)) {
  const branches = cfg.movement ?? [];
  if (!branches.length) moveErrors.push(`${name}家: movement が空`);
  for (const b of branches) {
    const rule = MOVE_RULES[b.type];
    if (!rule) { moveErrors.push(`${name}家/${b.who}: 知らない型「${b.type}」`); continue; }
    const g = branchGens(b);
    if (!g.length) { moveErrors.push(`${name}家/${b.who}: 登場世代が特定できない(ids も gens も空)`); continue; }
    const err = rule(g);
    if (err) moveErrors.push(`${name}家/${b.who}: 型「${b.type}」だが登場世代は ${g.join('・')} — ${err}`);
  }
}
if (moveErrors.length) {
  console.error('移動の型と登場世代の舞台が食い違っています:\n' + moveErrors.map((e) => '  - ' + e).join('\n'));
  process.exit(1);
}
// 同居する別姓(シェアハウス等)を一つの世帯に寄せる
const familyOf = (c) => (c?.familyName ? plan.merge?.[c.familyName] ?? c.familyName : null);

// --- 世帯ごとにまとめる -----------------------------------------------------
/** @type {Map<string, {rows: any[], members: any[]}>} */
const houses = new Map();
const house = (name) => {
  if (!houses.has(name)) houses.set(name, { name, rows: [], members: [] });
  return houses.get(name);
};

for (const c of characters) if (familyOf(c) && familyOf(c) !== BOSS) house(familyOf(c)).members.push(c);
for (const name of Object.keys(plan.households)) house(name);

const orphans = []; // どの世帯にも属さないイベント(主人公とハゲタだけの回)
for (const ev of events) {
  const cast = (ev.cast ?? [ev.characterId]).map((id) => byId.get(id)).filter((c) => c && familyOf(c) !== BOSS);
  const families = [...new Set(cast.map(familyOf).filter(Boolean))];
  const row = {
    gen: ev.generation,
    title: ev.title,
    summary: ev.summary ?? '(summary 未設定)',
    topicId: ev.topicId,
    planned: false,
  };
  if (families.length === 0) orphans.push({ ...row, coStars: [] });
  for (const f of families) house(f).rows.push({ ...row, coStars: cast.filter((c) => familyOf(c) !== f).map(fullName) });
}

for (const [name, cfg] of Object.entries(plan.households)) {
  for (const p of cfg.planned ?? []) {
    house(name).rows.push({ gen: p.gen, title: p.title, summary: p.summary, topicId: p.topicId, planned: true, coStars: [] });
  }
}

// --- 並べ替え ---------------------------------------------------------------
for (const h of houses.values()) {
  h.rows.sort((a, b) => a.gen - b.gen || Number(a.planned) - Number(b.planned) || a.title.localeCompare(b.title, 'ja'));
  h.members.sort((a, b) => a.generation - b.generation || a.id.localeCompare(b.id));
  // イベントを持たない家(主人公家系など)は、移動の枝の登場世代を使う
  const fromBranches = (plan.households[h.name]?.movement ?? []).flatMap(branchGens);
  h.gens = [...new Set(h.rows.length ? h.rows.map((r) => r.gen) : fromBranches)].sort();
  h.done = h.rows.filter((r) => !r.planned).length;
  h.todo = h.rows.filter((r) => r.planned).length;
  h.cfg = plan.households[h.name] ?? {};
}

const sorted = [...houses.values()].sort(
  (a, b) => b.gens.length - a.gens.length || b.rows.length - a.rows.length || a.gens[0] - b.gens[0] || a.name.localeCompare(b.name, 'ja'),
);
const single = sorted.filter((h) => h.gens.length <= 1);

// --- 出力 -------------------------------------------------------------------
const co = (row) => (row.coStars?.length ? `<br><sub>共演: ${row.coStars.join('・')}</sub>` : '');

const rowLine = (r) =>
  r.planned
    ? `| ${r.gen} | *${r.title}* | *${r.summary}* | ${topicCell(r.topicId)} | 📝計画 |`
    : `| ${r.gen} | **${r.title}${co(r)}** | ${r.summary} | ${topicCell(r.topicId)} | ✅実装済 |`;

const out = [];
out.push('# 世帯ごとの物語 — 設計の作業台');
out.push('');
out.push('**一族の六十年を縦に読む。** 世代で切るより、家ごとに追ったほうが変化が見える。');
out.push('あらすじは [story-all.md](story-all.md)。');
out.push('');
out.push('このファイルは **これから何を作るかを設計する場所** で、実装済みイベントと未実装の計画が同じ表に並ぶ。');
out.push('');
out.push('- 「どんな話か」列 = イベントJSONの `summary`(出来事の説明。セリフの引用ではない)');
out.push('- 〈 〉は分野(権利/業法/法令/税その他)');
out.push('- ✅実装済 = `content/gen*/events/` にJSONがある / *📝計画* = まだ無い。斜体');
out.push('- **移動の型** = その家が村と都会をどう行き来するか。移動そのものが宅建の題材になる');
out.push('');
out.push('| 型 | 何を語るか | 題材 |');
out.push('|---|---|---|');
out.push('| 村→都会 | 夢のために出ていく。親元を離れる | 初めての賃貸、保証人、狭小物件、定期借家 |');
out.push('| 都会→村 | 疲れて/追われて戻る。Uターン | 空き家バンク、相続した実家、農地転用、譲渡所得 |');
out.push('| 村に留まる | 根を張る。土地を守る | 相続、境界、借地、固定資産税 |');
out.push('| 都会に留まる | 都会が性に合う | 区分所有、住み替え、住宅ローン |');
out.push('| 都会に留まり村へ出向く | 住まいは街。仕事で村へ来る | 監督処分、届出、調査 |');
out.push('| 村に留まり都会へ出向く | 住まいは村。仕事で街へ行く | 登記、測量 |');
out.push('| 村→都会→村 | 出て、戻る。一族で円環が閉じる | 修行先の狭小賃貸、Uターン、造作買取 |');
out.push('| 都会→白夜村 | 管理された人工の街を選ぶ | 統計、地価公示、区分所有 |');
out.push('| 白夜村→村 | 人工の街に追われて/疑って村へ | 定期借家、空き家バンク |');
out.push('| 絶える | 跡継ぎがなく消える | 空き家、相続人不存在 |');
out.push('');
out.push('**型は家に1つではなく、系統(枝)ごとに持つ。** 同じ親に育った兄弟が違う場所を選ぶ家があるため。');
out.push('第1・3・5世代=ありきた村、第2・4世代=黒会市。**どの世代に出るかで、その人がどこに住んでいるかが決まる。**');
out.push('枝の型と登場世代の舞台が食い違うと、このスクリプトはエラーで止まる。');
out.push('');
out.push('> このファイルは `node scripts/gen-household-doc.mjs` で生成される。');
out.push('> **手で書いた設計(移動の型・計画行)は [household-plan.json](household-plan.json) にある。** そちらを編集すること。');
out.push('> 計画行を実装したら content にJSONを足し、household-plan.json の `planned` から消す。');
out.push('');
out.push('## 移動の型 ｜ 全世帯');
out.push('');
out.push('| 家 | 型 | 世代 | 実装 | 計画 |');
out.push('|---|---|---|---|---|');
for (const h of sorted) {
  const types = (h.cfg.movement ?? []).map((b) => b.type);
  out.push(`| ${h.name}家 | ${types.join(' / ') || '**未割当**'} | ${h.gens.join('・') || '—'} | ${h.done} | ${h.todo} |`);
}
out.push('');
out.push(
  single.length
    ? `> ⚠️ まだ1世代しか出ない家が ${single.length} 件ある: ${single.map((h) => h.name + '家').join('・')}`
    : '> **単発の家(1世代しか出ない家)はゼロ。** 唯一の例外である織部家も「絶える」という形で第3・5世代に残る。',
);
out.push('');
out.push('---');
out.push('');

for (const h of sorted) {
  out.push(`## ${h.name}家 ｜ 第${h.gens.join('・')}世代 ｜ 実装${h.done}件 + 計画${h.todo}件`);
  out.push('');
  out.push(h.cfg.note ?? '');
  out.push('');
  out.push('| 系統 | 移動の型 | 登場世代 | どういう枝か |');
  out.push('|---|---|---|---|');
  for (const b of h.cfg.movement ?? []) {
    out.push(`| ${b.who} | **${b.type}** | ${branchGens(b).join('・')} | ${b.note ?? ''} |`);
  }
  out.push('');
  if (h.cfg.story) {
    out.push(`> **あらすじ**`);
    out.push('>');
    out.push(`> ${h.cfg.story}`);
    out.push('');
  }
  for (const m of h.members) {
    out.push(`- **${fullName(m)}**(初出${m.age}歳・第${genList(m).join('・')}世代) ${(m.personality ?? '').slice(0, 50)}`);
  }
  if (h.members.length) out.push('');
  out.push('| 世代 | イベント | どんな話か | 学ぶ論点 | 状態 |');
  out.push('|---|---|---|---|---|');
  for (const r of h.rows) out.push(rowLine(r));
  out.push('');
}

out.push('---');
out.push('');
out.push(`## ${BOSS}家(全世代の上司なので別枠)`);
out.push('');
out.push(
  `初代 **${BOSS}禿ゲ田**(第1世代) → 二代目 **${BOSS}ハゲル**(第3世代) → (画面に出ない一代) → 四代目 **${BOSS}ハゲ子**(第4世代・ハゲルの孫)。主人公の家系と並走し、どの世代でも隣にいる。第4世代以降は不動産業から離れ、村の運営側(村長)に回る。`,
);
out.push('');
if (plan.boss?.story) {
  out.push('> **あらすじ**');
  out.push('>');
  out.push(`> ${plan.boss.story}`);
  out.push('');
}
out.push('主人公・その身内・社長だけで完結する回(どの世帯にも属さない):');
out.push('');
out.push('| 世代 | イベント | どんな話か | 学ぶ論点 | 状態 |');
out.push('|---|---|---|---|---|');
for (const r of orphans.sort((a, b) => a.gen - b.gen)) out.push(rowLine(r));
out.push('');

const text = out.join('\n');

if (process.argv.includes('--check')) {
  const cur = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (cur !== text) {
    console.error(`${OUT} が古い。node scripts/gen-household-doc.mjs で再生成してください。`);
    process.exit(1);
  }
  console.log(`${OUT} は最新です。`);
} else {
  writeFileSync(OUT, text);
  const done = events.length;
  const todo = [...houses.values()].reduce((n, h) => n + h.todo, 0);
  console.log(`${OUT} を生成: 世帯${houses.size} / 実装${done}件 / 計画${todo}件 / 単発の家${single.length}件`);
}
