#!/usr/bin/env node
// 全イベントJSONの整合性チェック + content/COVERAGE.md の対応表を生成する。
//   node scripts/check-coverage.mjs         → 検証のみ(異常があれば exit 1)
//   node scripts/check-coverage.mjs --write → COVERAGE.md の対応表も書き出す
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fieldOf } from './organize-events.mjs';

const FIELDS = { kenri: '権利関係', gyoho: '宅建業法', hourei: '法令上の制限', zei: '税・その他' };
const EXAM_Q = { kenri: 14, gyoho: 20, hourei: 8, zei: 8 };

// --- topics.md を読む -------------------------------------------------------
function parseTopics() {
  const lines = readFileSync('content/topics.md', 'utf8').split('\n');
  const heading = { '権利関係': 'kenri', '宅建業法': 'gyoho', '法令上の制限': 'hourei', '税・その他': 'zei' };
  const topics = [];
  let field = null;
  for (const line of lines) {
    const h = line.match(/^## (.+?)(\(|$)/);
    if (h) field = heading[h[1].trim()] ?? null;
    const row = line.match(/^\|\s*([a-z0-9-]+)\s*\|\s*(.+?)\s*\|\s*([ABC])\s*\|\s*(.+?)\s*\|/);
    if (row && field) topics.push({ id: row[1], name: row[2], freq: row[3], phase: row[4], field });
  }
  return topics;
}

// --- イベントを読む ---------------------------------------------------------
function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.json') ? [join(dir, e.name)] : [],
  );
}

const GENS = [1, 2, 3, 4, 5];
const STAGE = { 1: 'ありきた村(基礎)', 2: '黒会市(誘惑)', 3: 'ありきた村(サスペンス)', 4: '黒会市(再建)', 5: '村+市+白夜村(総力戦)' };
const KINDS = ['newcomer', 'farewell', 'life', 'trouble'];
const events = GENS.flatMap((g) => walk(`content/gen${g}/events`)).map((path) => ({
  path,
  data: JSON.parse(readFileSync(path, 'utf8')),
}));

// --- 整合性チェック ---------------------------------------------------------
const errors = [];
const seen = new Map();
for (const { path, data } of events) {
  const [, genDir] = path.split('/');
  const gen = Number(genDir.replace('gen', ''));
  if (data.id !== basename(path, '.json')) errors.push(`${path}: id "${data.id}" がファイル名と不一致`);
  if (seen.has(data.id)) errors.push(`${path}: id "${data.id}" が ${seen.get(data.id)} と重複`);
  seen.set(data.id, path);
  if (data.generation !== gen) errors.push(`${path}: generation ${data.generation} がフォルダ gen${gen} と不一致`);
  // 分野はフォルダで分けない(docs/CONTENT_SCHEMA.md)。分野は topicId から導く
  if (!data.topicId) errors.push(`${path}: topicId がない`);
  // フォルダ = イベントの種類(kind)
  const kindDir = path.split('/')[3];
  if (data.kind !== kindDir) errors.push(`${path}: kind "${data.kind}" がフォルダ ${kindDir}/ と不一致`);
  if (!KINDS.includes(kindDir)) errors.push(`${path}: 未定義の種類フォルダ ${kindDir}/`);
  if (!Array.isArray(data.cast) || data.cast.length === 0) errors.push(`${path}: cast がない`);
  if (data.characterId && data.cast?.[0] !== data.characterId)
    errors.push(`${path}: characterId "${data.characterId}" が cast の先頭と不一致`);
}

// --- 人物 -------------------------------------------------------------------
const characters = new Map(); // id -> { gens:Set, path }
for (const g of GENS) {
  for (const p of walk(`content/gen${g}/characters`)) {
    const c = JSON.parse(readFileSync(p, 'utf8'));
    if (c.id !== basename(p, '.json')) errors.push(`${p}: id "${c.id}" がファイル名と不一致`);
    if (characters.has(c.id)) errors.push(`${p}: 人物ID "${c.id}" が ${characters.get(c.id).path} と重複`);
    characters.set(c.id, { gens: new Set(c.appearsIn ?? [g]), path: p });
  }
}
for (const [id, c] of characters) {
  for (const r of c.relations ?? []) void r;
  const raw = JSON.parse(readFileSync(c.path, 'utf8'));
  for (const r of raw.relations ?? []) {
    if (!characters.has(r.characterId)) errors.push(`${c.path}: relations の "${r.characterId}" が存在しない (${id})`);
  }
}
// イベントの cast が実在し、その世代に登場する人物か
for (const { path, data } of events) {
  for (const id of data.cast ?? []) {
    const c = characters.get(id);
    if (!c) errors.push(`${path}: cast の "${id}" が characters に存在しない`);
    else if (!c.gens.has(data.generation))
      errors.push(`${path}: cast の "${id}" は第${[...c.gens].join('/')}世代の人物。gen${data.generation} のイベントで参照している`);
  }
}
// 世帯の memberIds
for (const g of GENS) {
  for (const p of walk(`content/gen${g}/households`)) {
    const h = JSON.parse(readFileSync(p, 'utf8'));
    for (const id of h.memberIds ?? []) if (!characters.has(id)) errors.push(`${p}: memberIds の "${id}" が存在しない`);
  }
}

const topics = parseTopics();
const byTopic = new Map();
for (const e of events) {
  if (!byTopic.has(e.data.topicId)) byTopic.set(e.data.topicId, []);
  byTopic.get(e.data.topicId).push(e);
}
const known = new Set(topics.map((t) => t.id));
const orphans = [...byTopic.keys()].filter((t) => !known.has(t));
const missing = topics.filter((t) => !byTopic.has(t.id));

// --- 出力 -------------------------------------------------------------------
console.log(`イベント ${events.length}件 / 論点 ${topics.length}件 / 人物 ${characters.size}人`);
console.log('世代ごと: ' + GENS.map((g) => `gen${g}=${events.filter((e) => e.data.generation === g).length}`).join(' '));
console.log('種類ごと: ' + KINDS.map((k) => `${k}=${events.filter((e) => e.data.kind === k).length}`).join(' '));
console.log(`イベントが無い論点: ${missing.length}件`);
console.log(`topics.md に無い topicId: ${orphans.length}件 ${orphans.join(', ')}`);
for (const e of errors) console.error('ERROR ' + e);

if (process.argv.includes('--write')) {
  const rows = topics.map((t) => {
    const evs = byTopic.get(t.id) ?? [];
    return `| ${FIELDS[t.field]} | ${t.id} | ${t.name} | ${t.freq} | ${evs.map((e) => e.data.id).join('<br>') || '—'} | ${evs.map((e) => e.data.generation).join(',') || '—'} | ${evs.length ? '✅' : '❌ なし'} |`;
  });
  const counts = Object.keys(FIELDS).map((f) => {
    const n = events.filter((e) => fieldOf(e.data.topicId) === f).length;
    const nt = topics.filter((t) => t.field === f).length;
    const share = ((n / events.length) * 100).toFixed(1);
    const examShare = ((EXAM_Q[f] / 50) * 100).toFixed(1);
    return `| ${FIELDS[f]} | ${EXAM_Q[f]} | ${examShare}% | ${nt} | ${n} | ${share}% | ${(share - examShare).toFixed(1)}pt |`;
  });
  const table = [
    '<!-- ここから下は scripts/check-coverage.mjs --write が自動生成する。手で編集しない -->',
    '## 論点 × イベント 対応表',
    '',
    '| 分野 | topicId | 論点 | 頻出度 | イベントID | 世代 | 有無 |',
    '|---|---|---|---|---|---|---|',
    ...rows,
    '',
    `**イベントが無い論点: ${missing.length}件** ${missing.map((m) => m.id).join(', ') || '(なし)'}`,
    '',
    `**topics.md に存在しない topicId を持つイベント: ${orphans.length}件** ` +
      (orphans.map((o) => `\`${o}\`(${byTopic.get(o).map((e) => e.data.id).join(', ')})`).join(', ') || '(なし)'),
    '',
    '## 世代ごとのイベント数',
    '',
    '| 世代 | 舞台 | イベント数 | 種類の内訳 |',
    '|---|---|---|---|',
    ...GENS.map((g) => {
      const evs = events.filter((e) => e.data.generation === g);
      const kinds = KINDS.map((k) => [k, evs.filter((e) => e.data.kind === k).length])
        .filter(([, n]) => n)
        .map(([k, n]) => `${k} ${n}`)
        .join(' / ');
      return `| 第${g}世代 | ${STAGE[g]} | ${evs.length} | ${kinds} |`;
    }),
    '',
    '## 分野ごとの過不足(実試験の出題比率との比較)',
    '',
    '| 分野 | 実試験の問数 | 出題比率 | 論点数 | イベント数 | イベント比率 | 差 |',
    '|---|---|---|---|---|---|---|',
    ...counts,
    '',
    `合計イベント数: ${events.length}`,
  ].join('\n');

  const path = 'content/COVERAGE.md';
  const head = existsSync(path) ? readFileSync(path, 'utf8').split('<!-- ここから下は')[0] : '';
  writeFileSync(path, head + table + '\n');
  console.log('wrote ' + path);
}

process.exit(errors.length ? 1 : 0);
