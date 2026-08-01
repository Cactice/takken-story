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
const events = GENS.flatMap((g) => walk(`content/gen${g}/events`)).map((path) => ({
  path,
  data: JSON.parse(readFileSync(path, 'utf8')),
}));

// --- 整合性チェック ---------------------------------------------------------
const errors = [];
const seen = new Map();
for (const { path, data } of events) {
  const [, genDir, , fieldDir] = path.split('/');
  const gen = Number(genDir.replace('gen', ''));
  if (data.id !== basename(path, '.json')) errors.push(`${path}: id "${data.id}" がファイル名と不一致`);
  if (seen.has(data.id)) errors.push(`${path}: id "${data.id}" が ${seen.get(data.id)} と重複`);
  seen.set(data.id, path);
  if (data.generation !== gen) errors.push(`${path}: generation ${data.generation} がフォルダ gen${gen} と不一致`);
  if (!data.topicId) errors.push(`${path}: topicId がない`);
  else if (fieldOf(data.topicId) !== fieldDir) errors.push(`${path}: topicId "${data.topicId}" は ${fieldOf(data.topicId)}/ に属するはず`);
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
console.log(`イベント ${events.length}件 / 論点 ${topics.length}件`);
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
