import { useEffect, useMemo, useState } from 'react'
import {
  KIND_JA, ageAt, atAge, cast, castOf, eventsOf, familyList,
  foreshadow, generations, topicList, topicOf, type Line, type StoryEvent,
} from './story'
import { Person } from './Person'
import { Gloss, TERMS } from './Gloss'
import { Lesson, Figure } from './Lesson'
import { lessonOf } from './lessons'
import { fetchQuestion, pickClosest, pickRandom, type Question, type QueryPart } from './kakomon'

type Tab = 'story' | 'cast' | 'topics' | 'gloss'
type Go = (tab: Tab, id?: string) => void

// URL でも行き来できるようにする。ルータは要らない。パスを見て出し分けるだけ。
// 2つ目の区切りは、その画面で開くものの id。イベントidは物語の中で一意なのでそのまま使う
const BASE = import.meta.env.BASE_URL
const PATH: Record<Tab, string> = { story: 'monogatari', cast: 'jinbutsu', topics: 'ronten', gloss: 'yougo' }
type Route = { tab: Tab; id: string | null }
const routeOf = (p: string): Route => {
  const [head, id] = p.replace(BASE, '').replace(/^\/|\/$/g, '').split('/')
  const tab = (Object.keys(PATH) as Tab[]).find((t) => PATH[t] === head) ?? 'story'
  return { tab, id: id || null }
}
export const linkTo = (tab: Tab, id?: string) => BASE + PATH[tab] + (id ? `/${id}` : '')

export function Viewer() {
  const [route, setRoute] = useState<Route>(() => routeOf(window.location.pathname))
  const go = (tab: Tab, id?: string) => {
    setRoute({ tab, id: id ?? null })
    window.history.pushState(null, '', linkTo(tab, id))
  }
  /** タブを移ったら、狭い画面ではまず一覧を出す。何があるか分からないまま中身だけ出ても困る */
  const goTab = (t: Tab) => { go(t); setListOpen(true) }
  useEffect(() => {
    const back = () => setRoute(routeOf(window.location.pathname))
    window.addEventListener('popstate', back)
    return () => window.removeEventListener('popstate', back)
  }, [])
  const { tab } = route
  // 狭い画面では一覧と詳細を切り替える。広い画面ではこの状態は効かない。
  // 何も選ばれていなければ一覧から始める
  const [listOpen, setListOpen] = useState(() => !routeOf(window.location.pathname).id)
  const pane = listOpen ? 'list-open' : 'list-closed'

  // URL にイベントidがあれば、その世代のその回を開く
  const found = route.tab === 'story' && route.id
    ? [1, 2, 3, 4, 5].flatMap((g) => eventsOf[g].map((e, i) => ({ g, i, e }))).find((x) => x.e.id === route.id)
    : null
  const [gen, setGen] = useState(found?.g ?? 1)
  const [pick, setPick] = useState(found?.i ?? 0)
  useEffect(() => {
    if (found) { setGen(found.g); setPick(found.i) }
  }, [found?.e.id])

  const events = eventsOf[gen]
  const ev = events[Math.min(pick, events.length - 1)]

  return (
    <div className="app">
      <header>
        <h1>宅建story</h1>
        <nav>
          {(['story', 'cast', 'topics', 'gloss'] as Tab[]).map((t) => (
            <button key={t} className={tab === t ? 'on' : ''} onClick={() => goTab(t)}>
              {{ story: '物語', cast: 'キャラクター', topics: '論点', gloss: '用語' }[t]}
            </button>
          ))}
        </nav>
      </header>
      {tab !== 'gloss' && (
      <button
        className="listtoggle"
        onClick={() => setListOpen(!listOpen)}
        aria-label={listOpen ? '一覧を閉じる' : '一覧を開く'}
        aria-expanded={listOpen}
      >
        {listOpen ? (
          <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden>
            <path d="M4 4 16 16M16 4 4 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden>
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        )}
      </button>
      )}

      {tab === 'story' && (
        <div className={`split ${pane}`}>
          <aside>
            {/* 世代は横に並べる。縦に積むと、一覧を開くたび5行ぶん場所を取る */}
            <div className="gentabs">
              {generations.map((g) => (
                <button key={g.gen} className={gen === g.gen ? 'on' : ''}
                  onClick={() => { setGen(g.gen); setPick(0); go('story', eventsOf[g.gen][0]?.id) }}>
                  <b>{g.kanji}</b>
                  <small>{g.gen}</small>
                </button>
              ))}
            </div>
            <ol className="events">
              {events.map((e, i) => (
                <li key={e.id}>
                  <button className={i === pick ? 'on' : ''}
                    onClick={() => { setPick(i); go('story', e.id); setListOpen(false) }}>
                    <time>{e.year}/{e.month}</time>
                    <span className={`kind k-${e.kind}`}>{KIND_JA[e.kind] ?? e.kind}</span>
                    <b>{e.title}</b>
                    {!e.quiz && <em>問題なし</em>}
                  </button>
                </li>
              ))}
            </ol>
          </aside>
          <main>
            <GenHead gen={gen} />
            {ev && <Scene ev={ev} go={go} />}
          </main>
        </div>
      )}

      {tab === 'cast' && <Cast pane={pane} close={() => setListOpen(false)} go={go} />}
      {tab === 'topics' && <Topics route={route} go={go} pane={pane} close={() => setListOpen(false)} />}
      {tab === 'gloss' && <Glossary go={go} />}
    </div>
  )
}

function GenHead({ gen }: { gen: number }) {
  const g = generations.find((x) => x.gen === gen)!
  const yen = (n: number) => (n >= 100000000 ? `${n / 100000000}億` : `${n / 10000}万`)
  return (
    <section className="genhead">
      <h2>
        <span className="kanji">{g.kanji}</span>
        第{g.gen}世代 ｜ {g.stage} ｜ {g.startYear}年〜
      </h2>
      <p className="facts">
        目標 {yen(g.goal)} ／ 所持金 {yen(g.startMoney)} ／ 指導役 {castOf.get(g.mentor)?.name ?? g.mentor}
        ／ 増える稼ぎ方 <b>{g.unlock}</b> ／ トーン {g.tone}
      </p>
      <details>
        <summary>あらすじと、ここで蒔く種</summary>
        <p className="synopsis">{g.synopsis.replace(/\*\*/g, '')}</p>
        <ul className="seeds">{g.seeds.map((s) => <li key={s}>{s}</li>)}</ul>
        <ul className="seeds">
          {foreshadow.filter((f) => f.from === g.gen).map((f, i) => (
            <li key={i}>{f.what} → <b>第{f.to.join('・')}世代</b>：{f.effect}</li>
          ))}
        </ul>
      </details>
    </section>
  )
}

function Scene({ ev, go }: { ev: StoryEvent; go: Go }) {
  const topic = ev.topicId ? topicOf.get(ev.topicId) : null
  // 台本に「ここで問う」の目印があれば、その位置で切る。
  // 無ければ、説明の手前で切る(目印を置く前の書き方に合わせる)
  // 台本の「ここで問う」の目印で前後に切る。目印が無ければ全部が前
  const at = ev.lines.findIndex((l) => l.role === 'quiz')
  const before = at < 0 ? ev.lines : ev.lines.slice(0, at)
  const after = at < 0 ? [] : ev.lines.slice(at + 1)

  const Row = ({ l, i, prev }: { l: Line; i: number; prev?: Line }) => {
    if (l.role === 'figure') {
      // 図は論点の解説から借りる。同じ話に二つの絵があると、覚えるものが増える
      const src = l.panel ?? lessonOf.get(l.topicId ?? ev.topicId ?? '')?.panels[l.use ?? 0]
      return src ? (
        <li className="figrow">
          <div className="advice"><Figure panel={src} /></div>
        </li>
      ) : null
    }
    const c = castOf.get(l.who ?? '')
    const same = prev?.who === l.who
    return (
      <li className={same ? 'same' : ''}>
        <span className="face">
          {!same && <Person id={c?.id} family={c?.family} gender={c?.gender} age={ageAt(c, ev.year)} seed={i} size={44} head />}
        </span>
        <span className="who">{same ? '' : c?.name ?? l.who ?? ''}</span>
        <p>{l.text}</p>
      </li>
    )
  }

  return (
    <article className="scene">
      <h3><time>{ev.year}/{ev.month}</time> {ev.title}</h3>
      <ol className="lines">
        {before.map((l, i) => <Row key={i} l={l} i={i} prev={before[i - 1]} />)}
      </ol>
      {ev.quiz ? <Quiz key={`q-${ev.id}`} quiz={ev.quiz} /> : <p className="todo">この回はまだ問題ができていない。</p>}
      {after.length > 0 && (
        <ol className="lines answer">
          {after.map((l, i) => <Row key={i} l={l} i={i} prev={after[i - 1]} />)}
        </ol>
      )}
      {topic && (
        <p className="jump">
          この回の論点 <a href={linkTo('topics', topic.id)}
            onClick={(e) => { e.preventDefault(); go('topics', topic.id) }}>{topic.name}</a>
          の解説を読む
        </p>
      )}
      {topic && (
        <Kakomon key={`k-${ev.id}`} topic={topic} query={queryOf(ev, topic.name)} source={ev.quiz?.source} />
      )}
    </article>
  )
}

function Quiz({ quiz }: { quiz: NonNullable<StoryEvent['quiz']> }) {
  // picked = まだ押していない状態は null。押したら答え合わせと解説を出す。
  const [picked, setPicked] = useState<number | null>(null)
  const [open, setOpen] = useState(false)
  const done = picked != null

  return (
    <section className="quiz">
      <p className="q">{quiz.question}</p>
      {quiz.choices?.length ? (
        <>
        <ol className="choices">
          {quiz.choices.map((c, i) => {
            const right = i === quiz.answer
            return (
              <li key={i} className={[done && (right ? 'right' : 'wrong'), picked === i && 'picked']
                .filter(Boolean).join(' ')}>
                <button onClick={() => setPicked(i)} disabled={done} aria-pressed={picked === i}>
                  {/* 押す前は番号、押したあとは ○×。色ではなく記号で伝える */}
                  <span className="mark">{done ? (right ? '○' : '×') : `${i + 1}.`}</span>
                  <span>{c}</span>
                  {done && <span className="sr">{right ? '正解' : '不正解'}</span>}
                </button>
              </li>
            )
          })}
        </ol>
        </>
      ) : null}

      {done && (
        <p className="verdict">
          {picked === quiz.answer ? '○ 正解' : `× 不正解 ── 正しいのは ${(quiz.answer ?? 0) + 1} 番`}
        </p>
      )}
      {!quiz.choices?.length && (
        <button onClick={() => setOpen(!open)}>{open ? '閉じる' : '答えと解説'}</button>
      )}
      {done && <button onClick={() => setPicked(null)}>選び直す</button>}
    </section>
  )
}

/** 近さを測るための検索文。問題文を厚めに、セリフや題・論点名も混ぜる。 */
const queryOf = (ev: StoryEvent, topicName: string): QueryPart[] => [
  [ev.quiz?.question ?? '', 2],
  [ev.quiz?.choices?.join('') ?? '', 1],
  [ev.title, 1],
  [ev.lines.map((l) => l.text).join(''), 1],
  [topicName, 1],
]

type Topic = { id: string; name: string; kakomonCount: number; kakomon: string[] }

/** 本物の過去問。答えは選んでから出す。最初から見えていると考えずに読んでしまう */
function RealQ({ q }: { q: Question }) {
  const [chose, setChose] = useState<number | null>(null)
  const right = q.answer
  return (
    <div className="real">
      <b>{q.ref}</b>
      <p><Gloss>{q.body}</Gloss></p>
      <ol>
        {q.choices.map((c, i) => {
          const n = i + 1
          const shown = chose != null
          return (
            <li key={i} className={shown && n === right ? 'right' : ''}>
              {/* 中に用語ボタンが入るので button にはできない。入れ子の button は無効なHTML */}
              <div
                className="pick"
                role="button"
                tabIndex={shown ? -1 : 0}
                aria-disabled={shown}
                onClick={() => !shown && setChose(n)}
                onKeyDown={(e) => {
                  if (shown) return
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setChose(n) }
                }}
              >
                <span className="mark">
                  {!shown ? `${n}.` : right == null ? '—' : n === right ? '○' : '×'}
                </span>
                <span><Gloss>{c}</Gloss></span>
              </div>
            </li>
          )
        })}
      </ol>
      {chose != null && (
        <p className="note">
          {right == null
            ? 'この問は正解が一つに決まっていません(全員正解など)。'
            : `${chose === right ? '○ 正解' : `× 不正解 ── 正しいのは ${right} 番`}（出題元の正解番号表より）`}
          <button className="roll" onClick={() => setChose(null)}>選び直す</button>
        </p>
      )}
    </div>
  )
}

/**
 * 過去問を3問出す。物語では「近い順」、論点では「転がして適当に」。
 * 論点のほうは同じ問ばかり見ても仕方ないので、押すたび引き直す。
 */
function Kakomon(
  { topic, query, mode = 'closest', source }:
  { topic: Topic; query?: QueryPart[]; mode?: 'closest' | 'random'; source?: string },
) {
  const [items, setItems] = useState<Question[]>([])
  const [done, setDone] = useState(false)
  const [roll, setRoll] = useState(0)
  useEffect(() => {
    let alive = true
    setDone(false)
    // もとにした過去問を必ず先頭に置く。残りは近い順で埋める
    const p = mode === 'random'
      ? pickRandom(topic.kakomon, 3)
      : Promise.all([
          source ? fetchQuestion(source) : null,
          pickClosest(query ?? [], topic.kakomon, 4),
        ]).then(([first, rest]) => {
          const others = rest.filter((q) => q.ref !== first?.ref)
          return first ? [first, ...others].slice(0, 3) : others.slice(0, 3)
        })
    p.then((qs) => { if (alive) { setItems(qs); setDone(true) } })
    return () => { alive = false }
    // query は毎回新しい配列になるので、依存に入れず key に任せる
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, mode, roll, source])

  return (
    <section className="kakomon">
      <p className="head">
        論点 <code>{topic.id}</code>（{topic.name}）／ 過去15年で {topic.kakomonCount}問
        <br />
        {mode === 'random'
          ? 'この論点から3問。'
          : source ? 'いちばん上が、この回の問題のもとにした過去問。' : 'この回にいちばん近い3問。'}
        {mode === 'random' && (
          <button className="roll" onClick={() => setRoll(roll + 1)}>別の3問を引く</button>
        )}
      </p>
      {items.length ? items.map((item) => (
        <RealQ key={item.ref} q={item} />
      )) : done && <p className="todo">この論点の過去問は、手元に本文が無いので出せません。</p>}
    </section>
  )
}

function Cast({ pane, close, go }: { pane: string; close: () => void; go: Go }) {
  const [open, setOpen] = useState<string | null>(null)
  const members = useMemo(() => {
    const m = new Map<string, typeof cast>()
    for (const c of cast) m.set(c.family ?? '—', [...(m.get(c.family ?? '—') ?? []), c])
    for (const [, cs] of m) cs.sort((a, b) => (a.birthYear ?? 0) - (b.birthYear ?? 0))
    return m
  }, [])
  const person = cast.find((c) => c.id === open)

  return (
    <div className={`withpane ${pane}`}>
      <div className="families">
        {familyList.map((f) => (
          <section key={f.id}>
            <h3>
              <span className="sw" style={{ background: f.cloth.base, borderColor: f.cloth.accent }} />
              {f.id}家 <small>{f.cloth.why}</small>
            </h3>
            <p>{f.story.replace(/\*\*/g, '')}</p>
            <div className="grid">
              {(members.get(f.id) ?? []).map((c, i) => (
                <figure key={c.id} className={open === c.id ? 'on' : ''}>
                  <button onClick={() => { setOpen(open === c.id ? null : c.id); close() }}>
                    <Person id={c.id} family={c.family} gender={c.gender} age={30} seed={i * 1.7} size={104} />
                    <figcaption>
                      <b>{c.name}</b>
                      <small>{c.birthYear}年生 ／ 第{c.appearsIn.join('・')}世代</small>
                    </figcaption>
                  </button>
                </figure>
              ))}
            </div>
          </section>
        ))}
      </div>
      <aside className="pane">
        {person
          ? <Detail c={person} go={go} />
          : <p className="lead">人を押すと、8歳から78歳までの姿と、その人のことが出る。</p>}
      </aside>
    </div>
  )
}

function Detail({ c, go }: { c: (typeof cast)[number]; go: Go }) {
  const gen = c.appearsIn[0] ?? 1
  const year = generations.find((g) => g.gen === gen)?.startYear ?? 1015
  const age = ageAt(c, year)
  const v = atAge(c, age)
  const appear = Object.entries(eventsOf)
    .flatMap(([g, evs]) => evs.filter((e) => e.cast.includes(c.id)).map((e) => ({ g: +g, e })))
  return (
    <div className="detail">
      <div className="ages">
        {[10, 20, 40, 80].map((a) => (
          <figure key={a}>
            <Person id={c.id} family={c.family} gender={c.gender} age={a} seed={a / 7} size={110} />
            <figcaption><small>{a}歳</small></figcaption>
          </figure>
        ))}
      </div>
      <div className="text">
        <h4>{c.name}<small>{v.job}{age != null ? ` ／ 第${gen}世代で${age}歳` : ''}</small></h4>
        {v.catchphrase && <q className="cp">{v.catchphrase}</q>}
        <p>{v.personality}</p>
        <dl>
          {v.motive && <><dt>動機</dt><dd>{v.motive}</dd></>}
          {v.weakness && <><dt>弱さ</dt><dd>{v.weakness}</dd></>}
        </dl>
        {v.smallTalk?.default && (
          <ul className="talk">{v.smallTalk.default.map((t, i) => <li key={i}>{t}</li>)}</ul>
        )}
        {appear.length > 0 && (
          <div className="appearlist">
            <h5>出番 {appear.length}件</h5>
            <ol>
              {appear.map(({ g, e }) => (
                <li key={e.id}>
                  <a href={linkTo('story', e.id)}
                    onClick={(ev) => { ev.preventDefault(); go('story', e.id) }}>
                    <time>{e.year}/{e.month}</time>
                    <span className={`kind k-${e.kind}`}>{KIND_JA[e.kind] ?? e.kind}</span>
                    <b>{e.title}</b>
                    <small>第{g}世代</small>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}

function Topics({ route, go, pane, close }: { route: Route; go: Go; pane: string; close: () => void }) {
  const open = route.id
  const setOpen = (id: string) => { go('topics', id); close() }
  const FIELD: Record<string, string> = {
    kenri: '権利関係', gyoho: '宅建業法', hourei: '法令上の制限', zeikin: '税・その他',
  }
  const order = ['kenri', 'gyoho', 'hourei', 'zeikin']
  const sorted = [...topicList].sort(
    (a, b) => order.indexOf(a.field) - order.indexOf(b.field) || b.kakomonCount - a.kakomonCount,
  )
  const used = new Map<string, { g: string; e: StoryEvent }[]>()
  for (const [g, evs] of Object.entries(eventsOf)) {
    for (const e of evs) {
      if (e.topicId) used.set(e.topicId, [...(used.get(e.topicId) ?? []), { g, e }])
    }
  }
  const cur = sorted.find((t) => t.id === open)
  const lesson = cur ? lessonOf.get(cur.id) : null

  return (
    <div className={`split ${pane}`}>
      <aside>
        {order.map((f) => {
          const list = sorted.filter((t) => t.field === f)
          if (!list.length) return null
          return (
            <div key={f} className="field">
              <h3>{FIELD[f]}<small>{list.reduce((n, t) => n + t.kakomonCount, 0)}問</small></h3>
              <ol className="events">
                {list.map((t) => (
                  <li key={t.id}>
                    <button className={open === t.id ? 'on' : ''} onClick={() => setOpen(t.id)}>
                      <b>{t.name}</b>
                      <time>{t.kakomonCount}</time>
                      {!lessonOf.get(t.id) && <em>解説なし</em>}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )
        })}
      </aside>
      <main>
        {!cur ? (
          <p className="lead">
            論点を選ぶと、住人を借りた図解が出る。<b>ここを全部読めば、過去問はだいたい解ける。</b>
          </p>
        ) : (
          <article className="scene">
            <h3>{cur.name}</h3>
            <p className="facts">
              {FIELD[cur.field]} ／ 15年で {cur.kakomonCount}問 ／ <code>{cur.id}</code>
            </p>
            {used.get(cur.id) && (
              <p className="appear">
                出てくる回：
                {used.get(cur.id)!.map(({ g, e }, i) => (
                  <span key={e.id}>
                    {i > 0 && ' / '}
                    <a href={linkTo('story', e.id)}
                      onClick={(ev) => { ev.preventDefault(); go('story', e.id) }}>
                      第{g}世代 {e.title}
                    </a>
                  </span>
                ))}
              </p>
            )}
            {lesson ? <Lesson data={lesson} /> : <p className="todo">この論点の解説はまだ書けていない。</p>}
            <Kakomon key={`r-${cur.id}`} topic={cur} mode="random" />
          </article>
        )}
      </main>
    </div>
  )
}

/** 用語集。押すと意味が出るのと同じ言葉を、一覧で読める */
function Glossary({ go }: { go: Go }) {
  const [q, setQ] = useState('')
  const FIELD: Record<string, string> = {
    kenri: '権利関係', gyoho: '宅建業法', hourei: '法令上の制限', zeikin: '税・その他', '': 'そのほか',
  }
  const fieldOf = (id?: string) => (id ? topicOf.get(id)?.field ?? '' : '')
  const hit = TERMS.filter(
    (t) => !q || t.term.includes(q) || t.alternative?.includes(q) || t.plain?.includes(q),
  )
  const order = ['kenri', 'gyoho', 'hourei', 'zeikin', '']

  return (
    <div className="glossary">
      <p className="lead">
        {TERMS.length}語。<b>物語と過去問の中では、下線を押すとその場で出る。</b>
      </p>
      <input className="find" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="語をさがす" aria-label="語をさがす" />
      {order.map((f) => {
        const list = hit.filter((t) => fieldOf(t.topicId) === f)
        if (!list.length) return null
        return (
          <section key={f || 'other'}>
            <h3>{FIELD[f]}<small>{list.length}語</small></h3>
            <dl>
              {list.map((t) => (
                <div key={t.term}>
                  <dt>
                    {t.term}
                    {t.alternative && <small>{t.alternative}</small>}
                  </dt>
                  <dd>
                    {t.plain}
                    {t.topicId && (
                      <a href={linkTo('topics', t.topicId)}
                        onClick={(e) => { e.preventDefault(); go('topics', t.topicId!) }}>
                        {topicOf.get(t.topicId)?.name ?? '解説'}
                      </a>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )
      })}
      {!hit.length && <p className="todo">見つからない。</p>}
    </div>
  )
}
