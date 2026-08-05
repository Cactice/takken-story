#!/usr/bin/env node
/**
 * 過去問PDF(.cache/kakomon/)を読んで、論点ごとの出題回数を数える。
 *
 * **問題文そのものはリポジトリに残さない。**著作権があるので、
 * ここで出すのは「どの論点が何回出たか」という数字だけ。
 * 出力は docs/kakomon-freq.md。
 *
 *   npm i -D pdf-parse    (未導入なら)
 *   node scripts/analyze-kakomon.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(ROOT, '.cache/kakomon')

/** 論点id → 本文に出たら1票入れる手がかり。順番に見て最初に当たったものを採る */
const CLUES = {
  'gyoho-menkyo': ['免許を受け', '免許換え', '免許の更新', '免許を取得'],
  'gyoho-takkenshi': ['宅地建物取引士証', '専任の宅地建物取引士', '取引士の登録'],
  'gyoho-baikai': ['媒介契約', '専任媒介', '専属専任媒介', '指定流通機構'],
  'gyoho-juyojiko': ['重要事項の説明', '第三十五条', '35条'],
  'gyoho-37jo': ['第三十七条', '37条書面'],
  'gyoho-cooling': ['クーリング・オフ', '事務所等以外の場所'],
  'gyoho-tetsuke-seigen': ['手付の額', '代金の額の十分の二を超える手付'],
  'gyoho-tetsuke-hozen': ['手付金等の保全'],
  'gyoho-tanpo-tokuyaku': ['担保責任についての特約', '契約不適合を担保すべき責任に関する特約'],
  'gyoho-baishou-yotei': ['損害賠償額の予定', '違約金'],
  'gyoho-tanin-bukken': ['自己の所有に属しない'],
  'gyoho-shoyuken-ryuho': ['所有権留保', '割賦販売'],
  'gyoho-hoshu': ['報酬', '報酬額の制限'],
  'gyoho-eigyo-hosho': ['営業保証金'],
  'gyoho-hosho-kyokai': ['保証協会', '弁済業務保証金'],
  'gyoho-kokoku': ['誇大広告', '広告の開始時期', '取引態様'],
  'gyoho-jimusho': ['案内所', '標識'],
  'gyoho-kantoku': ['指示処分', '業務停止', '免許の取消し', '聴聞'],
  'gyoho-kashi-tanpo': ['住宅販売瑕疵担保保証金', '資力確保'],
  'gyoho-meibo': ['従業者名簿', '帳簿', '従業者証明書'],
  'gyoho-fujitsu': ['故意に事実を告げず', '不実のことを告げる'],

  'minpo-seinen': ['制限行為能力者', '未成年者', '成年被後見人'],
  'minpo-ishihyoji': ['意思表示', '錯誤', '詐欺又は強迫'],
  'minpo-dairi': ['代理', '無権代理', '表見代理'],
  'minpo-jiko': ['時効', '取得時効', '消滅時効'],
  'minpo-bukken-hendo': ['物権変動', '対抗することができない', '二重譲渡'],
  'minpo-teito': ['抵当権', '根抵当'],
  'minpo-baibai': ['手付', '売買契約の解除'],
  'minpo-tanpo': ['契約不適合', '担保責任'],
  'minpo-chintai': ['賃貸借', '敷金', '転貸'],
  'minpo-furikou': ['債務不履行', '履行遅滞', '解除'],
  'minpo-souzoku': ['相続', '遺言', '遺留分'],
  'minpo-kyoyu': ['共有'],
  'minpo-fuhoukoui': ['不法行為', '使用者責任'],
  'minpo-hosho': ['保証', '連帯保証', '保証人'],
  shakuchi: ['借地権', '建物buy取請求', '建物買取請求'],
  shakka: ['建物の賃貸借', '定期建物賃貸借', '造作買取'],
  'kubun-shoyu': ['区分所有', '管理組合', '規約'],
  'toki-ho': ['登記', '仮登記', '筆界'],

  'hourei-toshikeikaku': ['都市計画', '市街化区域', '市街化調整区域', '地域地区'],
  'hourei-kaihatsu': ['開発許可', '開発行為'],
  'hourei-yoto': ['用途地域', '用途制限'],
  'hourei-kenpei': ['建蔽率', '建ぺい率', '容積率'],
  'hourei-takasa': ['高さの限度', '斜線制限', '日影'],
  'hourei-boka': ['防火地域', '準防火地域', '耐火建築物'],
  'hourei-kenchiku-kakunin': ['建築確認', '確認済証'],
  'hourei-kukaku': ['土地区画整理', '仮換地', '換地処分'],
  'hourei-nochi': ['農地法', '農地の転用'],
  'hourei-moridokisei': ['宅地造成', '盛土', '特定盛土'],
  'hourei-kokudo': ['国土利用計画法', '事後届出'],

  'zei-koteishisan': ['固定資産税'],
  'zei-futokuzei': ['不動産取得税'],
  'zei-inshi': ['印紙税'],
  'zei-touroku': ['登録免許税'],
  'zei-shotoku': ['譲渡所得', '特別控除', '譲渡した場合'],
  'zei-jutaku-loan': ['住宅借入金等特別控除', '住宅ローン控除'],
  'sonota-chika': ['地価公示', '公示価格'],
  'sonota-kantei': ['不動産の鑑定評価', '鑑定評価'],
  'sonota-keihin': ['不当景品類', '公正競争規約'],
  'sonota-kiko': ['住宅金融支援機構'],
  'sonota-toukei': ['地価公示によれば', '建築着工統計'],
  'sonota-tochi': ['土地に関する次の記述', '宅地として'],
  'sonota-tatemono': ['建物の構造', '木造', '鉄筋コンクリート'],
}

async function readPdf(file) {
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: new Uint8Array(fs.readFileSync(file)) })
  const r = await parser.getText()
  await parser.destroy()
  return r.text
}

const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.endsWith('.pdf')).sort() : []
if (files.length === 0) {
  console.error('.cache/kakomon/ にPDFがありません')
  process.exit(1)
}

const count = {}
const perYear = {}
for (const f of files) {
  const year = path.basename(f, '.pdf')
  let text
  try {
    text = await readPdf(path.join(DIR, f))
  } catch (e) {
    console.error(`${year}: 読めません (${e.message})`)
    continue
  }
  // 「問 1」〜「問 50」で切って、設問ごとに1論点だけ数える
  const blocks = text.split(/【問\s*\d+】|問\s*\d{1,2}\s/)
  perYear[year] = 0
  for (const b of blocks) {
    if (b.length < 80) continue
    for (const [id, clues] of Object.entries(CLUES)) {
      if (clues.some((c) => b.includes(c))) {
        count[id] = (count[id] ?? 0) + 1
        perYear[year]++
        break
      }
    }
  }
  console.log(`${year}: ${perYear[year]}問を分類`)
}

const rows = Object.entries(count).sort((a, b) => b[1] - a[1])
const out = [
  '# 過去問15年の論点別出題回数',
  '',
  '`.cache/kakomon/` の試験問題PDFを機械的に数えたもの。',
  '**問題文そのものはリポジトリに置いていない。**著作権があるので、傾向を測るためだけに使う。',
  '',
  `対象: ${files.map((f) => path.basename(f, '.pdf')).join(' / ')}`,
  '',
  '手がかりの語で1設問1論点に振り分けているので、**概数**として読むこと。',
  '',
  '| 論点 | 出題回数 |',
  '|---|---|',
  ...rows.map(([id, n]) => `| \`${id}\` | ${n} |`),
  '',
]
fs.writeFileSync(path.join(ROOT, 'docs/kakomon-freq.md'), `${out.join('\n')}\n`)
console.log(`\ndocs/kakomon-freq.md を生成: ${rows.length}論点`)
