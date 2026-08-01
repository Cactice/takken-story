# content/ スキーマ

- `topics.md` — 宅建論点マップ。イベント・試験問題は表の `topicId` を参照する。
- `characters/*.json` — 住民1人につき1ファイル。
  `{ id, name, sprite(仮パス), personality(職業・年齢・口調を含む), romanceable }`
- `events/*.json` — 相談イベント1本につき1ファイル。
  `{ id, characterId(characters の id), topicId(topics.md の id), dialogue: string[], choices: string[3], correctChoice(0始まり), explanation }`
