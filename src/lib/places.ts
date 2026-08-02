/**
 * 建物・土地(物件)の読み込み。
 * content/gen<N>/places/*.json を glob で拾い、既存の PropertySpec に変換して返す。
 *
 * 第1世代のデータは src/lib/properties.ts に直書きのまま残してあるので、
 * gen1 だけはそちらへフォールバックする(移すなら content/gen1/places/ に置けば
 * こちらが優先される)。
 *
 * **物件IDはマップ側の建物ID・看板ID(src/lib/maps/*.ts)と一致させること。**
 * 入口タイル → propertyIdAt() → placeById() で物件パネルが開く。
 */

import {
  INITIAL_VACANT as GEN1_VACANT,
  NOT_FOR_RENT as GEN1_NOT_FOR_RENT,
  PROPERTIES,
  initialOccupancy as gen1Occupancy,
} from './properties.ts'
import type { PropertySpec } from './properties.ts'

/** content/gen<N>/places/*.json の生データ。金額は万円、期間はヶ月(docs/CONTENT_SCHEMA.md) */
export interface PlaceJson {
  id: string
  name: string
  /** apartment | mansion | house | farm | shop | ruin | land | office | shrine */
  kind: string
  generation: number
  /** 一覧に出す種別ラベル */
  category: string
  /** 案内できる物件か(会社・主人公の自宅は false) */
  forRent?: boolean
  /** 開始時の空き戸数(0 = 満室で始まる)。1契約で埋まるよう、ふつうは1 */
  vacantUnitsAtStart?: number
  spec: {
    structure?: string
    floors?: number
    /** 戸数。1契約で1戸埋まる */
    units?: number
    ageYears?: number
    /** 間取り(2LDK・604号室 など) */
    layout?: string
    /** 専有面積(㎡) */
    area?: number
    /** 土地面積(㎡) */
    landArea?: number
    zoning: string
    buildingCoverage: number
    floorAreaRatio: number
    /** 賃料(万円/月) */
    rent?: number
    /** 価格(万円) */
    price?: number
    /** 賃料・価格に添える一言(共益費など) */
    priceNote?: string
    depositMonths?: number
    keyMoneyMonths?: number
    road: string
    features: string[]
    legalNotes: string[]
  }
}

/**
 * JSON を既存の PropertySpec(表示用の文字列を持つ形)に変換する。
 * 賃料・面積などの数値は lib/tour.ts が文字列から読み直す約束なので、
 * 「賃料 12万円/月」「築14年」のように**最初の数値が本体**になる書き方を守ること。
 */
export function toPropertySpec(p: PlaceJson): PropertySpec {
  const s = p.spec
  const isLand = p.kind === 'land'
  const price =
    s.rent != null
      ? `賃料 ${s.rent}万円/月${s.priceNote ? `(${s.priceNote})` : ''}`
      : `価格 ${s.price ?? 0}万円${s.priceNote ? `(${s.priceNote})` : ''}`
  const units = s.units ?? 1
  return {
    id: p.id,
    name: p.name,
    kind: isLand ? 'land' : 'building',
    category: p.category,
    structure: isLand ? undefined : s.structure,
    floors: isLand || s.floors == null ? undefined : `${s.floors}階建て${units > 1 ? `(全${units}戸)` : ''}`,
    age: isLand || s.ageYears == null ? undefined : `築${s.ageYears}年`,
    area: isLand || s.area == null ? '—' : `専有 ${s.area}㎡${s.layout ? `(${s.layout})` : ''}`,
    landArea: s.landArea == null ? undefined : `土地 ${s.landArea}㎡`,
    zoning: s.zoning,
    coverage: `建蔽率 ${s.buildingCoverage}%`,
    floorAreaRatio: `容積率 ${s.floorAreaRatio}%`,
    price,
    deposit:
      s.rent == null ? undefined : `敷金${s.depositMonths ?? 0}ヶ月 / 礼金${s.keyMoneyMonths ?? 0}ヶ月`,
    road: s.road,
    features: s.features,
    legalNotes: s.legalNotes,
    units,
  }
}

/**
 * ビルド時に content を取り込む。
 * ponytail: node の検証スクリプトからこのファイルを import しても落ちないように
 * try で囲ってある(node には import.meta.glob が無い)。スクリプト側は fs で
 * JSON を読み、toPropertySpec() だけを使う。
 */
let placeModules: Record<string, { default: PlaceJson }> = {}
try {
  placeModules = import.meta.glob<{ default: PlaceJson }>('../../content/gen*/places/*.json', {
    eager: true,
  })
} catch {
  placeModules = {}
}

function jsonOfGeneration(gen: number): PlaceJson[] {
  return Object.entries(placeModules)
    .filter(([path]) => path.includes(`/gen${gen}/`))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, m]) => m.default)
}

/** その世代の物件。gen1 に JSON が無ければ properties.ts の PROPERTIES を返す */
export function placesOfGeneration(gen: number): readonly PropertySpec[] {
  const json = jsonOfGeneration(gen)
  if (json.length > 0) return json.map(toPropertySpec)
  return gen === 1 ? PROPERTIES : []
}

export function placeById(gen: number, id: string): PropertySpec | undefined {
  return placesOfGeneration(gen).find((p) => p.id === id)
}

/** 案内対象にならない物件(会社・主人公の自宅)。常に満室扱い */
export function notForRent(gen: number): readonly string[] {
  const json = jsonOfGeneration(gen)
  if (json.length === 0) return gen === 1 ? GEN1_NOT_FOR_RENT : []
  return json.filter((p) => p.forRent === false).map((p) => p.id)
}

/** 開始時から空きがある物件(3件前後に保つ。docs/SYSTEMS.md) */
export function initialVacant(gen: number): readonly string[] {
  const json = jsonOfGeneration(gen)
  if (json.length === 0) return gen === 1 ? Object.keys(GEN1_VACANT) : []
  return json.filter((p) => (p.vacantUnitsAtStart ?? 0) > 0).map((p) => p.id)
}

/** 開始時の入居戸数(物件ID → 埋まっている戸数)。空き戸数を引いた残りが埋まっている */
export function initialOccupancy(gen: number): Record<string, number> {
  const json = jsonOfGeneration(gen)
  if (json.length === 0) return gen === 1 ? gen1Occupancy() : {}
  return Object.fromEntries(
    json.map((p) => [p.id, Math.max(0, (p.spec.units ?? 1) - (p.vacantUnitsAtStart ?? 0))]),
  )
}

/** 空いている戸数 */
export function vacantUnits(p: PropertySpec, occupied = 0): number {
  return Math.max(0, p.units - occupied)
}

/** 案内できる(空きがある)物件か。マップ上で目立たせる対象でもある */
export function isVacant(
  gen: number,
  id: string,
  occupancy: Readonly<Record<string, number>>,
): boolean {
  const p = placeById(gen, id)
  if (!p || notForRent(gen).includes(id)) return false
  return vacantUnits(p, occupancy[id] ?? 0) > 0
}
