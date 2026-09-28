/**
 * Static verification for @happyqu/dsh-plugin-model-filter's Client half.
 *
 * There is no browser test runner here, so this script proves the things a
 * silent failure would hide: the module parses and its factory returns a
 * plugin body, the registration targets the right seat at a shadowing
 * priority, every locale key the component asks for exists in both
 * dictionaries, and — most importantly — the component actually RENDERS with
 * the menu open. A component that throws blanks its slot entry (console: "slot
 * entry crashed in '<slot>'"), so a render pass is the check that matters.
 *
 * To render the open menu the harness carries a small hook-aware renderer:
 * hooks are stored per component path so state survives re-renders, `ref`
 * props are attached to fake nodes, and the portal is rendered in place.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

const here = dirname(fileURLToPath(import.meta.url))
const clientPath = join(here, '..', 'lib', 'client.js')
const source = readFileSync(clientPath, 'utf8')

// The boot graph derives a Client bundle's module id from its package name, so
// `__ModuleLoader__.load({ id })` must equal `package.json`'s `name` verbatim.
// Reading it here rather than hardcoding it is what keeps a package rename from
// silently breaking activation (the bundle would load but register nothing, and
// the loader would report "loaded without registering <id>").
const packageName = JSON.parse(
  readFileSync(join(here, '..', 'package.json'), 'utf8'),
).name

let failures = 0
const check = (label, fn) => {
  // Every check starts from a fresh mount: the renderer keys hook slots by
  // component path, so without this a later check would inherit the previous
  // check's `open` / `filter` state and toggle the menu the wrong way.
  hookStore.clear()
  try {
    fn()
    console.log(`ok   ${label}`)
  } catch (error) {
    failures += 1
    console.error(`FAIL ${label}\n     ${error.message}`)
  }
}

// ---- a minimal hook-aware renderer --------------------------------------

const Fragment = Symbol('Fragment')

/** Hook slots per component path, so state persists across re-renders. */
const hookStore = new Map()
let hookPath = ''
let hookSlots = []
let hookCursor = 0
let dirty = false
const pendingEffects = []
let hosts = []

function withHooks(path, fn) {
  const saved = { path: hookPath, slots: hookSlots, cursor: hookCursor }
  hookPath = path
  hookSlots = hookStore.get(path) ?? []
  hookCursor = 0
  try {
    return fn()
  } finally {
    hookStore.set(path, hookSlots)
    hookPath = saved.path
    hookSlots = saved.slots
    hookCursor = saved.cursor
  }
}

const React = {
  createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
  Fragment,
  useState(initial) {
    const at = hookCursor++
    // Capture the ARRAY REFERENCE: `hookSlots` is a module-level variable that
    // withHooks rebinds on every render, but a setter is called later (from an
    // event handler), when the variable no longer points at this component's
    // slots. Writing through the captured array is what makes state persist.
    const slots = hookSlots
    if (!(at in slots)) slots[at] = typeof initial === 'function' ? initial() : initial
    const set = (next) => {
      const value = typeof next === 'function' ? next(slots[at]) : next
      if (!Object.is(slots[at], value)) {
        slots[at] = value
        dirty = true
      }
    }
    return [slots[at], set]
  },
  useRef(initial) {
    const at = hookCursor++
    if (!(at in hookSlots)) hookSlots[at] = { current: initial }
    return hookSlots[at]
  },
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
  useEffect: (fn) => {
    pendingEffects.push(fn)
  },
  useLayoutEffect: (fn) => {
    pendingEffects.push(fn)
  },
  useId: () => `:${hookPath}:`,
  useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
  forwardRef: (render) => render,
}

const ReactDOM = { createPortal: (node) => node }

/** A stand-in DOM node: enough surface for the component's ref usage. */
function fakeNode(props) {
  return {
    focus() {},
    blur() {},
    getBoundingClientRect: () => ({ left: 0, top: 100, right: 200, bottom: 120, width: 200, height: 20 }),
    contains: () => false,
    querySelector: () => null,
    closest: () => null,
    disabled: props.disabled === true,
    offsetWidth: 240,
    offsetHeight: 200,
  }
}

/** Collect the text of a rendered element subtree. */
function textOf(node) {
  if (node === null || node === undefined || node === false || node === true) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  return (node.children ?? []).map(textOf).join('')
}

/** Render one element tree, attaching refs and running function components. */
function renderNode(node, path) {
  if (node === null || node === undefined || node === false || node === true) return null
  if (typeof node === 'string' || typeof node === 'number') return node
  if (Array.isArray(node)) {
    node.forEach((child, at) => renderNode(child, `${path}.${at}`))
    return null
  }
  const { type, props, children } = node
  if (type === Fragment) {
    ;(children ?? []).forEach((child, at) => renderNode(child, `${path}.${at}`))
    return node
  }
  if (typeof type === 'function') {
    return withHooks(path, () => renderNode(type({ ...props, children }), `${path}/c`))
  }
  hosts.push(node)
  if (typeof props.ref === 'function') props.ref(fakeNode(props))
  else if (props.ref !== null && typeof props.ref === 'object') props.ref.current = fakeNode(props)
  ;(children ?? []).forEach((child, at) => renderNode(child, `${path}.${at}`))
  return node
}

/**
 * Render a component to completion: re-render while state changes, then run
 * the queued effects once.
 * @returns the flat list of rendered host elements.
 */
function renderApp(component, props) {
  let guard = 0
  do {
    dirty = false
    hosts = []
    pendingEffects.length = 0
    // Render the component AS a node: renderNode wraps function components in
    // withHooks, so the root's own state is stored and persists across passes.
    renderNode({ type: component, props, children: [] }, '#root')
    guard += 1
  } while (dirty && guard < 20)
  for (const effect of pendingEffects) {
    const cleanup = effect()
    if (typeof cleanup === 'function') cleanup()
  }
  return hosts
}

// ---- load the module through a stubbed module table ----------------------

const registrations = []
const loaded = []

globalThis.window = {
  innerWidth: 1280,
  innerHeight: 800,
  addEventListener: () => {},
  removeEventListener: () => {},
  __ModuleLoader__: {
    load(definition) {
      loaded.push(definition.id)
      globalThis.__plugin = definition.factory((name) => {
        if (name === 'react') return React
        if (name === 'react-dom') return ReactDOM
        throw new Error(`unexpected require("${name}")`)
      })
    },
  },
}

globalThis.document = {
  head: { appendChild: () => {} },
  body: { appendChild: () => {} },
  createElement: () => ({ dataset: {}, remove: () => {}, textContent: '' }),
  addEventListener: () => {},
  removeEventListener: () => {},
  querySelector: () => null,
}

globalThis.Element = class Element {}
globalThis.Node = class Node {}
globalThis.HTMLButtonElement = class HTMLButtonElement {}

await import(`${new URL('file:///' + clientPath.replaceAll('\\', '/'))}?t=${Date.now()}`)

const plugin = globalThis.__plugin

check('module registers exactly one factory under the package name', () => {
  assert.deepEqual(loaded, [packageName])
})

check('the stylesheet tag is attributed to the package name', () => {
  const plugin = [...source.matchAll(/el\.dataset\.plugin = "([^"]+)"/g)].map(
    (m) => m[1],
  )
  assert.deepEqual(plugin, [packageName])
})

check('the bundle patch inserts this same package name', () => {
  const patch = readFileSync(join(here, '..', 'cordis.patch.yml'), 'utf8')
  const inserted = [...patch.matchAll(/^\s*name:\s*'([^']+)'/gm)].map((m) => m[1])
  assert.deepEqual(inserted, [packageName])
})

check('reasoning metadata is normalized against null before use', () => {
  // Catalog rows serialize "no effort metadata" as JSON null, and the shipped
  // control defends with `?.` — a copy that reads `.defaultEffort` through a
  // plain `null` crashes on render, the seat abdicates, and the plugin appears
  // to "work only in the first conversation". Guard it at the source.
  assert.match(source, /model\.reasoning \|\| undefined/)
})

check('plugin exports name, inject and apply', () => {
  assert.equal(plugin.name, 'model-filter')
  assert.deepEqual(plugin.inject, ['slots', 'locale'])
  assert.equal(typeof plugin.apply, 'function')
})

// ---- drive apply() against a fake context -------------------------------

const effectDisposers = []
const localeDicts = {}
let injectedSlotsCallback = null

const fakeScope = {
  modelDirectories: {
    directoryFor: () => ({ store: {}, load: async () => {}, select: async () => ({ ok: true }) }),
  },
  sessions: { subagentAddress: () => undefined },
  slots: {
    inject(key, callback) {
      injectedSlotsCallback = { key, callback }
      return () => {}
    },
    register(options, component) {
      registrations.push({ options, component })
      return () => {}
    },
  },
}

const ctx = {
  // ctx.effect runs its callback immediately and keeps the returned disposer,
  // so the harness must call it too — otherwise the dictionaries registered
  // inside an effect would never appear.
  effect: (fn) => {
    effectDisposers.push(fn())
    return () => {}
  },
  locale: {
    register: (ns, dicts) => {
      localeDicts[ns] = dicts
      return () => {}
    },
  },
  inject: (deps, callback) => {
    assert.deepEqual(deps, ['slots', 'modelDirectories', 'sessions'])
    callback(fakeScope)
  },
}

plugin.apply(ctx)

check('apply installs both effects (stylesheet and dictionaries)', () => {
  assert.equal(effectDisposers.length, 2)
})

check('apply registers both locale dictionaries', () => {
  assert.ok(localeDicts.modelFilter, 'no modelFilter namespace registered')
  assert.ok(localeDicts.modelFilter.zh, 'no zh dictionary')
  assert.ok(localeDicts.modelFilter.en, 'no en dictionary')
})

check('slots.inject targets the composer model seat', () => {
  assert.equal(injectedSlotsCallback.key, 'conversation.input.model')
})

injectedSlotsCallback.callback()

check('registers exactly one entry', () => {
  assert.equal(registrations.length, 1)
})

check('the entry shadows the shipped occupant at priority -1', () => {
  const options = registrations[0].options
  assert.equal(options.name, 'conversation.input.model')
  assert.equal(options.priority, -1, 'priority must be < 0 to outrank the shipped entry')
  assert.equal(options.locale, 'modelFilter')
  assert.equal(typeof options.inject, 'function')
  assert.equal(typeof registrations[0].component, 'function')
})

check('the inject face matches the seat contract', () => {
  const face = registrations[0].options.inject('session-1')
  assert.deepEqual(Object.keys(face).sort(), ['available', 'directory', 'load', 'select'])
  assert.equal(face.available, true)
})

// ---- locale key coverage ------------------------------------------------

const zh = localeDicts.modelFilter.zh
const en = localeDicts.modelFilter.en

check('zh and en declare identical key sets', () => {
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort())
})

/** Every literal t("...") key the component reads. */
const usedKeys = new Set([...source.matchAll(/\bt\(\s*"([^"]+)"/g)].map((match) => match[1]))

check('every t() key used by the component is declared', () => {
  const missing = [...usedKeys].filter((key) => !(key in zh))
  assert.deepEqual(missing, [], `undeclared keys: ${missing.join(', ')}`)
})

check('no declared key is dead weight', () => {
  const unused = Object.keys(zh).filter((key) => !usedKeys.has(key))
  assert.deepEqual(unused, [], `declared but unused: ${unused.join(', ')}`)
})

// ---- render passes ------------------------------------------------------

const component = registrations[0].component

/** A directory store with the shipped snapshot shape. */
function makeDirectory(overrides = {}) {
  const snapshot = {
    current: { provider: 'deepseek-account', model: 'deepseek-v4-pro', reasoningEffort: 'high' },
    routable: true,
    groups: [
      {
        id: 'deepseek-account',
        name: 'DeepSeek Account',
        models: [
          {
            id: 'deepseek-v4-pro',
            name: 'DeepSeek V4 Pro',
            description: 'stronger reasoning',
            reasoning: { efforts: [{ id: 'low', name: 'Low' }, { id: 'high', name: 'High' }], defaultEffort: 'high' },
          },
          { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash' },
        ],
      },
      { id: 'openrouter', name: 'OpenRouter', models: [{ id: 'qwen3', name: 'Qwen3 235B' }] },
    ],
    failures: [],
    status: 'ready',
    pending: null,
    error: null,
    ...overrides,
  }
  return {
    subscribe: () => () => {},
    getSnapshot: () => snapshot,
    load: async () => snapshot,
    select: async () => ({ ok: true }),
  }
}

/** Interpolate one dictionary key the way the locale service does. */
function translate(key, params) {
  let text = zh[key] ?? `!${key}!`
  for (const [name, value] of Object.entries(params ?? {})) text = text.replace(`{${name}}`, String(value))
  return text
}

/** The props the seat hands its occupant. */
function seatProps(directory, overrides = {}) {
  return {
    locked: false,
    available: true,
    directory,
    load: () => {},
    select: async () => ({ ok: true }),
    t: translate,
    ...overrides,
  }
}

const optionTexts = (rendered) =>
  rendered.filter((el) => el.props.role === 'menuitemradio').map((el) => textOf(el))
const findInput = (rendered) => rendered.find((el) => el.type === 'input' && el.props['aria-label'] === zh['filter.aria'])
const findTrigger = (rendered) => rendered.find((el) => el.type === 'button' && el.props['aria-haspopup'] === 'menu')

/**
 * Open the menu and land on the model pane.
 *
 * With a model already selected the seat opens on its root pane (the Model /
 * Effort cells), exactly like the shipped control; the model list — and so the
 * filter — is one drill down. With no selection it opens straight onto the
 * list. Both paths are exercised here.
 * @returns the rendered host elements with the model pane showing.
 */
function openModelPane(directory) {
  let rendered = renderApp(component, seatProps(directory))
  findTrigger(rendered).props.onClick()
  rendered = renderApp(component, seatProps(directory))
  const modelCell = rendered.find((el) => el.props.role === 'menuitem' && textOf(el).includes(zh['menu.model']))
  if (modelCell) {
    modelCell.props.onClick()
    rendered = renderApp(component, seatProps(directory))
  }
  return rendered
}

check('renders the closed trigger without throwing', () => {
  const rendered = renderApp(component, seatProps(makeDirectory()))
  assert.ok(findTrigger(rendered), 'no trigger rendered')
  assert.equal(rendered.filter((el) => el.props.role === 'menuitemradio').length, 0, 'menu should be closed')
})

check('renders with an unselected model, loading, empty and error states', () => {
  renderApp(component, seatProps(makeDirectory({ current: null, status: 'loading' })))
  renderApp(component, seatProps(makeDirectory({ current: null, status: 'ready', groups: [] })))
  renderApp(component, seatProps(makeDirectory({ error: 'boom', status: 'error' })))
  renderApp(component, seatProps(makeDirectory({ failures: [{ id: 'x', name: 'X', message: 'nope' }] })))
})

check('renders for an addressed subagent session as nothing', () => {
  const tree = component(seatProps(makeDirectory(), { available: false }))
  assert.equal(tree, null)
})

// Opening the menu is the real test: the filter box lives inside it.
check('the menu opens on the root pane, matching the shipped control', () => {
  const directory = makeDirectory()
  const first = renderApp(component, seatProps(directory))
  findTrigger(first).props.onClick()
  const rendered = renderApp(component, seatProps(directory))
  const cells = rendered.filter((el) => el.props.role === 'menuitem').map(textOf)
  assert.equal(cells.length, 2, `expected Model + Effort cells, got: ${cells.join(' | ')}`)
  assert.ok(cells[0].includes(zh['menu.model']))
  assert.ok(cells[1].includes(zh['menu.effort']))
})

check('an unselected session opens straight onto the filterable list', () => {
  const directory = makeDirectory({ current: null })
  const first = renderApp(component, seatProps(directory))
  findTrigger(first).props.onClick()
  const rendered = renderApp(component, seatProps(directory))
  assert.ok(findInput(rendered), 'an unset seat should drill straight into the list')
  assert.deepEqual(optionTexts(rendered), ['DeepSeek V4 Pro', 'DeepSeek V4 Flash', 'Qwen3 235B'])
})

check('drilling into Model renders the filter box over every model', () => {
  const rendered = openModelPane(makeDirectory())
  const input = findInput(rendered)
  assert.ok(input, 'the filter input did not render inside the model pane')
  assert.equal(input.props.placeholder, zh['filter.placeholder'])
  assert.equal(input.props.value, '')
  assert.deepEqual(optionTexts(rendered), ['DeepSeek V4 Pro', 'DeepSeek V4 Flash', 'Qwen3 235B'])
})

check('the model list keeps the shipped DeepSeek-first provider order', () => {
  const rendered = openModelPane(makeDirectory())
  const headings = rendered.filter((el) => el.props.role === 'group').map(textOf)
  assert.ok(headings[0].includes(zh['provider.account']), `account group should be first: ${headings.join(' | ')}`)
  assert.ok(headings[1].includes('OpenRouter'), `third-party group should follow: ${headings.join(' | ')}`)
})

check('typing in the filter narrows the visible models', () => {
  const directory = makeDirectory()
  let rendered = openModelPane(directory)
  findInput(rendered).props.onChange({ currentTarget: { value: 'flash' } })
  rendered = renderApp(component, seatProps(directory))
  assert.deepEqual(optionTexts(rendered), ['DeepSeek V4 Flash'])
})

check('the filter also matches on model id and on provider name', () => {
  const directory = makeDirectory()
  let rendered = openModelPane(directory)

  findInput(rendered).props.onChange({ currentTarget: { value: 'qwen3' } })
  rendered = renderApp(component, seatProps(directory))
  assert.deepEqual(optionTexts(rendered), ['Qwen3 235B'], 'model id should match')

  findInput(rendered).props.onChange({ currentTarget: { value: 'openrouter' } })
  rendered = renderApp(component, seatProps(directory))
  assert.deepEqual(optionTexts(rendered), ['Qwen3 235B'], 'provider name should match')

  findInput(rendered).props.onChange({ currentTarget: { value: 'stronger' } })
  rendered = renderApp(component, seatProps(directory))
  assert.deepEqual(optionTexts(rendered), ['DeepSeek V4 Pro'], 'description should match')
})

check('filtering is case-insensitive', () => {
  const directory = makeDirectory()
  let rendered = openModelPane(directory)
  findInput(rendered).props.onChange({ currentTarget: { value: 'FLASH' } })
  rendered = renderApp(component, seatProps(directory))
  assert.deepEqual(optionTexts(rendered), ['DeepSeek V4 Flash'])
})

check('a non-matching filter shows the empty message, not a blank menu', () => {
  const directory = makeDirectory()
  let rendered = openModelPane(directory)
  findInput(rendered).props.onChange({ currentTarget: { value: 'zzzz' } })
  rendered = renderApp(component, seatProps(directory))
  assert.deepEqual(optionTexts(rendered), [])
  const texts = rendered.map(textOf).join(' ')
  assert.ok(texts.includes(zh['empty.noMatch']), 'the no-match message should render')
})

check('clearing the filter restores every model', () => {
  const directory = makeDirectory()
  let rendered = openModelPane(directory)
  findInput(rendered).props.onChange({ currentTarget: { value: 'flash' } })
  rendered = renderApp(component, seatProps(directory))
  findInput(rendered).props.onChange({ currentTarget: { value: '' } })
  rendered = renderApp(component, seatProps(directory))
  assert.equal(optionTexts(rendered).length, 3)
})

check('a filtered list still marks the model in use', () => {
  const directory = makeDirectory()
  let rendered = openModelPane(directory)
  findInput(rendered).props.onChange({ currentTarget: { value: 'deepseek' } })
  rendered = renderApp(component, seatProps(directory))
  const checked = rendered.filter((el) => el.props.role === 'menuitemradio' && el.props['aria-checked'] === true)
  assert.equal(checked.length, 1)
  assert.ok(textOf(checked[0]).includes('DeepSeek V4 Pro'))
})

check('the effort pane still renders for a model that advertises levels', () => {
  const directory = makeDirectory()
  let rendered = renderApp(component, seatProps(directory))
  findTrigger(rendered).props.onClick()
  rendered = renderApp(component, seatProps(directory))
  const effortCell = rendered.find((el) => el.props.role === 'menuitem' && textOf(el).includes(zh['menu.effort']))
  assert.ok(effortCell, 'no effort cell rendered')
  effortCell.props.onClick()
  const drilled = renderApp(component, seatProps(directory))
  const texts = optionTexts(drilled)
  assert.ok(texts.includes('High'), `effort levels missing: ${texts.join(', ')}`)
})

check('the effort pane is absent for a model without reasoning metadata', () => {
  const directory = makeDirectory({
    current: { provider: 'deepseek-account', model: 'deepseek-v4-flash' },
  })
  const rendered = renderApp(component, seatProps(directory))
  findTrigger(rendered).props.onClick()
  const opened = renderApp(component, seatProps(directory))
  const cells = opened.filter((el) => el.props.role === 'menuitem').map(textOf)
  assert.equal(cells.length, 1, `expected only the Model cell, got: ${cells.join(' | ')}`)
})

check('the stylesheet declares no literal colors', () => {
  const styleBlock = source.slice(source.indexOf('var STYLES = ['), source.indexOf('].join("\\n")'))
  const literals = [...styleBlock.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g)].map((m) => m[0])
  assert.deepEqual(literals, [], `literal colors found: ${literals.join(', ')}`)
})

check('the filter input is excluded from the arrow-key row walk', () => {
  const inputBlock = source.slice(source.indexOf('ref: filterRef'), source.indexOf('ref: filterRef') + 400)
  assert.ok(!inputBlock.includes('itemRef()'), 'the filter input must not join the row refs')
})

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nall checks passed')
