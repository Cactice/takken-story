#!/usr/bin/env node
// 宅建試験の過去問PDFから問題文・選択肢・正解番号を取り出して
// kakomon/json/<年度>.json を作る。
//
//   node scripts/extract-kakomon.mjs --download   # 公式PDFを取得(既にあればスキップ)
//   node scripts/extract-kakomon.mjs              # 全年度を抽出
//   node scripts/extract-kakomon.mjs R01 H24      # 年度を指定
//   node scripts/extract-kakomon.mjs --force      # OCRキャッシュを捨ててやり直す
//   node scripts/extract-kakomon.mjs --stats      # 既存JSONの集計だけ
//   node scripts/extract-kakomon.mjs --selftest   # パーサの自己チェック
//
// 出典: 一般財団法人 不動産適正取引推進機構
//       https://www.retio.or.jp/exam/past_ques_ans/other/
//
// 本文の取り出しは2通り。
//   text : PDFにテキスト層がある年度(R05以降)。pdftotext -layout をそのまま使う。
//   ocr  : テキスト層が無い画像PDF(H24〜R04)。400dpiで描画して tesseract。
// 正解番号表は全年度テキストで入っている(最終ページ)。
//
// 必要: poppler(pdftotext/pdftoppm) と tesseract(-l jpn)
// 注意: kakomon/ は .gitignore 済み。問題文は絶対にコミットしないこと。

import { execFile, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PDF_DIR = path.join(ROOT, 'kakomon');
const OCR_DIR = path.join(PDF_DIR, 'ocr'); // OCRキャッシュ
const JSON_DIR = path.join(PDF_DIR, 'json');

const DPI = 400; // 元画像が400dpi。pdftoppmで描画した方が生画像抽出より認識が良い
const PSM = 6; // 単一ブロック。3/4/11 は明確に劣る
const TEXT_MIN = 20000; // これ以上テキストが取れたらテキスト層ありとみなす

const sh = (cmd, args) => execFileSync(cmd, args, { maxBuffer: 1 << 28 }).toString();
const pdftotext = (pdf, extra = []) => sh('pdftotext', ['-layout', ...extra, pdf, '-']);
const pageCount = (pdf) => Number(sh('pdfinfo', [pdf]).match(/^Pages:\s*(\d+)/m)[1]);

// ------------------------------------------------------------ ダウンロード

// 一覧ページのリンク名 → このリポジトリでの年度名
const FILE_TO_YEAR = {
  'R1-q_a': 'R01', 'R2-question': 'R02-10', 'R2-question_002': 'R02-12',
  'R3-question': 'R03-10', 'R3-question_002': 'R03-12', 'R4-q_a': 'R04',
  'R5_qestion_answer　': 'R05', 'R6_question_answer': 'R06', 'R7_question_answer': 'R07',
};
const WANT = new Set(['H24', 'H25', 'H26', 'H27', 'H28', 'H29', 'H30', 'R01', 'R02-10', 'R02-12', 'R03-10', 'R03-12', 'R04', 'R05', 'R06', 'R07']);

const download = async () => {
  const html = await (await fetch('https://www.retio.or.jp/exam/past_ques_ans/other/')).text();
  const urls = [...html.matchAll(/href="([^"]*\.pdf)"/g)].map((m) => new URL(m[1], 'https://www.retio.or.jp'));
  for (const url of urls) {
    const stem = decodeURIComponent(path.basename(url.pathname, '.pdf'));
    const year = FILE_TO_YEAR[stem] ?? stem.replace(/-q_a$/, '');
    if (!WANT.has(year)) continue;
    const out = path.join(PDF_DIR, `${year}.pdf`);
    if (fs.existsSync(out)) { console.log(`skip ${year}`); continue; }
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    fs.writeFileSync(out, buf);
    console.log(`got  ${year} (${buf.length} bytes)`);
  }
};

// ------------------------------------------------------------ 正解番号表

// R03-10 だけ ToUnicode が壊れていて、数字が U+2022 起点にずれている
const unshiftDigits = (s) => s.replace(/[•-‧]/g, (c) => String(c.codePointAt(0) - 0x2022));
const toAscii = (s) => s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

// 1行から正解トークンを拾う。"3", "3又は4", "なし" の3種
const ANSWER_TOKEN = /\d+\s*又は\s*\d+|正解\s*なし|なし|[1-4]/g;

const parseAnswerPage = (raw) => {
  const lines = toAscii(unshiftDigits(raw)).split('\n');
  const out = [];
  for (const line of lines) {
    if (/問|合[否格]|登録講習|※/.test(line)) continue; // 見出し行・判定基準・注記を捨てる
    const tokens = line.match(ANSWER_TOKEN) ?? [];
    if (tokens.length >= 5) out.push(...tokens);
  }
  return out;
};

const extractAnswers = (pdf) => {
  const n = pageCount(pdf);
  for (let p = n; p > n - 3 && p > 0; p--) {
    const tokens = parseAnswerPage(pdftotext(pdf, ['-f', String(p), '-l', String(p)]));
    if (tokens.length !== 50) continue;
    return tokens.map((t) => {
      const one = t.match(/^[1-4]$/);
      return one ? { answer: Number(t) } : { answer: null, answerNote: t.replace(/\s/g, '') };
    });
  }
  return null;
};

// 「全ての解答を正解として取り扱う」等の注記(あれば1件)
const extractAnswerNotice = (pdf) => {
  const n = pageCount(pdf);
  const raw = toAscii(pdftotext(pdf, ['-f', String(n - 1), '-l', String(n)]));
  const m = raw.match(/※[\s\S]{10,400}?(?:取り扱うことといたします。|正解として取り扱います。)/);
  return m ? m[0].replace(/\s+/g, '') : null;
};

// ---------------------------------------------------------- 表記ゆれ補正

// 面積単位。㎡ が m? / m2 / mn? / m* / mz などに化ける(OCR側)
const AREA_UNIT = /(?<=\d[\s,.]*)\s?m\s?[?2２*zn²ｍ]{0,2}(?![a-z])|\bm[?²]/gi;

// OCR結果を実際に集計して出てきた誤読だけを載せている(推測で足さないこと)。
const FIXES = [
  [/宅地(?!建)[^\s]物取引/g, '宅地建物取引'], // 「建」が填/針/閉/寺/電/刈/尋/道 などに化ける
  [/衝地建物/g, '宅地建物'],
  [/取引(?:業|楽|薬)(?:者|着|首|填)/g, '取引業者'],
  [/宅地建物取引[土圭十]/g, '宅地建物取引士'], // 「取引主任者」は平成24年までの正式名称なので直さない
  [/[者都]首府県知事|者道府県知事/g, '都道府県知事'],
  [/市衡化/g, '市街化'],
  [/準厨火建築物/g, '準耐火建築物'],
  [/[名召]介契約/g, '媒介契約'],
  [/保証撤会/g, '保証協会'],
  [/借地[億倍]家法/g, '借地借家法'],
  [/周定資産税/g, '固定資産税'],
  [/[議謀讃]渡/g, '譲渡'],
  [/譲渡欠/g, '譲渡益'],
  [/特別[捧接]除/g, '特別控除'],
  [/選住/g, '居住'],
  [/居住用財疾/g, '居住用財産'],
  [/(?<=[一-龠と])きれ(?=[てたるな])/g, 'され'], // 受身の「され」が「きれ」に化ける
  [/土地区面整理法/g, '土地区画整理法'],
  [/[堂党]業保証金/g, '営業保証金'],
  [/便務不履行/g, '債務不履行'],
  [/[賃費]貸[倍僅]契約|費貸借契約/g, '賃貸借契約'],
  [/消減時効/g, '消滅時効'],
  [/この[間開閉]において/g, 'この問において'],
  [/[でを挫]の記述のうち/g, '次の記述のうち'],
  [/正しい(?:もゃ|ゃの|もる|るの|ちの)/g, '正しいもの'],
  [/[調詩計訳語]っている|誤っでいる/g, '誤っている'],
];

// 罫線の誤認識で浮いた記号ゴミ。前後が空白で挟まれたものだけ消す
const STRAY = /(?<=^|[\s　])['"`’‘｀_。、,.:;\]\[|｜「」『』【】〕〔ー—–\-ｰ~^“”]{1,4}(?=[\s　]|$)/gu;
const PAGE_NO = /^[\s　_'ー—–\-一二]*\d{1,3}[\s　_'ー—–\-一二]*$/;
const FOOTER = /^[\s\S]{0,20}\.indd\b|^\s*[―‑–—\-]\s*\d{1,3}\s*[―‑–—\-]\s*$/;

// 行頭の選択肢番号が記号に化けたもの(1→ ] | l I など)。印を付けておいて後で復元する
const BROKEN_MARK = /^\s*[\]\[|｜lIiｌ!丁「」]\s+(?=[^\s\d０-９])/;
const HINT = '\u0001';

const cleanLine = (raw, ocr) => {
  let s = raw.replace(/　/g, ' ');
  if (ocr) s = s.replace(BROKEN_MARK, HINT);
  if (ocr) s = s.replace(STRAY, ' ').replace(STRAY, ' ');
  s = s.replace(/[ \t]+/g, ' ').trim();
  if (FOOTER.test(s) || PAGE_NO.test(s)) return '';
  return s;
};

const applyFixes = (s, ocr) => {
  let out = (ocr ? s.replace(AREA_UNIT, '㎡') : s).replace(/\u0001/g, '');
  if (ocr) for (const [re, to] of FIXES) out = out.replace(re, to);
  return out.replace(/\s+/g, ' ').replace(/^[\s_'"`|\]\[]+|[\s_'"`|\]\[]+$/g, '');
};

// ------------------------------------------------------------- パーサ

// 【問 1】 / [問18】 / 【間.2】 / 【山 37】 / 【間 181(閉じ括弧が1に化ける) / 較 12(括弧が消える)
// 括弧の中身も閉じ括弧も化けるので、行頭であることと番号の単調増加を頼りに拾う
const HEAD = /(?:[【\[「]\s*[^\s\d]{1,2}|[問間閉剛関門昌固山較])[\s.,、・]{0,2}([0-9０-９]{1,2})\s*(?:[】\]』〕)1lI|]|(?=\s))/g;
// 選択肢マーカー: 行頭の 1〜4(全角・丸数字も)
// 番号の前後にゴミ記号がくっつくことがある(_3 / -3 / 1] など)ので少し緩めに取る
const MARK = /^[\s_'"`’｀|\]\[\-–—ー]{0,3}([1-4１-４①-④])[\s.、,\]|)]+(?=\S)/;
const MARK_LOOSE = /(?:^|\s)([1-4１-４①-④])[\s.、,]+(?=[^\s\d])/g;

const digit = (c) => ('①②③④'.includes(c) ? '①②③④'.indexOf(c) + 1
  : '１２３４'.includes(c) ? '１２３４'.indexOf(c) + 1 : Number(c));

// 行頭マーカーで 1〜4 を探す。番号が記号に化けた行は「前の行が句点で終わっている」
// ことを手掛かりに復元する。それでも足りなければ行中マーカーで拾い直す
const findMarks = (lines) => {
  const at = new Map(); // 番号 → [行, マーカーの長さ]
  lines.forEach((l, i) => {
    const m = l.match(MARK);
    const d = m && digit(m[1]);
    if (d && !at.has(d) && (!at.has(d - 1) || at.get(d - 1)[0] < i)) at.set(d, [i, m[0].length]);
  });

  for (const d of [1, 2, 3, 4]) {
    if (at.has(d)) continue;
    const lo = at.has(d - 1) ? at.get(d - 1)[0] : -1;
    const hi = [d + 1, d + 2, d + 3].map((n) => at.get(n)?.[0]).find(Number.isInteger) ?? lines.length;
    const i = lines.findIndex((l, k) => k > lo && k < hi && l.startsWith(HINT) && /。\s*$/.test(lines[k - 1] ?? ''));
    if (i >= 0) at.set(d, [i, HINT.length]);
  }

  const marks = [];
  for (const d of [1, 2, 3, 4]) {
    const m = at.get(d);
    if (!m || (marks.length && m[0] <= marks.at(-1)[0])) break;
    marks.push(m);
  }
  if (marks.length === 4) return { marks };

  const text = lines.join('\n');
  const offsets = [];
  let want = 1;
  for (const m of text.matchAll(MARK_LOOSE)) {
    if (digit(m[1]) !== want) continue;
    offsets.push(m.index + m[0].length);
    if (++want > 4) break;
  }
  return offsets.length === 4 ? { text, offsets } : { marks };
};

const parseBlock = (lines, ocr) => {
  const fix = (s) => applyFixes(s, ocr);
  const { marks, text, offsets } = findMarks(lines);
  if (marks) {
    if (!marks.length) return { body: fix(lines.join('')), choices: [] };
    const body = lines.slice(0, marks[0][0]).join('');
    const choices = marks.map(([ln, cut], k) => {
      const end = k + 1 < marks.length ? marks[k + 1][0] : lines.length;
      return [lines[ln].slice(cut), ...lines.slice(ln + 1, end)].join('');
    });
    return { body: fix(body), choices: choices.map(fix) };
  }
  const flat = (s) => fix(s.replace(/\n/g, ''));
  const body = text.slice(0, offsets[0]).replace(/[1-4１-４①-④][\s.、,]*$/, '');
  const choices = offsets.map((o, k) => text.slice(o, k + 1 < offsets.length ? offsets[k + 1] : text.length)
    .replace(/[1-4１-４①-④][\s.、,]*$/, ''));
  return { body: flat(body), choices: choices.map(flat) };
};

export const parse = (rawText, ocr = true) => {
  const doc = rawText.split('\n').map((l) => cleanLine(l, ocr)).filter(Boolean).join('\n');
  const heads = [...doc.matchAll(HEAD)]
    .map((m) => ({
      no: Number(toAscii(m[1])), at: m.index, end: m.index + m[0].length,
      // 行頭にあるものだけが本物の見出し。「以下の【問 46】から【問 50】まで」のような
      // 本文中の言及を拾わないための条件
      head: /(^|\n)\s*$/.test(doc.slice(Math.max(0, m.index - 40), m.index)),
    }))
    .filter((h) => h.no >= 1 && h.no <= 50);

  // 番号が単調増加する並びだけ採用する(本文中の誤検出を落とす)
  const kept = [];
  for (const h of heads) if (h.head && (!kept.length || h.no > kept.at(-1).no)) kept.push(h);
  // 行頭で取れなかった番号だけ、行中の見出しでも補う(OCRで行が繋がった場合)
  for (const h of heads) {
    if (h.head || kept.some((k) => k.no === h.no)) continue;
    const i = kept.findIndex((k) => k.at > h.at);
    const prev = i === -1 ? kept.at(-1) : kept[i - 1];
    const next = i === -1 ? null : kept[i];
    if ((!prev || prev.no < h.no) && (!next || next.no > h.no)) kept.splice(i === -1 ? kept.length : i, 0, h);
  }

  return kept.map((h, i) => {
    const block = doc.slice(h.end, i + 1 < kept.length ? kept[i + 1].at : doc.length);
    return { no: h.no, ...parseBlock(block.split('\n'), ocr) };
  });
};

// ---------------------------------------------------------------- OCR

const ocrPdf = async (year, force) => {
  const dir = path.join(OCR_DIR, year);
  if (force) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  // ページ数ぶん揃っていなければ描画し直す(中断したキャッシュを引きずらないため)
  const pdf = path.join(PDF_DIR, `${year}.pdf`);
  const n = pageCount(pdf);
  const list = (ext) => fs.readdirSync(dir).filter((f) => f.endsWith(ext)).sort();

  // OCR済みテキストが揃っていれば画像は要らない(PNGは消してしまってよい)
  if (list('.txt').length !== n) {
    // 途中で止まったキャッシュを引きずらないよう、ページ数ぶん揃っていなければ描画し直す
    if (list('.png').length !== n) {
      for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f));
      execFileSync('pdftoppm', ['-r', String(DPI), '-gray', '-png', pdf, path.join(dir, 'p')]);
    }
    // ページ単位でCPU数ぶん並列に流す(1ページ約6秒、1年28ページ)
    const queue = list('.png').filter((f) => !fs.existsSync(path.join(dir, f.replace(/\.png$/, '.txt'))));
    const worker = async () => {
      for (let f = queue.shift(); f; f = queue.shift()) {
        const base = path.join(dir, f.replace(/\.png$/, ''));
        // OMP_THREAD_LIMIT=1: tesseract内のOpenMP並列を切る。プロセス単位で並べた方が速い
        await new Promise((ok, ng) => execFile('tesseract', [path.join(dir, f), base, '-l', 'jpn', '--psm', String(PSM)],
          { env: { ...process.env, OMP_THREAD_LIMIT: '1' } }, (e) => (e ? ng(e) : ok())));
      }
    };
    await Promise.all(Array.from({ length: Math.min(os.cpus().length, queue.length || 1) }, worker));
  }
  return list('.txt').map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
};

// ---------------------------------------------------------------- 本体

const buildYear = async (year, force) => {
  const pdf = path.join(PDF_DIR, `${year}.pdf`);
  const text = pdftotext(pdf);
  const source = text.replace(/\s/g, '').length >= TEXT_MIN ? 'text' : 'ocr';
  const questions = source === 'text' ? parse(text, false) : parse(await ocrPdf(year, force), true);

  const answers = extractAnswers(pdf);
  if (answers) questions.forEach((q) => Object.assign(q, answers[q.no - 1] ?? { answer: null }));
  const notice = extractAnswerNotice(pdf);

  const data = { year, source, ...(notice ? { answerNotice: notice } : {}), questions };
  fs.mkdirSync(JSON_DIR, { recursive: true });
  fs.writeFileSync(path.join(JSON_DIR, `${year}.json`), JSON.stringify(data, null, 1));
  return { data, answersOk: !!answers };
};

// ---------------------------------------------------------------- CLI

const allYears = () => fs.readdirSync(PDF_DIR).filter((f) => f.endsWith('.pdf')).map((f) => f.replace(/\.pdf$/, '')).sort();

const stats = (list) => {
  console.table(list.map((y) => {
    const d = JSON.parse(fs.readFileSync(path.join(JSON_DIR, `${y}.json`), 'utf8'));
    const q = d.questions;
    const full = q.filter((x) => x.choices.length === 4 && x.choices.every((c) => c.length >= 1)).length;
    const missing = Array.from({ length: 50 }, (_, i) => i + 1).filter((n) => !q.some((x) => x.no === n));
    const ans = q.filter((x) => 'answer' in x).length;
    return {
      年度: y, 取得: d.source, 問数: q.length, '4択揃い': full,
      '4択率': `${Math.round((full / 50) * 100)}%`, 正解番号: `${ans}/50`, 欠番: missing.join(',') || '-',
    };
  }));
};

// 自己チェック。問題文は埋め込まない(著作権)ので、構造だけの合成テキストで検証する
const selftest = () => {
  const sample = [
    "'  【問 1】 甲について、正しいものはどれか。   ]",
    '] 1 あああああああ、',
    'いいいいいい。      「',
    '_ 2 うううううう 100 m? である。',
    '。 3 ええええええええ。',
    '4 おおおおおお。',
    'ー 3 一',
    '【剛 2】 乙に関する記述のうち、誤っているものはどれか。',
    '1 かかかか。',
    '2 きききき。',
    '3 くくくく。',
    '4 けけけけ。',
  ].join('\n');
  const q = parse(sample, true);
  console.assert(q.length === 2, 'question count', q.length);
  console.assert(q[0].no === 1 && q[1].no === 2, 'numbering');
  console.assert(q.every((x) => x.choices.length === 4), 'choices');
  console.assert(q[0].body === '甲について、正しいものはどれか。', 'body', q[0].body);
  console.assert(q[0].choices[0] === 'あああああああ、いいいいいい。', 'choice1', q[0].choices[0]);
  console.assert(q[0].choices[1].includes('100㎡'), '㎡ normalize', q[0].choices[1]);
  console.assert(q[0].choices[3] === 'おおおおおお。', 'page number dropped', q[0].choices[3]);

  const ansPage = ['問 １ 問 ２ 問 ３ 問 ４ 問 ５ 問 ６ 問 ７ 問 ８ 問 ９ 問１０', '',
    '  3   1   3   2   3又は4   4   1   なし   1   4', '５０問中３６問以上正解'].join('\n');
  const a = parseAnswerPage(ansPage);
  console.assert(a.length === 10, 'answer tokens', a.length);
  console.assert(a[4] === '3又は4' && a[7] === 'なし', 'special tokens', a[4], a[7]);
  console.assert(parseAnswerPage('‣ ․ ‥ … ‣ ․').length === 6, 'CID shift');
  console.log('selftest done');
};

const main = async () => {
  const argv = process.argv.slice(2);
  if (argv.includes('--selftest')) return selftest();
  if (argv.includes('--download')) return download();
  const force = argv.includes('--force');
  const only = argv.filter((a) => !a.startsWith('--'));
  const list = only.length ? only : allYears();
  if (argv.includes('--stats')) return stats(list);

  for (const y of list) {
    process.stderr.write(`${y} ... `);
    const { data, answersOk } = await buildYear(y, force);
    process.stderr.write(`${data.source} ${data.questions.length}問 正解番号${answersOk ? 'OK' : 'NG'}\n`);
  }
  stats(list);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
