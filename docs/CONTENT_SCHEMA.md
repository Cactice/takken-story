# コンテンツJSONスキーマ

すべてのシナリオ・問題・物件データはこのスキーマに従う。`content/` にファイルを置くだけでゲームに読み込まれる。

## ディレクトリ構成
**世代が最上位**(世代ごとに舞台もキャストも変わるため)。全世代で共通のものだけトップに置く。

```
content/
  gen1/                  # 第1世代: ありきた村(基礎中心)
    characters/          # 人物(住民=転入者。1人1ファイル)
    households/          # 転入の単位(世帯)。人物はIDで参照
    places/              # 建物・土地(マップ配置とスペック)
    events/              # イベントは種類で分ける(分野では分けない)
      trouble/           #   住民の悩み・トラブル相談
      newcomer/          #   転入(世帯の面談・物件案内)
      work/              #   会社の仕事(重説の読み上げ、媒介契約、広告、報酬計算)
      business/          #   会社の制度(免許、営業保証金、帳簿、従業員、監督処分)
      village/           #   村の出来事(寄合、祭り、空き家、区画整理)複数人が絡む
      dispute/           #   揉め事・争い(境界、相続争い、法廷)
      life/              #   主人公の人生(家賃、引越し、結婚、出産、世代交代)
      farewell/          #   別れ(住民の死・退去)→ 相続や原状回復の題材
      romance/           #   恋愛(親密度で進む会話、デート)
      season/            #   時勢(地価公示、統計、税制改正、災害)
    README.md            # その世代の舞台・テーマ・キャラの方針
  gen2/ ... gen5/        # 以降の世代
  reference/             # 条文コーパス(全世代共通)
  topics.md              # 54論点の一覧(全世代共通)
  COVERAGE.md            # 論点 × イベントの網羅性
  README.md
```

**分野(権利関係/宅建業法/法令上の制限/税その他)はフォルダで分けない。** JSONの `category` フィールドで持つ。
1つのイベントが複数分野にまたがってよい(現実の相談は分野をまたぐ方が自然)。
分野で綺麗に整理することより、**その世代の世界観に沿った深い物語とキャラクター**を優先する。

**人物は世代ごとに分散させる。** 全員を gen1 に置かない。世代をまたいで再登場する一族
(見沼家・鈴木家・禿鷹家)は、登場する世代それぞれに配置し、IDで同一人物と分かるようにする。

- `content/newcomers/` は廃止(characters に統合)
- 人物IDは世代をまたいでも一意にする(第3世代に再登場する見沼家など)

## 設計方針
1. **話者はデータで持つ**(文字列に「ハゲタ「…」」と埋め込まない)。2世代目以降は上司が親に変わるため、話者は `mentor` のような**役割ID**で持ち、表示時に実際の人物へ解決する
2. **1イベント=1キャラで完結させない**。複数の登場人物と建物が絡めるよう `cast` / `places` を持つ
3. **物語(script)と試験問題(quiz)を分離する**。相談の場ではクイズを出さず、試験当日に quiz を使う
4. **問題文を持つ**(現状は選択肢だけで問題文がなく、試験画面で意味が通らない)
5. 追加要素(図解・メモ・報酬)はイベント単位でオプションにする

---

## イベント `content/gen<N>/events/<kind>/*.json`

> **現在のデータの形**: 会話は `dialogue: string[]`(メンターの行は `ハゲタ「…」` で始め、表示時に
> その世代のメンター名へ置換する)、試験問題は `choices` / `correctChoice` / `explanation`、
> 主人公の説明は `playerLines`、感謝は `thanksLine`、解決後は `resolvedLine` を使っている。
> 下の `script` / `quiz` / `memo` は**移行先の目標形**。移行するときも
> `id` / `topicId` / `choices` / `correctChoice` / `explanation` の**法的な結論は変えない**こと。

```jsonc
{
  "id": "ev-minpo-souzoku",              // 一意。ファイル名と一致させる
  "topicId": "minpo-souzoku",            // content/topics.md の論点ID
  "title": "遺産の分け方",                 // メモ・試験結果画面での見出し
  "summary": "遺言を残さず祖父が亡くなり、祖母と父と叔母で遺産を分けることになる", // 推奨(下記)
  "generation": 1,                        // 対象世代。フォルダ gen<N> と一致させる
  "kind": "trouble",                      // イベントの種類。フォルダ名と一致させる(下表)
  "category": ["kenri"],                  // 分野。複数該当してよい kenri|gyoho|hourei|zei
  "minAffection": 24,                     // 任意。親密度がこれ以上でないと発生しない(恋愛・打ち明け話)

  "cast": ["kr-yoshie", "kr-genta"],     // 登場するキャラID(1人以上)。先頭 = characterId(主役)
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

  "memo": {                               // 解決すると手に入る「禿鷹のメモ」
    "title": "法定相続分",
    "summary": "配偶者と子 → 配偶者1/2。配偶者と親 → 配偶者2/3。配偶者と兄弟姉妹 → 配偶者3/4。"
  },

  "reward": 1,                            // 報酬(万円)。省略時は既定値
  "resolvedLine": "あのときはありがとう。おかげで兄妹ともめずに済みましたのよ。"
}
```

### `summary`(推奨・全イベントに入れる)
ゲームには出さない、**開発者が中身を一目で見分けるための一文**。
`docs/events-by-household.md` の「どんな話か」列にそのまま使われる。

- **1文・30〜45文字**。長くしない
- **誰が・何をして・何が問題になるか**を書く。**セリフの引用は不可**(出来事の説明にする)
- **法律用語を使わない**。論点名は別列に出るので重複させない
- ネタバレ可。開発者用なので真相を書いてよい
- 人物は名前だけでよい(リオン、メープル、ソラ)。ただし誰か分かること

```
✅ 17歳のリオンが、親に内緒で土地を借りて温室を建てようとする
❌ …別に、たいした話じゃない。俺は十七だ。        ← セリフの切り出し
❌ 制限行為能力者の話                              ← 論点名の言い換え
```

### `kind`(イベントの種類 = フォルダ名)
分野ではなく**出来事の種類**で分ける。種類ごとに空白ができないよう配分する。

| kind | 内容 | 主に受け持つ論点 |
|---|---|---|
| `trouble` | 住民の悩み・トラブル相談 | 民法全般、用途地域など生活に触れるもの |
| `newcomer` | 転入(世帯の面談・物件案内) | 売買の基本、保証、建蔽率、借家 |
| `work` | 会社の仕事(重説の読み上げ、媒介契約、広告、報酬計算) | 35条・37条・媒介・報酬・広告規制 |
| `business` | 会社の制度(免許、営業保証金、保証協会、帳簿・名簿、監督処分) | 住民の悩みには絶対にならない業法の論点 |
| `village` | 村の出来事(寄合、祭り、空き家、まちづくり) | 不法行為、土地の知識、農地法 |
| `dispute` | 揉め事・争い(境界、相続争い、法廷) | 時効、共有、物権変動、登記 |
| `life` | 主人公の人生(家賃、引越し、結婚、出産、世代交代) | 賃貸借の基本など |
| `farewell` | 別れ(住民の死・退去) | 相続、原状回復 |
| `romance` | 恋愛(親密度で進む会話、デート) | 兼用住宅、共有名義など「二人の住まい」の論点 |
| `season` | 時勢(地価公示、統計、税制改正、災害) | 統計、地価公示、建物の知識、国土法 |

### `speaker` の値
| 値 | 意味 |
|---|---|
| キャラID(`kr-yoshie` 等) | `content/gen<N>/characters/` の人物 |
| `"player"` | 主人公(名前・見た目はプレイヤーの選択に従う) |
| `"mentor"` | 教える側。**第1世代=禿鷹社長(ハゲタ)、第2世代=海沢(ジン)、第3世代以降=その世代の師**。表示時に解決する |
| `"narration"` | 地の文(話者名なし) |

> `dialogue: string[]` を使っている現行データでは、メンターの行を `ハゲタ「…」` で書き、
> 表示時にその世代のメンター名へ置換する(docs/GAME_DESIGN.md)。
> **世代ごとのメンターが誰かは `content/gen<N>/README.md` に書く。** イベント側で明示したいときは
> `"mentorId": "umizawa"` を持たせる(第2世代のように、メンター本人が登場人物でもある場合)。
> **第2世代のメンター(海沢)は信用できない。** 教えにグレーな手法が混ざり、その誤りが後の回で判明する。

### 恋愛イベント(`kind: "romance"`)の追加フィールド
恋愛は別カテゴリではなく**イベントの一種**。上記の共通フィールドに加えて、親密度のはしごを持つ:

```jsonc
{
  "minAffection": 24,
  "stages": [{ "minAffection": 0, "lines": ["…"] }],  // 親密度ごとの日常会話
  "houseInviteLines": ["…"],                          // 家を見に行きたいと言い出す
  "idealHome": { "description": "…", "likedFeatures": [], "dislikedFeatures": [] },
  "reactions": { "good": [], "bad": [], "neutral": [] }, // 内見中の反応({feature} を差し込む)
  "proposalLines": ["…"]
}
```
デート(物件巡り)の中でもメンターが法的な話をし、`choices` / `explanation` で学習が成立する。

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

## キャラクター `content/gen<N>/characters/*.json`

```jsonc
{
  "id": "kr-yoshie",
  "name": "シルビア",             // 表示名。原則 givenName と同じ(呼ぶときは名前だけ)
  "familyName": "織部",          // 苗字は日本語(漢字)。家の話をするときに出す
  "givenName": "シルビア",        // 名前はカタカナ(あつ森風)
  "sprite": "villager-03",       // スプライト識別子
  "generation": 1,               // 初登場の世代。フォルダ gen<N> と一致させる
  "appearsIn": [1, 3],           // 任意。複数世代に登場する人物(生き延びて年を取る人・海沢など)
  "age": 68,                      // 年齢(時間経過で加齢。死亡イベントの基準)
  "gender": "female",
  "family": "見沼家",             // 任意。世代をまたぐ一族(見沼家・鈴木家・禿鷹家・田中家)
  "descendantOf": "minuma-shigeru", // 任意。先祖のキャラID。子孫関係を機械的に辿るために使う
  "romanceable": false,
  "initialResident": true,        // 任意。ゲーム開始時から村にいる(第1世代は禿鷹社長だけ)
  "home": "house-yoshie",        // 住んでいる建物ID(近くに配置される)

  // --- 人物を「論点の入れ物」にしないための項目 ---
  "personality": "68歳。元呉服店の未亡人。おっとりして見えるが店を三十年一人で回した芯の強さがある。「〜ですのよ」",
  "motive": "家をきちんと誰かに渡し、身軽になって余生を過ごしたい",   // その人が何をしたいか
  "weakness": "思い出のある物を手放す決心が、いつも一歩手前で鈍る",   // 弱さ・欠点
  "catchphrase": "あらまあ、そうですのね。",                          // 口癖
  "relations": [                                                      // 人物どうしの関係
    { "characterId": "hinata", "kind": "friend", "note": "孫のようにかわいがっている" }
  ]
}
```

### 名前の規則
**苗字=日本語(漢字) + 名前=カタカナ(あつ森風)**。`familyName` / `givenName` に分けて持ち、
`name` は表示用(原則 `givenName` と同じ)。会話では名前で呼び、**家の話をするときだけ苗字を出す**
(「見沼さんとこの畑」)。家族は同じ苗字にすること。**IDは変えない**(イベント・世帯・relations が壊れる)。

| 家 | 第1世代 | 第3世代 | 第4世代 | 第5世代 |
|---|---|---|---|---|
| 見沼家 | シゲル / ハル | カオル / サエ | — | サエ |
| 鈴木家 | タケオ / ナオ / ソラ | ソラ(68) / マモル / リク | — | リク |
| 禿鷹家 | ハゲタ | ゴロー | ミオ | — |
| 田中家 | ポッポ | — | — | ツグミ |
| 桜井家 | メープル | メープル(76) | — | — |
| 水瀬家 | リオン | リオン(77) | — | — |

### 世代をまたぐ人物
- **生き延びる人**: `appearsIn` に後の世代を足す(第1世代で8歳のソラは第3世代で68歳)。
  gen1 → gen3 はおよそ60年、gen3 → gen5 はさらに約50年。**年齢を計算して矛盾させない**
- **子孫**: `descendantOf` に先祖のキャラIDを書く。親の代の因縁・恩・約束が子に引き継がれる

### 雑談 `smallTalk`(任意)
話しかけたときの一言。**プレイヤーが案内した家の住み心地**まで含めて、その人らしい話をさせる。

```jsonc
"smallTalk": {
  "movedIn": ["…"],       // 入居して間もない頃(2〜3本)
  "default": ["…"],       // 通常の雑談(4〜6本)。他の住民の噂話を入れると町が生きる
  "satisfied": ["…"],     // 希望(moveIn.likedFeatures)に合う家に住めている(2〜3本)
  "dissatisfied": ["…"],  // 希望と食い違う家(moveIn.dislikedFeatures を含む)に住んでいる(2〜3本)
  "beforeExam": ["…"],    // 試験が近い時期(9〜10月)
  "season": { "1": ["…"], "4": ["…"], "8": ["…"], "12": ["…"] }  // 月ごとの一言
}
```
- `satisfied` / `dissatisfied` は、その人の `moveIn.likedFeatures` / `dislikedFeatures` に**具体的に言及**する
- 不満でも主人公を責めすぎない。「次はもっと良い家を」という気持ちが伝わる程度にする
- **世帯内で評価が割れてよい**(夫は静かで満足・妻は静かすぎて不満)
- 住民に法律用語を言わせない。生活実感として住まいの話をするのはよい

`relations[].kind` の例: `spouse` / `parent` / `child` / `family-like` / `friend` / `neighbor` /
`landlord` / `tenant` / `client` / `business` / `mentor` / `ally` / `rival` / `feud` / `distrust` / `trouble` / `roommate` / `fiance`。
**一人の人物のファイルは一つだけ**(IDの重複を避けるため)。複数世代に出る人物は `appearsIn` で示す。

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

## 世帯 `content/households/*.json`
**転入の単位**。人物は `content/characters/` を参照するだけで、データを二重に持たない
(転入者と住民は同一人物。`content/newcomers/` は廃止)。

```jsonc
{
  "id": "hh-tanaka",
  "kind": "family",                 // single | couple | family | share
  "label": "田中さん一家",
  "moveReason": "転勤で村に来た",
  "topicId": "gyoho-juyojiko",      // 引越し理由に紐づく論点(メモが発生する)
  "budget": 9,                       // 世帯合計(万円)
  "order": 1,                        // 案内する順番。1 = 村にいちばん最初に来る世帯(見沼家)
  "memberIds": ["nc-tanaka-taro", "nc-tanaka-hana"]
}
```
**世帯は「家」単位**。苗字を持たない量産キャラは置かない。第1世代は住民ゼロの村に
`order` の順で一軒ずつ越してくる(1=見沼家 … 9=鈴木家)。

人物側は `characters/*.json` に転入時の希望を持つ:
```jsonc
{
  "moveIn": {
    "demands": "音楽を大音量で流したいので防音性の高い家",
    "likedFeatures": ["防音", "角部屋"],
    "dislikedFeatures": ["木造", "隣が近い"]
  }
}
```
**メンバーごとに希望が食い違ってよい**(夫は駅近・妻は静か)。折り合う物件を探すのがゲーム性。
契約成立で**世帯全員が村の住民になる**。

## 恋愛(`content/gen<N>/events/romance/*.json` へ統合済み)
`content/romance/` は廃止。恋愛は **イベントの一種**(`kind: "romance"`)として events 配下に置く。
形は「イベントの共通フィールド + 親密度のはしご」で、上の
「恋愛イベント(`kind: "romance"`)の追加フィールド」を参照。

---

## 金額の単位
**すべて万円単位の整数**。`rent: 4` = 家賃4万円/月、`price: 1200` = 1200万円。円単位では持たない。

## 検証
```bash
node scripts/check-coverage.mjs          # 検証のみ(不整合があれば exit 1)
node scripts/check-coverage.mjs --write  # content/COVERAGE.md の対応表を再生成
node scripts/gen-household-doc.mjs       # docs/events-by-household.md を再生成
node scripts/gen-household-doc.mjs --check  # 生成物が古ければ exit 1
```
`docs/events-by-household.md` は生成物なので直接編集しない。移動の型と計画行(まだ content に無いイベント)は
**手書きの [docs/household-plan.json](household-plan.json)** にあり、生成スクリプトはこれを読むだけで書き換えない。
`summary` が欠けたイベントがあると `gen-household-doc.mjs` は失敗する。
検証項目: JSONがパースできるか / `id` とファイル名の一致 / id の重複 / `generation` とフォルダの一致 /
`kind` とフォルダの一致 / `topicId` が topics.md に存在するか / `cast` の人物が実在するか /
**イベントとキャラの世代ズレ**(gen1 のイベントが gen3 の人物を参照していないか。`appearsIn` を考慮) /
人物IDの重複 / `relations` の参照先の実在 / 世帯 `memberIds` の実在 / 54論点の網羅。

## 暦(出生年)

**第1世代の主人公は1000年生まれ。**15歳で仕事を始め、30歳の定年で世代交代するので、**1世代=30年**。

| 世代 | 開始年 | 主人公の生年 |
|---|---|---|
| 1 | **1015年** | 1000年 |
| 2 | 1045年 | 1030年 |
| 3 | 1075年 | 1060年 |
| 4 | 1105年 | 1090年 |
| 5 | 1135年 | 1120年 |

全体で **1000〜1150年の150年**を描く。

人物データは以下を持つ(スクリプトで自動計算):
- `birthYear` — 出生年。`その世代の開始年 - age` で算出
- `agesByGeneration` — 登場する各世代での年齢。`{"1": 8, "3": 68}` の形

**年齢の矛盾はこれで機械的に検出できる。**`scripts/calc-birth-years.mjs` を実行すると、未生誕(マイナス)や100歳超を検出して報告する。

