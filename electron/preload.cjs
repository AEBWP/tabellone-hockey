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

  // Chiusura del programma: la console mostra la sua finestra di conferma
  onCloseRequested: (callback) => {
    ipcRenderer.on('app:close-requested', () => {
      ipcRenderer.send('app:close-ack')
      callback()
    })
  },
  answerClose: (confirmed) => ipcRenderer.send('app:close-answer', !!confirmed),

  // Salvataggio della partita su file (oltre che nel browser interno)
  saveGame: (json) => ipcRenderer.send('game:save', json),
  loadGame: () => ipcRenderer.sendSync('game:load'),

  // Aggiornamento del programma dalle release su GitHub
  getUpdateState: () => ipcRenderer.invoke('update:state'),
  checkForUpdate: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateState: (callback) => {
    ipcRenderer.on('update:state', (_event, state) => callback(state))
  },

  // Lingua della console, per le finestre del programma (chiusura, avvio)
  setLanguage: (language) => ipcRenderer.send('app:language', String(language)),
})
