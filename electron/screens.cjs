// Logica pura per la scelta degli schermi (nessuna dipendenza da Electron,
// così si può verificare con i test).

/**
 * @typedef {{ x: number, y: number, width: number, height: number }} Rect
 * @typedef {{ id: number, bounds: Rect, primary: boolean, scaleFactor: number, label?: string, internal?: boolean }} ScreenInfo
 * @typedef {{ label: string, width: number, height: number, x: number, y: number, internal: boolean }} ScreenIdentity
 * @typedef {{ consoleId: number, displayIds: number[], mirrorIds: number[], known?: Record<string, ScreenIdentity> }} ScreenChoice
 * `mirrorIds`: schermi del tabellone girati verso la console (di fronte all'operatore),
 * dove destra e sinistra vanno rovesciate rispetto alla console.
 * `known`: com'è fatto ogni schermo scelto, per riconoscerlo ai riavvii.
 */

/**
 * Scelta predefinita: console sullo schermo principale, tabellone sul più
 * grande degli altri (di solito il maxischermo). Con un solo schermo, entrambi lì.
 * @param {ScreenInfo[]} screens
 * @returns {ScreenChoice | null}
 */
function defaultChoice(screens) {
  if (screens.length === 0) return null
  const primary = screens.find((s) => s.primary) ?? screens[0]
  const others = screens
    .filter((s) => s.id !== primary.id)
    .sort((a, b) => b.bounds.width * b.bounds.height - a.bounds.width * a.bounds.height)
  return { consoleId: primary.id, displayIds: [(others[0] ?? primary).id], mirrorIds: [] }
}

/**
 * Scelta salvata nel formato attuale. Le versioni fino alla 0.9.9 salvavano un
 * solo schermo per il tabellone (`displayId`): diventa un elenco di uno.
 * @param {unknown} saved
 * @returns {ScreenChoice | null}
 */
function normalizeChoice(saved) {
  if (!saved || typeof saved !== 'object') return null
  const s =
    /** @type {{ consoleId?: unknown, displayId?: unknown, displayIds?: unknown, mirrorIds?: unknown }} */ (
      saved
    )
  if (typeof s.consoleId !== 'number') return null
  const ids = Array.isArray(s.displayIds)
    ? s.displayIds.filter((id) => typeof id === 'number')
    : typeof s.displayId === 'number'
      ? [s.displayId]
      : []
  if (ids.length === 0) return null
  const displayIds = [...new Set(ids)]
  // Fino alla 0.9.11 non c'era: nessuno schermo specchiato.
  const mirrorIds = Array.isArray(s.mirrorIds)
    ? [...new Set(s.mirrorIds)].filter((id) => displayIds.includes(id))
    : []
  // Fino alla 1.0.5 non c'era: gli schermi si riconoscono solo dall'id.
  const known = {}
  if (s.known && typeof s.known === 'object') {
    for (const id of [s.consoleId, ...displayIds]) {
      const k = s.known[id]
      if (k && typeof k.width === 'number' && typeof k.height === 'number') known[id] = k
    }
  }
  return {
    consoleId: s.consoleId,
    displayIds,
    mirrorIds,
    ...(Object.keys(known).length ? { known } : {}),
  }
}

/**
 * Come è fatto uno schermo: serve a riconoscerlo anche se al riavvio ha un id
 * diverso. Il nome può mancare, la risoluzione è quella reale.
 * @param {ScreenInfo} s
 * @returns {ScreenIdentity}
 */
function screenIdentity(s) {
  return {
    label: s.label ?? '',
    width: Math.round(s.bounds.width * s.scaleFactor),
    height: Math.round(s.bounds.height * s.scaleFactor),
    x: s.bounds.x,
    y: s.bounds.y,
    internal: !!s.internal,
  }
}

/**
 * Aggiunge alla scelta come sono fatti gli schermi scelti, per poterli
 * riconoscere ai prossimi avvii.
 * @param {ScreenChoice} choice
 * @param {ScreenInfo[]} screens
 * @returns {ScreenChoice}
 */
function withIdentities(choice, screens) {
  /** @type {Record<string, ScreenIdentity>} */
  const known = {}
  for (const id of [choice.consoleId, ...choice.displayIds]) {
    const s = screens.find((x) => x.id === id)
    if (s) known[id] = screenIdentity(s)
  }
  return { ...choice, known }
}

/** @param {ScreenIdentity} [k] @param {ScreenIdentity} [c] */
const sameModel = (k, c) =>
  !!k &&
  !!c &&
  k.label === c.label &&
  k.width === c.width &&
  k.height === c.height &&
  !!k.internal === c.internal

/**
 * Criteri per riconoscere uno schermo salvato, dal più sicuro al meno sicuro.
 * L'ultimo vale anche per le scelte salvate dalle versioni precedenti.
 * @type {((k: ScreenIdentity | undefined, c: ScreenIdentity, sameId: boolean) => boolean)[]}
 */
const MATCHES = [
  (k, c) => sameModel(k, c) && k?.x === c.x && k?.y === c.y,
  (k, c, sameId) => sameId && sameModel(k, c),
  (k, c) => sameModel(k, c),
  (k, c) => !!k?.label && k.label === c.label,
  (_k, _c, sameId) => sameId,
]

/**
 * Riporta una scelta salvata sugli schermi collegati adesso: l'id di uno schermo
 * può cambiare da un avvio all'altro, le sue caratteristiche no. Uno schermo che
 * non si trova resta nella scelta, così viene ripreso appena si ricollega.
 * @param {unknown} saved
 * @param {ScreenInfo[]} screens
 * @returns {ScreenChoice | null}
 */
function resolveChoice(saved, screens) {
  const c = normalizeChoice(saved)
  if (!c) return null
  const ids = [...new Set([c.consoleId, ...c.displayIds])]
  const current = new Map(screens.map((s) => [s.id, screenIdentity(s)]))
  /** Da id salvato a id attuale. @type {Map<number, number>} */
  const found = new Map()
  const taken = new Set()
  for (const matches of MATCHES) {
    for (const id of ids) {
      if (found.has(id)) continue
      const hit = screens.find(
        (s) => !taken.has(s.id) && matches(c.known?.[id], current.get(s.id), s.id === id),
      )
      if (hit) {
        found.set(id, hit.id)
        taken.add(hit.id)
      }
    }
  }
  // Uno schermo mancante il cui id è ora di un altro schermo: gli serve un id
  // che nessuno schermo collegato ha, altrimenti verrebbe scambiato per quello.
  let free = -1
  for (const id of ids) {
    if (found.has(id) || !current.has(id)) continue
    while (ids.includes(free)) free--
    found.set(id, free--)
  }
  const now = (/** @type {number} */ id) => found.get(id) ?? id
  /** @type {Record<string, ScreenIdentity>} */
  const known = {}
  for (const id of ids) {
    const identity = current.get(now(id)) ?? c.known?.[id]
    if (identity) known[now(id)] = identity
  }
  return {
    consoleId: now(c.consoleId),
    displayIds: c.displayIds.map(now),
    mirrorIds: c.mirrorIds.map(now),
    ...(Object.keys(known).length ? { known } : {}),
  }
}

/**
 * Verifica che una scelta salvata sia ancora valida: la console e tutti gli
 * schermi del tabellone devono essere collegati.
 * @param {unknown} choice
 * @param {ScreenInfo[]} screens
 * @returns {boolean}
 */
function isChoiceValid(choice, screens) {
  const c = normalizeChoice(choice)
  if (!c) return false
  const ids = new Set(screens.map((s) => s.id))
  return ids.has(c.consoleId) && c.displayIds.every((id) => ids.has(id))
}

/**
 * Su quali schermi aprire il tabellone e come. Sul maxischermo (schermo diverso
 * da quello della console) va a schermo intero; sullo schermo della console resta
 * una finestra normale. Gli schermi scollegati si saltano; se non ne resta
 * nessuno il tabellone non si apre: la scelta è dell'operatore, non si sposta
 * da solo su un altro schermo. Se manca lo schermo della console, la console si
 * apre sul principale: lì il tabellone resta in finestra per non coprirla.
 * @param {ScreenChoice} choice
 * @param {ScreenInfo[]} screens
 * @param {boolean} [forceFullscreen] solo per i collaudi con un monitor
 * @returns {{ id: number, mode: 'fullscreen' | 'window', mirror: boolean }[]}
 */
function displayPlan(choice, screens, forceFullscreen = false) {
  const connected = new Set(screens.map((s) => s.id))
  const primary = (screens.find((s) => s.primary) ?? screens[0])?.id
  const mirrored = new Set(choice.mirrorIds ?? [])
  const consoleId = connected.has(choice.consoleId) ? choice.consoleId : primary
  const ids = choice.displayIds.filter((id) => connected.has(id))
  return [...new Set(ids)].map((id) => ({
    id,
    mode: forceFullscreen || id !== consoleId ? 'fullscreen' : 'window',
    mirror: mirrored.has(id),
  }))
}

/**
 * Nome comprensibile per ogni schermo: "Schermo 1 (principale) · 1920×1080".
 * Numerati da sinistra a destra, come li vede l'operatore.
 * @param {ScreenInfo[]} screens
 */
function describeScreens(screens) {
  return [...screens]
    .sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y)
    .map((s, i) => {
      const w = Math.round(s.bounds.width * s.scaleFactor)
      const h = Math.round(s.bounds.height * s.scaleFactor)
      const name = s.label ? ` – ${s.label}` : ''
      return {
        ...s,
        number: i + 1,
        title: `Schermo ${i + 1}${s.primary ? ' (principale)' : ''}${name}`,
        resolution: `${w}×${h}`,
      }
    })
}

module.exports = {
  defaultChoice,
  normalizeChoice,
  isChoiceValid,
  resolveChoice,
  withIdentities,
  displayPlan,
  describeScreens,
}
