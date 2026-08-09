import { useEffect, useMemo, useState } from 'react'
import {
  KIND_JA, ageAt, atAge, cast, castOf, eventsOf, familyList, familyOf,
  foreshadow, generations, topicList, topicOf, type StoryEvent,
} from './story'
import { Person } from './Person'
import { fetchQuestion } from './kakomon'

type Tab = 'story' | 'people' | 'families' | 'topics'

export function Viewer() {
  const [tab, setTab] = useState<Tab>('story')
  const [gen, setGen] = useState(1)
  const [pick, setPick] = useState(0)

  const events = eventsOf[gen]
  const ev = events[Math.min(pick, events.length - 1)]

  return (
    <div className="app">
      <header>
        <h1>宅建story</h1>
        <nav>
          {(['story', 'people', 'families', 'topics'] as Tab[]).map((t) => (
            <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
              {{ story: '物語', people: '人物', families: '家系', topics: '論点' }[t]}
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

      {tab === 'people' && <People />}
      {tab === 'families' && <Families />}
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
  const stage = ev.cast.filter((id) => castOf.has(id))
  const lines = [...ev.lines, ...(ev.thanks ? [ev.thanks] : []), ...(ev.later ? [ev.later] : [])]
  return (
    <article className="scene">
      <h3><time>{ev.year}/{ev.month}</time> {ev.title}</h3>
      <div className="stage">
        {stage.map((id, i) => {
          const c = castOf.get(id)!
          const age = ageAt(c, ev.year)
          return (
            <figure key={id}>
              <Person family={c.family} gender={c.gender} age={age} seed={i * 2.1} size={100} />
              <figcaption>{c.name}<small>{age != null ? `${age}歳` : ''}</small></figcaption>
            </figure>
          )
        })}
      </div>
      <ol className="lines">
        {lines.map((l, i) => (
          <li key={i}>
            <span className="who">{castOf.get(l.who)?.name ?? l.who}</span>
            <p>{l.text}</p>
          </li>
        ))}
      </ol>
      {ev.quiz ? <Quiz quiz={ev.quiz} /> : <p className="todo">この回はまだ問題ができていない。</p>}
      {topic && <Kakomon topic={topic} />}
    </article>
  )
}

function Quiz({ quiz }: { quiz: NonNullable<StoryEvent['quiz']> }) {
  const [open, setOpen] = useState(false)
  return (
    <section className="quiz">
      <p className="q">{quiz.question}</p>
      <ol className="choices">
        {quiz.choices?.map((c, i) => (
          <li key={i} className={open && i === quiz.answer ? 'right' : ''}>{c}</li>
        ))}
      </ol>
      <button onClick={() => setOpen(!open)}>{open ? '閉じる' : '答えと解説'}</button>
      {open && <p className="ex">{quiz.explanation}</p>}
    </section>
  )
}

function Kakomon({ topic }: { topic: { id: string; name: string; kakomonCount: number; kakomon: string[] } }) {
  const [items, setItems] = useState<{ ref: string; body: string; choices: string[] }[]>([])
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    Promise.all(topic.kakomon.slice(0, 3).map(fetchQuestion)).then((r) => setItems(r.filter(Boolean) as never))
  }, [open, topic])
  return (
    <section className="kakomon">
      <button onClick={() => setOpen(!open)}>
        論点 <code>{topic.id}</code>（{topic.name}）— 15年で {topic.kakomonCount}問
      </button>
      {open && (items.length ? items.map((q) => (
        <div key={q.ref} className="real">
          <b>{q.ref}</b>
          <p>{q.body}</p>
          <ol>{q.choices.map((c, i) => <li key={i}>{c}</li>)}</ol>
        </div>
      )) : <p className="todo">本文は kakomon/json/ にあるときだけ出る（開発サーバのみ）。</p>)}
    </section>
  )
}

function People() {
  const [gen, setGen] = useState(1)
  const g = generations.find((x) => x.gen === gen)!
  const list = useMemo(() => {
    const byFam = new Map<string, typeof cast>()
    for (const c of cast) {
      if (!c.appearsIn.includes(gen)) continue
      const k = c.family ?? '—'
      byFam.set(k, [...(byFam.get(k) ?? []), c])
    }
    return [...byFam.entries()].map(([f, cs]) =>
      [f, cs.sort((a, b) => (a.birthYear ?? 0) - (b.birthYear ?? 0))] as const)
  }, [gen])

  return (
    <div className="roster">
      <div className="gens row">
        {generations.map((x) => (
          <button key={x.gen} className={gen === x.gen ? 'on' : ''} onClick={() => setGen(x.gen)}>
            第{x.gen}世代
          </button>
        ))}
      </div>
      {list.map(([fam, cs]) => (
        <section key={fam}>
          <h3>{fam}家 <small>{familyOf.get(fam)?.cloth.why}</small></h3>
          <div className="grid">
            {cs.map((c0, i) => {
              const age = ageAt(c0, g.startYear)
              const c = atAge(c0, age)
              return (
                <figure key={c.id}>
                  <Person family={c.family} gender={c.gender} age={age} seed={i * 1.7} size={90} />
                  <figcaption>
                    <b>{c.name}</b><small>{age != null ? `${age}歳` : ''} {c.job ?? ''}</small>
                    {c.catchphrase && <q>{c.catchphrase}</q>}
                  </figcaption>
                </figure>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

function Families() {
  return (
    <div className="families">
      {familyList.map((f) => (
        <section key={f.id}>
          <h3>
            <span className="sw" style={{ background: f.cloth.base, borderColor: f.cloth.accent }} />
            {f.id}家 <small>{f.cloth.why}</small>
          </h3>
          <div className="pair">
            <Person family={f.id} gender="male" age={30} seed={1} size={96} />
            <Person family={f.id} gender="female" age={30} seed={2} size={96} />
            <Person family={f.id} gender="male" age={8} seed={3} size={96} />
            <Person family={f.id} gender="female" age={78} seed={4} size={96} />
          </div>
          <p>{f.story.split('\n')[0].replace(/\*\*/g, '')}</p>
        </section>
      ))}
    </div>
  )
}

function Topics() {
  const sorted = [...topicList].sort((a, b) => b.kakomonCount - a.kakomonCount)
  const used = new Set(
    Object.values(eventsOf).flat().map((e) => e.topicId).filter(Boolean) as string[],
  )
  return (
    <table className="topics">
      <thead><tr><th>論点</th><th>分野</th><th>15年の出題</th><th>イベント</th></tr></thead>
      <tbody>
        {sorted.map((t) => (
          <tr key={t.id} className={used.has(t.id) ? '' : 'unused'}>
            <td><code>{t.id}</code><br /><small>{t.name}</small></td>
            <td>{t.field}</td>
            <td className="num">{t.kakomonCount}</td>
            <td>{used.has(t.id) ? '有' : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
