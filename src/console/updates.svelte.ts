import { desktop, type UpdateState } from '../shared/desktop'

/**
 * Aggiornamento del programma installato: lo stato arriva dal processo
 * principale (electron/updater.cjs). Nel browser non c'è niente da aggiornare.
 */
class Updates {
  state = $state<UpdateState>({
    status: 'unsupported',
    current: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '',
  })

  constructor() {
    if (!desktop?.onUpdateState) return
    desktop.onUpdateState((s) => (this.state = s))
    void desktop.getUpdateState().then((s) => (this.state = s))
  }

  get supported() {
    return this.state.status !== 'unsupported'
  }

  /** C'è una versione nuova da proporre (o se ne sta già occupando). */
  get pending() {
    const s = this.state.status
    return (
      s === 'available' ||
      s === 'downloading' ||
      s === 'installing' ||
      (s === 'error' && !!this.state.version)
    )
  }

  async check() {
    if (desktop) this.state = await desktop.checkForUpdate()
  }

  async install() {
    if (desktop) this.state = await desktop.installUpdate()
  }
}

export const updates = new Updates()
