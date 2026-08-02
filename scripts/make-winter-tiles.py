#!/usr/bin/env python3
"""冬のタイルシートを、元のCC0タイルシートに「雪を乗せて」作る。

    python3 scripts/make-winter-tiles.py

方針は「色を白く変換する」ではなく「雪を足す」:
  - 地面タイル … まだらな雪のパッチを乗せる(全面は白くしない)
  - それ以外   … 一番上の輪郭に沿って積雪を乗せる(屋根・塀・看板・木の上端)
  - 元の色はそのまま。冬でも赤い屋根は赤い
さらに、
  - 地面はタイルを並べると同じ模様が繰り返して見えるので、**まだら模様違いを2枚ずつ**作る
    (マップ側がマスの座標で選び分ける → src/lib/maps/types.ts の SeasonSkin.variants)
  - 元シートに空きが無いので、シートを数行ぶん拡張して雪だるまと模様違いを置く

タイル番号(元からあるぶん)は元シートと同じ。生成されたタイル番号は
src/lib/maps/winter-tiles.ts に書き出すので、手で写す必要はない。
元素材は Kenney (CC0) — public/assets/CREDITS.md 参照。
"""
import math
from PIL import Image, ImageDraw

S = 16
SNOW = (244, 249, 255)
SNOW_EDGE = (214, 226, 244)
INK = (63, 38, 49)
# 地面のタイル。「雪が積もったマス」を1枚ずつ作る(2模様)。
# どのマスに置くかはマップ側が決める(積もっているマスと、まったく無いマスを作る)
TOWN_FIELD = [0, 1, 2, 39, 41]
CITY_FIELD = [741, 890, 892, 889, 704, 705, 707, 708]
# 道のタイル。轍(わだち)を残して、雪は端に寄る。縦の道と横の道で2種類
TOWN_ROAD = [25]
CITY_ROAD = [714, 712, 749, 827, 824, 838]

EDGE = 3  # タイルのふち何pxをディザ(雪と地面の境目)にするか。中心は白ベタ


def is_dark(px):
    return px[0] + px[1] + px[2] < 210  # 輪郭線。ドット絵の骨格なので雪で潰さない


def patch(seed, x, y, coverage):
    """3x3 の塊で疑似ランダムに雪を置く"""
    n = (x // 3) + (y // 3) * 17 + seed * 97
    n = (n ^ (n >> 4)) * 2654435761 % 4294967296
    n = (n ^ (n >> 13)) * 40503 % 4294967296
    return (n >> 7) % 100 < coverage


def snow_mask(seed, x, y):
    """雪が積もったマス。中心は白ベタ、ふちだけディザで地面と馴染ませる"""
    d = min(x, y, S - 1 - x, S - 1 - y)
    if d >= EDGE:
        return True
    return patch(seed + d, x, y, 40 + d * 22)


def rut(seed, x, y, vertical):
    """轍。タイヤの通った2本だけ地面が出て、残りに雪が乗る。
    縦の道でも横の道でも繋がるよう、轍は必ずタイルを貫通させる"""
    t = x if vertical else y
    if 2 <= t <= 5 or 10 <= t <= 13:
        return False                      # 轍(雪なし)
    along = y if vertical else x
    if t in (1, 6, 9, 14):                # 轍のふち。がたつかせて手描きらしく
        return patch(seed, along, along, 55)
    return True


def snow_tile(im, tx, ty, seed, ground, road=None):
    """ground=True で地面(まだら/轍)、False で上端に積もらせる。
    road は None / 'v'(縦の道) / 'h'(横の道)"""
    px = im.load()
    x0, y0 = tx * S, ty * S
    if ground:
        def snowy(x, y):
            if road:
                return rut(seed, x, y, road == 'v')
            return snow_mask(seed, x, y)
        for y in range(S):
            for x in range(S):
                p = px[x0 + x, y0 + y]
                if p[3] == 0:
                    continue
                if not snowy(x, y):
                    # 雪から覗いている地面。うっすら霜をかける(色は残す)
                    px[x0 + x, y0 + y] = (
                        min(255, int(p[0] * 0.82 + 46)),
                        min(255, int(p[1] * 0.82 + 48)),
                        min(255, int(p[2] * 0.82 + 54)),
                        p[3],
                    )
                    continue
                top = not snowy(x, y - 1)
                px[x0 + x, y0 + y] = (*(SNOW_EDGE if top else SNOW), 255)
        return
    for x in range(S):
        depth = 0
        for y in range(S):
            p = px[x0 + x, y0 + y]
            if p[3] == 0:
                continue
            if is_dark(p):       # 輪郭は残し、その内側から積もらせる
                if depth == 0:
                    continue
                break
            px[x0 + x, y0 + y] = (*(SNOW if depth else SNOW_EDGE), 255)
            depth += 1
            if depth >= 3:
                break


def draw_snowman(im, tx, ty):
    d = ImageDraw.Draw(im)
    x0, y0 = tx * S, ty * S
    d.line([(x0 + 3, y0 + 9), (x0 + 1, y0 + 6)], fill=(138, 90, 59, 255))   # 枝の腕
    d.line([(x0 + 12, y0 + 9), (x0 + 14, y0 + 6)], fill=(138, 90, 59, 255))
    d.ellipse([x0 + 3, y0 + 7, x0 + 12, y0 + 14], fill=(*SNOW, 255), outline=(*INK, 255))
    d.ellipse([x0 + 5, y0 + 2, x0 + 10, y0 + 7], fill=(*SNOW, 255), outline=(*INK, 255))
    d.rectangle([x0 + 5, y0 + 0, x0 + 10, y0 + 2], fill=(*INK, 255))        # バケツの帽子
    d.point([(x0 + 7, y0 + 4), (x0 + 9, y0 + 4)], fill=(*INK, 255))         # 目
    d.point([(x0 + 8, y0 + 5)], fill=(227, 134, 40, 255))                   # にんじんの鼻
    d.point([(x0 + 8, y0 + 10), (x0 + 8, y0 + 12)], fill=(*INK, 255))       # ボタン


def build(src, dst, cols, rows, field, road):
    base = Image.open(src).convert('RGBA')
    ground_set = set(field) | set(road)
    # 元のタイル: 建物などは上端に積雪。地面は「素通り」させ、下で薄い/濃いを作る
    extra = 1 + len(field) * 2 + len(road) * 2
    out_rows = rows + math.ceil(extra / cols)
    im = Image.new('RGBA', (cols * S, out_rows * S), (0, 0, 0, 0))
    im.paste(base, (0, 0))
    for i in range(cols * rows):
        if i not in ground_set:
            snow_tile(im, i % cols, i // cols, i, False)

    def copy_to(g, idx):
        im.paste(base.crop(((g % cols) * S, (g // cols) * S, (g % cols) * S + S, (g // cols) * S + S)),
                 ((idx % cols) * S, (idx // cols) * S))

    nxt = cols * rows
    snowman = nxt
    draw_snowman(im, snowman % cols, snowman // cols)
    nxt += 1
    snow, rut_h, rut_v = {}, {}, {}
    for g in field:
        ids = []
        for k in range(2):                # ふちの模様違いを2枚。1枚だと16px周期の格子が見える
            copy_to(g, nxt)
            snow_tile(im, nxt % cols, nxt // cols, 5000 + g * 7 + k, True)
            ids.append(nxt)
            nxt += 1
        snow[g] = ids
    for g in road:
        for table, d in ((rut_h, 'h'), (rut_v, 'v')):
            copy_to(g, nxt)
            snow_tile(im, nxt % cols, nxt // cols, g, True, road=d)
            table[g] = [nxt]
            nxt += 1
    im.save(dst)
    print(f'wrote {dst} ({cols}x{out_rows}) 雪だるま={snowman}')
    return {'cols': cols, 'rows': out_rows, 'snowman': snowman,
            'snow': snow, 'rutH': rut_h, 'rutV': rut_v}


town = build('public/assets/tiny-town/tilemap_packed.png',
             'public/assets/tiny-town/tilemap_winter.png', 12, 11, TOWN_FIELD, TOWN_ROAD)
city = build('public/assets/city/tilemap_packed.png',
             'public/assets/city/tilemap_winter.png', 37, 28, CITY_FIELD, CITY_ROAD)


def ts(v):
    return '{\n' + ''.join(f'  {k}: [{", ".join(map(str, ids))}],\n' for k, ids in v.items()) + '}'


def block(name, m):
    return f"""export const {name}: SnowTable = {ts(m)}
"""


with open('src/lib/maps/winter-tiles.ts', 'w') as f:
    f.write(f'''// 自動生成: scripts/make-winter-tiles.py。手で編集しない。
// 雪版シートにだけ存在するタイル番号。
//   snow          … 雪が積もったマス(中心は白ベタ、ふちだけディザ)。模様違いが2枚
//   rutH / rutV   … 轍(わだち)が残った道。横の道 / 縦の道
//   snowman       … 雪だるま

/** 元のタイル番号 → 冬のタイル候補 */
export type SnowTable = Readonly<Record<number, readonly number[]>>

/** 雪版シートの大きさ(足したタイルのぶん、元より縦に長い) */
export const TOWN_WINTER_SIZE = {{ cols: {town['cols']}, rows: {town['rows']} }}
export const CITY_WINTER_SIZE = {{ cols: {city['cols']}, rows: {city['rows']} }}

export const TOWN_SNOWMAN = {town['snowman']}
export const CITY_SNOWMAN = {city['snowman']}

{block('TOWN_SNOW', town['snow'])}
{block('CITY_SNOW', city['snow'])}
{block('TOWN_RUT_H', town['rutH'])}
{block('TOWN_RUT_V', town['rutV'])}
{block('CITY_RUT_H', city['rutH'])}
{block('CITY_RUT_V', city['rutV'])}
''')
print('wrote src/lib/maps/winter-tiles.ts')
