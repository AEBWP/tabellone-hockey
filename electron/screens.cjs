// Logica pura per la scelta degli schermi (nessuna dipendenza da Electron,
// così si può verificare con i test).

/**
 * @typedef {{ x: number, y: number, width: number, height: number }} Rect
 * @typedef {{ id: number, bounds: Rect, primary: boolean, scaleFactor: number, label?: string }} ScreenInfo
 * @typedef {{ consoleId: number, displayIds: number[], mirrorIds: number[] }} ScreenChoice
 * `mirrorIds`: schermi del tabellone girati verso la console (di fronte all'operatore),
 * dove destra e sinistra vanno rovesciate rispetto alla console.
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
  return { consoleId: s.consoleId, displayIds, mirrorIds }
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
 * nessuno, il tabellone va in una finestra sullo schermo della console (o sul
 * principale, se manca anche quello).
 * @param {ScreenChoice} choice
 * @param {ScreenInfo[]} screens
 * @param {boolean} [forceFullscreen] solo per i collaudi con un monitor
 * @returns {{ id: number, mode: 'fullscreen' | 'window', mirror: boolean }[]}
 */
function displayPlan(choice, screens, forceFullscreen = false) {
  const connected = new Set(screens.map((s) => s.id))
  const primary = (screens.find((s) => s.primary) ?? screens[0])?.id
  const mirrored = new Set(choice.mirrorIds ?? [])
  let ids = choice.displayIds.filter((id) => connected.has(id))
  if (ids.length === 0) ids = [connected.has(choice.consoleId) ? choice.consoleId : primary]
  return [...new Set(ids)]
    .filter((id) => id !== undefined)
    .map((id) => ({
      id,
      mode: forceFullscreen || id !== choice.consoleId ? 'fullscreen' : 'window',
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

module.exports = { defaultChoice, normalizeChoice, isChoiceValid, displayPlan, describeScreens }
