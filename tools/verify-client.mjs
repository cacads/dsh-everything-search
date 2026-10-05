// tools/verify-client.mjs —— 客户端半端的 headless 校验（不需要浏览器、不联网）
//
// 背景（2026-10-05）：本插件 1.0.3 的客户端半端在 0.2.0-rc.2 上**静默不挂载**——
// package.json 的 `dsh.client.inject` 是空数组、客户端导出 `inject` 也是空数组，
// 于是浏览器侧在 `@deepseek-ai/dsh-client-ui-slots` 之前 materialize，
// `ctx.get('slots')` 拿到 undefined 后 `return`，🔍 按钮与设置页**一个都不出现、且不报错**。
//
// 用法：
//   node tools/verify-client.mjs [要校验的 client.js 路径]
//   默认校验 ../lib/client.js
//
// 三条断言：
//   1) 客户端导出的 `inject` 必须声明 `slots`（Cordis 靠它等插槽服务就绪）；
//   2) `apply()` 必须注册全部三个 UI 座位（conversation.input.left 按钮 / conversation.input.dock 面板 / settings.section 设置页）；
//   3) 服务缺失时必须**出声**（console.warn），不得静默 return。

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, isAbsolute } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const target = process.argv[2]
  ? (isAbsolute(process.argv[2]) ? process.argv[2] : join(process.cwd(), process.argv[2]))
  : join(here, '..', 'lib', 'client.js')

const source = readFileSync(target, 'utf8')

// ── 用桩件接管模块表与 react，原样执行插件的 client bundle ──────────────────
let captured = null
globalThis.window = { __ModuleLoader__: { load: (entry) => { captured = entry } } }

const reactStub = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: (initial) => [initial, () => {}],
  useEffect: () => {},
  useRef: (v) => ({ current: v }),
  Fragment: Symbol('Fragment'),
}
const requireStub = (id) => {
  if (id === 'react') return reactStub
  throw new Error(`unexpected require(${JSON.stringify(id)})`)
}

new Function(source)() // 客户端 bundle 是经典脚本：直接求值即可

const results = []
const check = (name, ok, detail) => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

if (!captured) {
  console.error('FAIL  未能捕获 window.__ModuleLoader__.load(...) 调用（bundle 形态不符合预期）')
  process.exit(1)
}
console.log(`校验目标：${target}`)
console.log(`模块 id ：${captured.id}`)

const mod = captured.factory(requireStub)

// ── 断言 1：inject 必须声明 slots ───────────────────────────────────────────
const injectList = Array.isArray(mod.inject)
  ? mod.inject
  : (mod.inject && typeof mod.inject === 'object' ? Object.keys(mod.inject) : [])
check(
  "客户端 inject 声明了 'slots'",
  injectList.includes('slots'),
  `inject = ${JSON.stringify(injectList)}`,
)

// ── 断言 2：apply() 注册三个 UI 座位 ────────────────────────────────────────
function makeCtx(slotsValue) {
  const registered = []
  const slots = slotsValue === undefined ? undefined : {
    inject: (name, callback) => { registered.push({ kind: 'inject', name }); callback() },
    register: (spec, component) => {
      registered.push({ kind: 'register', name: spec && spec.name, id: spec && spec.id, component })
      return () => {}
    },
  }
  return {
    registered,
    ctx: { get: (name) => (name === 'slots' ? slots : undefined), slots },
  }
}

const live = makeCtx('stub')
let threw = null
try { mod.apply(live.ctx) } catch (err) { threw = err }
const seats = live.registered.filter((r) => r.kind === 'register').map((r) => r.name).sort()
const expected = ['conversation.input.dock', 'conversation.input.left', 'settings.section']
check(
  'apply() 注册三个 UI 座位',
  threw === null && JSON.stringify(seats) === JSON.stringify(expected),
  threw ? `抛出异常：${threw.message}` : `实际注册 = ${JSON.stringify(seats)}`,
)

// ── 断言 3：slots 服务缺失时必须出声（不得静默） ─────────────────────────────
const silent = makeCtx(undefined)
const warnings = []
const originalWarn = console.warn
console.warn = (...args) => { warnings.push(args.join(' ')) }
let threwWithoutSlots = null
try { mod.apply(silent.ctx) } catch (err) { threwWithoutSlots = err } finally { console.warn = originalWarn }
check(
  'slots 缺失时给出 warn（不静默、不抛异常）',
  threwWithoutSlots === null && warnings.length > 0,
  threwWithoutSlots
    ? `抛出异常：${threwWithoutSlots.message}`
    : `warn 条数 = ${warnings.length}${warnings.length ? `：${warnings[0]}` : ''}`,
)

const failed = results.filter((r) => !r.ok)
console.log(`\n== 汇总：${results.length - failed.length}/${results.length} 通过 ==`)
process.exit(failed.length === 0 ? 0 : 1)
