<script lang="ts">
  import { onDestroy, untrack } from 'svelte'
  import {
    advance,
    apply,
    createGame,
    deriveView,
    isAllowed,
    type Command,
    type GameState,
    type Rules,
  } from '../engine'
  import { createChannel } from '../shared/channel'
  import { HEARTBEAT_INTERVAL_MS, HEARTBEAT_TIMEOUT_MS } from '../shared/messages'
  import { loadGame, saveGame } from '../shared/persist'
  import { desktop } from '../shared/desktop'
  import { now } from '../shared/time'
  import { keepScreenAwake } from '../shared/wake-lock'
  import ClockEditDialog from './ClockEditDialog.svelte'
  import ClockPanel from './ClockPanel.svelte'
  import BoardPreview from './BoardPreview.svelte'
  import type { ConfirmRequest } from './confirm'
  import EventLog from './EventLog.svelte'
  import HelpOverlay from './HelpOverlay.svelte'
  import HelpTip from './HelpTip.svelte'
  import Modal from './Modal.svelte'
  import QuitDialog from './QuitDialog.svelte'
  import UpdateDialog from './UpdateDialog.svelte'
  import { updates } from './updates.svelte'
  import { fullscreen } from './fullscreen.svelte'
  import NewGameDialog from './NewGameDialog.svelte'
  import { actionForKey, isTypingTarget } from './shortcuts'
  import TeamControls from './TeamControls.svelte'
  import { audio } from './audio.svelte'
  import AudioTab from './AudioTab.svelte'
  import BackupTab from './BackupTab.svelte'
  import { snapshot, soundEvents } from './sound-events'
  import RulesTab from './RulesTab.svelte'
  import StyleTab from './StyleTab.svelte'
  import TeamsTab from './TeamsTab.svelte'
  import StreamingTab from './StreamingTab.svelte'
  import { streaming } from './streaming.svelte'
  import {
    t,
    ui,
    LANGUAGE_NAMES,
    onBoardLanguageRequest,
    takeBoardLanguageRequest,
  } from '../i18n/ui.svelte'
  import { LANGUAGES, type Language } from '../engine'

  // ── Stato ─────────────────────────────────────────────────────────────
  // `$state.raw`: lo stato viene sempre sostituito per intero, mai modificato,
  // così si può salvare e inviare al tabellone tale e quale.
  let game = $state.raw<GameState>(loadGame() ?? createGame())
  let clock = $state(now())
  let lastDisplaySeen = $state(0)

  const view = $derived(deriveView(game, clock))
  const displayConnected = $derived(clock - lastDisplaySeen < HEARTBEAT_TIMEOUT_MS)
  /**
   * Apertura o chiusura del tabellone in corso: la console mostra una rotellina
   * finché non è fatto, così l'operatore sa che il comando è arrivato anche se
   * il maxischermo non lo vede.
   */
  let displayBusy = $state<'opening' | 'closing' | null>(null)
  let busyTimer: ReturnType<typeof setTimeout> | undefined
  function setDisplayBusy(kind: 'opening' | 'closing' | null, maxMs = 0) {
    clearTimeout(busyTimer)
    displayBusy = kind
    // Per sicurezza l'attesa non resta mai per sempre.
    if (kind) busyTimer = setTimeout(() => (displayBusy = null), maxMs)
  }

  type Tab = 'game' | 'teams' | 'style' | 'rules' | 'audio' | 'streaming' | 'backup'
  // Etichette in italiano: tradotte al momento di mostrarle.
  const TABS: { id: Tab; label: string }[] = [
    { id: 'game', label: 'Partita' },
    { id: 'teams', label: 'Squadre' },
    { id: 'style', label: 'Stile' },
    { id: 'rules', label: 'Regolamento' },
    { id: 'audio', label: 'Audio' },
    { id: 'streaming', label: 'Streaming' },
    { id: 'backup', label: 'Backup' },
  ]
  let tab = $state<Tab>('game')
  /** Schede che stanno nel menu Impostazioni invece che nella barra delle schede. */
  const SETTINGS: Tab[] = ['rules', 'audio', 'backup', 'style']
  const MAIN_TABS = TABS.filter((item) => !SETTINGS.includes(item.id))
  const tabItem = (id: Tab) => TABS.find((item) => item.id === id)!
  /** Nel menu: prima le impostazioni della partita, poi (sotto Schermi) lo stile. */
  const SETTINGS_TABS = (['rules', 'audio', 'backup'] as Tab[]).map(tabItem)
  const STYLE_TAB = tabItem('style')
  const SETTINGS_ICONS: Partial<Record<Tab, string>> = { rules: '📋', audio: '🔊', backup: '💾' }
  let settingsOpen = $state(false)
  let settingsMenu = $state<HTMLElement>()
  function openSettingsTab(id: Tab) {
    tab = id
    settingsOpen = false
  }

  /** Il periodo in corso è già iniziato? (le nuove durate varranno dal prossimo) */
  const periodStarted = $derived(
    game.phase === 'final' ||
      game.phase === 'shootout' ||
      game.clock.runningSince !== null ||
      game.clock.baseMs !== game.clock.periodStartMs,
  )
  let helpOpen = $state(false)
  let clockEditOpen = $state(false)
  let newGameOpen = $state(false)
  let confirmRequest = $state<ConfirmRequest | null>(null)
  let toast = $state<string | null>(null)
  let toastTimer: ReturnType<typeof setTimeout> | undefined

  // ── Comunicazione con il tabellone ───────────────────────────────────
  const channel = createChannel()

  function publish() {
    saveGame(game)
    channel.send({ type: 'state', state: game })
    streaming.push()
  }
  // Lo streaming su internet invia la stessa situazione del tabellone.
  streaming.attach(() => game)

  const unsubscribe = channel.subscribe((message) => {
    if (message.type === 'hello') channel.send({ type: 'state', state: game })
    if (message.type === 'hello' || message.type === 'displayHeartbeat') {
      // Segnali rimasti in viaggio da un tabellone che si sta chiudendo.
      if (displayBusy === 'closing') return
      if (displayBusy === 'opening') setDisplayBusy(null)
      // Tabellone appena (ri)collegato: riceve subito la partita.
      if (now() - lastDisplaySeen >= HEARTBEAT_TIMEOUT_MS)
        channel.send({ type: 'state', state: game })
      lastDisplaySeen = now()
    }
  })
  // ── Suoni ─────────────────────────────────────────────────────────────
  // Controllo ogni 100 ms (indipendente dal disegno dello schermo): confronta lo
  // stato con quello precedente e fa partire sirene e segnali al momento giusto.
  let lastSound = untrack(() => snapshot(game, deriveView(game, now())))
  const soundTimer = setInterval(() => {
    const cur = snapshot(game, deriveView(game, now()))
    for (const id of soundEvents(lastSound, cur)) audio.play(id)
    lastSound = cur
  }, 100)

  const heartbeat = setInterval(
    () => channel.send({ type: 'heartbeat', sentAt: now() }),
    HEARTBEAT_INTERVAL_MS,
  )

  let frame = requestAnimationFrame(function tick() {
    clock = now()
    frame = requestAnimationFrame(tick)
  })

  // Versione da browser: niente standby durante la partita (il programma
  // installato lo impedisce già da sé).
  const releaseWakeLock = desktop ? () => {} : keepScreenAwake()

  onDestroy(() => {
    releaseWakeLock()
    cancelAnimationFrame(frame)
    clearInterval(heartbeat)
    clearInterval(soundTimer)
    clearTimeout(toastTimer)
    clearTimeout(busyTimer)
    unsubscribe()
    stopBoardLanguageRequests()
    channel.close()
  })

  // ── Azioni ────────────────────────────────────────────────────────────

  /**
   * Applica un comando. Non c'è "Annulla": ogni azione di gioco ha la sua
   * correzione (±1 sui gol e sui tiri, ↺ sul timeout e sui rigori, ✕ sulle penalità).
   */
  function run(command: Command): boolean {
    const before = game
    if (!isAllowed(advance(before, now()), command.type)) {
      // Es. una scorciatoia (frecce…) premuta prima del via.
      showToast(t('Partita non ancora iniziata: premi ▶ Avvia partita'))
      return false
    }
    const after = apply(before, command, now())
    // Comando senza effetto (es. timeout già usato): niente da registrare.
    if (JSON.stringify(after) === JSON.stringify(advance(before, now()))) return false
    game = after
    publish()
    if (command.type === 'setScore') noteRestoredPenalties(before, after)
    return true
  }

  /**
   * Gol in superiorità tolto con −1: la penalità che aveva chiuso riprende. Un
   * avviso leggero dice all'operatore che è andato tutto a posto.
   */
  function noteRestoredPenalties(before: GameState, after: GameState) {
    const kept = new Set(after.events.map((e) => e.id))
    // La penalità chiusa (o accorciata, per la doppia minore) da un gol tolto adesso.
    const touched = before.events.flatMap((e) =>
      e.type === 'goal' && !kept.has(e.id) && e.penaltyChanges
        ? e.penaltyChanges.filter((c) => c.after.status === 'ended' || c.before.status === 'active')
        : [],
    )
    const beforeById = new Map(before.penalties.map((p) => [p.id, p]))
    const back = after.penalties.find((p) =>
      touched.some((c) => {
        const was = beforeById.get(p.id)
        return c.id === p.id && !!was && (was.status !== p.status || was.endMs !== p.endMs)
      }),
    )
    if (back) {
      showToast(
        t('Gol annullato: la penalità #{player} riprende con il tempo che mancava', {
          player: back.player,
        }),
      )
    }
  }

  /** Lingua del tabellone (pillola accanto all'anteprima). */
  function setBoardLanguage(language: Language) {
    if (run({ type: 'setBoardLanguage', language })) showToast(t('Lingua del tabellone cambiata'))
  }

  /**
   * Lingua scelta nella prima schermata: diventa quella del tabellone e quella
   * iniziale dello streaming. Arriva all'avvio, o mentre la console è aperta se
   * si riapre la scelta degli schermi.
   */
  function applyBoardLanguageRequest() {
    const language = takeBoardLanguageRequest()
    if (!language) return
    run({ type: 'setBoardLanguage', language })
    streaming.setLanguage(language)
  }
  applyBoardLanguageRequest()
  const stopBoardLanguageRequests = onBoardLanguageRequest(applyBoardLanguageRequest)

  function startNewGame(rules: Rules) {
    run({ type: 'newGame', rules })
    tab = 'game'
    showToast(t('Nuova partita pronta'))
  }

  function showToast(text: string) {
    toast = text
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => (toast = null), 2500)
  }

  /** Versione browser: la scheda del tabellone aperta dalla console. */
  let displayWindow: Window | null = null
  const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
  function openDisplay() {
    // Finita quando il tabellone dà il primo segnale.
    setDisplayBusy('opening', 10_000)
    if (desktop) void desktop.openDisplay()
    else displayWindow = window.open('./display.html', 'tabellone-hockey-display')
  }
  async function closeDisplay() {
    setDisplayBusy('closing', 5000)
    if (desktop) {
      // Le finestre del tabellone sono chiuse quando la promessa si risolve.
      // Un attimo minimo di attesa, perché la rotellina si veda.
      await Promise.all([desktop.closeDisplay(), pause(400)])
    } else {
      // Nel browser: chiude la scheda, o la spegne se il browser non la lascia chiudere.
      channel.send({ type: 'closeDisplay' })
      displayWindow?.close()
      displayWindow = null
      await pause(600)
    }
    lastDisplaySeen = 0
    setDisplayBusy(null)
  }

  // Nel programma installato l'audio è permesso subito, senza aspettare un clic.
  if (desktop) audio.unlock()

  // Chiusura del programma: conferma con la finestra della console.
  let quitOpen = $state(false)
  let updateOpen = $state(false)
  desktop?.onCloseRequested(() => (quitOpen = true))
  function answerQuit(confirmed: boolean) {
    quitOpen = false
    desktop?.answerClose(confirmed)
  }

  const anyDialogOpen = $derived(
    helpOpen || clockEditOpen || newGameOpen || !!confirmRequest || quitOpen,
  )

  function onKeydown(e: KeyboardEvent) {
    const action = actionForKey(e)
    if (!action) return
    if (action === 'help') {
      e.preventDefault()
      helpOpen = !helpOpen
      return
    }
    if (action === 'fullscreen') {
      e.preventDefault()
      if (fullscreen.available) fullscreen.toggle()
      return
    }
    if (anyDialogOpen || isTypingTarget(e.target, e.key)) return
    // Lo spazio su un pulsante lo "cliccherebbe": lo usiamo solo per il tempo.
    e.preventDefault()

    const teamName = (id: 'home' | 'away') => game.teams[id].name
    // Le frecce seguono i lati della console: con le squadre invertite, ← è gli ospiti.
    const left = view.sidesSwapped ? 'away' : 'home'
    const right = view.sidesSwapped ? 'home' : 'away'
    switch (action) {
      // La barra spaziatrice fa sempre quello che fa il pulsante grande del tempo.
      case 'toggleClock':
        if (view.phase === 'intermission') run({ type: 'endIntermission' })
        else if (view.phase === 'final') newGameOpen = true
        else run({ type: 'toggleClock' })
        break
      case 'goalLeft':
      case 'goalRight': {
        const team = action === 'goalLeft' ? left : right
        if (view.phase === 'shootout') break
        // Come il pulsante GOL: solo a gioco in corso.
        if (view.phase !== 'play') {
          if (!view.pregame) showToast(t('Gol solo a gioco in corso: per correggere usa +1'))
          break
        }
        if (run({ type: 'goal', team })) showToast(t('Gol {team}', { team: teamName(team) }))
        break
      }
      case 'shotLeft':
      case 'shotRight': {
        const team = action === 'shotLeft' ? left : right
        // Tiri nascosti dal regolamento: la scorciatoia non fa nulla.
        if (!game.rules.showShots) break
        run({ type: 'shot', team, delta: 1 })
        break
      }
      case 'mute':
        audio.toggleMute()
        showToast(audio.settings.muted ? t('Audio disattivato') : t('Audio attivo'))
        break
    }
  }
</script>

<!-- Ogni clic o tasto sblocca l'audio (i browser lo richiedono prima di suonare). -->
<svelte:window
  onkeydown={(e) => {
    audio.unlock()
    if (settingsOpen && e.key === 'Escape') {
      settingsOpen = false
      return
    }
    onKeydown(e)
  }}
  onpointerdown={(e) => {
    audio.unlock()
    // Clic fuori dal menu Impostazioni: si chiude.
    if (settingsOpen && !settingsMenu?.contains(e.target as Node)) settingsOpen = false
  }}
/>

{#snippet appTools()}
  <!-- Audio sì/no, sempre a portata (anche con il tasto M). -->
  <button
    type="button"
    class="btn btn-ghost mute"
    title={`${audio.settings.muted ? t('Audio disattivato') : t('Audio attivo')} (M)`}
    aria-label={audio.settings.muted ? t('Attiva audio') : t('Disattiva audio')}
    onclick={() => audio.toggleMute()}
  >
    {audio.settings.muted ? '🔇' : '🔊'}
  </button>
  <!-- Compatto nella barra ("🌐 IT"); al clic si apre l'elenco con i nomi completi. -->
  <label class="btn btn-ghost lang" title={t('Lingua della console')}>
    <span aria-hidden="true">🌐 {ui.lang.toUpperCase()}</span>
    <select
      aria-label={t('Lingua della console')}
      value={ui.lang}
      onchange={(e) => ui.set(e.currentTarget.value as Language)}
    >
      {#each LANGUAGES as l (l)}
        <option value={l}>{LANGUAGE_NAMES[l]}</option>
      {/each}
    </select>
  </label>
  <!-- Impostazioni: le schede che non servono durante la partita, gli schermi e la guida. -->
  <div class="settings" bind:this={settingsMenu}>
    <button
      type="button"
      class="btn btn-ghost settings-btn"
      class:current={SETTINGS.includes(tab)}
      aria-haspopup="menu"
      aria-expanded={settingsOpen}
      onclick={() => (settingsOpen = !settingsOpen)}
    >
      ⚙ {t('Impostazioni')} <span class="caret" aria-hidden="true">▾</span>
    </button>
    {#if settingsOpen}
      <div class="settings-menu" role="menu">
        {#each SETTINGS_TABS as item (item.id)}
          <button
            type="button"
            role="menuitem"
            class:current={tab === item.id}
            onclick={() => openSettingsTab(item.id)}
          >
            <span class="mi-icon" aria-hidden="true">{SETTINGS_ICONS[item.id]}</span>
            {t(item.label)}
          </button>
        {/each}
        {#if desktop}
          <button
            type="button"
            role="menuitem"
            title={t('Scegli su quale schermo mostrare console e tabellone')}
            onclick={() => {
              settingsOpen = false
              void desktop?.chooseScreens()
            }}
          >
            <span class="mi-icon" aria-hidden="true">🖥</span>
            {t('Schermi…')}
          </button>
        {/if}
        <button
          type="button"
          role="menuitem"
          class:current={tab === STYLE_TAB.id}
          onclick={() => openSettingsTab(STYLE_TAB.id)}
        >
          <span class="mi-icon" aria-hidden="true">🎨</span>
          {t(STYLE_TAB.label)}
        </button>
        <hr />
        <button
          type="button"
          role="menuitem"
          onclick={() => {
            settingsOpen = false
            helpOpen = true
          }}
        >
          <span class="mi-icon" aria-hidden="true">❓</span>
          {t('Guida')}
          <kbd class="mi-key">F1</kbd>
        </button>
      </div>
    {/if}
  </div>
  <!-- Nel browser lo schermo intero sta qui; nel programma installato è nella barra del titolo. -->
  {#if fullscreen.available && !desktop}
    <button
      type="button"
      class="btn btn-ghost fs-btn"
      title="{fullscreen.active ? t('Esci da schermo intero') : t('Schermo intero')} (F11)"
      aria-label={fullscreen.active ? t('Esci da schermo intero') : t('Schermo intero')}
      onclick={() => fullscreen.toggle()}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {#if fullscreen.active}
          <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
        {:else}
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        {/if}
      </svg>
    </button>
  {/if}
{/snippet}

{#snippet versionInfo()}
  {#if updates.supported}
    <!-- Il numero di versione apre la finestra degli aggiornamenti. -->
    <button
      type="button"
      class="version as-link"
      title={t('Aggiornamento del programma')}
      onclick={() => (updateOpen = true)}>v{__APP_VERSION__}</button
    >
  {:else}
    <span class="version">v{__APP_VERSION__}</span>
  {/if}
  {#if updates.pending}
    <button
      type="button"
      class="update-pill"
      class:busy={updates.state.status === 'downloading' || updates.state.status === 'installing'}
      title={t('È disponibile la versione {version}', {
        version: updates.state.version ?? '',
      })}
      onclick={() => (updateOpen = true)}
    >
      {#if updates.state.status === 'downloading'}
        ⬇ {updates.state.percent ?? 0}%
      {:else if updates.state.status === 'installing'}
        {t('Installazione…')}
      {:else}
        ⬆ {t('Aggiorna alla {version}', { version: updates.state.version ?? '' })}
      {/if}
    </button>
  {/if}
{/snippet}

<div class="console">
  {#if desktop}
    <!-- Barra del titolo della finestra, disegnata qui con i suoi pulsanti
         (come quelli di Windows): riduci a icona, schermo intero / finestra
         e chiudi. Schermo intero vuol dire tutto lo schermo, barra Start compresa. -->
    <div class="titlebar">
      <span class="tb-title">Tabellone Hockey {@render versionInfo()}</span>
      <div class="tb-tools">{@render appTools()}</div>
      <div class="tb-buttons">
        <button
          type="button"
          class="tb-btn"
          title={t('Riduci a icona')}
          aria-label={t('Riduci a icona')}
          onclick={() => desktop?.minimizeConsole()}
        >
          <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M0 5.5h10" /></svg>
        </button>
        <button
          type="button"
          class="tb-btn"
          title="{fullscreen.active ? t('Esci da schermo intero') : t('Schermo intero')} (F11)"
          aria-label={fullscreen.active ? t('Esci da schermo intero') : t('Schermo intero')}
          onclick={() => fullscreen.toggle()}
        >
          <svg viewBox="0 0 10 10" aria-hidden="true">
            {#if fullscreen.active}
              <path d="M0.5 2.5h7v7h-7zM2.5 2.5v-2h7v7h-2" />
            {:else}
              <path d="M0.5 0.5h9v9h-9z" />
            {/if}
          </svg>
        </button>
        <button
          type="button"
          class="tb-btn tb-close"
          title={t('Chiudi il programma')}
          aria-label={t('Chiudi il programma')}
          onclick={() => desktop?.requestClose()}
        >
          <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M0 0l10 10M10 0L0 10" /></svg>
        </button>
      </div>
    </div>
  {/if}
  <header class="topbar">
    <!-- In alto a sinistra: Nuova partita (nel browser anche titolo e impostazioni). -->
    <div class="bar-left">
      {#if !desktop}
        <h1>Tabellone Hockey {@render versionInfo()}</h1>
        {@render appTools()}
      {/if}
      <button type="button" class="btn" onclick={() => (newGameOpen = true)}
        >{t('Nuova partita')}</button
      >
      {#if !audio.unlocked && !audio.settings.muted}
        <button type="button" class="btn btn-sm audio-locked" onclick={() => audio.unlock()}>
          🔈 {t('Clicca per attivare l’audio')}
        </button>
      {/if}
    </div>

    <!-- Al centro, appoggiate sul bordo in basso: le schede, subito sopra la console. -->
    <nav class="tabs" aria-label={t('Sezioni')}>
      {#each MAIN_TABS as item (item.id)}
        {#if item.id === 'streaming'}
          <!-- Lo stato dello streaming sta nella sua scheda: grigio se spento, verde se in corso. -->
          <button
            type="button"
            class="stream"
            class:active={tab === item.id}
            class:live={streaming.status === 'live'}
            class:warn={streaming.status === 'error' || streaming.status === 'connecting'}
            title={streaming.status === 'live'
              ? t('Streaming in corso')
              : streaming.active
                ? t('Streaming: collegamento…')
                : t('Streaming disabilitato')}
            onclick={() => (tab = item.id)}
          >
            <span class="dot"></span>
            {streaming.status === 'live' ? t('Streaming in corso') : t(item.label)}
          </button>
        {:else}
          <button type="button" class:active={tab === item.id} onclick={() => (tab = item.id)}>
            {t(item.label)}
          </button>
        {/if}
      {/each}
    </nav>

    <!-- In alto a destra, tutto il tabellone in un'unica pillola: a sinistra il pulsante
         Apri/Chiudi, a destra l'anteprima; lo stato in piccolo sul bordo in basso. -->
    <div
      class="display-control"
      class:ok={displayConnected && !displayBusy}
      class:busy={!!displayBusy}
      class:off={!displayConnected && !displayBusy}
    >
      <span class="status">
        {#if displayBusy}
          <span class="spinner" aria-hidden="true"></span>
          {displayBusy === 'closing' ? t('Chiusura del tabellone…') : t('Apertura del tabellone…')}
        {:else}
          <span class="dot"></span>
          {displayConnected ? t('Tabellone collegato') : t('Tabellone non aperto')}
        {/if}
      </span>
      <div class="dc-board">
        <BoardPreview {game} connected={displayConnected} busy={displayBusy} />
      </div>
      <!-- Lingua del tabellone, in piccolo in fondo alla pillola: al clic l'elenco completo. -->
      <label class="dc-lang" title={t('Lingua del tabellone')}>
        <span aria-hidden="true">{game.boardLanguage.toUpperCase()}</span>
        <select
          aria-label={t('Lingua del tabellone')}
          value={game.boardLanguage}
          onchange={(e) => setBoardLanguage(e.currentTarget.value as Language)}
        >
          {#each LANGUAGES as l (l)}
            <option value={l}>{l.toUpperCase()} · {LANGUAGE_NAMES[l]}</option>
          {/each}
        </select>
      </label>
      {#if displayBusy}
        <button type="button" class="dc-btn" disabled aria-busy="true">
          {displayBusy === 'closing' ? t('Chiudi') : t('Apri')}
        </button>
      {:else if displayConnected}
        <button
          type="button"
          class="dc-btn"
          title={t('Spegne il tabellone sul maxischermo (si riapre con Apri tabellone)')}
          onclick={() => void closeDisplay()}
        >
          {t('Chiudi')}
        </button>
      {:else}
        <!-- Tabellone spento: il pulsante deve saltare all'occhio, è la prima cosa da premere. -->
        <button type="button" class="dc-btn open" onclick={openDisplay}>
          ▶ {t('Apri tabellone')}
        </button>
      {/if}
    </div>
  </header>

  {#if tab === 'game'}
    <!-- Le squadre dal lato in cui le vede l'operatore (Inverti squadre / cambio campo). -->
    <main class="game">
      <!-- Rimontati al cambio lato: un numero di giocatore a metà non passa all'altra squadra. -->
      {#key view.sidesSwapped}
        <TeamControls id={view.sidesSwapped ? 'away' : 'home'} {view} rules={game.rules} {run} />
      {/key}

      <div class="center">
        <ClockPanel
          {view}
          {run}
          confirm={(r) => (confirmRequest = r)}
          onEditClock={() => (clockEditOpen = true)}
          onNewGame={() => (newGameOpen = true)}
        />

        <EventLog {game} />
      </div>

      {#key view.sidesSwapped}
        <TeamControls id={view.sidesSwapped ? 'home' : 'away'} {view} rules={game.rules} {run} />
      {/key}
    </main>
  {:else if tab === 'teams'}
    <main class="page">
      <TeamsTab
        teams={game.teams}
        showLogos={game.showLogos}
        onchange={(team, setup) => run({ type: 'setTeam', team, setup })}
        onShowLogos={(show) => run({ type: 'setShowLogos', show })}
      />
    </main>
  {:else if tab === 'style'}
    <main class="page">
      <StyleTab
        current={game.boardStyle}
        language={game.boardLanguage}
        onchoose={(style) => {
          run({ type: 'setBoardStyle', style })
          showToast(t('Stile del tabellone cambiato'))
        }}
      />
    </main>
  {:else if tab === 'rules'}
    <main class="page">
      <RulesTab
        rules={game.rules}
        gameStarted={periodStarted}
        onapply={(rules) => run({ type: 'setRules', rules })}
      />
    </main>
  {:else if tab === 'audio'}
    <main class="page">
      <AudioTab />
    </main>
  {:else if tab === 'streaming'}
    <main class="page">
      <StreamingTab />
    </main>
  {:else}
    <main class="page">
      <BackupTab />
    </main>
  {/if}
</div>

{#if toast}
  <div class="toast" role="status">{toast}</div>
{/if}

<QuitDialog open={quitOpen} {view} onanswer={answerQuit} />
<UpdateDialog open={updateOpen} {view} onclose={() => (updateOpen = false)} />

<HelpOverlay open={helpOpen} onclose={() => (helpOpen = false)} />

<ClockEditDialog
  open={clockEditOpen}
  currentMs={view.clockMs}
  maxMs={game.clock.periodEndMs - game.clock.periodStartMs}
  onclose={() => (clockEditOpen = false)}
  onsave={(remainingMs) => run({ type: 'setClock', remainingMs })}
/>

<NewGameDialog
  open={newGameOpen}
  currentRules={game.rules}
  onclose={() => (newGameOpen = false)}
  onstart={startNewGame}
/>

<Modal
  open={!!confirmRequest}
  title={confirmRequest?.title ?? ''}
  onclose={() => (confirmRequest = null)}
>
  <p>{confirmRequest?.message}</p>
  {#snippet actions()}
    <button type="button" class="btn" onclick={() => (confirmRequest = null)}>{t('Annulla')}</button
    >
    <button
      type="button"
      class="btn {confirmRequest?.danger ? 'btn-stop' : 'btn-primary'}"
      onclick={() => {
        confirmRequest?.action()
        confirmRequest = null
      }}
    >
      {confirmRequest?.confirmLabel}
    </button>
  {/snippet}
</Modal>

<style>
  .console {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  /* Tre colonne: a sinistra Nuova partita e a destra il tabellone, in alto;
     al centro le schede, appoggiate sul bordo in basso. */
  .topbar {
    position: relative;
    z-index: 2;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: start;
    gap: 0.9rem;
    padding: 0.6rem 1.25rem 0;
    border-bottom: 1px solid var(--ice-800);
    background: var(--ice-900);
  }

  h1 {
    margin: 0 0.5rem 0 0;
    font-size: 1.1rem;
    font-weight: 700;
  }

  .version {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--ice-300);
  }

  .version.as-link {
    padding: 0;
    border: none;
    background: none;
    font-family: inherit;
    cursor: pointer;
  }

  .version.as-link:hover {
    color: var(--ice-50);
    text-decoration: underline;
  }

  /* Compare solo quando c'è una versione nuova. */
  .update-pill {
    margin-left: 0.3rem;
    padding: 0.15rem 0.6rem;
    border: none;
    border-radius: 999px;
    background: #3ccf7a;
    color: #06121f;
    font: inherit;
    font-size: 0.78rem;
    font-weight: 700;
    vertical-align: middle;
    cursor: pointer;
    animation: pill-glow 2.4s ease-in-out infinite;
  }

  .update-pill.busy {
    animation: none;
    background: var(--ice-600);
    color: #fff;
  }

  @keyframes pill-glow {
    50% {
      box-shadow: 0 0 0 4px rgba(60, 207, 122, 0.25);
    }
  }

  /* Come linguette di un raccoglitore, sul bordo della console. */
  .tabs {
    align-self: end;
    justify-self: center;
    display: flex;
    gap: 0.25rem;
    padding: 0.25rem 0.25rem 0;
    border-radius: 10px 10px 0 0;
    background: var(--ice-950);
  }

  .tabs button {
    padding: 0.4rem 0.7rem;
    border: 0;
    border-radius: 8px 8px 0 0;
    background: none;
    color: var(--ice-300);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .tabs button.active {
    background: var(--ice-600);
    color: #fff;
  }

  .audio-locked {
    border-color: var(--warn);
    color: var(--warn);
  }

  .lang {
    position: relative;
    padding: 0.35rem 0.6rem;
  }

  /* Il menu vero è invisibile sopra la scritta: il clic lo apre. */
  .lang select {
    position: absolute;
    inset: 0;
    width: 100%;
    opacity: 0;
    cursor: pointer;
  }

  .mute {
    padding: 0.35rem 0.6rem;
    font-size: 1.15rem;
  }

  .bar-left {
    justify-self: start;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    padding-bottom: 0.6rem;
  }

  /* Tutto quello che riguarda il tabellone in un'unica pillola, a destra:
     a sinistra il pulsante, a destra stato (in piccolo) e anteprima. */
  .display-control {
    position: relative;
    justify-self: end;
    display: flex;
    align-items: stretch;
    /* Spazio per la scritta di stato appoggiata sul bordo in basso. */
    margin-bottom: 0.95rem;
    border: 1px solid color-mix(in srgb, var(--warn) 55%, transparent);
    border-radius: 12px;
    background: color-mix(in srgb, var(--warn) 8%, var(--ice-950));
  }

  .display-control.ok {
    border-color: color-mix(in srgb, var(--ok) 45%, transparent);
    background: color-mix(in srgb, var(--ok) 6%, var(--ice-950));
  }

  .display-control.busy {
    border-color: var(--ice-700, #2a4a6e);
    background: var(--ice-950);
  }

  /* L'anteprima riempie la sua parte della pillola, senza margini. */
  .dc-board {
    display: flex;
    overflow: hidden;
  }

  /* In fondo a destra, stretta: la sigla della lingua del tabellone. */
  .dc-lang {
    position: relative;
    display: flex;
    align-items: center;
    padding: 0 0.45rem;
    border-left: 1px solid var(--ice-800);
    border-radius: 0 11px 11px 0;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--ice-200, #cfe3f7);
    cursor: pointer;
  }

  .dc-lang:hover {
    background: var(--ice-800);
  }

  .dc-lang:focus-within {
    outline: 2px solid var(--ice-400, #5aa0e6);
    outline-offset: -2px;
  }

  /* Il menu vero è invisibile sopra la sigla: il clic lo apre. */
  .dc-lang select {
    position: absolute;
    inset: 0;
    width: 100%;
    opacity: 0;
    cursor: pointer;
  }

  .dc-board :global(.board-preview) {
    border: none;
    border-radius: 0;
  }

  /* Lo stato sta sul bordo in basso, come la legenda di un riquadro: non ruba altezza
     e lascia libera la parte alta dell'anteprima (punteggio e tempo). */
  .display-control .status {
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translate(-50%, 55%);
    z-index: 1;
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    gap: 0.35rem;
    font-size: 0.72rem;
    line-height: 1;
    white-space: nowrap;
    background: var(--ice-900);
  }

  .display-control .status .dot {
    width: 7px;
    height: 7px;
  }

  /* Il pulsante sta sempre a sinistra, l'anteprima a destra. */
  .dc-btn {
    order: -1;
    padding: 0 1rem;
    border: none;
    border-radius: 11px 0 0 11px;
    border-right: 1px solid var(--ice-800);
    background: var(--ice-800);
    color: var(--ice-50);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .dc-btn:hover:not(:disabled) {
    background: var(--ice-700, #2a4a6e);
  }

  .dc-btn.open {
    background: var(--warn);
    color: #1a1000;
    font-weight: 700;
    animation: open-pulse 1.6s ease-in-out infinite;
  }

  .dc-btn.open:hover {
    background: color-mix(in srgb, var(--warn) 80%, #fff);
    animation: none;
  }

  .display-control.off {
    border-color: var(--warn);
    box-shadow: 0 0 14px color-mix(in srgb, var(--warn) 45%, transparent);
  }

  @keyframes open-pulse {
    50% {
      background: color-mix(in srgb, var(--warn) 70%, #fff);
    }
  }

  .dc-btn:disabled {
    opacity: 0.5;
    cursor: progress;
  }

  .status {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.9rem;
    color: var(--warn);
  }

  .display-control.ok .status {
    color: var(--ok);
  }

  .fs-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.35rem 0.6rem;
  }

  .fs-btn svg {
    width: 20px;
    height: 20px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* Barra del titolo (solo nel programma installato). È alta come i pulsanti
     di Windows (vedi titleBarOverlay in electron/main.cjs) e si trascina per
     spostare la finestra. */
  .titlebar {
    position: relative;
    z-index: 5;
    flex: none;
    display: flex;
    align-items: center;
    height: 32px;
    padding-left: 0.9rem;
    background: var(--ice-950);
    color: var(--ice-300);
    font-size: 0.8rem;
    user-select: none;
    -webkit-app-region: drag;
  }

  .tb-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tb-title :global(button) {
    -webkit-app-region: no-drag;
  }

  .tb-title .version,
  .tb-title :global(.version) {
    font-size: 0.75rem;
  }

  .settings {
    position: relative;
  }

  .settings-btn.current {
    color: #fff;
    background: var(--ice-600);
  }

  .caret {
    font-size: 0.7em;
    opacity: 0.7;
  }

  .settings-menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    z-index: 30;
    display: flex;
    flex-direction: column;
    min-width: 190px;
    padding: 0.35rem;
    border: 1px solid var(--ice-800);
    border-radius: 10px;
    background: var(--ice-900);
    box-shadow: 0 14px 40px rgba(0, 0, 0, 0.55);
  }

  .settings-menu button {
    padding: 0.5rem 0.75rem;
    border: none;
    border-radius: 7px;
    background: none;
    color: var(--ice-50);
    font: inherit;
    font-size: 0.9rem;
    text-align: left;
    cursor: pointer;
  }

  .settings-menu button:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .settings-menu button.current {
    background: var(--ice-600);
    color: #fff;
  }

  .settings-menu button {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .mi-icon {
    width: 1.3em;
    text-align: center;
  }

  .mi-key {
    margin-left: auto;
    font-size: 0.7rem;
  }

  .settings-menu hr {
    width: 100%;
    margin: 0.3rem 0;
    border: none;
    border-top: 1px solid var(--ice-800);
  }

  /* Lingua e guida nella barra del titolo: piccoli, come una barra dei menu. */
  .tb-tools {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    height: 100%;
    margin-right: 0.4rem;
    -webkit-app-region: no-drag;
  }

  .tb-tools :global(.btn) {
    height: 26px;
    padding: 0 0.6rem;
    border: none;
    background: transparent;
    font-size: 0.8rem;
  }

  .tb-tools :global(.btn:hover) {
    background: rgba(255, 255, 255, 0.1);
  }

  .tb-tools :global(kbd) {
    font-size: 0.65rem;
  }

  .tb-buttons {
    display: flex;
    height: 100%;
    -webkit-app-region: no-drag;
  }

  /* Come i pulsanti di Windows: larghi 46 px, senza bordo, icone sottili. */
  .tb-btn {
    display: grid;
    place-items: center;
    width: 46px;
    height: 100%;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--ice-200, #c9dcf0);
    cursor: default;
  }

  .tb-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .tb-btn svg {
    width: 10px;
    height: 10px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1;
    overflow: visible;
  }

  .tb-close:hover {
    background: #c42b1c;
    color: #fff;
  }

  .display-control.busy .status {
    color: var(--ice-200, #c9dcf0);
  }

  .spinner {
    flex: none;
    width: 14px;
    height: 14px;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Streaming: spento con un pallino grigio, discreto; in corso tutto verde, ben visibile. */
  .tabs button.stream {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }

  .tabs button.stream .dot {
    width: 8px;
    height: 8px;
    opacity: 0.5;
  }

  .tabs button.stream.live {
    color: #062b16;
    background: var(--ok);
  }

  .tabs button.stream.live .dot {
    opacity: 1;
    animation: pulse 1.6s ease-in-out infinite;
  }

  .tabs button.stream.warn {
    color: var(--warn);
  }

  .tabs button.stream.warn .dot {
    opacity: 1;
  }

  @keyframes pulse {
    50% {
      opacity: 0.3;
    }
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: currentColor;
  }

  .game {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(300px, 1fr) minmax(420px, 1.35fr) minmax(300px, 1fr);
    gap: 1rem;
    padding: 1rem;
    overflow: auto;
  }

  .center {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-width: 0;
  }

  .page {
    flex: 1;
    overflow: auto;
    padding: 1rem 1.5rem;
  }

  .toast {
    position: fixed;
    left: 50%;
    bottom: 1.5rem;
    transform: translateX(-50%);
    padding: 0.7rem 1.2rem;
    border-radius: 12px;
    background: #0e2440;
    border: 1px solid var(--ice-600);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
    font-weight: 600;
    animation: toast-in 180ms ease-out;
  }

  @keyframes toast-in {
    from {
      transform: translate(-50%, 10px);
      opacity: 0;
    }
  }

  /* Monitor piccoli: le squadre affiancate sopra, il centro sotto. */
  @media (max-width: 1100px) {
    .game {
      grid-template-columns: 1fr 1fr;
    }

    .center {
      grid-column: 1 / -1;
      grid-row: 1;
    }
  }

  @media (max-width: 700px) {
    .game {
      grid-template-columns: 1fr;
    }
  }
</style>
