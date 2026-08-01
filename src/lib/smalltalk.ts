/**
 * 住民の雑談の出し分け。
 * セリフは content 側の人物JSON(smallTalk / movedInLines)から引き、無ければ既定文で動く。
 * ponytail: 文言そのものはコンテンツ担当が足す。src 側は「あれば使う、無ければ既定」だけを持つ。
 */

import type { Character } from '../types'
import { EXAM_MONTH } from '../types'
import { reactionTo, toTourMember, toTourProperty } from './tour'
import type { PropertySpec } from './properties'

export interface TalkContext {
  /** 引っ越してきてからの日数。契約で村に来た住民だけ入る */
  daysSinceMoveIn?: number
  /** 住んでいる家の名前(新居の話に使う) */
  homeName?: string
  /** 住んでいる家(契約した物件)。希望と突き合わせて満足・不満を出す */
  home?: PropertySpec
  month: number
  /** 解決済みの相談の「あのときはありがとう」 */
  resolvedLine?: string
  /** 同じセリフを連続で出さないための種(話すたびに変わる値) */
  seed: number
}

/** 引っ越してから、これだけの日数は新居の話をする */
export const MOVED_IN_DAYS = 60

const DEFAULT_MOVED_IN = (home: string): string[] => [
  `${home}、決めてよかったよ。荷ほどきがまだ終わらないけどね。`,
  `朝の光の入り方がね、思っていたより気持ちいいの。${home}にしてよかった。`,
  'ご近所さんにも挨拶してきたところ。この村、静かでいいね。',
  '契約のとき、いろいろ説明してくれてありがとう。あれで安心できたよ。',
]

const DEFAULT_SEASONAL: Record<number, string[]> = {
  1: ['あけましておめでとう。今年もよろしくね。'],
  4: ['桜が咲いたね。引っ越しの季節だ。'],
  7: ['暑いねえ。この家、夏は風が通るからまだ助かるよ。'],
  8: ['夏祭り、今年もやるのかな。'],
  [EXAM_MONTH]: ['そろそろ試験だろう? 根を詰めすぎないようにね。'],
  12: ['もう年の瀬か。一年は早いねえ。'],
}

const DEFAULT_SATISFIED = (home: string): string[] => [
  `${home}、住んでみても気に入ってるよ。よく探してくれた。`,
  '朝起きて窓を開けるのが楽しみでね。いい家を紹介してもらった。',
  '知り合いにも「いい不動産屋がいる」って話しておいたよ。',
]

const DEFAULT_DISSATISFIED = (home: string): string[] => [
  `${home}ねえ…住んでみると、やっぱり気になるところがあってさ。`,
  '悪い家じゃないんだけど、あのとき言った希望、覚えてる?',
  '次にいい物件が出たら教えてよ。今度はもう少し希望に合うところがいいな。',
]

const DEFAULT_SMALL_TALK = [
  'こんにちは。いい天気だね。',
  '畑の野菜、そろそろ採れるよ。持っていくかい?',
  'この村も、少しずつ人が増えてきたね。',
  '不動産屋さんは大変だねえ。あの社長、まだ怒鳴ってるのかい?',
]

/**
 * 住んでいる家が希望に合っているか。
 * 判定は物件案内と同じ照合ロジック(reactionTo)を使う — 基準がぶれると理不尽になる。
 */
export function homeMood(c: Character, home: PropertySpec | undefined): 'satisfied' | 'dissatisfied' | null {
  if (!home || !c.moveIn) return null
  // 予算は当時の契約で通っている前提なので、家賃では減点しない(上限を十分大きく渡す)
  const r = reactionTo(toTourMember(c), toTourProperty(home), Number.MAX_SAFE_INTEGER)
  if (r.mood === 'like') return 'satisfied'
  if (r.mood === 'dislike') return 'dissatisfied'
  return null
}

/** 候補のなかから、種で1つ選ぶ(同じ人に続けて話しかけても同じ文が続かない) */
function pick(lines: string[], seed: number): string {
  return lines[((seed % lines.length) + lines.length) % lines.length]
}

export function smallTalkFor(c: Character, ctx: TalkContext): string {
  // 1. 引っ越してきたばかり → 新居の話
  if (ctx.daysSinceMoveIn !== undefined && ctx.daysSinceMoveIn <= MOVED_IN_DAYS) {
    const lines = c.movedInLines ?? DEFAULT_MOVED_IN(ctx.homeName ?? 'あの家')
    return pick(lines, ctx.seed)
  }
  // 2. 悩みを解決してあげた相手 → あのときのお礼
  if (ctx.resolvedLine) return ctx.resolvedLine
  // 3. 住んでいる家への満足・不満(案内の巧拙が暮らしに残る)
  const mood = homeMood(c, ctx.home)
  if (mood !== null) {
    const home = ctx.homeName ?? ctx.home?.name ?? 'あの家'
    const lines =
      mood === 'satisfied'
        ? (c.homeLines?.satisfied ?? DEFAULT_SATISFIED(home))
        : (c.homeLines?.dissatisfied ?? DEFAULT_DISSATISFIED(home))
    if (lines.length > 0) return pick(lines, ctx.seed)
  }
  // 4. 時期の話
  const seasonal = c.seasonalLines?.[String(ctx.month)] ?? DEFAULT_SEASONAL[ctx.month]
  if (seasonal && seasonal.length > 0 && ctx.seed % 3 === 0) return pick(seasonal, ctx.seed)
  // 5. ふだんの雑談
  return pick(c.smallTalk ?? DEFAULT_SMALL_TALK, ctx.seed)
}
