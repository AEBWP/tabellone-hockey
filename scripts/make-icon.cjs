// Crea le immagini del programma a partire da build/icon.svg:
// - build/icon.png             (512×512, sfondo trasparente): icona di Windows
// - build/installerSidebar.bmp (164×314): fascia laterale dell'installazione,
//   con icona, nome e numero di versione (preso da package.json)
// Uso: npm run icon (viene eseguito anche da npm run dist)
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const svg = fs.readFileSync(path.join(root, 'build', 'icon.svg'), 'utf8')
const svgUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`

/** Codifica pixel RGBA in un BMP a 24 bit (righe dal basso, BGR, allineate a 4 byte). */
function encodeBmp(width, height, rgba) {
  const rowSize = Math.ceil((width * 3) / 4) * 4
  const dataSize = rowSize * height
  const buf = Buffer.alloc(54 + dataSize)
  buf.write('BM', 0)
  buf.writeUInt32LE(54 + dataSize, 2)
  buf.writeUInt32LE(54, 10)
  buf.writeUInt32LE(40, 14)
  buf.writeInt32LE(width, 18)
  buf.writeInt32LE(height, 22)
  buf.writeUInt16LE(1, 26)
  buf.writeUInt16LE(24, 28)
  buf.writeUInt32LE(dataSize, 34)
  buf.writeInt32LE(2835, 38)
  buf.writeInt32LE(2835, 42)
  for (let y = 0; y < height; y++) {
    const row = 54 + (height - 1 - y) * rowSize
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      buf[row + x * 3] = rgba[i + 2]
      buf[row + x * 3 + 1] = rgba[i + 1]
      buf[row + x * 3 + 2] = rgba[i]
    }
  }
  return buf
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false })
  await win.loadURL('data:text/html,<!doctype html><title>immagini</title>')

  const result = await win.webContents.executeJavaScript(`
    new Promise((resolve, reject) => {
      const img = new Image()
      img.onerror = () => reject(new Error('SVG non valido'))
      img.onload = () => {
        // Icona 512×512
        const icon = document.createElement('canvas')
        icon.width = icon.height = 512
        icon.getContext('2d').drawImage(img, 0, 0, 512, 512)

        // Fascia laterale dell'installazione 164×314
        const W = 164, H = 314
        const c = document.createElement('canvas')
        c.width = W
        c.height = H
        const g = c.getContext('2d')
        const bg = g.createLinearGradient(0, 0, 0, H)
        bg.addColorStop(0, '#16406b')
        bg.addColorStop(1, '#061223')
        g.fillStyle = bg
        g.fillRect(0, 0, W, H)
        g.drawImage(img, (W - 112) / 2, 34, 112, 112)
        g.textAlign = 'center'
        g.fillStyle = '#ffffff'
        g.font = '700 21px "Segoe UI", sans-serif'
        g.fillText('Tabellone', W / 2, 184)
        g.fillText('Hockey', W / 2, 209)
        g.fillStyle = '#ffb000'
        g.fillRect(36, 228, W - 72, 2)
        g.fillStyle = '#9cc3ea'
        g.font = '600 15px "Segoe UI", sans-serif'
        g.fillText('Versione', W / 2, 256)
        g.fillStyle = '#ffffff'
        g.font = '700 22px "Segoe UI", sans-serif'
        g.fillText(${JSON.stringify(version)}, W / 2, 282)

        resolve({
          icon: icon.toDataURL('image/png'),
          sidebar: Array.from(g.getImageData(0, 0, W, H).data),
          width: W,
          height: H,
        })
      }
      img.src = ${JSON.stringify(svgUrl)}
    })
  `)

  const iconFile = path.join(root, 'build', 'icon.png')
  fs.writeFileSync(iconFile, Buffer.from(result.icon.split(',')[1], 'base64'))
  const sidebarFile = path.join(root, 'build', 'installerSidebar.bmp')
  fs.writeFileSync(sidebarFile, encodeBmp(result.width, result.height, result.sidebar))
  console.log(`Create: ${iconFile}, ${sidebarFile} (versione ${version})`)
  app.quit()
})
