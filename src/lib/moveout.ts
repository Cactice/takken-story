/**
 * 転出イベント(住民が村を出ていく)。docs/SYSTEMS.md「転出イベント」。
 * 住民に「!」が出て、話しかけると引っ越す理由を聞く。その理由がそのまま宅建の題材になり、
 * ハゲ田のアドバイス(メモ)が発生する。話が終わると住民が去り、その物件が空きになる。
 *
 * セリフは content/ 側で書けるようにしてある(Character.moveOut)。
 * まだ書かれていない人物は、下の既定文で動く。
 */

import type { Character } from '../types'

export interface MoveOutReason {
  /** 住民が話す引っ越しの理由(法律用語は使わない) */
  reason: string
  /** 対応する宅建の論点。ハゲ田のアドバイスはこの論点のイベントから引く */
  topicId: string
  /** 去り際の一言 */
  farewell: string
}

/**
 * 既定の転出理由。人物JSON(content 側)に `moveOut` が書かれたらそちらが勝つ。
 * topicId は content 側の相談イベントの論点に合わせてある(無い論点はアドバイスが出ないだけ)。
 */
export const DEFAULT_MOVE_OUT_REASONS: readonly MoveOutReason[] = [
  {
    reason: '急に転勤が決まってしまって…来月にはこの村を出ないといけないんです',
    topicId: 'shakka',
    farewell: 'お世話になりました。部屋はきれいにして返しますね',
  },
  {
    reason: '親が亡くなって、実家を継ぐことになりました。兄弟で話し合って、私が戻ることに',
    topicId: 'minpo-sozoku',
    farewell: '実家の片付けが大変で…でも、帰らないといけません',
  },
  {
    reason: '土地を借りて建てた家なんですが、借りる約束の期間が今年で終わるんです',
    topicId: 'shakuchi',
    farewell: '長いこと住みました。地主さんとも、もめずに済みそうです',
  },
  {
    reason: '大家さんから「建て替えたいので出てほしい」と言われて…立退料をもらって出ます',
    topicId: 'shakka',
    farewell: '納得はしています。次の家も見つかりましたし',
  },
  {
    reason: '一人暮らしが難しくなってきたので、街の施設に入ることにしました',
    topicId: 'minpo-seinen',
    farewell: '長いことお世話になったねえ。村のことは忘れんよ',
  },
  {
    reason: '家が古くなったので、いったん解体して建て直すことにしました',
    topicId: 'hourei-kenchiku-kakunin',
    farewell: '工事のあいだは仮住まいです。またいつか',
  },
]

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/**
 * その住民の転出理由。content に書かれていればそれを、無ければ既定文を人物ごとに割り振る。
 * 同じ人物なら毎回同じ理由になる(会話の途中で変わらない)。
 */
export function moveOutReasonFor(c: Character): MoveOutReason {
  if (c.moveOut)
    return {
      reason: c.moveOut.reason,
      topicId: c.moveOut.topicId,
      farewell: c.moveOut.farewell ?? 'お世話になりました',
    }
  return DEFAULT_MOVE_OUT_REASONS[hash(`mo/${c.id}`) % DEFAULT_MOVE_OUT_REASONS.length]
}

/** 転出の会話。住民の理由 → ハゲ田のアドバイス → 去り際 の順に並べる */
export function moveOutLines(
  c: Character,
  r: MoveOutReason,
  advice?: { title: string; text: string },
): string[] {
  return [
    `${c.name}「${r.reason}」`,
    ...(advice
      ? [`ハゲタ「${advice.title}の話だな。新人、よく聞いておけ」`, `ハゲタ「${advice.text}」`]
      : []),
    `${c.name}「${r.farewell}」`,
  ]
}
