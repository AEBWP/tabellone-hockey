// Logica pura per la scelta degli schermi (nessuna dipendenza da Electron,
// così si può verificare con i test).

/**
 * @typedef {{ x: number, y: number, width: number, height: number }} Rect
 * @typedef {{ id: number, bounds: Rect, primary: boolean, scaleFactor: number, label?: string }} ScreenInfo
 * @typedef {{ consoleId: number, displayId: number }} ScreenChoice
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
  return { consoleId: primary.id, displayId: (others[0] ?? primary).id }
}

/**
 * Verifica che una scelta salvata sia ancora valida (entrambi gli schermi collegati).
 * @param {Partial<ScreenChoice> | null | undefined} choice
 * @param {ScreenInfo[]} screens
 * @returns {choice is ScreenChoice}
 */
function isChoiceValid(choice, screens) {
  if (!choice || typeof choice.consoleId !== 'number' || typeof choice.displayId !== 'number') {
    return false
  }
  const ids = new Set(screens.map((s) => s.id))
  return ids.has(choice.consoleId) && ids.has(choice.displayId)
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

module.exports = { defaultChoice, isChoiceValid, describeScreens }
