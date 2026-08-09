import { useEffect, useMemo, useRef, useState } from 'react'
import glossary from '../story/glossary.json'

// 難しい言葉に下線を引いて、押すと意味が出る。
// 過去問の本文は本試験そのままなので、やさしくできない。言葉のほうに意味を付ける。

type Term = {
  term: string
  /** 短い言い換え。これだけで済む人はここで読み終わる */
  alternative?: string
  /** ひとことの説明。論点ページへ飛ばすだけでよい語では省いてよい */
  plain?: string
  /** その語をまるごと扱っている論点。あれば「解説を読む」を出す */
  topicId?: string
}
const BASE = import.meta.env.BASE_URL
const TERMS: Term[] = glossary
const BY_TERM = new Map(TERMS.map((t) => [t.term, t]))
// 長い語から先に当てる。「対抗要件」を「対抗」で切らないため
const RE = new RegExp(`(${TERMS.map((t) => t.term).sort((a, b) => b.length - a.length).join('|')})`, 'g')

function Word({ t }: { t: Term }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLSpanElement>(null)

  // 外を押したら閉じる。Esc でも閉じる
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <span className="glosswrap" ref={box}>
      <button
        className="gloss"
        aria-expanded={open}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open) }}
      >
        {t.term}
      </button>
      {open && (
        <span className="pop" role="tooltip" onClick={(e) => e.stopPropagation()}>
          {t.alternative && <b>{t.alternative}</b>}
          {t.plain}
          {t.topicId && (
            <a className="more" href={`${BASE}ronten/${t.topicId}`}>解説を読む</a>
          )}
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
