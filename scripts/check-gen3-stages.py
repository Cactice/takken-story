# gen3 の段階構造の自己チェック(壊れたら落ちる最小の1本)
import json, glob
evs = [json.load(open(f)) for f in glob.glob('content/gen3/events/*/*.json')]
assert len(evs) == 13, len(evs)
chars = {json.load(open(f))['id'] for f in glob.glob('content/gen*/characters/*.json')}
by_stage = {}
for e in evs:
    assert e['stage'] in (1,2,3,4,5), e['id']
    assert e['clue'], e['id']                                  # 稼ぐ=手がかりが必ず1つ出る
    assert e['cast'][0] == e['characterId'], e['id']
    assert set(e['cast']) <= chars, e['id']
    assert 0 <= e['correctChoice'] < len(e['choices']), e['id']
    assert len(e['choices']) == 3, e['id']
    by_stage.setdefault(e['stage'], []).append(e)
# 解錠条件: 段が上がるほど必要資産が増え、前段の完了を要求する
prev = -1
for s in sorted(by_stage):
    assets = {e['unlock']['minAssets'] for e in by_stage[s]}
    assert len(assets) == 1, (s, assets)                       # 同じ段は同じ資産条件
    a = assets.pop(); assert a > prev, (s, a, prev); prev = a
    for e in by_stage[s]:
        assert e['unlock'].get('afterStage') == (s-1 if s > 1 else None), e['id']
assert prev <= 3000, '解錠条件が目標額3000万を超えている'
# 生き証人ソラが真相の段に必ず立ち会う
assert 'suzuki-sora' in by_stage[4][0]['cast'] + by_stage[4][1]['cast'] + by_stage[4][2]['cast']
assert any('suzuki-sora' in e['cast'] for e in by_stage[5])
print('gen3 OK:', {s: len(v) for s, v in sorted(by_stage.items())})
