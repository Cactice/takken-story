# 網羅性(論点 × イベント)

`scripts/check-coverage.mjs` が `content/topics.md`(54論点)と `content/gen*/events/**/*.json` を突き合わせて生成する。

```bash
node scripts/check-coverage.mjs          # 検証のみ(不整合があれば exit 1)
node scripts/check-coverage.mjs --write  # このファイルの対応表を再生成
```

## 結論(2026-08 時点)

- **54論点すべてに最低1イベントがある(取りこぼしゼロ)。** イベント総数55件 = 54論点 × 1 + 重複1件。
- 方針どおり **1論点1イベント**。世代が増えてもイベントを増やさず、既存を世代へ振り分ける。
- **要修正1件**: `tanaka-tejukin.json` の `topicId` が `takkengyouhou-tetsukekin` で `topics.md` に存在しない。
  内容は手付金なので `gyoho-tetsuke-seigen`(既に `ev-gyoho-tetsuke-seigen` がある)か `minpo-baibai` と重複する。
  **統合または topicId 修正が必要**。中身の書き換えは担当外のため未着手。

## 分野ごとの過不足

イベント数は「論点数」に比例していて、「実試験の出題数」には比例していない。

- **宅建業法が構造的に不足**。実試験は50問中20問(40%)が宅建業法なのに、論点が15個しかないためイベントは16件(29%)。
  出題比率に合わせるなら宅建業法は **あと5〜6件** ほしい。頻出度Aの論点(35条・37条・8種制限・報酬・媒介契約)を
  **1論点2イベント**にするのが妥当(例: 35条を「賃貸で説明する回」と「売買で説明する回」に分ける)。
- 権利関係・法令上の制限・税その他は出題比率に対してむしろ過剰気味。ただし論点数そのものが多いので、
  これ以上減らすとかえって穴になる。**追加はしない**という判断でよい。

## 世代分担の現状

現状は **47件が第1世代**に集中している。第1世代だけで54論点のうち47をカバーする = ほぼ試験範囲が第1世代で完結する。
これは「第1世代は基礎中心・わかりやすさ優先」という方針(docs/STORY.md)と矛盾する。
ただし全世代で網羅できていればよいので、**第2〜5世代の物語が固まった段階で第1世代から段階的に移す**のが現実的。

### 第1世代から外した論点とその理由

第1世代の舞台は「ありきた村」(自然豊かな農村・ほのぼの)。**村の日常にその題材が物理的に存在しない**ものだけを外した。
物語のトーン(ドロドロしているか)ではなく、**題材が村に在るか**を基準にしている。

| topicId | 移動先 | 理由 |
|---|---|---|
| kubun-shoyu | gen2 | 区分所有=分譲マンション。村に分譲マンションが無い。黒会市(第2世代)の舞台に合う |
| gyoho-kokoku | gen2 | 誇大広告。第2世代の学習方針「宅建業法の禁止事項をやってしまう側から学ぶ」そのもの |
| gyoho-kantoku | gen2 | 監督処分・免許取消。第2世代の違反 → 第4世代冒頭の免許取消への直接の伏線 |
| gyoho-meibo | gen2 | 従業者名簿・帳簿。第1世代の事務所は社長と主人公だけで従業者名簿が成立しない |
| gyoho-kashi-tanpo | gen2 | 住宅瑕疵担保履行法。新築住宅を分譲する売主業者の話で、村の中古・空き家取引では出てこない |
| hourei-takasa | gen4 | 高さ制限・斜線制限・日影規制。高層建築が無い村では成立しない。第4世代の都市開発向き |
| hourei-kukaku | gen4 | 土地区画整理事業。市街地の再開発手続で、第4世代の黒会市再建に直結する |

第3・第5世代へはまだ何も割り当てていない。docs/STORY.md によれば、
第3世代(村・サスペンス)は `minpo-souzoku` / `minpo-kyoyu` / `minpo-jiko` / `toki-ho`、
第5世代(村の再生)は `hourei-nochi` / `zei-shotoku` / `sonota-tochi` が本来の持ち場。
第1世代に伏線を置いたうえで、**第3・第5世代の制作時に移す候補**として記録しておく。

<!-- ここから下は scripts/check-coverage.mjs --write が自動生成する。手で編集しない -->
## 論点 × イベント 対応表

| 分野 | topicId | 論点 | 頻出度 | イベントID | 世代 | 有無 |
|---|---|---|---|---|---|---|
| 権利関係 | minpo-ishihyoji | 意思表示(詐欺・強迫・虚偽表示・錯誤) | A | ev-minpo-ishihyoji | 1 | ✅ |
| 権利関係 | minpo-seinen | 制限行為能力者(未成年者・成年被後見人等) | B | ev06-ren-seinen | 1 | ✅ |
| 権利関係 | minpo-dairi | 代理(無権代理・表見代理・復代理) | A | ev-minpo-dairi | 1 | ✅ |
| 権利関係 | minpo-baibai | 売買契約の基本(申込と承諾・手付) | A | ev05-misaki-tetsuke | 1 | ✅ |
| 権利関係 | minpo-chintai | 賃貸借(敷金・原状回復・転貸) | A | ev01-tetsujiro-shikikin | 1 | ✅ |
| 権利関係 | minpo-jiko | 時効(取得時効・消滅時効・完成猶予と更新) | B | ev-minpo-jiko | 1 | ✅ |
| 権利関係 | minpo-bukken-hendo | 物権変動(登記と対抗要件・二重譲渡) | A | ev-minpo-bukken-hendo | 1 | ✅ |
| 権利関係 | minpo-tanpo | 契約不適合責任(追完・代金減額・解除・通知期間) | A | ev-minpo-tanpo | 1 | ✅ |
| 権利関係 | minpo-furikou | 債務不履行・解除・危険負担 | B | ev-minpo-furikou | 1 | ✅ |
| 権利関係 | minpo-teito | 抵当権(効力の範囲・順位・法定地上権・根抵当) | A | ev-minpo-teito | 1 | ✅ |
| 権利関係 | minpo-hosho | 保証・連帯債務・連帯保証 | B | ev-minpo-hosho | 1 | ✅ |
| 権利関係 | minpo-souzoku | 相続(法定相続分・遺言・遺留分・配偶者居住権) | A | ev-minpo-souzoku | 1 | ✅ |
| 権利関係 | shakuchi | 借地借家法・借地(存続期間・更新・建物買取請求) | A | ev-shakuchi | 1 | ✅ |
| 権利関係 | shakka | 借地借家法・借家(更新拒絶・造作買取・定期建物賃貸借) | A | ev-shakka | 1 | ✅ |
| 権利関係 | minpo-kyoyu | 共有(持分・変更・管理・分割請求) | B | ev-minpo-kyoyu | 1 | ✅ |
| 権利関係 | minpo-fuhoukoui | 不法行為(使用者責任・工作物責任) | B | ev-minpo-fuhoukoui | 1 | ✅ |
| 権利関係 | kubun-shoyu | 区分所有法(集会・規約・決議要件) | A | ev-kubun-shoyu | 2 | ✅ |
| 権利関係 | toki-ho | 不動産登記法(表示登記・権利登記・仮登記) | B | ev-toki-ho | 1 | ✅ |
| 宅建業法 | gyoho-menkyo | 宅建業の免許(要否・欠格事由・免許換え) | A | ev03-hinata-menkyo | 1 | ✅ |
| 宅建業法 | gyoho-takkenshi | 宅地建物取引士(登録・宅建士証・専任設置) | A | ev-gyoho-takkenshi | 1 | ✅ |
| 宅建業法 | gyoho-baikai | 媒介契約(一般・専任・専属専任、レインズ・報告義務) | A | ev-gyoho-baikai | 1 | ✅ |
| 宅建業法 | gyoho-juyojiko | 重要事項説明(35条書面) | A | ev02-koji-juyojiko | 1 | ✅ |
| 宅建業法 | gyoho-8shu | 8種制限(クーリング・オフ・自己の所有に属しない物件の売買制限等) | A | ev04-koji-cooling | 1 | ✅ |
| 宅建業法 | gyoho-hoshu | 報酬額の制限(速算式・貸借の報酬・空家等の特例) | A | ev-gyoho-hoshu | 1 | ✅ |
| 宅建業法 | gyoho-eigyo-hosho | 営業保証金(供託・還付・取戻し) | A | ev-gyoho-eigyo-hosho | 1 | ✅ |
| 宅建業法 | gyoho-hosho-kyokai | 保証協会(弁済業務保証金・分担金) | A | ev-gyoho-hosho-kyokai | 1 | ✅ |
| 宅建業法 | gyoho-37jo | 37条書面(契約書面の記載事項・交付義務) | A | ev-gyoho-37jo | 1 | ✅ |
| 宅建業法 | gyoho-tetsuke-seigen | 手付金等の保全措置・手付額の制限(2割) | A | ev-gyoho-tetsuke-seigen | 1 | ✅ |
| 宅建業法 | gyoho-kokoku | 広告規制・業務上の規制(誇大広告・取引態様明示) | B | ev-gyoho-kokoku | 2 | ✅ |
| 宅建業法 | gyoho-jimusho | 事務所・案内所等の規制(標識・専任宅建士の設置) | B | ev-gyoho-jimusho | 1 | ✅ |
| 宅建業法 | gyoho-kantoku | 監督処分・罰則(指示・業務停止・免許取消) | B | ev-gyoho-kantoku | 2 | ✅ |
| 宅建業法 | gyoho-kashi-tanpo | 住宅瑕疵担保履行法(資力確保措置・届出) | B | ev-gyoho-kashi-tanpo | 2 | ✅ |
| 宅建業法 | gyoho-meibo | 従業者名簿・帳簿・従業者証明書 | C | ev-gyoho-meibo | 2 | ✅ |
| 法令上の制限 | hourei-yoto | 用途地域と用途制限 | A | ev07-hinata-yoto | 1 | ✅ |
| 法令上の制限 | hourei-kenpei | 建蔽率・容積率 | A | ev-hourei-kenpei | 1 | ✅ |
| 法令上の制限 | hourei-toshikeikaku | 都市計画法(区域区分・地域地区・都市計画の内容) | A | ev-hourei-toshikeikaku | 1 | ✅ |
| 法令上の制限 | hourei-kaihatsu | 開発許可(要否・規模・手続) | A | ev-hourei-kaihatsu | 1 | ✅ |
| 法令上の制限 | hourei-kenchiku-kakunin | 建築確認(要否・手続)・単体規定 | B | ev-hourei-kenchiku-kakunin | 1 | ✅ |
| 法令上の制限 | hourei-kokudo | 国土利用計画法(事後届出制) | B | ev-hourei-kokudo | 1 | ✅ |
| 法令上の制限 | hourei-nochi | 農地法(3条・4条・5条許可) | A | ev-hourei-nochi | 1 | ✅ |
| 法令上の制限 | hourei-takasa | 高さ制限・斜線制限・日影規制 | B | ev-hourei-takasa | 4 | ✅ |
| 法令上の制限 | hourei-boka | 防火地域・準防火地域 | B | ev-hourei-boka | 1 | ✅ |
| 法令上の制限 | hourei-moridokisei | 盛土規制法(宅地造成等工事の許可・届出) | B | ev-hourei-moridokisei | 1 | ✅ |
| 法令上の制限 | hourei-kukaku | 土地区画整理法(換地・仮換地) | C | ev-hourei-kukaku | 4 | ✅ |
| 税・その他 | zei-fudosan | 不動産取得税・固定資産税 | A | ev08-tetsujiro-koteishisan | 1 | ✅ |
| 税・その他 | zei-inshi | 印紙税(課税文書・記載金額・過怠税) | B | ev-zei-inshi | 1 | ✅ |
| 税・その他 | zei-touroku | 登録免許税(税率・住宅用家屋の軽減) | C | ev-zei-touroku | 1 | ✅ |
| 税・その他 | zei-shotoku | 所得税(譲渡所得・3000万円特別控除・軽減税率) | B | ev-zei-shotoku | 1 | ✅ |
| 税・その他 | sonota-chika | 地価公示法・不動産鑑定評価基準 | B | ev-sonota-chika | 1 | ✅ |
| 税・その他 | sonota-kiko | 住宅金融支援機構(免除科目) | B | ev-sonota-kiko | 1 | ✅ |
| 税・その他 | sonota-keihin | 景品表示法・公正競争規約(免除科目) | B | ev-sonota-keihin | 1 | ✅ |
| 税・その他 | sonota-tochi | 土地の知識(地形・災害リスク)(免除科目) | A | ev-sonota-tochi | 1 | ✅ |
| 税・その他 | sonota-tatemono | 建物の知識(構造・材料)(免除科目) | B | ev-sonota-tatemono | 1 | ✅ |
| 税・その他 | sonota-toukei | 統計(地価・着工戸数・業者数)(免除科目) | A | ev-sonota-toukei | 1 | ✅ |

**イベントが無い論点: 0件** (なし)

**topics.md に存在しない topicId を持つイベント: 1件** `takkengyouhou-tetsukekin`(tanaka-tejukin)

## 分野ごとの過不足(実試験の出題比率との比較)

| 分野 | 実試験の問数 | 出題比率 | 論点数 | イベント数 | イベント比率 | 差 |
|---|---|---|---|---|---|---|
| 権利関係 | 14 | 28.0% | 18 | 18 | 32.7% | 4.7pt |
| 宅建業法 | 20 | 40.0% | 15 | 16 | 29.1% | -10.9pt |
| 法令上の制限 | 8 | 16.0% | 11 | 11 | 20.0% | 4.0pt |
| 税・その他 | 8 | 16.0% | 10 | 10 | 18.2% | 2.2pt |

合計イベント数: 55
