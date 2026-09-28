/**
 * Real-React reproduction for the model-filter seat crash.
 *
 * The shipped stub renderer fakes React, so a class of real-browser crashes
 * (hook-order, invalid element types, snapshot identity, portal DOM) never
 * shows. This harness runs lib/client.js under REAL react/react-dom 18 inside
 * jsdom, drives apply() through a stub ctx that captures the registered seat
 * component, and walks the states a fresh page load and a session switch hit.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { JSDOM } from 'jsdom'

const here = dirname(fileURLToPath(import.meta.url))
const clientFile = process.env.DSHMF_CLIENT ?? join(here, '..', 'lib', 'client.js')

const dom = new JSDOM('<!doctype html><html><body><div id="host"></div></body></html>', {
  pretendToBeVisual: true,
})
const { window } = dom
const { document } = window

globalThis.window = window
globalThis.document = document
globalThis.Element = window.Element
globalThis.Node = window.Node
globalThis.HTMLButtonElement = window.HTMLButtonElement
globalThis.HTMLElement = window.HTMLElement
window.innerWidth = 1280
window.innerHeight = 800

const React = (await import('react')).default
const ReactDOMClient = await import('react-dom/client')
const ReactDOM = await import('react-dom')

const registered = []
window.__ModuleLoader__ = {
  load(definition) {
    registered.push(definition.id)
    globalThis.__plugin = definition.factory((name) => {
      if (name === 'react') return React
      if (name === 'react-dom') return ReactDOM
      throw new Error(`unexpected require("${name}")`)
    })
  },
}

await import(`file:///${clientFile.replaceAll('\\', '/')}`)
const plugin = globalThis.__plugin

console.log('module id registered:', registered.join(', '))
console.log('plugin exports:', Object.keys(plugin).join(', '))

// ---- capture the seat component through apply() ----------------------------
let seatComponent = null
let seatOptions = null

const slots = {
  inject(_key, fn) {
    // the plugin registers through this indirection
    const registrar = fn()
    // call it like the real inject does: returns a disposer
    return registrar
  },
  register(options, component) {
    seatOptions = options
    seatComponent = component
    return () => {}
  },
}

const localeDisposers = []
const ctx = {
  effect(fn, _label) {
    const d = fn()
    if (typeof d === 'function') localeDisposers.push(d)
    return () => {}
  },
  locale: {
    register(_ns, dictPair) {
      localeDict.zh = dictPair.zh
      localeDict.en = dictPair.en
      return () => {}
    },
  },
  inject(_names, fn) {
    // plugin's soft injection: ["slots", "modelDirectories", "sessions"]
    fn({
      slots,
      modelDirectories: { directoryFor: () => fakeDirectory },
      sessions: { subagentAddress: () => undefined },
    })
    return () => {}
  },
}

let localeDict = { zh: null, en: null }

// a directory fake with the real snapshot shape
function createStore(initial) {
  let snapshot = initial
  const listeners = new Set()
  return {
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    getSnapshot() {
      return snapshot
    },
    set(next) {
      snapshot = { ...snapshot, ...next }
      for (const fn of listeners) fn()
    },
  }
}

const initialSnapshot = {
  current: null,
  routable: null,
  groups: [],
  failures: [],
  status: 'idle',
  pending: null,
  error: null,
}
const directoryStore = createStore(initialSnapshot)
const fakeDirectory = {
  store: directoryStore,
  load: () => Promise.resolve(directoryStore.getSnapshot()),
  select: () => Promise.resolve({ ok: true, value: undefined }),
}

plugin.apply(ctx)

if (seatComponent === null) {
  console.log('FAIL apply() never registered the seat component')
  process.exit(1)
}
console.log('seat captured: priority =', seatOptions.priority, ', locale =', seatOptions.locale)

// the seat's inject() provides per-session props; mirror it
const seatProps = (over = {}) => ({
  locked: false,
  available: true,
  directory: directoryStore,
  load: () => directoryStore.set({}),
  select: fakeDirectory.select,
  t: (key, params) => {
    const template = localeDict.zh?.[key] ?? localeDict.en?.[key]
    if (template === undefined) throw new Error(`missing dict key: ${key}`)
    if (params === undefined) return template
    return template.replace(/\{(\w+)\}/g, (_, k) => (params[k] === undefined ? `{${k}}` : String(params[k])))
  },
  ...over,
})

// ---- render harness --------------------------------------------------------
const host = document.getElementById('host')
const reactRoot = ReactDOMClient.createRoot(host)

const failures = []
const origError = console.error
console.error = (...args) => {
  const text = args.map((a) => (a instanceof Error ? a.stack : String(a))).join(' ')
  if (text.includes('not wrapped in act')) return
  failures.push(text)
}
const crashLog = []
process.on('uncaughtException', (e) => crashLog.push('uncaught: ' + (e.stack ?? e.message)))
process.on('unhandledRejection', (e) => crashLog.push('rejection: ' + String(e)))

async function mount(label, props) {
  failures.length = 0
  await new Promise((resolve) => {
    reactRoot.render(React.createElement(seatComponent, props))
    setTimeout(resolve, 50)
  })
  const htmlLen = host.innerHTML.length
  const trigger = host.querySelector('button') !== null
  console.log(`${failures.length === 0 && crashLog.length === 0 ? 'ok ' : 'FAIL'} ${label} (html ${htmlLen}b, trigger=${trigger})`)
  for (const f of [...failures, ...crashLog]) {
    console.log('     !! ' + f.split('\n').slice(0, 6).join('\n     '))
  }
  return failures.length === 0 && crashLog.length === 0
}

// ---- the states a fresh load and a session switch hit ----------------------

let ok = true

// 1. fresh page, closed trigger, idle store
ok = (await mount('fresh page: closed, idle', seatProps())) && ok

// 2. loading (the first open() triggers load())
directoryStore.set({ status: 'loading' })
ok = (await mount('loading', seatProps())) && ok

// 3. ready with groups — the state after catalog load
directoryStore.set({
  status: 'ready',
  groups: [
    {
      id: 'deepseek-account',
      name: 'DeepSeek',
      models: [
        { id: 'deepseek-v4.1', name: 'DeepSeek V4.1', description: 'flagship' },
        { id: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash', description: 'fast', reasoning: { efforts: [{ id: 'low', name: 'Low' }, { id: 'high', name: 'High' }], defaultEffort: 'high' } },
      ],
    },
    { id: 'openrouter', name: 'OpenRouter', models: [{ id: 'qwen3', name: 'Qwen3 235B' }] },
  ],
  failures: [],
})
ok = (await mount('ready with groups (current=null)', seatProps())) && ok

// 4. current selection present — the steady state of an existing session
directoryStore.set({
  current: { provider: 'deepseek-account', model: 'deepseek-v4.1' },
  routable: true,
  retainedEffort: undefined,
})
ok = (await mount('ready with current', seatProps())) && ok

// 5. session switch: store tears back to a new session's idle snapshot
directoryStore.set({
  current: null,
  routable: null,
  groups: [],
  failures: [],
  status: 'idle',
  pending: null,
  error: null,
  retainedEffort: undefined,
})
ok = (await mount('session switch: back to idle', seatProps())) && ok

// 6. with current + effort metadata (trigger shows effort label)
directoryStore.set({
  current: { provider: 'deepseek-account', model: 'deepseek-v4.1-flash', reasoningEffort: 'high' },
  routable: true,
})
ok = (await mount('current + effort', seatProps())) && ok

// 7. a model whose reasoning crossed the wire as null — the JSON shape for
//    "no effort metadata" that the shipped control defends against
directoryStore.set({
  status: 'ready',
  groups: [
    {
      id: 'deepseek-account',
      name: 'DeepSeek',
      models: [
        { id: 'deepseek-v4.1', name: 'DeepSeek V4.1', description: 'flagship', reasoning: null },
        { id: 'openrouter/qwen3', name: 'Qwen3 235B', reasoning: null },
      ],
    },
  ],
  failures: [],
  current: { provider: 'deepseek-account', model: 'deepseek-v4.1' },
  routable: true,
})
ok = (await mount('ready, current model has reasoning:null', seatProps())) && ok

// 8. switching TO a session whose current model is the reasoning:null one —
//    the exact user-reported trigger
directoryStore.set({
  current: { provider: 'deepseek-account', model: 'openrouter/qwen3' },
  routable: true,
})
ok = (await mount('switched to session with reasoning:null current', seatProps())) && ok

console.log('')
console.log(ok ? 'ALL MOUNTS CLEAN — crash is interaction-time, not mount-time' : 'MOUNT CRASH REPRODUCED')
process.exit(ok ? 0 : 1)
