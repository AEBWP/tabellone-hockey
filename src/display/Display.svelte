<script lang="ts">
  import { onDestroy } from 'svelte'
  import { apply, deriveView, type GameState } from '../engine'
  import Scoreboard from '../scoreboard/Scoreboard.svelte'
  import { createChannel } from '../shared/channel'
  import { HEARTBEAT_TIMEOUT_MS } from '../shared/messages'
  import { now } from '../shared/time'
  import { DEMO_GOAL_KEYS, DEMO_SCENES, DEMO_TEAMS } from './demo'
  import Stage from './Stage.svelte'

  const demo = new URLSearchParams(location.search).has('demo')

  let game = $state.raw<GameState | null>(null)
  let t = $state(now())
  let lastHeartbeat = $state(0)
  let sceneVersion = $state(0)

  const connected = $derived(t - lastHeartbeat < HEARTBEAT_TIMEOUT_MS)
  // Il tempo è calcolato qui dai timestamp: il tabellone continua a scorrere
  // anche se la console si blocca per un attimo.
  const view = $derived(game ? deriveView(game, t) : null)

  // Aggiorna l'orologio a ogni fotogramma (servono i decimi di secondo).
  let frame = requestAnimationFrame(function tick() {
    t = now()
    frame = requestAnimationFrame(tick)
  })

  let cleanup: () => void = () => {}

  if (demo) {
    game = DEMO_SCENES[0].build(now())
    const onKey = (e: KeyboardEvent) => {
      const scene = DEMO_SCENES.find((s) => s.key === e.key)
      if (scene) {
        game = scene.build(now())
        // Cambiare scena non è un gol: si riparte senza animazione.
        sceneVersion++
      }
      const team = DEMO_GOAL_KEYS[e.key.toLowerCase()]
      if (team && game) game = apply(game, { type: 'goal', team }, now())
      // L: mostra/nasconde i loghi, per vedere entrambe le versioni.
      if (e.key.toLowerCase() === 'l' && game) {
        const hide = game.teams.home.logo !== null
        for (const id of ['home', 'away'] as const) {
          const logo = hide ? null : DEMO_TEAMS[id].logo
          game = apply(game, { type: 'setTeam', team: id, setup: { logo } }, now())
        }
      }
    }
    window.addEventListener('keydown', onKey)
    cleanup = () => window.removeEventListener('keydown', onKey)
  } else {
    const channel = createChannel()
    const unsubscribe = channel.subscribe((message) => {
      if (message.type === 'heartbeat') lastHeartbeat = now()
      if (message.type === 'state') {
        lastHeartbeat = now()
        game = message.state
      }
    })
    channel.send({ type: 'hello' })
    cleanup = () => {
      unsubscribe()
      channel.close()
    }
  }

  onDestroy(() => {
    cancelAnimationFrame(frame)
    cleanup()
  })

  // Nella versione browser: doppio clic per lo schermo intero.
  // In Electron la finestra si aprirà già a schermo intero sul maxischermo.
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen()
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="root" ondblclick={toggleFullscreen}>
  <Stage>
    {#if view}
      {#key sceneVersion}
        <Scoreboard {view} />
      {/key}
    {:else}
      <div class="waiting">
        <h1>TABELLONE HOCKEY</h1>
        <p>In attesa della console…</p>
      </div>
    {/if}

    {#if !demo && game && !connected}
      <div class="offline" title="Console non collegata"></div>
    {/if}
  </Stage>

  {#if demo}
    <aside class="demo-help">
      <strong>DEMO</strong>
      {#each DEMO_SCENES as scene (scene.key)}
        <span><kbd>{scene.key}</kbd> {scene.label}</span>
      {/each}
      <span><kbd>G</kbd> gol casa · <kbd>H</kbd> gol ospiti · <kbd>L</kbd> loghi sì/no</span>
    </aside>
  {/if}
</div>

<style>
  .root {
    position: relative;
    height: 100%;
    cursor: none;
  }

  .waiting {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-family: 'Barlow Condensed', var(--font-ui);
    background: radial-gradient(ellipse at center, var(--ice-800), var(--ice-950) 70%);
  }

  h1 {
    margin: 0;
    font-size: 160px;
    font-weight: 800;
    letter-spacing: 0.06em;
  }

  p {
    margin: 24px 0 0;
    font-size: 48px;
    color: var(--ice-300);
  }

  /* Discreto: segnala all'operatore che la console è chiusa, il pubblico quasi non lo nota. */
  .offline {
    position: absolute;
    right: 16px;
    bottom: 16px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--warn);
    opacity: 0.7;
  }

  .demo-help {
    position: absolute;
    left: 8px;
    bottom: 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    max-width: calc(100% - 16px);
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 12px;
    color: #cfe0f2;
    background: rgba(0, 0, 0, 0.7);
    cursor: default;
  }

  kbd {
    padding: 0 4px;
    border: 1px solid #6b8bb0;
    border-radius: 3px;
    font-family: inherit;
  }
</style>
