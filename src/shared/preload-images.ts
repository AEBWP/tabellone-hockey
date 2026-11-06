/**
 * Tiene pronte (già decodificate) le immagini indicate, ad es. i loghi delle
 * squadre: così l'animazione del gol, che li mostra in grande all'improvviso,
 * non deve decodificarli proprio nel primo fotogramma.
 * Le immagini non più richieste vengono lasciate andare.
 */
const ready = new Map<string, HTMLImageElement>()

export function preloadImages(urls: readonly (string | null | undefined)[]): void {
  if (typeof Image === 'undefined') return
  const wanted = new Set(urls.filter((u): u is string => !!u))
  for (const url of ready.keys()) if (!wanted.has(url)) ready.delete(url)
  for (const url of wanted) {
    if (ready.has(url)) continue
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    img.decode().catch(() => {})
    ready.set(url, img)
  }
}
