// Ponte sicuro tra le pagine (console, tabellone, scelta schermi) e il
// processo principale. Le pagine non hanno accesso diretto a Node o al disco:
// possono solo usare queste funzioni.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('tabelloneApp', {
  isDesktop: true,
  version: ipcRenderer.sendSync('app:version'),

  // Scelta degli schermi
  listScreens: () => ipcRenderer.invoke('screens:list'),
  identifyScreens: () => ipcRenderer.invoke('screens:identify'),
  startWithScreens: (choice) => ipcRenderer.invoke('screens:start', choice),
  chooseScreens: () => ipcRenderer.invoke('screens:choose'),

  // Finestra del tabellone
  openDisplay: () => ipcRenderer.invoke('display:open'),
  closeDisplay: () => ipcRenderer.invoke('display:close'),

  // Salvataggio della partita su file (oltre che nel browser interno)
  saveGame: (json) => ipcRenderer.send('game:save', json),
  loadGame: () => ipcRenderer.sendSync('game:load'),
})
