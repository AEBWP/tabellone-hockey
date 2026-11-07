import { desktop } from '../shared/desktop'

/**
 * Schermo intero della console. Nel programma installato lo gestisce la
 * finestra (Electron); nel browser si usa lo schermo intero del browser.
 */
class ConsoleFullScreen {
  active = $state(false)

  constructor() {
    if (desktop) {
      desktop.onConsoleFullScreen((on) => (this.active = on))
      void desktop.isConsoleFullScreen().then((on) => (this.active = on))
    } else if (typeof document !== 'undefined') {
      document.addEventListener('fullscreenchange', () => {
        this.active = !!document.fullscreenElement
      })
    }
  }

  get available() {
    return !!desktop || (typeof document !== 'undefined' && document.fullscreenEnabled)
  }

  set(on: boolean) {
    if (desktop) return void desktop.setConsoleFullScreen(on)
    if (on) void document.documentElement.requestFullscreen().catch(() => {})
    else if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
  }

  toggle() {
    this.set(!this.active)
  }
}

export const fullscreen = new ConsoleFullScreen()
