# 網羅性(論点 × イベント × 世代)

`scripts/check-coverage.mjs` が `content/topics.md`(54論点)と `content/gen*/events/**/*.json` を突き合わせて生成する。
イベントの整合性(id重複・kindとフォルダの一致・cast の実在・世代ズレ・世帯メンバー)も同時に検証する。

```bash
node scripts/check-coverage.mjs          # 検証のみ(不整合があれば exit 1)
node scripts/check-coverage.mjs --write  # このファイルの対応表を再生成
```

## 結論(2026-08 時点)

- **54論点すべてに最低1イベントがある(取りこぼしゼロ)。**
- **原則は1論点1イベント。** 世代が増えてもイベントを増やさず、置き場所を変える方針。
- **例外: 頻出度Aかつ物語上の必然があるものに限り1論点2イベント。** 第3世代(サスペンス)の
  段階構造のために4件だけ追加した(下記「第3世代の2件目」)。
- 旧 `tanaka-poppo-tejukin`(topicId `takkengyouhou-tetsukekin` が topics.md に存在せず、内容も `gyoho-tetsuke-seigen` と重複)は**削除**した。
  手付の論点は `ev-gyoho-tetsuke-seigen`(第2世代・海沢が800万を要求する場面)が受け持つ。

## 世代への振り分けの考え方

**分野(権利関係/宅建業法/…)ではなく、世代の舞台とトーンで振り分ける**(docs/STORY.md)。

| 世代 | 舞台・トーン | 引き受ける題材 |
|---|---|---|
| 1 | ありきた村・ほのぼの・基礎 | 村の暮らしに実在するもの: 敷金、借地借家、用途地域、建蔽率、免許の要否、媒介契約 |
| 2 | 黒会市・都会・誘惑 | 業法の禁止事項を「やってしまう側」から: 誇大広告、重説の順序違反、手付の上限、クーリング・オフ、営業保証金・保証協会・帳簿・監督処分(会社の制度は住民の悩みにならないので business として都会で扱う) |
| 3 | ありきた村・サスペンス | 権利関係の争い: 相続、契約不適合、共有、時効、物権変動、仮登記、無権代理、盛土(証拠)。加えて**業界の不都合を暴く業法2件**(囲い込み・告知)と、**転出/転入の理由になる借地・借家** |
| 4 | 黒会市・再建 | 法令上の制限と大規模開発: 都市計画法、開発許可、区画整理、防火地域、建築確認、高さ制限、瑕疵担保履行法 |
| 5 | 総力戦(村+市+白夜村) | まちづくり: 農地法、譲渡所得の特別控除、地価公示、統計、国土法の届出、土地の知識 |

第2世代の `gyoho-kantoku`(業務停止・免許取消)は、第4世代冒頭の免許取消(事業崩壊)への直接の伏線として置いてある。
第1世代の `ev-shakuchi`(見沼家の底地)・`ev-hourei-kenpei`(鈴木家の転入)は、第3世代の見沼家 vs 鈴木家の争いの伏線。
とくに `ev-hourei-kenpei` の「敷地200㎡・建蔽率60%」は、**第3世代のどんでん返しの数字そのもの**なので変更しないこと。

## 第3世代の2件目(1論点2イベントの例外)

第3世代は**稼ぐこと=捜査が進むこと**という段階構造(docs/STORY.md)のため、
下の4論点だけ2件目を置いた。**いずれも頻出度Aで、物語上その場面が要る**もの。

| topicId | 頻出度 | 1件目 | 第3世代の2件目 | なぜ2件目が要るか |
|---|---|---|---|---|
| `gyoho-baikai` | A | 第1世代 `ev-gyoho-baikai`(専任の期間と報告・ほのぼの版) | `ev-gyoho-baikai-kakoikomi` | **囲い込み**。見沼家の空き家と山を預かったまま流さない構図が、争いを長引かせる装置そのもの。第1世代は囲い込みに触れない軽い媒介契約の回として残す |
| `gyoho-juyojiko` | A | 第2世代 `ev02-koji-juyojiko`(賃貸・説明の順序違反) | `ev-gyoho-juyojiko-byakuya` | **売買での記載事項**。COVERAGE が元から推奨していた「賃貸で説明する回/売買で説明する回」の分割。転入者(白夜村からの避難民)の初回接触も兼ねる |
| `shakuchi` | A | 第1世代 `ev-shakuchi`(建物買取請求権) | `ev-shakuchi-hanaya` | **存続期間(30年→20年→10年)**。花屋リオン(77)の転出。六十年ぶん書面が一枚も無いことが露呈する場面 |
| `shakka` | A | 第1世代 `ev-shakka`(更新拒絶の正当事由) | `ev-shakka-panya` | **造作買取請求権(特約で排除できる)**。パン屋メープル(76)の転出。「柵を運ぶのを手伝った」証言の場面 |

第3世代は転出(`farewell`)が主軸なので、**転出理由そのものが論点**になる借地・借家をここで2件目に回している。

## 分野ごとの偏りについて

イベント数は「論点数」に比例していて、実試験の出題数には比例していない。
**宅建業法は実試験の40%なのに論点が15個しかない**ため、イベント比率は26%にとどまる。
出題比率に寄せるなら、頻出度Aの論点(35条・37条・8種制限・報酬・媒介契約)を1論点2イベントにするのが妥当
(例: 35条を「賃貸で説明する回」と「売買で説明する回」に分ける)。
この分割を実際に行ったのは、いまのところ**第3世代の4件だけ**(上表)。他は総数を増やさない方針を優先している。

<!-- ここから下は scripts/check-coverage.mjs --write が自動生成する。手で編集しない -->
## 論点 × イベント 対応表

| 分野 | topicId | 論点 | 頻出度 | イベントID | 世代 | 有無 |
|---|---|---|---|---|---|---|
| 権利関係 | minpo-ishihyoji | 意思表示(詐欺・強迫・虚偽表示・錯誤) | A | ev-minpo-ishihyoji | 2 | ✅ |
| 権利関係 | minpo-seinen | 制限行為能力者(未成年者・成年被後見人等) | B | ev06-minase-rion-seinen | 1 | ✅ |
| 権利関係 | minpo-dairi | 代理(無権代理・表見代理・復代理) | A | ev-minpo-dairi | 3 | ✅ |
| 権利関係 | minpo-baibai | 売買契約の基本(申込と承諾・手付) | A | ev05-shiraishi-olivia-tetsuke<br>rom-minase-rion | 1,1 | ✅ |
| 権利関係 | minpo-chintai | 賃貸借(敷金・原状回復・転貸) | A | ev-life-yachin<br>ev01-kishiwada-gaston-shikikin | 1,1 | ✅ |
| 権利関係 | minpo-jiko | 時効(取得時効・消滅時効・完成猶予と更新) | B | ev-minpo-jiko | 3 | ✅ |
| 権利関係 | minpo-bukken-hendo | 物権変動(登記と対抗要件・二重譲渡) | A | ev-minpo-bukken-hendo | 3 | ✅ |
| 権利関係 | minpo-tanpo | 契約不適合責任(追完・代金減額・解除・通知期間) | A | ev-minpo-tanpo | 3 | ✅ |
| 権利関係 | minpo-furikou | 債務不履行・解除・危険負担 | B | ev-minpo-furikou | 2 | ✅ |
| 権利関係 | minpo-teito | 抵当権(効力の範囲・順位・法定地上権・根抵当) | A | ev-minpo-teito | 4 | ✅ |
| 権利関係 | minpo-hosho | 保証・連帯債務・連帯保証 | B | ev-minpo-hosho | 1 | ✅ |
| 権利関係 | minpo-souzoku | 相続(法定相続分・遺言・遺留分・配偶者居住権) | A | ev-minpo-souzoku | 3 | ✅ |
| 権利関係 | shakuchi | 借地借家法・借地(存続期間・更新・建物買取請求) | A | ev-shakuchi<br>ev-shakuchi-hanaya | 1,3 | ✅ |
| 権利関係 | shakka | 借地借家法・借家(更新拒絶・造作買取・定期建物賃貸借) | A | ev-shakka<br>ev-shakka-panya | 1,3 | ✅ |
| 権利関係 | minpo-kyoyu | 共有(持分・変更・管理・分割請求) | B | ev-minpo-kyoyu | 3 | ✅ |
| 権利関係 | minpo-fuhoukoui | 不法行為(使用者責任・工作物責任) | B | ev-minpo-fuhoukoui | 1 | ✅ |
| 権利関係 | kubun-shoyu | 区分所有法(集会・規約・決議要件) | A | ev-kubun-shoyu | 2 | ✅ |
| 権利関係 | toki-ho | 不動産登記法(表示登記・権利登記・仮登記) | B | ev-toki-ho | 3 | ✅ |
| 宅建業法 | gyoho-menkyo | 宅建業の免許(要否・欠格事由・免許換え) | A | ev03-sakurai-maple-menkyo | 1 | ✅ |
| 宅建業法 | gyoho-takkenshi | 宅地建物取引士(登録・宅建士証・専任設置) | A | ev-gyoho-takkenshi | 1 | ✅ |
| 宅建業法 | gyoho-baikai | 媒介契約(一般・専任・専属専任、レインズ・報告義務) | A | ev-gyoho-baikai<br>ev-gyoho-baikai-kakoikomi | 1,3 | ✅ |
| 宅建業法 | gyoho-juyojiko | 重要事項説明(35条書面) | A | ev-gen2-opening<br>ev02-koji-juyojiko<br>ev-gyoho-juyojiko-byakuya | 2,2,3 | ✅ |
| 宅建業法 | gyoho-8shu | 8種制限(クーリング・オフ・自己の所有に属しない物件の売買制限等) | A | ev04-koji-cooling | 2 | ✅ |
| 宅建業法 | gyoho-hoshu | 報酬額の制限(速算式・貸借の報酬・空家等の特例) | A | ev-gyoho-hoshu | 2 | ✅ |
| 宅建業法 | gyoho-eigyo-hosho | 営業保証金(供託・還付・取戻し) | A | ev-gyoho-eigyo-hosho | 2 | ✅ |
| 宅建業法 | gyoho-hosho-kyokai | 保証協会(弁済業務保証金・分担金) | A | ev-gyoho-hosho-kyokai | 2 | ✅ |
| 宅建業法 | gyoho-37jo | 37条書面(契約書面の記載事項・交付義務) | A | ev-gyoho-37jo | 2 | ✅ |
| 宅建業法 | gyoho-tetsuke-seigen | 手付金等の保全措置・手付額の制限(2割) | A | ev-gyoho-tetsuke-seigen | 2 | ✅ |
| 宅建業法 | gyoho-kokoku | 広告規制・業務上の規制(誇大広告・取引態様明示) | B | ev-gen2-bottakuri<br>ev-gyoho-kokoku | 2,2 | ✅ |
| 宅建業法 | gyoho-jimusho | 事務所・案内所等の規制(標識・専任宅建士の設置) | B | ev-gyoho-jimusho | 2 | ✅ |
| 宅建業法 | gyoho-kantoku | 監督処分・罰則(指示・業務停止・免許取消) | B | ev-gyoho-kantoku | 2 | ✅ |
| 宅建業法 | gyoho-kashi-tanpo | 住宅瑕疵担保履行法(資力確保措置・届出) | B | ev-gyoho-kashi-tanpo | 4 | ✅ |
| 宅建業法 | gyoho-meibo | 従業者名簿・帳簿・従業者証明書 | C | ev-gyoho-meibo | 2 | ✅ |
| 法令上の制限 | hourei-yoto | 用途地域と用途制限 | A | rom-sakurai-maple<br>ev07-sakurai-maple-yoto | 1,1 | ✅ |
| 法令上の制限 | hourei-kenpei | 建蔽率・容積率 | A | ev-hourei-kenpei | 1 | ✅ |
| 法令上の制限 | hourei-toshikeikaku | 都市計画法(区域区分・地域地区・都市計画の内容) | A | ev-hourei-toshikeikaku | 4 | ✅ |
| 法令上の制限 | hourei-kaihatsu | 開発許可(要否・規模・手続) | A | ev-hourei-kaihatsu | 4 | ✅ |
| 法令上の制限 | hourei-kenchiku-kakunin | 建築確認(要否・手続)・単体規定 | B | ev-hourei-kenchiku-kakunin | 4 | ✅ |
| 法令上の制限 | hourei-kokudo | 国土利用計画法(事後届出制) | B | ev-hourei-kokudo | 5 | ✅ |
| 法令上の制限 | hourei-nochi | 農地法(3条・4条・5条許可) | A | ev-hourei-nochi | 5 | ✅ |
| 法令上の制限 | hourei-takasa | 高さ制限・斜線制限・日影規制 | B | ev-hourei-takasa | 4 | ✅ |
| 法令上の制限 | hourei-boka | 防火地域・準防火地域 | B | ev-hourei-boka | 4 | ✅ |
| 法令上の制限 | hourei-moridokisei | 盛土規制法(宅地造成等工事の許可・届出) | B | ev-hourei-moridokisei | 3 | ✅ |
| 法令上の制限 | hourei-kukaku | 土地区画整理法(換地・仮換地) | C | ev-hourei-kukaku | 4 | ✅ |
| 税・その他 | zei-fudosan | 不動産取得税・固定資産税 | A | ev08-kishiwada-gaston-koteishisan | 1 | ✅ |
| 税・その他 | zei-inshi | 印紙税(課税文書・記載金額・過怠税) | B | ev-zei-inshi | 4 | ✅ |
| 税・その他 | zei-touroku | 登録免許税(税率・住宅用家屋の軽減) | C | ev-zei-touroku | 3 | ✅ |
| 税・その他 | zei-shotoku | 所得税(譲渡所得・3000万円特別控除・軽減税率) | B | ev-zei-shotoku | 5 | ✅ |
| 税・その他 | sonota-chika | 地価公示法・不動産鑑定評価基準 | B | ev-sonota-chika | 5 | ✅ |
| 税・その他 | sonota-kiko | 住宅金融支援機構(免除科目) | B | ev-sonota-kiko | 4 | ✅ |
| 税・その他 | sonota-keihin | 景品表示法・公正競争規約(免除科目) | B | ev-sonota-keihin | 2 | ✅ |
| 税・その他 | sonota-tochi | 土地の知識(地形・災害リスク)(免除科目) | A | ev-sonota-tochi | 5 | ✅ |
| 税・その他 | sonota-tatemono | 建物の知識(構造・材料)(免除科目) | B | ev-sonota-tatemono | 4 | ✅ |
| 税・その他 | sonota-toukei | 統計(地価・着工戸数・業者数)(免除科目) | A | ev-sonota-toukei | 5 | ✅ |

**イベントが無い論点: 0件** (なし)

**topics.md に存在しない topicId を持つイベント: 0件** (なし)

## 世代ごとのイベント数

| 世代 | 舞台 | イベント数 | 種類の内訳 |
|---|---|---|---|
| 第1世代 | ありきた村(基礎) | 16 | trouble 6 / newcomer 3 / work 1 / business 2 / village 1 / life 1 / romance 2 |
| 第2世代 | 黒会市(誘惑) | 17 | trouble 5 / work 6 / business 5 / life 1 |
| 第3世代 | ありきた村(サスペンス) | 13 | trouble 1 / newcomer 1 / work 1 / village 1 / dispute 6 / farewell 3 |
| 第4世代 | 黒会市(再建) | 11 | trouble 4 / work 6 / season 1 |
| 第5世代 | 村+市+白夜村(総力戦) | 6 | village 3 / season 3 |

## 分野ごとの過不足(実試験の出題比率との比較)

| 分野 | 実試験の問数 | 出題比率 | 論点数 | イベント数 | イベント比率 | 差 |
|---|---|---|---|---|---|---|
| 権利関係 | 14 | 28.0% | 18 | 22 | 34.9% | 6.9pt |
| 宅建業法 | 20 | 40.0% | 15 | 19 | 30.2% | -9.8pt |
| 法令上の制限 | 8 | 16.0% | 11 | 12 | 19.0% | 3.0pt |
| 税・その他 | 8 | 16.0% | 10 | 10 | 15.9% | -0.1pt |

合計イベント数: 63
