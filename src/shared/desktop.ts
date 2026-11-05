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
  bounds: { x: number; y: number; width: number; height: number }
}

export interface ScreenChoice {
  consoleId: number
  displayId: number
}

export interface DesktopApi {
  isDesktop: true
  version: string
  listScreens(): Promise<{ screens: ScreenItem[]; choice: ScreenChoice | null; remember: boolean }>
  identifyScreens(): Promise<void>
  startWithScreens(choice: ScreenChoice & { remember: boolean }): Promise<boolean>
  chooseScreens(): Promise<void>
  openDisplay(): Promise<void>
  /** Chiude il tabellone (sul maxischermo si può chiudere solo da qui). */
  closeDisplay(): Promise<void>
  /** Chiamata quando l'operatore prova a chiudere il programma. */
  onCloseRequested(callback: () => void): void
  /** Risposta alla richiesta di chiusura: true = chiudi. */
  answerClose(confirmed: boolean): void
  saveGame(json: string): void
  loadGame(): string | null
}

export const desktop: DesktopApi | undefined = (
  globalThis as unknown as { tabelloneApp?: DesktopApi }
).tabelloneApp
