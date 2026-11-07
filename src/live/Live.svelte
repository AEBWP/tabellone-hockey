<script lang="ts">
  import { onDestroy } from 'svelte'
  import { deriveView, LANGUAGES, type GameState, type Language } from '../engine'
  import Scoreboard from '../scoreboard/Scoreboard.svelte'
  import Stage from '../display/Stage.svelte'
  import { preloadImages } from '../shared/preload-images'
  import { keepScreenAwake } from '../shared/wake-lock'
  import { now } from '../shared/time'
  import { isValidLiveName, LIVE_STALE_MS, type LiveMessage } from '../shared/live'
  import { LANGUAGE_NAMES, t, ui } from '../i18n/ui.svelte'
  import { browserLanguage, nameFromPath, sanitizeState } from './sanitize'

  /**
   * Pagina per gli spettatori: ridisegna il tabellone con i dati che la
   * console del palaghiaccio invia al servizio online. Chi guarda può solo
   * scegliere la lingua.
   */

  const LANGUAGE_KEY = 'tabellone-hockey:lingua-spettatori'
  const name = nameFromPath(location.pathname)
  const validName = isValidLiveName(name)
  // Anteprima nella console (?embed): niente pulsanti, lingua decisa da chi la incorpora (?lang=).
  const params = new URLSearchParams(location.search)
  const embed = params.has('embed')
  const forcedLanguage = LANGUAGES.find((l) => l === params.get('lang')) ?? null

  // ── Lingua ──────────────────────────────────────────────────────────────
  function savedLanguage(): Language | null {
    try {
      const v = localStorage.getItem(LANGUAGE_KEY) as Language | null
      return v && LANGUAGES.includes(v) ? v : null
    } catch {
      return null
    }
  }
  let chosen = $state<Language | null>(savedLanguage())
  const automatic = browserLanguage(navigator.languages ?? [navigator.language])
  let raw = $state.raw<unknown>(null)
  const consoleLanguage = $derived(
    (raw as { boardLanguage?: Language } | null)?.boardLanguage ?? null,
  )
  const language = $derived<Language>(
    forcedLanguage ??
      chosen ??
      automatic ??
      (consoleLanguage && LANGUAGES.includes(consoleLanguage) ? consoleLanguage : 'it'),
  )
  $effect(() => {
    ui.lang = language
    document.documentElement.lang = language
  })
  function choose(l: Language) {
    chosen = l
    try {
      localStorage.setItem(LANGUAGE_KEY, l)
    } catch {
      // Vale fino alla chiusura della pagina.
    }
  }

  // ── Collegamento ────────────────────────────────────────────────────────
  type Phase = 'connecting' | 'unknown' | 'paused' | 'live'
  let phase = $state<Phase>(validName ? 'connecting' : 'unknown')
  let online = $state(false)
  let logos = $state.raw(new Map<string, string>())
  /** Orologio del servizio meno orologio di questa pagina. */
  let serverSkew = 0
  /** Orologio della console meno orologio del servizio. */
  let clockOffset = $state(0)
  let lastSeen = $state(0)
  let clock = $state(now())

  const game = $derived<GameState | null>(raw ? sanitizeState(raw, logos, language) : null)
  // Il tempo della partita si calcola con l'orologio della console.
  const view = $derived.by(() => {
    if (!game) return null
    try {
      return deriveView(game, clock + serverSkew + clockOffset)
    } catch {
      return null
    }
  })
  const stale = $derived(
    phase === 'live' && lastSeen > 0 && clock + serverSkew - lastSeen > LIVE_STALE_MS,
  )

  const logoList = $derived([game?.teams.home.logo, game?.teams.away.logo])
  $effect(() => preloadImages(logoList))

  let frame = requestAnimationFrame(function tick() {
    clock = now()
    frame = requestAnimationFrame(tick)
  })

  let socket: WebSocket | null = null
  let retry = 0
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let pingTimer: ReturnType<typeof setInterval> | undefined
  let closed = false

  function handle(message: LiveMessage) {
    if ('serverNow' in message && typeof message.serverNow === 'number') {
      serverSkew = message.serverNow - now()
    }
    if (message.type === 'status') {
      lastSeen = message.lastSeen ?? 0
      phase = !message.claimed ? 'unknown' : message.live ? 'live' : 'paused'
      if (!message.live) raw = null
      if (!message.claimed) logos = new Map()
    } else if (message.type === 'state') {
      phase = 'live'
      lastSeen = message.lastSeen ?? 0
      clockOffset = message.clockOffset ?? 0
      raw = message.update?.state ?? null
    } else if (message.type === 'logo' && message.hash && message.data) {
      logos = new Map(logos).set(message.hash, message.data)
    }
  }

  function connect() {
    if (!validName || closed) return
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(
      `${protocol}//${location.host}/api/channels/${encodeURIComponent(name)}/watch`,
    )
    socket = ws
    ws.onopen = () => {
      online = true
      retry = 0
    }
    ws.onmessage = (e) => {
      try {
        handle(JSON.parse(e.data))
      } catch {
        // Messaggio che questa pagina non conosce: si ignora.
      }
    }
    ws.onclose = () => {
      if (socket !== ws) return
      online = false
      socket = null
      if (closed) return
      // Nuovo tentativo, sempre più distanziato (massimo 30 s).
      const delay = Math.min(30_000, 1_000 * 2 ** retry++)
      retryTimer = setTimeout(connect, delay)
    }
  }
  connect()
  // Tiene vivo il collegamento attraverso reti e proxy.
  pingTimer = setInterval(() => {
    if (socket?.readyState === WebSocket.OPEN) socket.send('ping')
  }, 30_000)
  // Tornando sulla pagina (telefono in tasca) si ricollega subito.
  const onVisible = () => {
    if (document.visibilityState === 'visible' && !socket && validName) {
      clearTimeout(retryTimer)
      retry = 0
      connect()
    }
  }
  document.addEventListener('visibilitychange', onVisible)

  // Mentre si guarda la partita il telefono o il PC non vanno in standby
  // (non nell'anteprima della console, che ha già la sua finestra accesa).
  $effect(() => {
    if (phase !== 'live' || embed) return
    return keepScreenAwake()
  })

  onDestroy(() => {
    closed = true
    cancelAnimationFrame(frame)
    clearTimeout(retryTimer)
    clearInterval(pingTimer)
    document.removeEventListener('visibilitychange', onVisible)
    socket?.close()
  })

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen?.().catch(() => {})
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="root" ondblclick={toggleFullscreen}>
  <Stage>
    {#if phase === 'live' && view}
      <Scoreboard {view} style={game?.boardStyle} />
    {:else}
      <div class="message">
        <h1>TABELLONE HOCKEY</h1>
        {#if !name}
          <p>{t('Apri il link ricevuto dal palaghiaccio per seguire la partita.')}</p>
        {:else if phase === 'unknown'}
          <p class="title">{t('Streaming non trovato')}</p>
          <p>
            {t('Nessun palaghiaccio usa questo indirizzo. Controlla il link o chiedine uno nuovo.')}
          </p>
        {:else if phase === 'paused'}
          <p class="title">{t('Al momento non c’è nessuna partita in corso')}</p>
          <p>{t('Quando comincerà, questa pagina verrà aggiornata automaticamente.')}</p>
        {:else}
          <p class="title">{t('Collegamento in corso…')}</p>
        {/if}
      </div>
    {/if}
  </Stage>

  {#if stale || (phase === 'live' && view && !online)}
    <div class="banner" class:embed role="status">
      {online
        ? t('Collegamento con il palaghiaccio interrotto: i dati potrebbero non essere aggiornati.')
        : t('Connessione persa, nuovo tentativo in corso…')}
    </div>
  {/if}

  {#if !embed}
    <div class="tools">
      <label class="lang" title={t('Lingua')}>
        <span aria-hidden="true">🌐 {language.toUpperCase()}</span>
        <select
          aria-label={t('Lingua')}
          value={language}
          onchange={(e) => choose(e.currentTarget.value as Language)}
        >
          {#each LANGUAGES as l (l)}<option value={l}>{LANGUAGE_NAMES[l]}</option>{/each}
        </select>
      </label>
      {#if document.fullscreenEnabled}
        <button type="button" onclick={toggleFullscreen} title={t('Schermo intero')}>⛶</button>
      {/if}
    </div>
  {/if}
</div>

<style>
  :global(html),
  :global(body),
  :global(#app) {
    height: 100%;
    margin: 0;
    background: #000;
  }

  .root {
    position: relative;
    height: 100%;
  }

  .message {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 28px;
    height: 100%;
    padding: 0 160px;
    text-align: center;
    font-family: 'Barlow Condensed', var(--font-ui);
    background: radial-gradient(ellipse at center, var(--ice-800), var(--ice-950) 70%);
  }

  h1 {
    margin: 0 0 24px;
    font-size: 140px;
    font-weight: 800;
    letter-spacing: 0.06em;
  }

  p {
    margin: 0;
    font-size: 44px;
    line-height: 1.25;
    color: var(--ice-300);
  }

  .title {
    font-size: 72px;
    font-weight: 700;
    color: #fff;
  }

  .banner {
    position: absolute;
    left: 50%;
    bottom: 12px;
    transform: translateX(-50%);
    max-width: calc(100% - 24px);
    padding: 8px 14px;
    border-radius: 8px;
    font: 600 14px/1.3 var(--font-ui);
    text-align: center;
    color: #1a1200;
    background: var(--warn, #f5b800);
  }

  .banner.embed {
    bottom: 4px;
    padding: 3px 6px;
    font-size: 10px;
  }

  .tools {
    position: absolute;
    top: 10px;
    right: 10px;
    display: flex;
    gap: 6px;
    opacity: 0.55;
    transition: opacity 0.2s;
  }

  .tools:hover,
  .tools:focus-within {
    opacity: 1;
  }

  .lang,
  button {
    position: relative;
    display: inline-flex;
    align-items: center;
    padding: 6px 10px;
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 8px;
    font: 600 14px/1 var(--font-ui);
    color: #fff;
    background: rgba(0, 0, 0, 0.6);
    cursor: pointer;
  }

  .lang select {
    position: absolute;
    inset: 0;
    width: 100%;
    opacity: 0;
    cursor: pointer;
  }
</style>
