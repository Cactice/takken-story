import type { Character, GameEvent } from '../types'

// content/ 配下の JSON をビルド時に取り込む
const characterModules = import.meta.glob<{ default: Character }>(
  '../../content/characters/*.json',
  { eager: true },
)
const eventModules = import.meta.glob<{ default: GameEvent }>(
  '../../content/events/*.json',
  { eager: true },
)

export const characters: Character[] = Object.values(characterModules).map(
  (m) => m.default,
)
export const events: GameEvent[] = Object.values(eventModules).map(
  (m) => m.default,
)

export function characterById(id: string): Character | undefined {
  return characters.find((c) => c.id === id)
}

export function eventsForCharacter(characterId: string): GameEvent[] {
  return events.filter((e) => e.characterId === characterId)
}
