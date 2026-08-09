#!/usr/bin/env node
// laws/*.txt (オーナーが手で貼り直した文字化けの無いテキスト) を構造化して
// kakomon/json/*.json を作り直す。answer / answerNote は既存 JSON から引き継ぐ。
//
// 使い方: node scripts/parse-pasted.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const LAWS = path.join(ROOT, 'laws');
const OUT = path.join(ROOT, 'kakomon', 'json');

// 1ファイルに複数回ぶん入っている場合の並び順。中身の見出しで確認済み。
const FILES = [
  ['h24.txt', ['H24']],
  ['h25.txt', ['H25']],
  ['h26.txt', ['H26']],
  ['h27.txt', ['H27']],
  ['h28.txt', ['H28']],
  ['h29.txt', ['H29']],
  ['h30.txt', ['H30']],
  ['r01.txt', ['R01']],
  ['r02-all.txt', ['R02-10', 'R02-12']], // 10月が先
  ['r03.txt', ['R03-12', 'R03-10']], // 12月が先
  ['r04.txt', ['R04']],
];

// 「问」は貼りテキスト中の誤字（R03 12月 問23）。両方受ける。
const Q_RE = /^【[問问]\s*(\d+)】\s*(.*)$/;
const C_RE = /^([1-4])\.\s+(.*)$/;

/**
 * 年度によって選択肢の書き方が違う。
 * H25 は「問題文 1(改行)本文 2(改行)本文 …」で、番号のうしろにピリオドが無い。
 * 先に「1. 本文」の形へ揃えてから、共通の処理に渡す。
 */
const normalizeChoices = (text) =>
  /^[1-4]\.\s/m.test(text)
    ? text
    : text
        // 「いくつあるか」型は選択肢が1行に並ぶ(1 一つ 2 二つ 3 三つ 4 四つ)。先に割る
        .replace(/[ 　\n]([1-4])[ 　\n]+(?=(?:一つ|二つ|三つ|四つ|なし)(?:[ 　\n]|$))/g, '\n$1. ')
        // 「… 1(改行)本文」「(改行)1(改行)本文」→ 行頭の「1. 本文」に揃える
        .replace(/[ 　\n]([1-4])\n(?=\S)/g, '\n$1. ')
        // 「組合せはどれか」型(1 ア、イ 2 イ、ウ …)も1行に並ぶ
        .replace(/[ 　\n]([1-4])[ 　]+(?=[ア-オ][、，])/g, '\n$1. ')
        // 「…どれか。 1 本文」のように、句点のあとへ続けて置かれた選択肢を割る
        .replace(/([。」])[ 　]([1-4])[ 　]+(?=\S)/g, '$1\n$2. ')
        // 行頭の「4 本文」(ピリオド無し)も同じ形へ
        .replace(/^([1-4])[ 　]+(?=\S)/gm, '$1. ');

/** 貼りテキストに混じっている LaTeX 記法をふつうの日本語に戻す */
const clean = (s) =>
  s
    .replace(/\\,?\\mathrm\{m\}\^2/g, '㎡')
    .replace(/\\,?\\mathrm\{m\}/g, 'm')
    .replace(/\\mathrm\{([^}]*)\}/g, '$1')
    .replace(/\\,/g, '')
    .trim();

// 表紙・注意事項・ページ番号・正解番号表など、本文でない行
const JUNK = [
  /^-?\s*\d+\s*-$/, // - 12 -
  /^\d+\s*ページ/, // 3ページ（正解番号表…）
  /^[【（(]?\d+\s*ページ[】）)]?$/,
  /^\|/, // 正解番号表
  /^※/,
  /^Page\s*\d+$/i,
  /^【PDF/,
  /^表紙/,
  /^問題$/,
  /^[（(]注意事項[）)]/,
  /^次の注意事項/,
  /^(平成|令和)[\s\d]+年度?.*問題$/,
  /^合否判定基準/,
  /^正解番号表/,
];
const isJunk = (s) => JUNK.some((re) => re.test(s));

/** 折り返された行を前の行にくっつけて論理行にする。空行は null で残す。 */
function toLogicalLines(rawLines) {
  const out = [];
  for (const raw of rawLines) {
    if (!raw.trim()) {
      out.push(null);
      continue;
    }
    const indented = /^\s/.test(raw);
    const bullet = raw.match(/^\s*[-•]\s+(.*)$/); // 「  - ア …」は新しい論理行
    if (bullet) {
      out.push(bullet[1].trim());
    } else if (indented && out.length && typeof out[out.length - 1] === 'string') {
      out[out.length - 1] += raw.trim();
    } else {
      out.push(raw.trim());
    }
  }
  return out;
}

/** 論理行の中で 1./2./3./4. が（空行を挟むのは可）連続する最後の並びを探す */
function findChoiceRun(lines) {
  let best = null;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i] && lines[i].match(C_RE);
    if (!m || m[1] !== '1') continue;
    const run = [i];
    let want = 2;
    for (let j = i + 1; j < lines.length && want <= 4; j++) {
      if (lines[j] === null) continue; // 空行はまたぐ
      const m2 = lines[j].match(C_RE);
      if (m2 && +m2[1] === want) {
        run.push(j);
        want++;
      } else break; // 選択肢以外の本文が挟まったら打ち切り
    }
    if (run.length === 4) best = run;
  }
  return best;
}

function parseBlockQuestions(rawLines) {
  const heads = [];
  rawLines.forEach((l, i) => {
    if (Q_RE.test(l)) heads.push(i);
  });
  return heads.map((start, k) => {
    const end = k + 1 < heads.length ? heads[k + 1] : rawLines.length;
    const chunk = rawLines.slice(start, end);
    const no = +chunk[0].match(Q_RE)[1];
    chunk[0] = chunk[0].match(Q_RE)[2]; // 【問 N】 を落とす
    const lines = toLogicalLines(chunk);
    const run = findChoiceRun(lines);
    const bodyLines = (run ? lines.slice(0, run[0]) : lines).filter(
      (l) => l && !isJunk(l)
    );
    return {
      no,
      body: clean(bodyLines.join('')),
      choices: run ? run.map((i) => clean(lines[i].match(C_RE)[2])) : [],
    };
  });
}

/** 問番号が 1 に戻るところで回を分割する */
function splitExams(questions) {
  const blocks = [];
  for (const q of questions) {
    if (!blocks.length || q.no <= blocks[blocks.length - 1].at(-1).no) blocks.push([]);
    blocks[blocks.length - 1].push(q);
  }
  return blocks;
}

const dry = process.argv.includes('--dry');
const report = [];

for (const [file, years] of FILES) {
  const rawLines = normalizeChoices(fs.readFileSync(path.join(LAWS, file), 'utf8')).split('\n');
  const blocks = splitExams(parseBlockQuestions(rawLines));
  if (blocks.length !== years.length) {
    throw new Error(`${file}: 回数が合わない (期待 ${years.length}, 実際 ${blocks.length})`);
  }
  blocks.forEach((parsed, bi) => {
    const year = years[bi];
    const outPath = path.join(OUT, `${year}.json`);
    const prev = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    const prevByNo = new Map(prev.questions.map((q) => [q.no, q]));
    const parsedByNo = new Map(parsed.map((q) => [q.no, q]));

    const questions = [];
    const issues = { missing: [], badChoices: [], noAnswer: [], drift: [] };

    for (const old of prev.questions) {
      const p = parsedByNo.get(old.no);
      if (!p) {
        issues.missing.push(old.no);
        questions.push({ ...old, source: 'ocr' }); // 貼りテキストに無い問は OCR 版を残す
        continue;
      }
      if (p.choices.length !== 4 || p.choices.some((c) => !c)) issues.badChoices.push(p.no);
      const q = { no: p.no, body: p.body, choices: p.choices, answer: old.answer ?? null };
      if (old.answerNote) q.answerNote = old.answerNote;
      if (q.answer == null && !q.answerNote) issues.noAnswer.push(p.no);
      questions.push(q);
      // OCR 版との冒頭30文字の食い違い（パーサのずれ検知用）
      const norm = (s) => s.replace(/[\s、。,.・「」（）()【】]/g, '');
      const a = norm(old.body).slice(0, 30);
      const b = norm(p.body).slice(0, 30);
      let same = 0;
      for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] === b[i]) same++;
      if (same / Math.max(a.length, b.length, 1) < 0.5) issues.drift.push(p.no);
    }
    for (const p of parsed) if (!prevByNo.has(p.no)) throw new Error(`${year}: 問${p.no} が既存 JSON に無い`);

    const out = { year, source: 'pasted', questions };
    if (!dry) fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
    report.push({ year, file, ...issues, total: questions.length,
      ok4: questions.filter((q) => q.choices.length === 4).length,
      withAnswer: questions.filter((q) => q.answer != null || q.answerNote).length });
  });
}

console.table(report.map((r) => ({
  year: r.year, 問数: r.total, '4択OK': r.ok4, answer有: r.withAnswer,
  貼り無し: r.missing.join(',') || '-', 選択肢NG: r.badChoices.join(',') || '-',
  本文差異: r.drift.join(',') || '-',
})));
