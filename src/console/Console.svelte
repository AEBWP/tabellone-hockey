<script lang="ts">
  import { onDestroy, untrack } from 'svelte'
  import {
    advance,
    apply,
    canUndo,
    createGame,
    deriveView,
    isAllowed,
    pushHistory,
    undo,
    type Command,
    type GameState,
    type HistoryEntry,
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
  import { t, ui, LANGUAGE_NAMES } from '../i18n/ui.svelte'
  import { LANGUAGES, type Language } from '../engine'

  // ── Stato ─────────────────────────────────────────────────────────────
  // `$state.raw`: lo stato viene sempre sostituito per intero, mai modificato,
  // così si può salvare e inviare al tabellone tale e quale.
  let game = $state.raw<GameState>(loadGame() ?? createGame())
  let history = $state.raw<HistoryEntry[]>([])
  let clock = $state(now())
  let lastDisplaySeen = $state(0)

  const view = $derived(deriveView(game, clock))
  const displayConnected = $derived(clock - lastDisplaySeen < HEARTBEAT_TIMEOUT_MS)
  const undoLabel = $derived(
    canUndo(history, advance(game, clock)) ? (history.at(-1)?.label ?? null) : null,
  )

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
    unsubscribe()
    channel.close()
  })

  // ── Azioni ────────────────────────────────────────────────────────────

  /**
   * Applica un comando. Se ha un'etichetta è un'azione di gioco annullabile
   * (gol, penalità, tiri…); i comandi del cronometro non lo sono.
   */
  function run(command: Command, label?: string): boolean {
    const before = game
    if (!isAllowed(advance(before, now()), command.type)) {
      // Es. una scorciatoia (C, O…) premuta prima del via.
      showToast(t('Partita non ancora iniziata: premi ▶ Avvia partita'))
      return false
    }
    const after = apply(before, command, now())
    // Comando senza effetto (es. timeout già usato): niente da registrare.
    if (JSON.stringify(after) === JSON.stringify(advance(before, now()))) return false
    game = after
    if (label) history = pushHistory(history, label, before)
    publish()
    return true
  }

  function doUndo() {
    const result = undo(history, advance(game, now()))
    if (!result) return
    game = result.state
    history = result.history
    publish()
    showToast(t('Annullato: {label}', { label: result.label }))
  }

  function startNewGame(rules: Rules) {
    run({ type: 'newGame', rules })
    history = []
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
  function openDisplay() {
    if (desktop) void desktop.openDisplay()
    else displayWindow = window.open('./display.html', 'tabellone-hockey-display')
  }
  function closeDisplay() {
    if (desktop) return void desktop.closeDisplay()
    // Nel browser: chiude la scheda, o la spegne se il browser non la lascia chiudere.
    channel.send({ type: 'closeDisplay' })
    displayWindow?.close()
    displayWindow = null
    lastDisplaySeen = 0
  }

  // Nel programma installato l'audio è permesso subito, senza aspettare un clic.
  if (desktop) audio.unlock()

  // Chiusura del programma: conferma con la finestra della console.
  let quitOpen = $state(false)
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
    if (anyDialogOpen || isTypingTarget(e.target)) return
    // Lo spazio su un pulsante lo "cliccherebbe": lo usiamo solo per il tempo.
    e.preventDefault()

    const teamName = (id: 'home' | 'away') => game.teams[id].name
    switch (action) {
      case 'toggleClock':
        run({ type: 'toggleClock' })
        break
      case 'goalHome':
      case 'goalAway': {
        const team = action === 'goalHome' ? 'home' : 'away'
        if (view.phase === 'shootout') break
        const label = t('Gol {team}', { team: teamName(team) })
        if (run({ type: 'goal', team }, label)) showToast(label)
        break
      }
      case 'shotHome':
      case 'shotAway': {
        const team = action === 'shotHome' ? 'home' : 'away'
        // Tiri nascosti dal regolamento: la scorciatoia non fa nulla.
        if (!game.rules.showShots) break
        run({ type: 'shot', team, delta: 1 }, t('Tiro {team}', { team: teamName(team) }))
        break
      }
      case 'mute':
        audio.toggleMute()
        showToast(audio.settings.muted ? t('Audio disattivato') : t('Audio attivo'))
        break
      case 'undo':
        doUndo()
        break
    }
  }
</script>

<!-- Ogni clic o tasto sblocca l'audio (i browser lo richiedono prima di suonare). -->
<svelte:window
  onkeydown={(e) => {
    audio.unlock()
    onKeydown(e)
  }}
  onpointerdown={() => audio.unlock()}
/>

<div class="console">
  <header class="topbar">
    <div class="bar-main">
      <h1>Tabellone Hockey <span class="version">v{__APP_VERSION__}</span></h1>

      <nav class="tabs" aria-label={t('Sezioni')}>
        {#each TABS as item (item.id)}
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

      <div class="spacer"></div>

      {#if !audio.unlocked && !audio.settings.muted}
        <button type="button" class="btn btn-sm audio-locked" onclick={() => audio.unlock()}>
          🔈 {t('Clicca per attivare l’audio')}
        </button>
      {/if}
      <button
        type="button"
        class="btn btn-ghost mute"
        title={`${audio.settings.muted ? t('Audio disattivato') : t('Audio attivo')} (M)`}
        aria-label={audio.settings.muted ? t('Attiva audio') : t('Disattiva audio')}
        onclick={() => audio.toggleMute()}
      >
        {audio.settings.muted ? '🔇' : '🔊'}
      </button>

      {#if displayConnected}
        <button
          type="button"
          class="btn"
          title={t('Spegne il tabellone sul maxischermo (si riapre con Apri tabellone)')}
          onclick={closeDisplay}
        >
          {t('Chiudi tabellone')}
        </button>
      {:else}
        <button type="button" class="btn btn-primary" onclick={openDisplay}
          >{t('Apri tabellone')}</button
        >
      {/if}
      {#if desktop}
        <button
          type="button"
          class="btn"
          title={t('Scegli su quale schermo mostrare console e tabellone')}
          onclick={() => desktop?.chooseScreens()}
        >
          {t('Schermi…')}
        </button>
      {/if}
      <button type="button" class="btn" onclick={() => (newGameOpen = true)}
        >{t('Nuova partita…')}</button
      >
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
      <button type="button" class="btn btn-ghost" onclick={() => (helpOpen = true)}>
        {t('Guida')} <kbd>F1</kbd>
      </button>
    </div>

    <!-- Colonna a destra, a sé: sotto la scritta il tabellone in piccolo, che
         resta lì anche quando la barra va a capo. -->
    <div class="display-status">
      <span class="status" class:ok={displayConnected}>
        <span class="dot"></span>
        {displayConnected ? t('Tabellone collegato') : t('Tabellone non aperto')}
        <HelpTip title={t('Tabellone')} align="right">
          {@html t(
            'Indica se la finestra del tabellone (quella per il maxischermo) è aperta. Se l’hai chiusa per sbaglio, premi <b>Apri tabellone</b>: riprende subito con il punteggio e il tempo giusti.',
          )}
        </HelpTip>
      </span>
      <div class="preview-slot">
        <BoardPreview {game} connected={displayConnected} />
      </div>
    </div>
  </header>

  {#if tab === 'game'}
    <main class="game">
      <TeamControls id="home" {view} rules={game.rules} {run} />

      <div class="center">
        <ClockPanel
          {view}
          {run}
          confirm={(r) => (confirmRequest = r)}
          onEditClock={() => (clockEditOpen = true)}
          onNewGame={() => (newGameOpen = true)}
        />

        <EventLog {game} {undoLabel} onundo={doUndo} />
      </div>

      <TeamControls id="away" {view} rules={game.rules} {run} />
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
        onlanguage={(language) => {
          run({ type: 'setBoardLanguage', language })
          showToast(t('Lingua del tabellone cambiata'))
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

  .topbar {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: flex-start;
    gap: 0.9rem;
    padding: 0.7rem 1.25rem;
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

  .tabs {
    display: flex;
    gap: 0.25rem;
    padding: 0.2rem;
    border-radius: 10px;
    background: var(--ice-950);
  }

  .tabs button {
    padding: 0.4rem 1rem;
    border: 0;
    border-radius: 8px;
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

  .spacer {
    flex: 1;
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

  .bar-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem 0.9rem;
  }

  .display-status {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.35rem;
    padding-top: 0.45rem;
  }

  .status {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.9rem;
    color: var(--warn);
  }

  .status.ok {
    color: var(--ok);
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
