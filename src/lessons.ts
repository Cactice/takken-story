import type { LessonData } from './Lesson'

// 論点の解説は分野ごとに1ファイル。並行して書けるように分けてある。
const mods = import.meta.glob<{ default: LessonData[] }>('../story/lessons/*.json', { eager: true })

export const lessonOf = new Map<string, LessonData>(
  Object.values(mods).flatMap((m) => m.default.map((l) => [l.topicId, l] as const)),
)
