<script lang="ts">
  import { onDestroy } from 'svelte'
  import { apply, createGame, deriveView, type Command, type GameState } from '../engine'
  import Stage from '../display/Stage.svelte'
  import Scoreboard from '../scoreboard/Scoreboard.svelte'
  import { createChannel } from '../shared/channel'
  import { HEARTBEAT_INTERVAL_MS } from '../shared/messages'
  import { now } from '../shared/time'
  import TeamEditor from './TeamEditor.svelte'

  // Stato della partita. `$state.raw`: viene sempre sostituito per intero,
  // mai modificato, e così si può inviare tale e quale al tabellone.
  let game = $state.raw<GameState>(createGame())
  let t = $state(now())

  const view = $derived(deriveView(game, t))

  const channel = createChannel()
  const broadcast = () => channel.send({ type: 'state', state: game })

  /** Applica un comando e aggiorna subito il tabellone. */
  function run(command: Command) {
    game = apply(game, command, now())
    broadcast()
  }

  // Un tabellone appena aperto chiede subito lo stato.
  const unsubscribe = channel.subscribe((message) => {
    if (message.type === 'hello') broadcast()
  })
  const timer = setInterval(
    () => channel.send({ type: 'heartbeat', sentAt: now() }),
    HEARTBEAT_INTERVAL_MS,
  )

  let frame = requestAnimationFrame(function tick() {
    t = now()
    frame = requestAnimationFrame(tick)
  })

  onDestroy(() => {
    cancelAnimationFrame(frame)
    clearInterval(timer)
    unsubscribe()
    channel.close()
  })

  function openDisplay() {
    window.open('./display.html', 'tabellone-hockey-display')
  }
</script>

<main>
  <header>
    <h1>Console operatore</h1>
    <button type="button" onclick={openDisplay}>Apri tabellone</button>
  </header>

  <div class="content">
    <section class="preview-section">
      <h2>Anteprima tabellone</h2>
      <div class="preview">
        <Stage>
          <Scoreboard {view} animations={false} />
        </Stage>
      </div>
      <p class="hint">
        I controlli di gioco (tempo, punteggio, penalità) arriveranno con la fase 4.
      </p>
    </section>

    <section class="teams">
      <h2>Squadre</h2>
      <div class="team-grid">
        <TeamEditor
          id="home"
          team={game.teams.home}
          onchange={(setup) => run({ type: 'setTeam', team: 'home', setup })}
        />
        <TeamEditor
          id="away"
          team={game.teams.away}
          onchange={(setup) => run({ type: 'setTeam', team: 'away', setup })}
        />
      </div>
    </section>
  </div>
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 1.5rem;
    background: var(--ice-900);
    border-bottom: 1px solid var(--ice-800);
  }

  h1 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }

  h2 {
    margin: 0 0 0.75rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--ice-300);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .content {
    flex: 1;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
  }

  .preview {
    width: min(100%, 640px);
    aspect-ratio: 16 / 9;
    border: 1px solid var(--ice-800);
    border-radius: 10px;
    overflow: hidden;
  }

  .hint {
    color: var(--ice-300);
  }

  .team-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 1rem;
  }

  header button {
    padding: 0.6rem 1.1rem;
    border: 0;
    border-radius: 8px;
    background: var(--ice-600);
    color: white;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  header button:hover {
    background: #3a7dbb;
  }
</style>
