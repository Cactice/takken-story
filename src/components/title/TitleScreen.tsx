import { useState } from 'react'
import type { Gender } from '../../types'
import './title.css'

interface Props {
  hasSave: boolean
  onStart: (gender: Gender) => void
  onContinue: () => void
}

export function TitleScreen({ hasSave, onStart, onContinue }: Props) {
  const [gender, setGender] = useState<Gender>('male')

  return (
    <main className="title-screen">
      <h1 className="title-logo">
        宅建<span className="title-logo-accent">study</span>
      </h1>
      <p className="title-tagline">〜 街の不動産屋ものがたり 〜</p>

      <section className="gender-select" aria-label="性別選択">
        <p className="gender-label">主人公をえらんでね</p>
        <div className="gender-options">
          <button
            type="button"
            className={`gender-card ${gender === 'male' ? 'is-selected' : ''}`}
            onClick={() => setGender('male')}
          >
            <span className="gender-sprite">🧑‍💼</span>
            おとこのこ
          </button>
          <button
            type="button"
            className={`gender-card ${gender === 'female' ? 'is-selected' : ''}`}
            onClick={() => setGender('female')}
          >
            <span className="gender-sprite">👩‍💼</span>
            おんなのこ
          </button>
        </div>
      </section>

      <div className="title-actions">
        <button type="button" className="pixel-btn" onClick={() => onStart(gender)}>
          はじめから
        </button>
        {hasSave && (
          <button type="button" className="pixel-btn pixel-btn-secondary" onClick={onContinue}>
            つづきから
          </button>
        )}
      </div>
    </main>
  )
}
