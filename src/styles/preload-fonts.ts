/**
 * Carica subito i font del tabellone (il browser li caricherebbe solo al
 * primo utilizzo): così cambiando stile, o alla prima animazione, il testo
 * compare senza ritardi.
 */
export function preloadFonts(): void {
  if (typeof document === 'undefined' || !document.fonts) return
  for (const font of [
    '500 20px "Barlow Condensed"',
    '700 20px "Barlow Condensed"',
    '800 20px "Barlow Condensed"',
    '800 20px "Doto"',
    '900 20px "Doto"',
  ]) {
    void document.fonts.load(font).catch(() => {})
  }
}
