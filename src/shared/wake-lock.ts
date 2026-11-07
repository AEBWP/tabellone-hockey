/**
 * Tiene acceso lo schermo (niente standby né salvaschermo) finché la pagina è
 * aperta, con il "wake lock" del browser. Serve nella versione da browser e
 * nella pagina dello streaming; il programma installato lo fa già da sé.
 *
 * Il browser toglie il blocco quando la scheda non è visibile (altra scheda,
 * finestra ridotta a icona): lo si richiede di nuovo appena torna visibile.
 * Dove il browser non lo supporta, semplicemente non fa nulla.
 *
 * Restituisce la funzione per togliere il blocco.
 */
export function keepScreenAwake(): () => void {
  const wakeLock = (navigator as Navigator & { wakeLock?: WakeLock }).wakeLock
  if (!wakeLock || typeof document === 'undefined') return () => {}

  let sentinel: WakeLockSentinel | null = null
  let active = true

  async function request() {
    if (!active || document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) {
      return
    }
    try {
      sentinel = await wakeLock!.request('screen')
      // Tolto nel frattempo (es. pagina chiusa mentre si aspettava la risposta).
      if (!active) void sentinel.release()
    } catch {
      // Rifiutato (batteria scarica, impostazioni del browser…): si riprova al
      // prossimo ritorno sulla pagina.
      sentinel = null
    }
  }

  const onVisible = () => void request()
  document.addEventListener('visibilitychange', onVisible)
  void request()

  return () => {
    active = false
    document.removeEventListener('visibilitychange', onVisible)
    void sentinel?.release().catch(() => {})
    sentinel = null
  }
}
