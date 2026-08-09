import { useMemo, useState } from 'react'
import glossary from '../story/glossary.json'

// 難しい言葉に下線を引いて、押すと意味が出る。
// 過去問の本文は本試験そのままなので、やさしくできない。言葉のほうに意味を付ける。

type Term = { term: string; plain: string; alternative?: string }
const TERMS: Term[] = glossary
const BY_TERM = new Map(TERMS.map((t) => [t.term, t]))
// 長い語から先に当てる。「対抗要件」を「対抗」で切らないため
const RE = new RegExp(`(${TERMS.map((t) => t.term).sort((a, b) => b.length - a.length).join('|')})`, 'g')

function Word({ t }: { t: Term }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="glosswrap">
      <button className="gloss" onClick={() => setOpen(!open)} aria-expanded={open}>{t.term}</button>
      {open && (
        <span className="pop" role="tooltip">
          {t.alternative && <b>{t.alternative}</b>}
          {t.plain}
          <button className="close" onClick={() => setOpen(false)} aria-label="閉じる">×</button>
        </span>
      )}
    </span>
  )
}

export function Gloss({ children }: { children: string }) {
  const parts = useMemo(() => children.split(RE), [children])
  return (
    <>
      {parts.map((s, i) => {
        const t = BY_TERM.get(s)
        return t ? <Word key={i} t={t} /> : <span key={i}>{s}</span>
      })}
    </>
  )
}
