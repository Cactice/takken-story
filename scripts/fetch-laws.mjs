#!/usr/bin/env node
// e-Gov 法令API v2 から宅建試験の根拠条文を取得し content/reference/*.md を生成する。
//
//   node scripts/fetch-laws.mjs            # 全法令を取得して Markdown を生成
//   node scripts/fetch-laws.mjs 民法 借地借家法   # slug または法令名で絞って取得
//   node scripts/fetch-laws.mjs --toc 民法        # 条見出し一覧だけ表示(絞り込み範囲の検討用)
//
// API: https://laws.e-gov.go.jp/api/2/law_data/{law_id}?response_format=json
// 条文本文は一切加工しない(タグを外して連結するだけ)。

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'content', 'reference');
const CACHE_DIR = path.join(ROOT, '.cache', 'laws');

// range: [from, to] は「第○条」の主番号(枝番 第5条の2 は主番号5として扱う)。null = 全条文。
export const LAWS = [
  { slug: 'takken-gyoho', lawId: '327AC1000000176', title: '宅地建物取引業法', range: null },
  { slug: 'takken-gyoho-shikorei', lawId: '339CO0000000383', title: '宅地建物取引業法施行令', range: null },
  { slug: 'takken-gyoho-shikokisoku', lawId: '332M50004000012', title: '宅地建物取引業法施行規則', range: null },
  {
    slug: 'minpo',
    lawId: '129AC0000000089',
    title: '民法',
    // 宅建で問われるのは総則・物権・債権・相続。親族編(725-881)は宅建の出題対象外なので除外。
    range: [[1, 724], [882, 1050]],
    note: '親族編(第725条〜第881条)は宅建試験の出題対象外のため除外。それ以外(総則・物権・債権・相続)は全条文を収録。',
  },
  { slug: 'shakuchi-shakka-ho', lawId: '403AC0000000090', title: '借地借家法', range: null },
  { slug: 'kubun-shoyu-ho', lawId: '337AC0000000069', title: '建物の区分所有等に関する法律', range: null },
  { slug: 'fudosan-toki-ho', lawId: '416AC0000000123', title: '不動産登記法', range: null },
  { slug: 'toshi-keikaku-ho', lawId: '343AC0000000100', title: '都市計画法', range: null },
  {
    slug: 'kenchiku-kijun-ho',
    lawId: '325AC0000000201',
    title: '建築基準法',
    // 総則(1-18)、単体規定(19-41)、集団規定(41の2-68の9)まで。
    // 第69条以降(建築協定・建築審査会・雑則・罰則)は宅建の出題がごく稀なため除外。
    range: [[1, 68]],
    note: '第1条〜第68条(総則・単体規定・集団規定)のみ収録。第69条以降(建築協定・建築審査会・雑則・罰則)は宅建試験での出題がごく稀なため除外。',
  },
  { slug: 'kokudo-riyo-keikaku-ho', lawId: '349AC1000000092', title: '国土利用計画法', range: null },
  { slug: 'nochi-ho', lawId: '327AC0000000229', title: '農地法', range: null },
  {
    slug: 'tochi-kukaku-seiri-ho',
    lawId: '329AC0000000119',
    title: '土地区画整理法',
    // 換地・仮換地・保留地が出題範囲。
    range: [[1, 110]],
    note: '第1条〜第110条(総則・施行者・事業計画・換地・仮換地・清算)のみ収録。第111条以降(費用負担・監督・雑則・罰則)は宅建試験での出題がごく稀なため除外。',
  },
  { slug: 'moridokisei-ho', lawId: '336AC0000000191', title: '宅地造成及び特定盛土等規制法', range: null },
  { slug: 'keihyo-ho', lawId: '337AC0000000134', title: '不当景品類及び不当表示防止法', range: null },
  { slug: 'chika-kojiho', lawId: '344AC0000000049', title: '地価公示法', range: null },
  {
    slug: 'jutaku-kinyu-shien-kiko-ho',
    lawId: '417AC0000000082',
    title: '独立行政法人住宅金融支援機構法',
    range: [[1, 30]],
    note: '第1条〜第30条(目的・業務範囲)のみ収録。宅建の免除科目で問われるのは機構の目的と業務(第4条・第13条)が中心のため。',
  },
  { slug: 'jutaku-kashi-tanpo-ho', lawId: '419AC0000000066', title: '特定住宅瑕疵担保責任の履行の確保等に関する法律', range: null },
  {
    slug: 'chihozei-ho',
    lawId: '325AC0000000226',
    title: '地方税法',
    // 不動産取得税(73〜73の40)と固定資産税(341〜437)のみ。
    range: [[73, 73], [341, 437]],
    note: '不動産取得税(第73条〜第73条の40)と固定資産税(第341条〜第437条)のみ収録。他の税目は宅建試験の出題対象外。',
  },
  {
    slug: 'shotokuzei-ho',
    lawId: '340AC0000000033',
    title: '所得税法',
    // 譲渡所得の定義まわり。特別控除・軽減税率の本体は租税特別措置法。
    range: [[33, 33], [38, 38], [22, 22]],
    note: '譲渡所得に関する第22条・第33条・第38条のみ収録。3,000万円特別控除や軽減税率の本体規定は租税特別措置法にあるため、そちらを参照すること。',
  },
  {
    slug: 'sozei-tokubetsu-sochi-ho',
    lawId: '332AC0000000026',
    title: '租税特別措置法',
    // 長短区分(31,32)・軽減税率(31の3)・3,000万円特別控除(35)・買換え(36の2)・
    // 住宅ローン控除(41)・住宅用家屋の登録免許税の軽減(72〜75)。
    // 第37条〜第40条(事業用資産の買換え・株式等・国外関係)は宅建の出題対象外のため除外。
    range: [[31, 36], [41, 41], [72, 75]],
    note: '宅建の税分野で問われる範囲のみ収録: 第31条〜第36条(長期・短期譲渡所得の課税の特例、居住用財産の3,000万円特別控除・軽減税率・買換え)、第41条(住宅借入金等特別控除)、第72条〜第75条(住宅用家屋等の登録免許税の税率の軽減)。第37条〜第40条(事業用資産の買換え・株式等の譲渡)は宅建試験の出題対象外のため除外。',
  },
  { slug: 'inshizei-ho', lawId: '342AC0000000023', title: '印紙税法', range: null },
  {
    slug: 'torokumenkyozei-ho',
    lawId: '342AC0000000035',
    title: '登録免許税法',
    range: [[1, 35]],
    note: '第1条〜第35条(課税範囲・納税義務者・課税標準・税率・非課税・還付)のみ収録。第36条以降(雑則・罰則)は宅建試験での出題がごく稀なため除外。',
  },
];

// ---------- API ----------

async function fetchLawData(lawId) {
  const cache = path.join(CACHE_DIR, `${lawId}.json`);
  if (existsSync(cache)) return JSON.parse(await readFile(cache, 'utf8'));
  const url = `https://laws.e-gov.go.jp/api/2/law_data/${lawId}?response_format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const json = await res.json();
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(cache, JSON.stringify(json));
  return json;
}

// ---------- 法令XMLツリー -> テキスト ----------

const text = (node) => {
  if (typeof node === 'string') return node;
  if (!node) return '';
  if (node.tag === 'Rt' || node.tag === 'Fig') return ''; // ルビの読み・図参照は本文ではない
  const kids = node.children || [];
  // Column(表形式の欄)は全角スペース区切り。区切らないと「宅地建物の敷地に…」のように語が繋がる
  const sep = kids.some((k) => typeof k === 'object' && k.tag === 'Column') ? '　' : '';
  // 表のセル内では号(Item)が連続するので改行で区切る(通常の条文描画は Item を通らない)
  const isListed = (k) => typeof k === 'object' && (k.tag === 'Item' || /^Subitem\d+$/.test(k.tag) || k.tag === 'Paragraph');
  return kids.map((k) => (isListed(k) ? `\n${text(k)}` : text(k))).join(sep);
};

const childrenOf = (node, tag) => (node.children || []).filter((c) => typeof c === 'object' && c.tag === tag);
const firstOf = (node, tag) => childrenOf(node, tag)[0];

// Sentence が複数 / Column を持つ場合も連結する
const sentenceText = (node) => text(node).trim();

function renderItem(node, depth) {
  const indent = '  '.repeat(depth);
  const title = sentenceText(firstOf(node, `${node.tag}Title`));
  const body = sentenceText(firstOf(node, `${node.tag}Sentence`));
  return [`${indent}- ${title}　${body}`.trimEnd(), ...renderSubStructures(node, depth + 1)].join('\n');
}

/** Item / Subitem / List / 表・様式・注記など、条項の下にぶら下がる構造を再帰的に描画する */
function renderSubStructures(node, depth) {
  const out = [];
  for (const c of node.children || []) {
    if (typeof c !== 'object') continue;
    if (c.tag === 'Item' || /^Subitem\d+$/.test(c.tag)) out.push(renderItem(c, depth));
    else if (c.tag === 'TableStruct') out.push(renderTable(c, depth));
    else if (c.tag === 'List') out.push(`${'  '.repeat(depth)}- ${sentenceText(firstOf(c, 'ListSentence'))}`);
    else if (c.tag === 'StyleStruct' || c.tag === 'NoteStruct' || c.tag === 'FigStruct' || c.tag === 'QuoteStruct') {
      const t = sentenceText(c);
      if (t) out.push(`${'  '.repeat(depth)}${t}`);
    }
  }
  return out.filter(Boolean);
}

function renderTable(node, depth) {
  const indent = '  '.repeat(depth);
  const table = firstOf(node, 'Table');
  if (!table) return '';
  const rows = childrenOf(table, 'TableRow').map((row) =>
    childrenOf(row, 'TableColumn').map((c) => {
      // セル内の兄弟 Sentence(号の列挙)は改行で区切る。連結すると「一　住宅二　住宅で…」になる
      const parts = (c.children || []).map((k) => text(k).trim()).filter(Boolean);
      return parts.join('\n').replace(/\|/g, '\\|').replace(/\n+/g, '<br>');
    }),
  );
  if (!rows.length) return '';
  const line = (cells) => `${indent}| ${cells.join(' | ')} |`;
  // Markdown の表として描画するため、1行目をヘッダー扱いして区切り行を入れる
  return [line(rows[0]), line(rows[0].map(() => '---')), ...rows.slice(1).map(line)].join('\n');
}

function renderParagraph(node, only) {
  const num = sentenceText(firstOf(node, 'ParagraphNum'));
  const caption = sentenceText(firstOf(node, 'ParagraphCaption'));
  const body = sentenceText(firstOf(node, 'ParagraphSentence'));
  const lines = [];
  if (caption) lines.push(caption);
  const prefix = only || !num ? '' : `${num}　`;
  lines.push(`${prefix}${body}`);
  lines.push(...renderSubStructures(node, 0));
  return lines.join('\n\n');
}

function renderArticle(node) {
  const title = sentenceText(firstOf(node, 'ArticleTitle'));
  const caption = sentenceText(firstOf(node, 'ArticleCaption'));
  const paragraphs = childrenOf(node, 'Paragraph');
  const heading = `### ${title}${caption ? `　${caption}` : ''}`;
  const body = paragraphs.map((p) => renderParagraph(p, paragraphs.length === 1)).join('\n\n');
  return `${heading}\n\n${body}\n`;
}

/** 主番号を返す。Num="5_2"(第5条の2) -> 5, Num="73_14" -> 73 */
const mainNum = (node) => parseInt(String(node.attr?.Num ?? '').split(/[_:]/)[0], 10);

const inRange = (n, range) => range === null || range.some(([a, b]) => n >= a && n <= b);

/** MainProvision を走査して見出し(編・章・節)と条文の Markdown を組み立てる */
function renderBody(root, range) {
  const out = [];
  let count = 0;
  const walk = (node, headingStack) => {
    for (const child of node.children || []) {
      if (typeof child !== 'object') continue;
      if (child.tag === 'Article') {
        if (!inRange(mainNum(child), range)) continue;
        // 直前の未出力の見出しをフラッシュ
        for (const h of headingStack) if (!h.emitted) { out.push(h.md); h.emitted = true; }
        out.push(renderArticle(child));
        count += 1;
      } else if (/^(Part|Chapter|Section|Subsection|Division)$/.test(child.tag)) {
        const title = sentenceText(firstOf(child, `${child.tag}Title`));
        walk(child, [...headingStack, { md: `## ${title}\n`, emitted: false }]);
      }
    }
  };
  walk(root, []);
  return { md: out.join('\n'), count };
}

// ---------- Markdown 生成 ----------

function buildMarkdown(law, data, fetchedAt) {
  const info = data.law_info;
  const rev = data.revision_info;
  const body = firstOf(data.law_full_text, 'LawBody');
  const main = firstOf(body, 'MainProvision');
  const { md, count } = renderBody(main, law.range);

  // 別表(建築基準法 別表第二の用途制限、印紙税法 別表第一の課税物件表など)は宅建の頻出範囲なので収録する
  const appendices = childrenOf(body, 'AppdxTable').map((a) => {
    const title = sentenceText(firstOf(a, 'AppdxTableTitle'));
    const related = sentenceText(firstOf(a, 'RelatedArticleNum'));
    return `## ${title}${related ? `　${related}` : ''}\n\n${childrenOf(a, 'TableStruct').map((t) => renderTable(t, 0)).join('\n\n')}\n`;
  });
  const appendixMd = appendices.length ? `\n${appendices.join('\n')}` : '';

  const header = [
    `# ${rev.law_title}`,
    '',
    '| | |',
    '|---|---|',
    `| 法令番号 | ${info.law_num} |`,
    `| 法令ID | \`${info.law_id}\` |`,
    `| 公布日 | ${info.promulgation_date} |`,
    `| 収録版(施行日) | ${rev.amendment_enforcement_date}(改正: ${rev.amendment_law_num ?? '—'}) |`,
    `| 出典 | e-Gov法令検索 https://laws.e-gov.go.jp/law/${info.law_id} |`,
    `| 取得日 | ${fetchedAt} |`,
    `| 収録条文数 | ${count} 条 |`,
    '',
    law.note
      ? `> **収録範囲を絞っています。** ${law.note}\n>\n> 全文は上記 e-Gov のリンクを参照してください。`
      : '> 本則の全条文を収録しています。',
    '',
    `> 附則は収録していません。${appendices.length ? '別表は末尾に収録しています。' : ''}`,
    '',
    '> 条文本文は e-Gov 法令API v2 の出力をそのまま転記しており、改変していません。',
    '',
    '---',
    '',
  ].join('\n');

  return { md: header + md + appendixMd, count };
}

// ---------- main ----------

async function main() {
  const argv = process.argv.slice(2);
  const tocMode = argv.includes('--toc');
  const filters = argv.filter((a) => a !== '--toc');
  const targets = filters.length
    ? LAWS.filter((l) => filters.some((f) => l.slug === f || l.title.includes(f)))
    : LAWS;
  if (!targets.length) throw new Error(`該当する法令がありません: ${filters.join(', ')}`);

  const fetchedAt = new Date().toISOString().slice(0, 10);
  await mkdir(OUT_DIR, { recursive: true });

  for (const law of targets) {
    let data;
    try {
      data = await fetchLawData(law.lawId);
    } catch (err) {
      console.error(`[NG] ${law.title}: ${err.message}`);
      continue;
    }

    if (tocMode) {
      const main = firstOf(firstOf(data.law_full_text, 'LawBody'), 'MainProvision');
      const walk = (n) => {
        for (const c of n.children || []) {
          if (typeof c !== 'object') continue;
          if (c.tag === 'Article') {
            console.log(`${c.attr.Num}\t${sentenceText(firstOf(c, 'ArticleTitle'))}\t${sentenceText(firstOf(c, 'ArticleCaption'))}`);
          } else walk(c);
        }
      };
      walk(main);
      continue;
    }

    const { md, count } = buildMarkdown(law, data, fetchedAt);
    const file = path.join(OUT_DIR, `${law.slug}.md`);
    await writeFile(file, md);
    console.log(`[OK] ${law.title}\t${count} 条\t-> content/reference/${law.slug}.md`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
