// Crea build/icon.png (512×512, sfondo trasparente) da build/icon.svg.
// Uso: npm run icon
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const SIZE = 512
const root = path.join(__dirname, '..')
const svg = fs.readFileSync(path.join(root, 'build', 'icon.svg'), 'utf8')
const svgUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false })
  await win.loadURL('data:text/html,<!doctype html><title>icona</title>')
  // Disegna l'SVG su una tela e restituisce il PNG (indipendente dalla scala dello schermo).
  const dataUrl = await win.webContents.executeJavaScript(`
    new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const c = document.createElement('canvas')
        c.width = c.height = ${SIZE}
        c.getContext('2d').drawImage(img, 0, 0, ${SIZE}, ${SIZE})
        resolve(c.toDataURL('image/png'))
      }
      img.onerror = () => reject(new Error('SVG non valido'))
      img.src = ${JSON.stringify(svgUrl)}
    })
  `)
  const out = path.join(root, 'build', 'icon.png')
  fs.writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'))
  console.log(`Icona creata: ${out}`)
  app.quit()
})
