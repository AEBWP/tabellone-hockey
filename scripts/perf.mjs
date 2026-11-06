// Misura la fluidità del tabellone: per ogni stile fa partire le animazioni
// (gol, inizio partita, ultimo minuto) e conta i fotogrammi lenti.
// Usa la versione compilata (dist/), come il programma installato.
//
// Uso: npm run perf            (risultati in tabella; PERF_OUT=file.json li salva)
//      npm run perf -- --json  (risultati in JSON, per confronti)
import { app, BrowserWindow } from 'electron'
import { preview } from 'vite'
import fs from 'node:fs'
import path from 'node:path'

const root = path.join(import.meta.dirname, '..')
const asJson = process.argv.includes('--json')
const ALL_STYLES = ['arena', 'broadcast', 'ghiaccio', 'retro', 'classico']
// STYLES=arena,retro misura solo alcuni stili.
const STYLES = process.env.STYLES ? process.env.STYLES.split(',') : ALL_STYLES
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Come il maxischermo tipico: 1920×1080 a scala 1, senza limiti di fotogrammi in background.
app.commandLine.appendSwitch('force-device-scale-factor', '1')
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
// PERF_FLAGS=disable-gpu,altro: opzioni di Chromium da provare.
for (const flag of (process.env.PERF_FLAGS ?? '').split(',').filter(Boolean))
  app.commandLine.appendSwitch(flag)

/** Raccoglie gli intervalli tra fotogrammi per `ms` millisecondi (nel browser). */
const MEASURE = (ms) => `new Promise((resolve) => {
  const gaps = []
  const longFrames = []
  let obs
  try {
    obs = new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        longFrames.push({
          ms: Math.round(e.duration),
          script: Math.round(e.scripts.reduce((a, x) => a + x.duration, 0)),
          styleLayout: Math.round(e.renderStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0),
          render: Math.round(e.renderStart ? e.startTime + e.duration - e.renderStart : 0),
        })
    })
    obs.observe({ type: 'long-animation-frame', buffered: false })
  } catch {}
  let last = performance.now()
  const start = last
  requestAnimationFrame(function tick(t) {
    gaps.push(t - last)
    last = t
    if (t - start < ${ms}) requestAnimationFrame(tick)
    else {
      obs?.disconnect()
      resolve({ gaps: gaps.slice(1), longFrames })
    }
  })
})`

function summarize(name, { gaps, longFrames }) {
  const sorted = [...gaps].sort((a, b) => a - b)
  const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length
  return {
    name,
    fps: Math.round(1000 / avg),
    p95: +pct(95).toFixed(1),
    max: +sorted.at(-1).toFixed(1),
    // A 60 Hz un fotogramma dura 16,7 ms: oltre 25 ms almeno un fotogramma è saltato.
    lenti: gaps.filter((g) => g > 25).length,
    longFrames: longFrames.length,
    // PERF_DETAIL=1: i fotogrammi più lunghi, divisi tra script e disegno.
    ...(process.env.PERF_DETAIL && {
      peggiori: longFrames.sort((a, b) => b.ms - a.ms).slice(0, 2),
    }),
  }
}

app.whenReady().then(async () => {
  const server = await preview({ root, logLevel: 'error', preview: { port: 5198 } })
  const base = 'http://localhost:5198'

  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    useContentSize: true,
    x: 0,
    y: 0,
    show: true,
    webPreferences: { backgroundThrottling: false },
  })
  const js = (code) => win.webContents.executeJavaScript(code)
  const key = (k) =>
    js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)} }))`)

  const results = []
  for (const style of STYLES) {
    await win.loadURL(`${base}/display.html?demo`)
    await js('document.fonts.ready.then(() => true)')
    // Come nell'uso vero: si aspetta la prova generale delle animazioni (Warmup.svelte).
    await js(`new Promise((resolve) => {
      const t = setInterval(() => {
        if (document.documentElement.dataset.warmup === 'done') resolve(clearInterval(t) ?? true)
      }, 200)
    })`)
    await sleep(800)
    for (let s = 0; s < ALL_STYLES.indexOf(style); s++) await key('s')
    // PERF_CSS: CSS in più per provare (es. disattivare un'animazione).
    if (process.env.PERF_CSS) await win.webContents.insertCSS(process.env.PERF_CSS)

    // Inizio partita: dalla presentazione al tabellone
    await key('0')
    await sleep(1500)
    const startP = js(MEASURE(1600))
    await key('p')
    results.push(summarize(`${style} · inizio partita`, await startP))

    // Gol (il primo: nessuna risorsa ancora "calda")
    await key('1')
    await sleep(1200)
    const goal1 = js(MEASURE(2500))
    await key('g')
    results.push(summarize(`${style} · gol (primo)`, await goal1))
    await sleep(5000)

    // Secondo gol, dell'altra squadra
    const goal2 = js(MEASURE(2500))
    await key('h')
    results.push(summarize(`${style} · gol (secondo)`, await goal2))
    await sleep(5000)

    // Ultimo minuto: decimi di secondo a ogni fotogramma
    await key('3')
    await sleep(800)
    results.push(summarize(`${style} · ultimo minuto`, await js(MEASURE(2000))))
  }

  if (asJson) console.log(JSON.stringify(results))
  else console.table(results)
  if (process.env.PERF_OUT) fs.writeFileSync(process.env.PERF_OUT, JSON.stringify(results, null, 2))
  server.httpServer.closeAllConnections?.()
  server.httpServer.close()
  app.exit(0)
})
