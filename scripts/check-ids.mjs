#!/usr/bin/env node
/**
 * キャラIDの健全性チェック。
 * - characters/<id>.json のファイル名と中の id が一致しているか
 * - イベント・世帯・続柄から参照されているIDが実在するか
 *
 * 一括リネームで壊れやすいところなので、npm run check で毎回見る。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONTENT = path.join(ROOT, 'content')

/** 主人公の各世代。キャラJSONを持たないので参照先として許す */
const PLAYER_IDS = new Set(['shu-1', 'shu-2', 'shu-3', 'shu-4', 'shu-5'])

const ids = new Set()
const gens = fs.readdirSync(CONTENT).filter((d) => d.startsWith('gen'))
for (const g of gens) {
  const dir = path.join(CONTENT, g, 'characters')
  for (const f of fs.readdirSync(dir)) {
    const c = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
    assert.equal(c.id, path.basename(f, '.json'), `${g}/characters/${f} の id が ${c.id}`)
    ids.add(c.id)
  }
}

const broken = []
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      walk(p)
      continue
    }
    if (!e.name.endsWith('.json')) continue
    const j = JSON.parse(fs.readFileSync(p, 'utf8'))
    const refs = [
      j.characterId,
      ...(j.cast ?? []),
      ...(j.memberIds ?? []),
      ...(j.relations ?? []).map((r) => r.characterId),
      j.descendantOf,
    ].filter(Boolean)
    for (const r of refs) {
      if (!ids.has(r) && !PLAYER_IDS.has(r)) broken.push(`${path.relative(ROOT, p)} → ${r}`)
    }
  }
}
walk(CONTENT)

const plan = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/household-plan.json'), 'utf8'))
for (const [name, h] of Object.entries({ ...plan.households, 禿鷹: plan.boss })) {
  for (const m of h.movement ?? []) {
    for (const r of m.ids ?? []) {
      if (!ids.has(r) && !PLAYER_IDS.has(r)) broken.push(`household-plan(${name}) → ${r}`)
    }
  }
}

assert.deepEqual(broken, [], `参照切れ:\n  ${broken.join('\n  ')}`)
console.log(`check-ids: OK(${ids.size}人 / 参照切れなし)`)
