# content/ の歩き方

**世代が最上位**。世代ごとに舞台もキャストも変わるため、人物もイベントも世代の下に置く。
スキーマの詳細は [docs/CONTENT_SCHEMA.md](../docs/CONTENT_SCHEMA.md)。

```
content/
  gen1/ … gen5/
    README.md      その世代の舞台・トーン・主要人物・物語上の役割・論点の方針
    characters/    人物(1人1ファイル。IDは全世代で一意。再登場は appearsIn で示す)
    households/    転入の単位(世帯)。人物はIDで参照する
    events/<kind>/ イベント。フォルダは**分野ではなく種類**(trouble/newcomer/work/business/
                   village/dispute/life/farewell/romance/season)。分野は JSON の category
  reference/       条文コーパス(全世代共通・書き換えない)
  topics.md        54論点の一覧(イベントの topicId はここを参照する)
  COVERAGE.md      論点 × 世代 × イベントの網羅性(自動生成)
```

## 触るときのルール
- **法的な結論は変えない**: 既存イベントの `topicId` / `choices` / `correctChoice` / `explanation` は
  条文で検証する対象。書き換えてよいのは舞台・登場人物・セリフ・関係性・置く世代
- **1論点1イベント**を守る(総数を増やさず、置き場所で調整する)
- **1イベント=1キャラで完結させない**。`cast` に複数人を入れ、建物や隣人を絡める
- 住民は法律用語を話さない → メンターが分解して教える → 主人公がかみ砕く → 住民が感謝する
- 変更したら `node scripts/check-coverage.mjs` を通す(世代ズレ・ID重複・参照切れを検出する)
