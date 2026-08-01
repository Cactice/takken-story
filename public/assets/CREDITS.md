# アセットクレジット

## Tiny Town (v1.1)
- 作者: Kenney (https://kenney.nl)
- 入手元: https://kenney.nl/assets/tiny-town
- ライセンス: CC0 1.0 (パブリックドメイン、商用可、帰属表示不要) — 同梱 `tiny-town/License.txt` 参照
- 用途: 町のタイルマップ (`tiny-town/tilemap_packed.png`、16x16px、12x11タイル)

## Tiny Dungeon (v1.0)
- 作者: Kenney (https://kenney.nl)
- 入手元: https://kenney.nl/assets/tiny-dungeon
- ライセンス: CC0 1.0 (パブリックドメイン、商用可、帰属表示不要) — 同梱 `tiny-dungeon/License.txt` 参照
- 用途: 主人公・住民のキャラクタースプライト (`tiny-dungeon/tilemap_packed.png`、16x16px、12x11タイル)

## diagram/*.png (Tiny Town からの切り出し)
- 元素材: 上記 Tiny Town (Kenney / CC0 1.0)。ライセンスは CC0 のまま
- 内容: `grass.png`(タイル1) / `dirt.png`(40) / `road.png`(25) / `gravel.png`(43) /
  `floor-warm.png`(73) / `floor-cool.png`(77)
- 理由: パックされたシートは `background-repeat` で敷き詰められないため、
  図解で地面として敷く6枚だけ単体の16pxPNGに切り出した
- 用途: 図解の地面・床(`src/components/diagram/`)

## DotGothic16
- 作者: Fontworks Inc. / The DotGothic16 Project Authors (https://github.com/fontworks-fonts/DotGothic16)
- 入手元: Google Fonts (https://fonts.google.com/specimen/DotGothic16)
- ライセンス: SIL Open Font License 1.1 (商用可、改変可、再配布可) — 同梱 `fonts/DotGothic16-OFL.txt` 参照
- 用途: 図解の数値・単位・見出し(`fonts/dotgothic16.css` + `fonts/dotgothic16/*.woff2`)
- 備考: Google Fonts の unicode-range サブセット分割をそのまま自前ホストしている。
  ブラウザは実際に使った字を含むサブセット(1つ10KB前後)だけを取得する

タイル番号 → 用途の対応は `src/lib/sprites.ts`、`src/components/town/TownView.tsx`、
`src/components/diagram/tiles.ts` を参照。図解のデザイン方針は `docs/DESIGN.md`。
