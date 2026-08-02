// マップ上の建物・土地のスペック。金額は万円単位(docs/SYSTEMS.md)。
// 第1世代「ありきた村」の設定なので、地方の村として現実的な相場にしてある。

export interface PropertySpec {
  id: string
  /** 物件名(パネルの見出し) */
  name: string
  kind: 'building' | 'land'
  /** 一覧に出す種別ラベル(木造アパート/RCマンション/空き地 など) */
  category: string
  /** 構造(木造/鉄骨造/RC造)。土地は undefined */
  structure?: string
  floors?: string
  age?: string
  /** 専有面積 or 延床面積 / 土地面積 */
  area: string
  landArea?: string
  zoning: string
  /** 建蔽率 */
  coverage: string
  /** 容積率 */
  floorAreaRatio: string
  /** 賃料 or 価格 */
  price: string
  /** 敷金・礼金(賃貸のみ) */
  deposit?: string
  /** 接道状況 */
  road: string
  features: string[]
  legalNotes: string[]
  /**
   * 戸数。契約1件でここに1世帯が入る。戸建は1、アパートは4〜8、マンションは10〜20。
   * 第1世代のありきた村は戸建が多い(村なので自然で、1契約=1軒が埋まる手応えがある)。
   * いま何戸埋まっているかはゲーム状態側(GameState.occupancy)が持つ。
   */
  units: number
}

export const PROPERTIES: readonly PropertySpec[] = [
  {
    id: 'hibari',
    name: 'ひばり不動産',
    kind: 'building',
    category: '店舗(事務所)',
    structure: '木造',
    floors: '2階建て',
    age: '築32年',
    area: '延床 95㎡(1階事務所 55㎡)',
    landArea: '土地 140㎡',
    zoning: '近隣商業地域',
    coverage: '建蔽率 80%',
    floorAreaRatio: '容積率 200%',
    price: '自社所有(固定資産税評価額 1,800万円)',
    road: '幅員6mの県道に12m接道',
    features: ['来客用駐車2台', '大型ガラスの物件ボード', '応接スペースあり'],
    legalNotes: [
      '事務所ごとに専任の宅地建物取引士を1名以上置く必要がある(業務従事者5人に1人以上)',
      '事務所には報酬額の掲示と標識(宅地建物取引業者票)の掲示義務がある',
      '帳簿・従業者名簿を備え付ける義務がある',
    ],
    units: 1,
  },
  {
    id: 'player-home',
    name: 'ボロ屋(あなたの家)',
    kind: 'building',
    category: 'ボロ屋(賃貸・平屋)',
    structure: '木造',
    floors: '平屋',
    age: '築48年',
    area: '専有 32㎡(2K)',
    zoning: '第一種低層住居専用地域',
    coverage: '建蔽率 60%',
    floorAreaRatio: '容積率 150%',
    price: '賃料 5万円/月',
    deposit: '敷金1ヶ月 / 礼金なし',
    road: '幅員4mの村道に3m接道',
    features: ['風呂なし(銭湯まで徒歩3分)', '雨漏り補修済み', '隙間風あり', '庭付き'],
    legalNotes: [
      '昭和56年5月以前の旧耐震基準の建物(耐震診断の記録なし)',
      '現況有姿での引渡し。契約不適合責任の免除特約あり',
      '普通借家契約(期間2年・更新あり)。貸主からの更新拒絶には正当事由が必要',
    ],
    units: 1,
  },
  {
    id: 'mansion',
    name: 'ありきたハイツ',
    kind: 'building',
    category: 'RCマンション(分譲)',
    structure: 'RC造(鉄筋コンクリート)',
    floors: '4階建て(全24戸)',
    age: '築18年',
    area: '専有 68㎡(3LDK・301号室)',
    zoning: '第一種住居地域',
    coverage: '建蔽率 60%',
    floorAreaRatio: '容積率 200%',
    price: '価格 1,450万円',
    deposit: '管理費 0.8万円/月 + 修繕積立金 0.6万円/月',
    road: '幅員6mの県道に20m接道',
    features: ['エレベーター', 'オートロック', '専用駐車場1台', '南向きバルコニー'],
    legalNotes: [
      '区分所有建物。専有部分と共用部分に分かれ、バルコニーは共用部分の専用使用部分',
      '管理規約・集会の議事録あり。規約の設定変更は区分所有者および議決権の各4分の3以上',
      '敷地利用権は専有部分と分離処分できない(規約に別段の定めなし)',
      '重要事項説明では管理費・修繕積立金の額と滞納額の説明が必要',
    ],
    units: 12,
  },
  {
    id: 'apart-wood',
    name: 'ガストン荘',
    kind: 'building',
    category: '木造アパート(賃貸)',
    structure: '木造',
    floors: '2階建て(全8戸)',
    age: '築26年',
    area: '専有 24㎡(1K・102号室)',
    zoning: '第一種住居地域',
    coverage: '建蔽率 60%',
    floorAreaRatio: '容積率 200%',
    price: '賃料 4.2万円/月(共益費 0.3万円)',
    deposit: '敷金1ヶ月 / 礼金1ヶ月',
    road: '幅員4mの村道に6m接道',
    features: ['エアコン付き', '駐輪場', '追い焚き機能なし', 'ペット不可'],
    legalNotes: [
      '貸主はガストン(所有者本人)。自ら貸主となる行為は宅建業に当たらず免許不要',
      '通常損耗・経年変化の原状回復費用は原則として貸主負担',
      '敷金は明渡し時に未払賃料等を控除して返還する義務がある',
    ],
    units: 8,
  },
  {
    id: 'apart-old',
    name: '第二ガストン荘',
    kind: 'building',
    category: '木造アパート(築古・空室多数)',
    structure: '木造',
    floors: '2階建て(全6戸)',
    age: '築41年',
    area: '専有 18㎡(1R)',
    zoning: '第一種住居地域',
    coverage: '建蔽率 60%',
    floorAreaRatio: '容積率 200%',
    price: '賃料 2.8万円/月',
    deposit: '敷金1ヶ月 / 礼金なし',
    road: '幅員1.8mの通路にのみ2m接する',
    features: ['浴室なし', '共同トイレ', '6戸中4戸が空室', 'ブロック塀が隣地へ越境の疑い'],
    legalNotes: [
      '再建築不可。接道義務(幅員4m以上の道路に2m以上接する)を満たさない',
      '旧耐震基準の建物。耐震診断・改修の記録なし',
      '越境物がある場合は重要事項ではないが、覚書の有無を売買時に確認すべき',
    ],
    units: 6,
  },
  {
    id: 'clinic',
    name: 'ありきた診療所',
    kind: 'building',
    category: '診療所(鉄骨平屋)',
    structure: '鉄骨造',
    floors: '平屋',
    age: '築14年',
    area: '延床 120㎡',
    landArea: '土地 260㎡',
    zoning: '第一種低層住居専用地域',
    coverage: '建蔽率 50%',
    floorAreaRatio: '容積率 100%',
    price: '価格 2,200万円',
    road: '幅員4mの村道に14m接道',
    features: ['駐車5台', 'バリアフリー', '待合室18席', '看板は条例の基準内'],
    legalNotes: [
      '診療所・保育所・神社・巡査派出所などは、用途地域に関係なく建築できる',
      '第一種低層住居専用地域なので高さは10m(または12m)以下に制限される',
      '外壁の後退距離1mが都市計画で定められている',
    ],
    units: 1,
  },
  {
    id: 'bakery',
    name: 'サクライベーカリー',
    kind: 'building',
    category: '店舗兼住宅',
    structure: '木造',
    floors: '2階建て',
    age: '築34年',
    area: '延床 110㎡(1階店舗 60㎡ / 2階住居 50㎡)',
    landArea: '土地 130㎡',
    zoning: '近隣商業地域',
    coverage: '建蔽率 80%',
    floorAreaRatio: '容積率 200%',
    price: '価格 1,600万円',
    road: '幅員6mの県道に9m接道',
    features: ['業務用オーブン残置', '厨房排気ダクトあり', 'イートイン4席'],
    legalNotes: [
      '準防火地域。建て替え時は原則として準耐火建築物等にする必要がある',
      '防火地域・準防火地域にまたがる場合は、厳しいほう(防火地域)の規制が敷地全体に適用される',
      '2階を自ら貸主として賃貸するだけなら宅建業の免許は不要',
    ],
    units: 1,
  },
  {
    id: 'flower',
    name: 'みなせ生花店',
    kind: 'building',
    category: '店舗(借地上の建物)',
    structure: '木造',
    floors: '平屋',
    age: '築29年',
    area: '延床 64㎡',
    landArea: '借地 95㎡',
    zoning: '近隣商業地域',
    coverage: '建蔽率 80%',
    floorAreaRatio: '容積率 200%',
    price: '建物価格 480万円 + 地代 1.8万円/月',
    road: '幅員6mの県道に7m接道',
    features: ['冷蔵ショーケース', '軒下の花台', '作業用の水場'],
    legalNotes: [
      '土地は借地(建物所有目的の賃借権)。建物は自己所有',
      '普通借地権の存続期間は30年以上。更新後は1回目20年、2回目以降10年',
      '借地上の建物を第三者に譲渡するには地主の承諾(または裁判所の許可)が必要',
      '建物を登記しておけば、土地が売られても新所有者に借地権を対抗できる',
    ],
    units: 1,
  },
  {
    id: 'house-misaki',
    name: 'オリビア邸',
    kind: 'building',
    category: '一戸建て(中古)',
    structure: '木造',
    floors: '2階建て',
    age: '築12年',
    area: '延床 96㎡(4LDK)',
    landArea: '土地 165㎡',
    zoning: '第一種低層住居専用地域',
    coverage: '建蔽率 50%',
    floorAreaRatio: '容積率 100%',
    price: '価格 2,380万円',
    road: '幅員4mの村道に8m接道',
    features: ['南向き・日当たり良好', '駐車2台', '築浅で設備良好', '庭に物置'],
    legalNotes: [
      '高さ10m以下、外壁後退1mの制限あり(第一種低層住居専用地域)',
      '居住用財産を売った場合、3,000万円の特別控除の対象になりうる',
      '売主が個人なので、契約不適合責任の期間を引渡しから2年とする特約も有効',
    ],
    units: 1,
  },
  {
    id: 'kimono',
    name: 'シルビアの実家(旧・呉服店)',
    kind: 'building',
    category: '古民家(共有名義)',
    structure: '木造',
    floors: '2階建て',
    age: '築63年',
    area: '延床 132㎡',
    landArea: '土地 210㎡',
    zoning: '近隣商業地域',
    coverage: '建蔽率 80%',
    floorAreaRatio: '容積率 200%',
    price: '価格 1,100万円(相談中)',
    road: '幅員6mの県道に11m接道',
    features: ['土間と蔵', '梁は状態良好', '水回りは要リフォーム'],
    legalNotes: [
      '相続により3名の共有(持分 各3分の1)',
      '共有物の変更・売却は共有者全員の同意、管理行為は持分価格の過半数で決める',
      '各共有者はいつでも共有物の分割を請求できる',
      '増築部分が未登記。売買前に表題部の変更登記が必要',
    ],
    units: 1,
  },
  {
    id: 'koumuten',
    name: 'ブルーノ工務店',
    kind: 'building',
    category: '作業所(事業用)',
    structure: '鉄骨造',
    floors: '平屋',
    age: '築22年',
    area: '延床 180㎡',
    landArea: '土地 300㎡',
    zoning: '準工業地域',
    coverage: '建蔽率 60%',
    floorAreaRatio: '容積率 200%',
    price: '価格 1,900万円',
    road: '幅員6mの県道に15m接道',
    features: ['大型シャッター', '資材置場', '3t車の乗入れ可'],
    legalNotes: [
      '準工業地域では住宅・店舗も建築できるが、危険性や環境悪化のおそれが大きい工場は建てられない',
      '床面積10㎡を超える増改築には建築確認が必要(防火・準防火地域内なら10㎡以下でも必要)',
      '工事中は建築確認済の表示と設計図書の備置きが必要',
    ],
    units: 1,
  },
  {
    id: 'farmhouse',
    name: 'ポッポ農場 母屋',
    kind: 'building',
    category: '農家住宅',
    structure: '木造',
    floors: '平屋(一部2階)',
    age: '築52年',
    area: '延床 145㎡',
    landArea: '土地 480㎡',
    zoning: '市街化調整区域',
    coverage: '建蔽率 60%',
    floorAreaRatio: '容積率 200%',
    price: '価格 780万円',
    road: '幅員4mの農道に18m接道',
    features: ['納屋と作業場', '井戸あり', '薪ストーブ', '広い縁側'],
    legalNotes: [
      '市街化調整区域は市街化を抑制すべき区域。開発行為は原則として都道府県知事の許可が必要',
      '農林漁業を営む者の住宅・農業用倉庫は、市街化調整区域では開発許可が不要',
      '農家以外の人が住宅として買う場合は用途変更の許可が要り、原則認められない',
    ],
    units: 1,
  },
  {
    id: 'field',
    name: 'ポッポ農場の畑',
    kind: 'land',
    category: '農地(畑)',
    area: '—',
    landArea: '土地 1,900㎡',
    zoning: '市街化調整区域(農業振興地域)',
    coverage: '建蔽率 60%',
    floorAreaRatio: '容積率 200%',
    price: '価格 190万円(1㎡あたり約1,000円)',
    road: '幅員4mの農道に接する',
    features: ['日当たり良好', '用水路あり', '現在は野菜を作付け中'],
    legalNotes: [
      '農地を農地のまま売買するには農地法3条の許可(農業委員会)が必要',
      '自分で農地以外に転用するときは4条許可、転用目的で売るときは5条許可(都道府県知事等)',
      '市街化区域内の農地なら、あらかじめ農業委員会に届出をすれば4条・5条の許可は不要',
      '許可を受けずにした売買契約は効力を生じない',
    ],
    units: 1,
  },
  {
    id: 'vacant-hill',
    name: '丘の上の空き地',
    kind: 'land',
    category: '空き地(住宅用地)',
    area: '—',
    landArea: '土地 180㎡',
    zoning: '第一種低層住居専用地域',
    coverage: '建蔽率 50%',
    floorAreaRatio: '容積率 100%',
    price: '価格 320万円',
    road: '幅員4mの公道に8m接道',
    features: ['南斜面で眺めが良い', '上下水道引込み済み', '更地・造成済み'],
    legalNotes: [
      '第一種低層住居専用地域では単独の喫茶店・飲食店は建てられない',
      '住宅と兼用し、店舗部分が50㎡以下かつ建物の1/2未満なら兼用住宅として建築できる',
      '高さは10m(または12m)以下。北側斜線制限もかかる',
    ],
    units: 1,
  },
  {
    id: 'vacant-river',
    name: '川沿いの低地',
    kind: 'land',
    category: '空き地(元・畑)',
    area: '—',
    landArea: '土地 620㎡',
    zoning: '市街化調整区域',
    coverage: '建蔽率 60%',
    floorAreaRatio: '容積率 200%',
    price: '価格 210万円',
    road: '幅員3.5mの村道に5m接道(建築基準法42条2項道路の可能性)',
    features: ['川まで20m', '周囲より1m低い', '地盤は軟弱', '日当たりは良い'],
    legalNotes: [
      '洪水浸水想定区域内。水害ハザードマップ上の位置は重要事項として説明義務がある',
      '宅地造成等工事規制区域内で一定規模を超える盛土・切土をするには知事等の許可が必要',
      '2項道路に接する場合、道路中心線から2mまで敷地を後退(セットバック)する必要がある',
    ],
    units: 1,
  },
  {
    id: 'vacant-station',
    name: '村役場前の空き地',
    kind: 'land',
    category: '空き地(商業用地)',
    area: '—',
    landArea: '土地 145㎡',
    zoning: '近隣商業地域',
    coverage: '建蔽率 80%',
    floorAreaRatio: '容積率 200%(指定)',
    price: '価格 680万円',
    road: '幅員6mの県道に10m接道',
    features: ['村役場とバス停まで徒歩1分', '角地', '更地'],
    legalNotes: [
      '前面道路の幅員が12m未満なので、容積率は「指定容積率」と「幅員×4/10」の小さいほう',
      '6m×4/10=240% > 指定200% となり、この土地は200%が適用される',
      '角地なので建蔽率が10%緩和され、90%まで建てられる(特定行政庁の指定がある場合)',
    ],
    units: 1,
  },
]

const byId = new Map(PROPERTIES.map((p) => [p.id, p]))

export function propertyById(id: string): PropertySpec | undefined {
  return byId.get(id)
}

/**
 * 開始時から空いている物件。docs/SYSTEMS.md「物件の空き状況」。
 * 村は出来立てだが空っぽではなく、案内できる空きは3件前後に保つ
 * (選択肢が多すぎるとどれを見せるか決められず苦痛になる)。
 * ここに無い物件は満室で始まる = 内見できない。
 */
/**
 * 空き3件は**性格の違う物件**を、村の中で**散らして**選んである
 * (どれを選ぶかに意味が出るように。かつ会社からの距離が偏らないように):
 *   - オリビア邸(中央)   : 築12年・日当たり良好だが高い  = 新しいが高い
 *   - 第二ガストン荘(西) : 賃料2.8万だが再建築不可・浴室なし = 安いが難あり
 *   - ポッポ農場 母屋(南) : 145㎡と広いが築52年・調整区域   = 広いが古い
 * 値は「空き戸数」。アパートは1戸だけ空けておき、1契約で満室になるようにしてある
 * (ずっと空きが残ると転出イベントが回らない)。
 */
export const INITIAL_VACANT: Readonly<Record<string, number>> = {
  'house-misaki': 1,
  'apart-old': 1,
  farmhouse: 1,
}

/** 案内対象にならない物件(会社と主人公の自宅)。常に満室扱い */
export const NOT_FOR_RENT: readonly string[] = ['hibari', 'player-home']

/** 開始時の入居戸数(建物ID → 埋まっている戸数)。空き3件以外は満室 */
export function initialOccupancy(): Record<string, number> {
  return Object.fromEntries(
    PROPERTIES.map((p) => [p.id, Math.max(0, p.units - (INITIAL_VACANT[p.id] ?? 0))]),
  )
}

/** 空いている戸数 */
export function vacantUnits(p: PropertySpec, occupied = 0): number {
  return Math.max(0, p.units - occupied)
}

/** 案内できる(空きがある)物件か。マップ上で目立たせる対象でもある */
export function isVacant(id: string, occupancy: Readonly<Record<string, number>>): boolean {
  const p = byId.get(id)
  if (!p || NOT_FOR_RENT.includes(id)) return false
  return vacantUnits(p, occupancy[id] ?? 0) > 0
}
