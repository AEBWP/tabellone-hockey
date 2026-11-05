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
  import ClockEditDialog from './ClockEditDialog.svelte'
  import ClockPanel from './ClockPanel.svelte'
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

  // ── Stato ─────────────────────────────────────────────────────────────
  // `$state.raw`: lo stato viene sempre sostituito per intero, mai modificato,
  // così si può salvare e inviare al tabellone tale e quale.
  let game = $state.raw<GameState>(loadGame() ?? createGame())
  let history = $state.raw<HistoryEntry[]>([])
  let t = $state(now())
  let lastDisplaySeen = $state(0)

  const view = $derived(deriveView(game, t))
  const displayConnected = $derived(t - lastDisplaySeen < HEARTBEAT_TIMEOUT_MS)
  const undoLabel = $derived(
    canUndo(history, advance(game, t)) ? (history.at(-1)?.label ?? null) : null,
  )

  type Tab = 'game' | 'teams' | 'style' | 'rules' | 'audio' | 'backup'
  const TABS: { id: Tab; label: string }[] = [
    { id: 'game', label: 'Partita' },
    { id: 'teams', label: 'Squadre' },
    { id: 'style', label: 'Stile' },
    { id: 'rules', label: 'Regolamento' },
    { id: 'audio', label: 'Audio' },
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
  }

  const unsubscribe = channel.subscribe((message) => {
    if (message.type === 'hello') channel.send({ type: 'state', state: game })
    if (message.type === 'hello' || message.type === 'displayHeartbeat') lastDisplaySeen = now()
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
    t = now()
    frame = requestAnimationFrame(tick)
  })

  onDestroy(() => {
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
      showToast('Partita non ancora iniziata: premi ▶ Avvia partita')
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
    showToast(`Annullato: ${result.label}`)
  }

  function startNewGame(rules: Rules) {
    run({ type: 'newGame', rules })
    history = []
    tab = 'game'
    showToast('Nuova partita pronta')
  }

  function showToast(text: string) {
    toast = text
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => (toast = null), 2500)
  }

  function openDisplay() {
    if (desktop) void desktop.openDisplay()
    else window.open('./display.html', 'tabellone-hockey-display')
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
        if (run({ type: 'goal', team }, `Gol ${teamName(team)}`)) showToast(`Gol ${teamName(team)}`)
        break
      }
      case 'shotHome':
      case 'shotAway': {
        const team = action === 'shotHome' ? 'home' : 'away'
        run({ type: 'shot', team, delta: 1 }, `Tiro ${teamName(team)}`)
        break
      }
      case 'mute':
        audio.toggleMute()
        showToast(audio.settings.muted ? 'Audio disattivato' : 'Audio attivo')
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
    <h1>Tabellone Hockey <span class="version">v{__APP_VERSION__}</span></h1>

    <nav class="tabs" aria-label="Sezioni">
      {#each TABS as t (t.id)}
        <button type="button" class:active={tab === t.id} onclick={() => (tab = t.id)}>
          {t.label}
        </button>
      {/each}
    </nav>

    <div class="spacer"></div>

    {#if !audio.unlocked && !audio.settings.muted}
      <button type="button" class="btn btn-sm audio-locked" onclick={() => audio.unlock()}>
        🔈 Clicca per attivare l’audio
      </button>
    {/if}
    <button
      type="button"
      class="btn btn-ghost mute"
      title={audio.settings.muted ? 'Audio disattivato (M)' : 'Audio attivo (M)'}
      aria-label={audio.settings.muted ? 'Attiva audio' : 'Disattiva audio'}
      onclick={() => audio.toggleMute()}
    >
      {audio.settings.muted ? '🔇' : '🔊'}
    </button>

    <span class="status" class:ok={displayConnected}>
      <span class="dot"></span>
      {displayConnected ? 'Tabellone collegato' : 'Tabellone non aperto'}
      <HelpTip title="Tabellone" align="right">
        Indica se la finestra del tabellone (quella per il maxischermo) è aperta. Se l’hai chiusa
        per sbaglio, premi <b>Apri tabellone</b>: riprende subito con il punteggio e il tempo
        giusti.
      </HelpTip>
    </span>
    {#if desktop && displayConnected}
      <button
        type="button"
        class="btn"
        title="Spegne il tabellone sul maxischermo (si riapre con Apri tabellone)"
        onclick={() => desktop?.closeDisplay()}
      >
        Chiudi tabellone
      </button>
    {:else}
      <button type="button" class="btn btn-primary" onclick={openDisplay}>Apri tabellone</button>
    {/if}
    {#if desktop}
      <button
        type="button"
        class="btn"
        title="Scegli su quale schermo mostrare console e tabellone"
        onclick={() => desktop?.chooseScreens()}
      >
        Schermi…
      </button>
    {/if}
    <button type="button" class="btn" onclick={() => (newGameOpen = true)}>Nuova partita…</button>
    <button type="button" class="btn btn-ghost" onclick={() => (helpOpen = true)}>
      Guida <kbd>F1</kbd>
    </button>
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
        onchoose={(style) => {
          run({ type: 'setBoardStyle', style })
          showToast('Stile del tabellone cambiato')
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
    <button type="button" class="btn" onclick={() => (confirmRequest = null)}>Annulla</button>
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
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem 0.9rem;
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

  .mute {
    padding: 0.35rem 0.6rem;
    font-size: 1.15rem;
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
