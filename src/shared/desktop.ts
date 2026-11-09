/**
 * Funzioni disponibili solo nella versione installabile (Electron), esposte
 * da `electron/preload.cjs`. Nel browser `desktop` è undefined e la console
 * usa le alternative (finestre del browser, solo salvataggio interno).
 */

export interface ScreenItem {
  id: number
  number: number
  title: string
  resolution: string
  primary: boolean
  /** Nome dello schermo dato da Windows (può mancare). */
  label?: string
  bounds: { x: number; y: number; width: number; height: number }
}

export interface ScreenChoice {
  consoleId: number
  /** Uno o più schermi: il tabellone è uguale su tutti. */
  displayIds: number[]
  /**
   * Schermi del tabellone girati verso la console (es. sopra l'operatore, verso
   * il pubblico di fronte): lì destra e sinistra sono rovesciate.
   */
  mirrorIds: number[]
}

export type UpdateStatus =
  | 'unsupported'
  | 'idle'
  | 'checking'
  | 'none'
  | 'available'
  | 'downloading'
  | 'installing'
  | 'error'

/** Stato dell'aggiornamento del programma (vedi electron/updater.cjs). */
export interface UpdateState {
  status: UpdateStatus
  /** Versione installata. */
  current: string
  /** Versione nuova trovata. */
  version?: string
  /** Avanzamento dello scaricamento, da 0 a 100. */
  percent?: number
  transferred?: number
  total?: number
  error?: 'offline' | 'check' | 'download' | 'install'
  /** Messaggio tecnico dell'errore. */
  detail?: string
  checkedAt?: number
}

export interface DesktopApi {
  isDesktop: true
  version: string
  listScreens(): Promise<{ screens: ScreenItem[]; choice: ScreenChoice | null; remember: boolean }>
  identifyScreens(): Promise<void>
  startWithScreens(choice: ScreenChoice & { remember: boolean }): Promise<boolean>
  chooseScreens(): Promise<void>
  /** Nessuno degli schermi scelti per il tabellone è collegato. */
  isScreenMissing(): Promise<boolean>
  onScreenMissing(callback: (missing: boolean) => void): void
  openDisplay(): Promise<void>
  /** Chiude il tabellone (sul maxischermo si può chiudere solo da qui). */
  closeDisplay(): Promise<void>
  /** Console a schermo intero (sì/no). */
  setConsoleFullScreen(on: boolean): Promise<void>
  isConsoleFullScreen(): Promise<boolean>
  onConsoleFullScreen(callback: (on: boolean) => void): void
  /** Come la X della finestra: la console chiede conferma prima di chiudere. */
  requestClose(): void
  /** Riduce la console a icona sulla barra delle applicazioni. */
  minimizeConsole(): void
  /** Chiamata quando l'operatore prova a chiudere il programma. */
  onCloseRequested(callback: () => void): void
  /** Risposta alla richiesta di chiusura: true = chiudi. */
  answerClose(confirmed: boolean): void
  saveGame(json: string): void
  loadGame(): string | null
  /** Percorso sul disco di un file scelto o trascinato ('' se non ne ha uno). */
  filePath(file: File): string
  /** Per ogni percorso, se il file si può leggere in questo momento. */
  checkFiles(paths: string[]): Promise<boolean[]>
  getUpdateState(): Promise<UpdateState>
  checkForUpdate(): Promise<UpdateState>
  /** Scarica la versione nuova, chiude il programma, la installa e lo riapre. */
  installUpdate(): Promise<UpdateState>
  onUpdateState(callback: (state: UpdateState) => void): void
  /** Lingua della console: la usano le finestre del programma (chiusura, avvio). */
  setLanguage?(language: string): void
}

export const desktop: DesktopApi | undefined = (
  globalThis as unknown as { tabelloneApp?: DesktopApi }
).tabelloneApp
