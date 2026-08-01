import { Diagram, type DiagramInput } from './Diagram'
import './gallery.css'

/**
 * 全typeを並べる開発用プレビュー。/diagram.html で見る(本番ビルドには入れない)。
 * 会話ウィンドウ内(sm)と復習画面(lg)の両方で破綻しないかを並べて確認する。
 */
const SAMPLES: { note: string; spec: DiagramInput }[] = [
  {
    note: '法定相続分 — 夫が亡くなり、妻と子2人が相続する',
    spec: { type: 'parties', labels: ['夫(亡)', '妻', '長男', '長女'] },
  },
  {
    note: '売主・買主・仲介の三者',
    spec: { type: 'parties', labels: ['売主', '買主', 'ひばり不動産'] },
  },
  {
    note: '法定相続分の割合',
    spec: { type: 'ratio', labels: ['妻', '長男', '長女'], values: [50, 25, 25] },
  },
  {
    note: '建蔽率60% / 容積率200%',
    spec: { type: 'area', labels: [], values: [60, 200] },
  },
  {
    note: 'クーリングオフは書面を受け取った日から8日',
    spec: { type: 'timeline', labels: ['申込み', 'クーリングオフ期限'], values: [0, 8] },
  },
  {
    note: '3つの時点があるとき',
    spec: {
      type: 'timeline',
      labels: ['契約', '手付解除の期限', '引渡し'],
      values: [0, 14, 30],
    },
  },
  {
    note: '入居時に払うお金の内訳',
    spec: {
      type: 'money',
      labels: ['借主', '貸主', '敷金', '礼金', '仲介手数料'],
      values: [8, 4, 4],
    },
  },
  {
    note: '手付金だけを払う',
    spec: { type: 'money', labels: ['買主', '売主'], values: [200] },
  },
  {
    note: '隣地との境界と接道',
    spec: { type: 'land', labels: ['自分の土地', '隣地'], values: [120, 95] },
  },
  {
    note: '区分所有の専有部分',
    spec: {
      type: 'floorplan',
      labels: ['居室', '寝室', '台所', '浴室'],
      values: [16, 10, 8, 4],
    },
  },
]

export function DiagramGallery() {
  return (
    <main className="gal">
      <header className="gal-head">
        <h1>宅建story ─ 図解デザイン</h1>
        <p>「ハゲ田の野帳」。方眼紙にドット絵で描く。docs/DESIGN.md 参照。</p>
      </header>

      {SAMPLES.map((s, i) => (
        <section className="gal-row" key={i}>
          <h2>
            <code>{s.spec.type}</code> {s.note}
          </h2>
          <div className="gal-pair">
            <div className="gal-col">
              <span className="gal-cap">会話ウィンドウ内 (sm)</span>
              <div className="gal-dialogue">
                <Diagram spec={s.spec} />
                <p className="gal-line">
                  いいか新人、ここが肝心なところだ。よく見ておけよ。
                </p>
              </div>
            </div>
            <div className="gal-col">
              <span className="gal-cap">復習画面 (lg)</span>
              <div className="gal-memo">
                <Diagram spec={s.spec} size="lg" />
              </div>
            </div>
          </div>
        </section>
      ))}
    </main>
  )
}
