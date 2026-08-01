import { useState } from 'react'
import type { GameEvent } from '../../types'
import { EXAM_PASS_RATIO, REWARD_EXAM_FAIL, REWARD_EXAM_PASS } from '../../types'
import './exam.css'

export interface ExamAnswer {
  event: GameEvent
  picked: number
  correct: boolean
}

interface Props {
  year: number
  /** 1年目はハゲタ社長が申込済み(見送り不可) */
  firstYear: boolean
  /** その年にスケジュールされた10イベント */
  questions: GameEvent[]
  /** 体験済み(馴染みの問題)判定用 */
  experiencedIds: ReadonlySet<string>
  onFinish: (answers: ExamAnswer[]) => void
  onDecline: () => void
}

type Phase = 'intro' | 'quiz' | 'result'

export function passLine(total: number): number {
  return Math.ceil(total * EXAM_PASS_RATIO)
}

export function ExamScreen({ year, firstYear, questions, experiencedIds, onFinish, onDecline }: Props) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<ExamAnswer[]>([])

  const pick = (i: number) => {
    const event = questions[index]
    const next = [...answers, { event, picked: i, correct: i === event.correctChoice }]
    setAnswers(next)
    if (index + 1 < questions.length) {
      setIndex(index + 1)
    } else {
      setPhase('result')
    }
  }

  const correctCount = answers.filter((a) => a.correct).length
  const passed = correctCount >= passLine(questions.length)
  const perfect = correctCount === questions.length && questions.length > 0

  return (
    <div className="exam-overlay" role="dialog" aria-label="宅建試験">
      <div className="exam-panel">
        {phase === 'intro' && (
          <div className="exam-intro">
            <h2 className="exam-title">📝 宅建試験(10月15日)</h2>
            {firstYear ? (
              <p>
                ハゲタ「言い忘れてたが、お前の分はわしが申し込んどいた。
                <br />
                全{questions.length}問、{passLine(questions.length)}問正解で合格だ。行ってこい」
              </p>
            ) : (
              <p>
                試験当日だ。全{questions.length}問、{passLine(questions.length)}問正解で合格。
                <br />
                受験するか?
              </p>
            )}
            <div className="exam-actions">
              <button type="button" className="pixel-btn" onClick={() => setPhase('quiz')}>
                試験を受ける
              </button>
              {!firstYear && (
                <button type="button" className="pixel-btn pixel-btn-secondary" onClick={onDecline}>
                  今年は見送る
                </button>
              )}
            </div>
          </div>
        )}

        {phase === 'quiz' && (
          <div className="exam-quiz">
            <p className="exam-progress">
              第{index + 1}問 / 全{questions.length}問
              {!experiencedIds.has(questions[index].id) && (
                <span className="exam-unseen">初見の問題!</span>
              )}
            </p>
            <div className="exam-question">
              {questions[index].dialogue.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
            <div className="exam-choices">
              {questions[index].choices.map((c, i) => (
                <button key={i} type="button" className="pixel-btn choice-btn" onClick={() => pick(i)}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {phase === 'result' && (
          <div className="exam-result">
            <h2 className="exam-title">
              {passed ? '🎉 合格!' : '😢 不合格…'} {correctCount} / {questions.length}問正解
            </h2>
            <p>
              {passed
                ? `合格ボーナス +${REWARD_EXAM_PASS.toLocaleString()}円!`
                : `残念…お疲れさま +${REWARD_EXAM_FAIL.toLocaleString()}円。間違えた論点は来年また相談で出てくるぞ。`}
            </p>
            {perfect && <p className="exam-perfect">👑 称号「{year}年目の満点宅建士」を獲得!</p>}
            <ol className="exam-review">
              {answers.map((a) => (
                <li key={a.event.id} className={a.correct ? 'is-correct' : 'is-wrong'}>
                  <p className="exam-review-head">
                    {a.correct ? '⭕' : '❌'} 正解: {a.event.choices[a.event.correctChoice]}
                    {!a.correct && ` (あなたの回答: ${a.event.choices[a.picked]})`}
                  </p>
                  <p className="exam-review-exp">{a.event.explanation}</p>
                </li>
              ))}
            </ol>
            <button type="button" className="pixel-btn" onClick={() => onFinish(answers)}>
              町にもどる
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
