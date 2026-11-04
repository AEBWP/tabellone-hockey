/** Lato massimo del logo salvato, in pixel: basta per il maxischermo e resta leggero. */
export const LOGO_MAX_SIZE = 320

export const LOGO_ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml,image/gif'

/**
 * Legge un'immagine scelta dall'operatore e la ridimensiona (mantenendo le
 * proporzioni e la trasparenza). Restituisce un'immagine incorporata (data
 * URL) che viaggia con lo stato della partita e funziona offline.
 */
export async function loadLogo(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error("Il file scelto non è un'immagine.")
  }

  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    // Gli SVG senza dimensioni dichiarate risultano 0×0: usiamo il lato massimo.
    const width = img.naturalWidth || LOGO_MAX_SIZE
    const height = img.naturalHeight || LOGO_MAX_SIZE
    // Le immagini normali si rimpiccioliscono soltanto; gli SVG (vettoriali)
    // si portano sempre alla dimensione piena, così restano nitidi.
    const fit = LOGO_MAX_SIZE / Math.max(width, height)
    const scale = file.type === 'image/svg+xml' ? fit : Math.min(1, fit)

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error("Impossibile elaborare l'immagine.")
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    // WebP mantiene la trasparenza ed è leggero; PNG se non supportato.
    const webp = canvas.toDataURL('image/webp', 0.92)
    return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Impossibile leggere l'immagine."))
    img.src = src
  })
}
