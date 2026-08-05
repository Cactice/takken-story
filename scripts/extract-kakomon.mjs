#!/usr/bin/env node
/**
 * kakomon/*.pdf を1問ずつ切り出して kakomon/json/<年度>.json に書き出す。
 *
 * テキスト層があるPDF(令和5年以降)は pdftotext、
 * 無いもの(平成24年〜令和4年)は 300dpi で画像にしてから tesseract の日本語OCR。
 *
 * **問題文には著作権がある。kakomon/ は .gitignore 済みで、コミットしない。**
 * 傾向を測るためだけに使う。
 *
 *   node scripts/extract-kakomon.mjs          # 全年度
 *   node scripts/extract-kakomon.mjs R06 H30  # 年度を指定
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(ROOT, 'kakomon')
const OUT = path.join(DIR, 'json')

/** テキスト層があるか(日本語が十分に取れるか)で読み方を変える */
function hasTextLayer(pdf) {
  try {
    const t = execFileSync('pdftotext', [pdf, '-'], { encoding: 'utf8', maxBuffer: 1 << 28 })
    return (t.match(/[぀-ヿ一-龠]/g) ?? []).length > 3000
  } catch {
    return false
  }
}

function readWithText(pdf) {
  return execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8', maxBuffer: 1 << 28 })
}

function readWithOcr(pdf, label) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kakomon-'))
  try {
    execFileSync('pdftoppm', ['-r', '300', '-gray', '-png', pdf, path.join(tmp, 'p')])
    const pages = fs.readdirSync(tmp).filter((f) => f.endsWith('.png')).sort()
    const out = []
    for (const [i, f] of pages.entries()) {
      process.stdout.write(`\r  ${label}: OCR ${i + 1}/${pages.length}`)
      const base = path.join(tmp, 'out')
      execFileSync('tesseract', [path.join(tmp, f), base, '-l', 'jpn', '--psm', '6'], {
        stdio: ['ignore', 'ignore', 'ignore'],
      })
      out.push(fs.readFileSync(`${base}.txt`, 'utf8'))
    }
    process.stdout.write('\r')
    return out.join('\n')
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

/** 「【問 1】…」で切って、設問ごとに { no, body, choices } にする */
function splitQuestions(text) {
  const norm = text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    // 行頭の余白を落とす。-layout も OCR も左に大きく空きが入る
    .split('\n')
    .map((l) => l.replace(/^[ \t\u3000]+/, '').replace(/[ \t\u3000]+$/, ''))
    .join('\n')
    // 「【問 1】」「問1」「間 1」の揺れを吸収して、必ず行頭に置く
    .replace(/【?[間問]\s*(\d{1,2})\s*】/g, '\n@@Q$1@@ ')

  const parts = norm.split(/\n@@Q(\d{1,2})@@/)
  const qs = []
  for (let i = 1; i < parts.length; i += 2) {
    const no = Number(parts[i])
    const raw = (parts[i + 1] ?? '').trim()
    if (!Number.isInteger(no) || no < 1 || no > 50 || raw.length < 40) continue
    if (qs.some((q) => q.no === no)) continue

    // 全角の 1〜4 と、行頭に単独で置かれた 1〜4 を選択肢の目印にする
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)
    const body = []
    const choices = []
    for (const l of lines) {
      const m = l.match(/^([1-4])\s+(\S.*)$/)
      // 次に来るべき番号のときだけ選択肢として開く(本文中の数字を拾わない)
      if (m && Number(m[1]) === choices.length + 1) {
        choices.push(m[2])
      } else if (choices.length === 0) {
        body.push(l)
      } else {
        choices[choices.length - 1] += l
      }
    }
    qs.push({ no, body: body.join(''), choices })
  }
  return qs.sort((a, b) => a.no - b.no)
}

const only = process.argv.slice(2)
fs.mkdirSync(OUT, { recursive: true })
const files = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.pdf'))
  .filter((f) => only.length === 0 || only.includes(path.basename(f, '.pdf')))
  .sort()

for (const f of files) {
  const year = path.basename(f, '.pdf')
  const pdf = path.join(DIR, f)
  const dest = path.join(OUT, `${year}.json`)
  if (fs.existsSync(dest)) {
    console.log(`${year}: 済み(${JSON.parse(fs.readFileSync(dest, 'utf8')).questions.length}問)`)
    continue
  }
  const withText = hasTextLayer(pdf)
  const text = withText ? readWithText(pdf) : readWithOcr(pdf, year)
  const questions = splitQuestions(text)
  fs.writeFileSync(
    dest,
    `${JSON.stringify({ year, source: withText ? 'pdftotext' : 'ocr', questions }, null, 2)}\n`,
  )
  console.log(`${year}: ${questions.length}問 (${withText ? 'テキスト層' : 'OCR'})`)
}
