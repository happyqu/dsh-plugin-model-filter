/**
 * Real-React interaction reproduction for the model-filter seat.
 *
 * Why this exists: the seat is a `single` slot entry at priority -1 that
 * shadows the shipped ModelSelect. A render throw retires ("abdicates") the
 * entry for the life of the page, so the shipped control silently takes over —
 * which is exactly "the filter box worked, then it was gone". The shipped stub
 * verifier fakes React and so cannot see any of this.
 *
 * This harness runs lib/client.js under REAL react/react-dom 18 in jsdom,
 * mounts the captured seat in a FRESH root per case (React reuses hook state
 * of the same element type at the same position, which would otherwise leak
 * `open` between cases), drives the real click sequence, and wraps the seat in
 * an error boundary so a render crash is recorded with its stack instead of
 * vanishing into React's retry/unmount path.
 */
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { JSDOM, VirtualConsole } from 'jsdom'

const here = dirname(fileURLToPath(import.meta.url))
const clientFile = process.env.DSHMF_CLIENT ?? join(here, '..', 'lib', 'client.js')

// jsdom routes listener and render throws to its virtual console instead of
// rethrowing them, so an unhandled one is invisible unless it is wired.
const virtualConsole = new VirtualConsole()
const jsdomErrors = []
virtualConsole.on('jsdomError', (e) => jsdomErrors.push(e.stack ?? e.message ?? String(e)))

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  pretendToBeVisual: true,
  url: 'http://localhost/',
  virtualConsole,
})
const { window } = dom
const { document } = window

globalThis.window = window
globalThis.document = document
globalThis.Element = window.Element
globalThis.Node = window.Node
globalThis.HTMLButtonElement = window.HTMLButtonElement
globalThis.HTMLElement = window.HTMLElement
globalThis.Event = window.Event
globalThis.MouseEvent = window.MouseEvent
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

// ---- capture the seat through apply() --------------------------------------
let seatComponent = null
let seatOptions = null
const slots = {
  inject(_key, fn) {
    return fn()
  },
  register(options, component) {
    seatOptions = options
    seatComponent = component
    return () => {}
  },
}

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

const directoryStore = createStore({
  current: null,
  routable: null,
  groups: [],
  failures: [],
  status: 'idle',
  pending: null,
  error: null,
})

const localeDict = { zh: null, en: null }
// A cordis service is a Proxy whose methods resolve `this.ctx` through the
// CALLER's declared scope, not the provider's. Model this faithfully: the
// directory only exists if the caller declared `remote.session`, and a session
// with no cached directory is exactly the case that throws in the real shell
// (`cannot get property "remote.session" without inject`). Without this the
// harness silently papers over the very failure it exists to catch.
let declaredDeps = []
const liveDirectories = new Map()

function directoryFor(sessionId) {
  const key = String(sessionId)
  if (liveDirectories.has(key)) return liveDirectories.get(key)
  if (!declaredDeps.includes('remote.session')) {
    throw new Error('cannot get property "remote.session" without inject')
  }
  const directory = {
    store: directoryStore,
    load: () => Promise.resolve(directoryStore.getSnapshot()),
    select: () => Promise.resolve({ ok: true, value: undefined }),
  }
  liveDirectories.set(key, directory)
  return directory
}

const ctx = {
  effect(fn) {
    fn()
    return () => {}
  },
  locale: {
    register(_ns, pair) {
      localeDict.zh = pair.zh
      localeDict.en = pair.en
      return () => {}
    },
  },
  inject(deps, fn) {
    declaredDeps = [...deps]
    fn({
      slots,
      modelDirectories: { directoryFor },
      sessions: { subagentAddress: () => undefined },
      get remote() {
        if (!declaredDeps.includes('remote')) {
          throw new Error('cannot get property "remote" without inject')
        }
        return { session: {} }
      },
    })
    return () => {}
  },
}
plugin.apply(ctx)
if (seatComponent === null) {
  console.log('FAIL apply() registered no seat component')
  process.exit(1)
}

const t = (key, params) => {
  const template = localeDict.zh?.[key] ?? localeDict.en?.[key]
  if (template === undefined) throw new Error(`missing dict key: ${key}`)
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/g, (_, k) => (params[k] === undefined ? `{${k}}` : String(params[k])))
}

// Go through the REAL seat injection rather than hand-building the face. The
// shell calls `options.inject(sessionId)` for every session it renders, and
// that call is what evaluates `models.directoryFor(sessionId)` in this plugin's
// scope — the exact expression that threw in production. A harness that
// fabricates props skips the only line that matters.
let sessionSeq = 0
function seatProps(over = {}) {
  // A brand-new session id each time: a previously-resolved directory would hit
  // the service's cache and mask a missing-inject failure, which is why the
  // real bug only showed on sessions the shipped control had not touched.
  const sessionId = `session-${++sessionSeq}`
  const injected = seatOptions.inject(sessionId)
  return {
    locked: false,
    t,
    ...injected,
    ...over,
  }
}

// ---- harness ---------------------------------------------------------------
const crashes = []
const consoleErrors = []
const origError = console.error
console.error = (...args) => {
  const text = args.map((a) => (a instanceof Error ? a.stack : String(a))).join(' ')
  if (text.includes('not wrapped in act')) return
  if (text.includes('unique "key" prop')) return // warning, cannot abdicate a seat
  consoleErrors.push(text)
}
process.on('unhandledRejection', (e) => {
  crashes.push('unhandledRejection: ' + (e instanceof Error ? e.stack : String(e)))
})

// The boundary is what turns "the seat went blank" into a stack we can read.
class Boundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { err: null }
  }
  static getDerivedStateFromError(err) {
    return { err }
  }
  componentDidCatch(err, info) {
    crashes.push(`${err && err.stack ? err.stack : String(err)}\n  --- componentStack ---${info.componentStack}`)
  }
  render() {
    return this.state.err === null
      ? this.props.children
      : React.createElement('div', { 'data-crashed': '' })
  }
}

let root = null
let host = null
function freshMount() {
  if (root !== null) root.unmount()
  if (host !== null) host.remove()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = ReactDOMClient.createRoot(host)
  return root
}

const flush = () => new Promise((r) => setTimeout(r, 40))

/** A real click is mousedown + mouseup + click; the seat's root onMouseDown runs first. */
function realClick(el) {
  for (const type of ['mousedown', 'mouseup', 'click']) {
    el.dispatchEvent(new window.MouseEvent(type, { bubbles: true, cancelable: true, view: window }))
  }
}

function setInputValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(input, value)
  input.dispatchEvent(new window.Event('input', { bubbles: true }))
}

function trigger() {
  return host.querySelector('button')
}
function filterBox() {
  return document.querySelector('[data-dsh-model-filter]')
}

let ok = true
function report(label, failedStep, marks) {
  const clean = failedStep === null && crashes.length === 0
  if (!clean) ok = false
  console.log(`${clean ? 'ok  ' : 'FAIL'} ${label}${failedStep ? ` — failed at: ${failedStep}` : ''}`)
  for (const m of marks) console.log('      · ' + m)
  for (const c of [...crashes, ...consoleErrors].slice(0, 2)) {
    console.log('      !! ' + c.split('\n').slice(0, 6).join('\n      '))
  }
}

async function runCase(label, setup, steps) {
  crashes.length = 0
  consoleErrors.length = 0
  jsdomErrors.length = 0
  setup()
  freshMount().render(React.createElement(Boundary, null, React.createElement(seatComponent, seatProps())))
  await flush()
  let failedStep = null
  const marks = []
  if (crashes.length > 0 || consoleErrors.length > 0) {
    failedStep = 'initial render'
  } else {
    for (const [name, fn] of steps) {
      crashes.length = 0
      consoleErrors.length = 0
      try {
        await fn()
      } catch (error) {
        failedStep = `${name} (harness error: ${error.message})`
        break
      }
      await flush()
      if (crashes.length > 0 || consoleErrors.length > 0 || jsdomErrors.length > 0) {
        for (const j of jsdomErrors.splice(0)) consoleErrors.push(j)
        failedStep = name
        break
      }
    }
  }
  // A crashed/blanked seat renders the boundary's marker instead of the trigger.
  if (host.querySelector('[data-crashed]') !== null) {
    marks.push('seat was replaced by the error boundary (would abdicate in the shell)')
  } else if (trigger() === null) {
    marks.push('seat rendered no trigger')
  }
  report(label, failedStep, marks)
  return failedStep === null
}

// ---- payloads --------------------------------------------------------------
const groupsPayload = [
  {
    id: 'deepseek-account',
    name: 'DeepSeek',
    models: [
      { id: 'deepseek-v4.1', name: 'DeepSeek V4.1', description: 'flagship' },
      {
        id: 'deepseek-v4.1-flash',
        name: 'DeepSeek V4.1 Flash',
        description: 'fast',
        reasoning: { efforts: [{ id: 'low', name: 'Low' }, { id: 'high', name: 'High' }], defaultEffort: 'high' },
      },
    ],
  },
  { id: 'openrouter', name: 'OpenRouter', models: [{ id: 'qwen3', name: 'Qwen3 235B' }] },
]
const ready = (over = {}) => ({
  status: 'ready',
  groups: groupsPayload,
  failures: [],
  current: null,
  routable: null,
  pending: null,
  error: null,
  ...over,
})

// A. fresh page, idle store (the first render after a reload)
await runCase('A. fresh page, idle store', () => directoryStore.set({
  current: null, routable: null, groups: [], failures: [], status: 'idle', pending: null, error: null,
}), [
  ['open menu', () => realClick(trigger())],
  ['filter box present', () => {
    if (filterBox() === null) throw new Error('no filter box in the opened menu')
  }],
])

// B. no current model -> opening lands on the filtered list
await runCase('B. no current model: open lands on the list', () => directoryStore.set(ready()), [
  ['open menu', () => realClick(trigger())],
  ['type a query', () => {
    const input = filterBox()?.querySelector('input') ?? document.querySelector('input')
    if (input === null) throw new Error('filter input missing')
    setInputValue(input, 'flash')
  }],
  ['clear the query', () => {
    const clear = [...document.querySelectorAll('button')].find((b) => {
      const a = (b.getAttribute('aria-label') ?? '').toLowerCase()
      return a.includes('clear') || a.includes('清除')
    })
    if (clear !== undefined) realClick(clear)
  }],
])

// C. a current model -> root pane, then drill into Model (the filter lives there)
await runCase('C. current model: root pane then drill into Model', () => directoryStore.set(
  ready({ current: { provider: 'deepseek-account', model: 'deepseek-v4.1' }, routable: true }),
), [
  ['open menu (root pane)', () => realClick(trigger())],
  ['click the Model cell', () => {
    const cells = [...document.querySelectorAll('[role="menuitem"]')]
    if (cells.length === 0) {
      throw new Error(`root pane rendered no menuitem cells; roles=${JSON.stringify([...document.querySelectorAll('[role]')].map((e) => e.getAttribute('role')))}`)
    }
    realClick(cells[0])
  }],
  ['the drilled pane holds the filter box', () => {
    if (filterBox() === null) throw new Error('no filter box after drilling into Model')
  }],
])

// D. reasoning:null current — the JSON shape for "no effort metadata"
await runCase('D. current model has reasoning:null', () => directoryStore.set({
  status: 'ready',
  groups: [{ id: 'deepseek-account', name: 'DeepSeek', models: [{ id: 'deepseek-v4.1', name: 'DeepSeek V4.1', reasoning: null }] }],
  failures: [],
  current: { provider: 'deepseek-account', model: 'deepseek-v4.1' },
  routable: true,
  pending: null,
  error: null,
}), [
  ['open menu', () => realClick(trigger())],
  ['click the Model cell', () => {
    const cells = [...document.querySelectorAll('[role="menuitem"]')]
    if (cells.length > 0) realClick(cells[0])
  }],
])

// E. switching away (the seat unmounts) and back — the reported trigger
await runCase('E. unmount (leave the session) and remount', () => directoryStore.set(
  ready({ current: { provider: 'deepseek-account', model: 'deepseek-v4.1-flash', reasoningEffort: 'high' }, routable: true }),
), [
  ['open menu', () => realClick(trigger())],
  ['unmount the seat', () => {
    root.unmount()
    root = null
  }],
  ['remount the seat', () => {
    freshMount().render(React.createElement(Boundary, null, React.createElement(seatComponent, seatProps())))
  }],
])

console.log('')
console.log(ok ? 'INTERACTION PASS CLEAN' : 'INTERACTION CRASH REPRODUCED')
process.exit(ok ? 0 : 1)
