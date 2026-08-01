# コンテンツJSONスキーマ

すべてのシナリオ・問題・物件データはこのスキーマに従う。`content/` にファイルを置くだけでゲームに読み込まれる。

## 設計方針
1. **話者はデータで持つ**(文字列に「ハゲタ「…」」と埋め込まない)。2世代目以降は上司が親に変わるため、話者は `mentor` のような**役割ID**で持ち、表示時に実際の人物へ解決する
2. **1イベント=1キャラで完結させない**。複数の登場人物と建物が絡めるよう `cast` / `places` を持つ
3. **物語(script)と試験問題(quiz)を分離する**。相談の場ではクイズを出さず、試験当日に quiz を使う
4. **問題文を持つ**(現状は選択肢だけで問題文がなく、試験画面で意味が通らない)
5. 追加要素(図解・メモ・報酬)はイベント単位でオプションにする

---

## イベント `content/events/*.json`

```jsonc
{
  "id": "ev-minpo-souzoku",              // 一意。ファイル名と一致させる
  "topicId": "minpo-souzoku",            // content/topics.md の論点ID
  "title": "遺産の分け方",                 // メモ・試験結果画面での見出し
  "generation": 1,                        // 対象世代(省略時は全世代)

  "cast": ["kr-yoshie", "kr-genta"],     // 登場するキャラID(1人以上)
  "places": ["house-yoshie"],            // 関係する建物・土地ID(0件以上)
  "trigger": {                            // 発生条件
    "type": "talk",                       // talk | enterBuilding | company | date
    "characterId": "kr-yoshie",           // type=talk のとき: 話しかける相手
    "placeId": null                       // type=enterBuilding のとき: 対象の建物
  },

  "script": [                             // 会話の進行。順に表示する
    { "speaker": "kr-yoshie", "text": "先日、主人が亡くなりましたの。" },
    { "speaker": "kr-yoshie", "text": "自宅と預金は、どう分けるものかしら?" },
    { "speaker": "mentor", "text": "いいか新人、これは相続の分け前の問題だ。",
      "diagram": { "type": "parties", "labels": ["夫(亡)", "妻", "長男", "長女"] } },
    { "speaker": "mentor", "text": "配偶者が2分の1、子が残りを分ける。",
      "diagram": { "type": "ratio", "labels": ["妻", "長男", "長女"], "values": [50, 25, 25] } },
    { "speaker": "player", "text": "つまり奥さんが半分、お子さんが4分の1ずつです!" },
    { "speaker": "kr-yoshie", "text": "まあ、すっきりしましたわ。ありがとう。", "effect": "thanks" }
  ],

  "quiz": {                               // 試験当日に使う。相談中は表示しない
    "question": "遺言がない場合、妻と子2人の法定相続分は?",
    "choices": ["妻1/3、子1/3ずつ", "妻1/2、子1/4ずつ", "全部を妻が相続"],
    "answer": 1,                          // 0始まり
    "explanation": "いいか、遺言がなけりゃ法定相続分で分ける。配偶者が2分の1、子が全員で残りの2分の1だ。"
  },

  "memo": {                               // 解決すると手に入る「ハゲ田のメモ」
    "title": "法定相続分",
    "summary": "配偶者と子 → 配偶者1/2。配偶者と親 → 配偶者2/3。配偶者と兄弟姉妹 → 配偶者3/4。"
  },

  "reward": 1,                            // 報酬(万円)。省略時は既定値
  "resolvedLine": "あのときはありがとう。おかげで兄妹ともめずに済みましたのよ。"
}
```

### `speaker` の値
| 値 | 意味 |
|---|---|
| キャラID(`kr-yoshie` 等) | `content/characters/` の住民 |
| `"player"` | 主人公(名前・見た目はプレイヤーの選択に従う) |
| `"mentor"` | 上司。**1世代目=ハゲ田社長、2世代目以降=父または母**。表示時に解決する |
| `"narration"` | 地の文(話者名なし) |

### `script[].effect`(任意)
| 値 | 意味 |
|---|---|
| `"thanks"` | 住民の感謝。この行で解決演出+メモ入手 |
| `"getMemo"` | メモだけ入手(感謝なし) |

### `diagram`(任意)
| type | 用途 | labels / values |
|---|---|---|
| `parties` | 人物の関係(売主・買主・仲介、家系図) | labels=人物名 |
| `ratio` | 割合(相続分、持分、報酬) | labels+values(合計100) |
| `area` | 面積の比(建蔽率・容積率) | labels+values(%) |
| `timeline` | 期間・期限(クーリングオフ8日など) | labels=時点、values=日数 |
| `money` | お金の流れ(敷金・手付金・手数料) | labels+values(万円) |
| `land` | 土地と境界・隣地・接道 | labels=区画名 |
| `floorplan` | 間取り・区分所有 | labels=部屋名 |

---

## キャラクター `content/characters/*.json`

```jsonc
{
  "id": "kr-yoshie",
  "name": "シルビア",
  "sprite": "villager-03",       // スプライト識別子
  "personality": "68歳。元呉服店の未亡人。上品な口調",
  "age": 68,                      // 年齢(時間経過で加齢。死亡イベントの基準)
  "gender": "female",
  "romanceable": false,
  "home": "house-yoshie"         // 住んでいる建物ID(近くに配置される)
}
```

## 物件・土地 `content/places/*.json`

```jsonc
{
  "id": "apart-hibari",
  "name": "ひばり荘",
  "kind": "apartment",           // apartment | mansion | house | farm | shop | ruin | land | office | shrine
  "sprite": "apartment-wood",    // docs/ASSETS.md のタイル組み合わせ名
  "pos": { "x": 12, "y": 8 },    // マップ上の位置
  "spec": {
    "structure": "木造",
    "floors": 2,
    "builtYear": 1985,
    "area": 42,                   // 専有面積(㎡)
    "zoning": "第一種低層住居専用地域",
    "buildingCoverage": 60,       // 建蔽率(%)
    "floorAreaRatio": 200,        // 容積率(%)
    "rent": 4,                    // 賃料(万円/月)。売買物件は price
    "price": null,                // 価格(万円)
    "deposit": 8,                 // 敷金(万円)
    "keyMoney": 4,                // 礼金(万円)
    "features": ["ペット可", "日当たり良好", "駅徒歩15分"],
    "legalNotes": ["再建築不可", "接道2m"]
  }
}
```

## 転入者 `content/newcomers/*.json`
物件案内ゲームの客。キャラクターのフィールドに加えて:
```jsonc
{
  "moveReason": "転勤で村に来た",
  "topicId": "gyoho-juyojiko",        // 引越し理由に紐づく論点(メモが発生する)
  "demands": "音楽を大音量で流したいので防音性の高い家",
  "likedFeatures": ["防音", "角部屋"],
  "dislikedFeatures": ["木造", "隣が近い"],
  "budget": 8                          // 万円
}
```

## 恋愛 `content/romance/*.json`
```jsonc
{
  "characterId": "hinata",
  "stages": [
    { "minAffection": 0,  "lines": ["おはよう!今日もいい天気だね"] },
    { "minAffection": 3,  "lines": ["最近よく話すね。ちょっと嬉しいかも"] },
    { "minAffection": 6,  "lines": ["実はね…将来のこと考えることがあるんだ"] },
    { "minAffection": 10, "lines": ["ねえ、いい家って…どんなのだと思う?"] }
  ],
  "houseInviteLines": ["ねえ、よかったら…家、見に行かない?"],
  "idealHome": {
    "description": "日当たりがよくて庭がある家",
    "likedFeatures": ["日当たり良好", "庭付き"],
    "dislikedFeatures": ["日当たり悪い", "騒音"]
  },
  "proposalLines": ["この家でなら…ずっと一緒に暮らせそう"]
}
```

---

## 金額の単位
**すべて万円単位の整数**。`rent: 4` = 家賃4万円/月、`price: 1200` = 1200万円。円単位では持たない。

## 検証
`npm run validate:content` で全JSONをスキーマ検証する(必須フィールド、話者IDの存在、topicId の存在、answer の範囲、参照先の place/character が実在するか)。
