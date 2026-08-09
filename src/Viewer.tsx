import { useEffect, useMemo, useState } from 'react'
import {
  KIND_JA, ageAt, atAge, cast, castOf, eventsOf, familyList,
  foreshadow, generations, topicList, topicOf, type Line, type StoryEvent,
} from './story'
import { Person } from './Person'
import { Lesson } from './Lesson'
import { lessonOf } from './lessons'
import { pickClosest, type Question, type QueryPart } from './kakomon'

type Tab = 'story' | 'cast' | 'topics'

// URL でも行き来できるようにする。ルータは要らない。パスを見て出し分けるだけ
const BASE = import.meta.env.BASE_URL
const PATH: Record<Tab, string> = { story: '', cast: 'jinbutsu', topics: 'ronten' }
const tabOf = (p: string): Tab => {
  const rest = p.replace(BASE, '').replace(/^\/|\/$/g, '')
  return (Object.keys(PATH) as Tab[]).find((t) => PATH[t] === rest) ?? 'story'
}

export function Viewer() {
  const [tab, setTabState] = useState<Tab>(() => tabOf(window.location.pathname))
  const setTab = (t: Tab) => {
    setTabState(t)
    window.history.pushState(null, '', BASE + PATH[t])
  }
  useEffect(() => {
    const back = () => setTabState(tabOf(window.location.pathname))
    window.addEventListener('popstate', back)
    return () => window.removeEventListener('popstate', back)
  }, [])
  const [gen, setGen] = useState(1)
  const [pick, setPick] = useState(0)

  const events = eventsOf[gen]
  const ev = events[Math.min(pick, events.length - 1)]

  return (
    <div className="app">
      <header>
        <h1>宅建story</h1>
        <nav>
          {(['story', 'cast', 'topics'] as Tab[]).map((t) => (
            <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
              {{ story: '物語', cast: '家系と人物', topics: '論点' }[t]}
            </button>
          ))}
        </nav>
      </header>

      {tab === 'story' && (
        <div className="split">
          <aside>
            <div className="gens">
              {generations.map((g) => (
                <button key={g.gen} className={gen === g.gen ? 'on' : ''}
                  onClick={() => { setGen(g.gen); setPick(0) }}>
                  第{g.gen}世代
                  <small>{g.stage}</small>
                </button>
              ))}
            </div>
            <ol className="events">
              {events.map((e, i) => (
                <li key={e.id}>
                  <button className={i === pick ? 'on' : ''} onClick={() => setPick(i)}>
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
            {ev && <Scene ev={ev} />}
          </main>
        </div>
      )}

      {tab === 'cast' && <Cast />}
      {tab === 'topics' && <Topics />}
    </div>
  )
}

function GenHead({ gen }: { gen: number }) {
  const g = generations.find((x) => x.gen === gen)!
  const yen = (n: number) => (n >= 100000000 ? `${n / 100000000}億` : `${n / 10000}万`)
  return (
    <section className="genhead">
      <h2>第{g.gen}世代 ｜ {g.stage} ｜ {g.startYear}年〜</h2>
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

function Scene({ ev }: { ev: StoryEvent }) {
  const topic = ev.topicId ? topicOf.get(ev.topicId) : null
  // 芝居と説明を混ぜない。混ぜると場面が長くなって、間延びして読める
  const drama = ev.lines.filter((l) => l.role !== 'teach')
  const teach = ev.lines.filter((l) => l.role === 'teach')

  const Row = ({ l, i, prev }: { l: Line; i: number; prev?: Line }) => {
    const c = castOf.get(l.who)
    const same = prev?.who === l.who
    return (
      <li className={same ? 'same' : ''}>
        <span className="face">
          {!same && <Person id={c?.id} family={c?.family} gender={c?.gender} age={ageAt(c, ev.year)} seed={i} size={44} head />}
        </span>
        <span className="who">{same ? '' : c?.name ?? l.who}</span>
        <p>{l.text}</p>
      </li>
    )
  }

  return (
    <article className="scene">
      <h3><time>{ev.year}/{ev.month}</time> {ev.title}</h3>
      <ol className="lines">
        {drama.map((l, i) => <Row key={i} l={l} i={i} prev={drama[i - 1]} />)}
      </ol>
      {teach.length > 0 && (
        <aside className="teach">
          <h4>あなたが説明する</h4>
          {teach.map((l, i) => <p key={i}>{l.text}</p>)}
        </aside>
      )}
      {(ev.thanks || ev.later) && (
        <ol className="lines after">
          {ev.thanks && <Row l={ev.thanks} i={90} />}
          {ev.later && <Row l={ev.later} i={91} />}
        </ol>
      )}
      {/* key にイベントidを渡して、別のイベントへ移ったら選択状態を捨てる */}
      {/* key は兄弟どうしで重複させない（同じ値だとReactが別物と見なせず要素が積み上がる） */}
      {ev.quiz ? <Quiz key={`q-${ev.id}`} quiz={ev.quiz} /> : <p className="todo">この回はまだ問題ができていない。</p>}
      {topic && <Kakomon key={`k-${ev.id}`} topic={topic} query={queryOf(ev, topic.name)} />}
    </article>
  )
}

function Quiz({ quiz }: { quiz: NonNullable<StoryEvent['quiz']> }) {
  // picked = まだ押していない状態は null。押したら答え合わせと解説を出す。
  const [picked, setPicked] = useState<number | null>(null)
  const [open, setOpen] = useState(false)
  const done = picked != null
  const shown = done || open

  return (
    <section className="quiz">
      <p className="q">{quiz.question}</p>
      {quiz.choices?.length ? (
        <>
        {!done && <p className="hint">選択肢を押すと ○× と解説が出ます。</p>}
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
      {shown && <p className="ex">{quiz.explanation}</p>}
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

function Kakomon(
  { topic, query }:
  { topic: { id: string; name: string; kakomonCount: number; kakomon: string[] }; query: QueryPart[] },
) {
  const [item, setItem] = useState<Question | null>(null)
  const [done, setDone] = useState(false)
  useEffect(() => {
    let alive = true
    // 候補を全部読んでから、イベントの文脈に一番近い1問だけ選ぶ
    pickClosest(query, topic.kakomon).then((q) => { if (alive) { setItem(q); setDone(true) } })
    return () => { alive = false }
    // query は毎回新しい配列になるので、イベントが変われば作り直される key に任せる
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic])
  return (
    <section className="kakomon">
      <p className="head">
        論点 <code>{topic.id}</code>（{topic.name}）
        <br />
        この論点は過去15年で {topic.kakomonCount}問。いちばん近いのはこれです。
      </p>
      {item ? (
        <div className="real">
          <b>{item.ref}</b>
          <p>{item.body}</p>
          <ol>
            {item.choices.map((c, i) => (
              <li key={i} className={item.answer === i + 1 ? 'right' : ''}>
                <span className="mark">{item.answer == null ? '' : item.answer === i + 1 ? '○' : '×'}</span>
                {c}
              </li>
            ))}
          </ol>
          <p className="note">
            {item.answer == null
              ? 'この年の正解番号はまだ取り込めていません。'
              : `正解は ${item.answer} 番（出題元が公表している正解番号表より）。`}
          </p>
        </div>
      ) : done && <p className="todo">本文は kakomon/json/ にあるときだけ出る（開発サーバのみ）。</p>}
    </section>
  )
}

function Cast() {
  const [open, setOpen] = useState<string | null>(null)
  const members = useMemo(() => {
    const m = new Map<string, typeof cast>()
    for (const c of cast) m.set(c.family ?? '—', [...(m.get(c.family ?? '—') ?? []), c])
    for (const [, cs] of m) cs.sort((a, b) => (a.birthYear ?? 0) - (b.birthYear ?? 0))
    return m
  }, [])
  const person = cast.find((c) => c.id === open)
  const fam = familyList.find((f) => f.id === (person?.family ?? open))

  return (
    <div className="split">
      <aside>
        {familyList.map((f) => (
          <div key={f.id} className="field">
            <h3>
              <button className={!person && open === f.id ? 'on' : ''} onClick={() => setOpen(f.id)}>
                <span className="sw" style={{ background: f.cloth.base, borderColor: f.cloth.accent }} />
                {f.id}家<small>{f.cloth.why}</small>
              </button>
            </h3>
            <ol className="events">
              {(members.get(f.id) ?? []).map((c) => (
                <li key={c.id}>
                  <button className={open === c.id ? 'on' : ''} onClick={() => setOpen(c.id)}>
                    <b>{c.name}</b>
                    <time>{c.birthYear}</time>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </aside>
      <main>
        {fam && (
          <section className="genhead">
            <h2>
              <span className="sw" style={{ background: fam.cloth.base, borderColor: fam.cloth.accent }} />
              {fam.id}家 <small>{fam.cloth.why}</small>
            </h2>
            <p className="synopsis">{fam.story.replace(/\*\*/g, '')}</p>
          </section>
        )}
        {person ? <Detail c={person} /> : !fam && (
          <p className="lead">家か人を選ぶと、家の物語と、その人の姿が出る。</p>
        )}
      </main>
    </div>
  )
}

function Detail({ c }: { c: (typeof cast)[number] }) {
  const gen = c.appearsIn[0] ?? 1
  const year = generations.find((g) => g.gen === gen)?.startYear ?? 1015
  const age = ageAt(c, year)
  const v = atAge(c, age)
  const appear = Object.entries(eventsOf)
    .flatMap(([g, evs]) => evs.filter((e) => e.cast.includes(c.id)).map((e) => ({ g: +g, e })))
  return (
    <div className="detail">
      <div className="ages">
        {[8, 20, 45, 78].map((a) => (
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
        <p className="appear">
          出番 {appear.length}件
          {appear.length > 0 && <>：{appear.map(({ g, e }) => `第${g}世代 ${e.title}`).join(' / ')}</>}
        </p>
      </div>
    </div>
  )
}

function Topics() {
  const [open, setOpen] = useState<string | null>(null)
  const FIELD: Record<string, string> = {
    kenri: '権利関係', gyoho: '宅建業法', hourei: '法令上の制限', zeikin: '税・その他',
  }
  const order = ['kenri', 'gyoho', 'hourei', 'zeikin']
  const sorted = [...topicList].sort(
    (a, b) => order.indexOf(a.field) - order.indexOf(b.field) || b.kakomonCount - a.kakomonCount,
  )
  const used = new Map<string, string[]>()
  for (const [g, evs] of Object.entries(eventsOf)) {
    for (const e of evs) {
      if (e.topicId) used.set(e.topicId, [...(used.get(e.topicId) ?? []), `第${g}世代 ${e.title}`])
    }
  }
  const cur = sorted.find((t) => t.id === open)
  const lesson = cur ? lessonOf.get(cur.id) : null

  return (
    <div className="split">
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
            {lesson ? <Lesson data={lesson} /> : <p className="todo">この論点の解説はまだ書けていない。</p>}
            {used.get(cur.id) && <p className="appear">出てくる回：{used.get(cur.id)!.join(' / ')}</p>}
          </article>
        )}
      </main>
    </div>
  )
}
