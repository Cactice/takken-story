#!/usr/bin/env python3
"""冬の(雪が積もった)タイルシートを、元のCC0タイルシートから機械的に作る。

    python3 scripts/make-winter-tiles.py

タイル番号は元シートと完全に同じなので、マップ側は季節ごとに
参照するシート(URL)を差し替えるだけでよい(src/lib/maps/types.ts の SeasonSkin.sheet)。
元素材は Kenney (CC0) — public/assets/CREDITS.md 参照。
"""
import colorsys
from PIL import Image

SNOW = (226, 236, 250)   # 雪
PALE = (206, 214, 228)   # 雪をかぶった土・道


def mix(rgb, target, k):
    """元の色を残したまま target を k だけ混ぜる。真っ白にすると形が消えるので混ぜる"""
    return tuple(int(c * (1 - k) + t * k) for c, t in zip(rgb, target))

def frost(src, dst, *, ground_only=False):
    im = Image.open(src).convert('RGBA')
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if v < 0.25:          # 輪郭線はドット絵の骨格なので触らない
                continue
            deg = h * 360
            if s > 0.15 and 60 <= deg <= 175:        # 草・木の緑 → 雪。陰影は残す
                r2, g2, b2 = colorsys.hsv_to_rgb(h, s * 0.35, v)
                px[x, y] = (*mix((r2 * 255, g2 * 255, b2 * 255), SNOW, 0.68), a)
            elif s > 0.15 and 15 <= deg < 60:        # 土・道・木材 → 雪をかぶって白茶
                r2, g2, b2 = colorsys.hsv_to_rgb(h, s * 0.45, v)
                px[x, y] = (*mix((r2 * 255, g2 * 255, b2 * 255), PALE, 0.6), a)
            elif not ground_only:                    # 屋根や壁もうっすら白く、色を落とす
                r2, g2, b2 = colorsys.hsv_to_rgb(h, s * 0.78, v)
                px[x, y] = (*mix((r2 * 255, g2 * 255, b2 * 255), (255, 255, 255), 0.24), a)
    im.save(dst)
    print('wrote', dst)

# 村は激変(農村なので雪が全部を覆う)
frost('public/assets/tiny-town/tilemap_packed.png', 'public/assets/tiny-town/tilemap_winter.png')
# 都会は控えめ(アスファルトは雪かきされる。街路樹と土だけ白くする)
frost('public/assets/city/tilemap_packed.png', 'public/assets/city/tilemap_winter.png', ground_only=True)
