import qrcode from 'qrcode-generator'

/**
 * QR code del link dello streaming, con un logo al centro. Si usa la
 * correzione d'errore più alta (H, fino al 30% del codice ricostruibile):
 * il logo copre molto meno e il codice resta leggibile.
 */

/** Lato del logo rispetto al lato del codice (senza margine). */
const LOGO_RATIO = 0.24
/** Margine bianco attorno al codice, in moduli (lo standard ne chiede 4). */
const QUIET_ZONE = 4

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Impossibile leggere l'immagine."))
    img.src = src
  })
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Disegna il QR code di `text` su `canvas` (quadrato di `size` pixel). */
export async function drawQr(
  canvas: HTMLCanvasElement,
  text: string,
  logo: string | null,
  size = 1024,
): Promise<void> {
  const qr = qrcode(0, 'H')
  qr.addData(text, 'Byte')
  qr.make()
  const count = qr.getModuleCount()
  const cell = size / (count + QUIET_ZONE * 2)

  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = '#0b1220'
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (!qr.isDark(r, c)) continue
      // Arrotondato all'intero per non lasciare righe sottili fra i moduli.
      const x = Math.floor((c + QUIET_ZONE) * cell)
      const y = Math.floor((r + QUIET_ZONE) * cell)
      ctx.fillRect(
        x,
        y,
        Math.ceil((c + QUIET_ZONE + 1) * cell) - x,
        Math.ceil((r + QUIET_ZONE + 1) * cell) - y,
      )
    }
  }

  if (!logo) return
  const img = await loadImage(logo).catch(() => null)
  if (!img) return
  const box = count * cell * LOGO_RATIO
  const pad = box * 0.1
  const x0 = (size - box) / 2
  // Riquadro bianco dietro al logo, così si distingue dai moduli.
  ctx.fillStyle = '#ffffff'
  roundRect(ctx, x0 - pad, x0 - pad, box + pad * 2, box + pad * 2, pad * 1.5)
  ctx.fill()
  const w = img.naturalWidth || box
  const h = img.naturalHeight || box
  const fit = box / Math.max(w, h)
  const dw = w * fit
  const dh = h * fit
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh)
}

/** Salva il QR code come immagine PNG (cartella dei download). */
export function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, 'image/png')
}
