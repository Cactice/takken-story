#!/usr/bin/env node
// content/events/*.json を 世代/分野 フォルダへ移動し、generation フィールドを付与する。
// 一度きりの整理スクリプト。再実行しても冪等(移動済みならスキップ)。
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const CONTENT = 'content';
const eventsDir = (gen) => `${CONTENT}/gen${gen}/events`;

// topicId の接頭辞 → 分野フォルダ
export function fieldOf(topicId) {
  if (/^(gyoho|takkengyouhou)-/.test(topicId)) return 'gyoho';
  if (/^hourei-/.test(topicId)) return 'hourei';
  if (/^(zei|sonota)-/.test(topicId)) return 'zei';
  return 'kenri'; // minpo-*, shakuchi, shakka, kubun-shoyu, toki-ho
}

// 第1世代(ありきた村・ほのぼの・基礎)に題材が存在しない論点だけを他世代へ。
// 判断理由は content/COVERAGE.md に記載。
const NON_GEN1 = {
  'kubun-shoyu': 2,
  'gyoho-kokoku': 2,
  'gyoho-kantoku': 2,
  'gyoho-meibo': 2,
  'gyoho-kashi-tanpo': 2,
  'hourei-takasa': 4,
  'hourei-kukaku': 4,
};

function allEventFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? allEventFiles(join(dir, e.name)) : e.name.endsWith('.json') ? [join(dir, e.name)] : [],
  );
}

// import されたときは fieldOf だけを提供し、副作用(移動)は走らせない
if (process.argv[1]?.endsWith('organize-events.mjs')) {
  const files = [1, 2, 3, 4, 5].flatMap((g) => allEventFiles(eventsDir(g)));

  for (const src of files) {
    const raw = readFileSync(src, 'utf8');
    const data = JSON.parse(raw);
    const gen = NON_GEN1[data.topicId] ?? 1;
    const dest = join(eventsDir(gen), fieldOf(data.topicId), src.split('/').pop());

    if (src !== dest) {
      mkdirSync(dirname(dest), { recursive: true });
      execFileSync('git', ['mv', src, dest]);
    }
    if (data.generation !== gen) {
      // generation は id/topicId の直後に置く
      const out = {};
      for (const [k, v] of Object.entries(data)) {
        out[k] = v;
        if (k === 'topicId') out.generation = gen;
      }
      if (!('generation' in out)) out.generation = gen;
      writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');
    }
  }

  // 世代フォルダの枠を用意(空フォルダは git が追跡しないため events/ まで)
  for (const gen of [2, 3, 4, 5]) mkdirSync(eventsDir(gen), { recursive: true });
  console.log('done');
}
