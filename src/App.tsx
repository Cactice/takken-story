import { useCallback, useState } from 'react'
import { TitleScreen } from './components/title/TitleScreen'
import { TownView } from './components/town/TownView'
import { DialogueBox } from './components/dialogue/DialogueBox'
import { useGameClock } from './hooks/useGameClock'
import { characters, eventsForCharacter } from './lib/content'
import { loadState, saveState } from './lib/save'
import { playerSpriteStyle } from './lib/sprites'
import { ageOf, calendarOf, REWARD_CORRECT } from './types'
import type { Character, GameState, Gender } from './types'
import './App.css'

export default function App() {
  const [state, setState] = useState<GameState | null>(null)
  const [talkingTo, setTalkingTo] = useState<Character | null>(null)

  const update = useCallback((fn: (s: GameState) => GameState) => {
    setState((prev) => {
      if (!prev) return prev
      const next = fn(prev)
      saveState(next)
      return next
    })
  }, [])

  const tickMonth = useCallback(
    () => update((s) => ({ ...s, monthsElapsed: s.monthsElapsed + 1 })),
    [update],
  )
  useGameClock(state !== null, tickMonth)

  if (!state) {
    return (
      <TitleScreen
        hasSave={loadState() !== null}
        onStart={(gender: Gender) => {
          const fresh: GameState = {
            gender,
            monthsElapsed: 0,
            money: 100000,
            answeredEventIds: [],
          }
          saveState(fresh)
          setState(fresh)
        }}
        onContinue={() => setState(loadState())}
      />
    )
  }

  const { year, month } = calendarOf(state)
  const pendingEvent =
    talkingTo === null
      ? null
      : (eventsForCharacter(talkingTo.id).find(
          (e) => !state.answeredEventIds.includes(e.id),
        ) ?? null)

  return (
    <div className="game">
      <header className="game-header">
        <span className="hud-item">
          <span className="hud-avatar" style={playerSpriteStyle(state.gender)} /> {ageOf(state)}歳
        </span>
        <span className="hud-item">
          📅 {year}年{month}月
        </span>
        <span className="hud-item hud-money">💰 {state.money.toLocaleString()}円</span>
      </header>

      <TownView
        characters={characters}
        gender={state.gender}
        inputLocked={talkingTo !== null}
        onTapCharacter={setTalkingTo}
      />

      {talkingTo && (
        <DialogueBox
          key={talkingTo.id + (pendingEvent?.id ?? '')}
          character={talkingTo}
          event={pendingEvent}
          answered={pendingEvent === null}
          onAnswer={(correct, eventId) =>
            update((s) => ({
              ...s,
              money: s.money + (correct ? REWARD_CORRECT : 0),
              answeredEventIds: [...s.answeredEventIds, eventId],
            }))
          }
          onClose={() => setTalkingTo(null)}
        />
      )}
    </div>
  )
}
