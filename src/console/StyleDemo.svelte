<script lang="ts">
  import { onDestroy } from 'svelte'
  import { apply, deriveView, type BoardStyle, type GameState } from '../engine'
  import { DEMO_SCENES } from '../display/demo'
  import Stage from '../display/Stage.svelte'
  import Scoreboard from '../scoreboard/Scoreboard.svelte'
  import { now } from '../shared/time'

  /**
   * Piccola demo animata di uno stile del tabellone, in ciclo continuo:
   * gioco con penalità → gol (alternando casa e ospiti) → intervallo.
   * È generata dal tabellone stesso: sempre fedele alla grafica reale.
   */
  let { style }: { style: BoardStyle } = $props()

  const STEPS = [
    { id: 'play', label: 'Partita', ms: 4_000 },
    { id: 'goal', label: 'Gol', ms: 6_500 },
    { id: 'pause', label: 'Intervallo', ms: 3_500 },
  ] as const
  const LOOP_MS = STEPS.reduce((sum, s) => sum + s.ms, 0)

  const playScene = DEMO_SCENES.find((s) => s.key === '1')!
  const pauseScene = DEMO_SCENES.find((s) => s.key === '5')!

  let game = $state.raw<GameState>(playScene.build(now()))
  let t = $state(now())
  let step = $state(0)
  let loop = 0
  const start = now()

  const view = $derived(deriveView(game, t))

  function stepAt(elapsed: number): number {
    let acc = 0
    for (let i = 0; i < STEPS.length; i++) {
      acc += STEPS[i].ms
      if (elapsed < acc) return i
    }
    return 0
  }

  let frame = requestAnimationFrame(function tick() {
    t = now()
    const elapsed = t - start
    const currentLoop = Math.floor(elapsed / LOOP_MS)
    const next = stepAt(elapsed % LOOP_MS)
    if (next !== step || currentLoop !== loop) {
      loop = currentLoop
      step = next
      const id = STEPS[next].id
      if (id === 'play') game = playScene.build(t)
      if (id === 'goal') {
        // Un giro gol della squadra di casa, quello dopo degli ospiti.
        game = apply(game, { type: 'goal', team: loop % 2 === 0 ? 'home' : 'away' }, t)
      }
      if (id === 'pause') game = pauseScene.build(t)
    }
    frame = requestAnimationFrame(tick)
  })

  onDestroy(() => cancelAnimationFrame(frame))
</script>

<div class="demo">
  <div class="screen">
    <Stage>
      <Scoreboard {view} {style} />
    </Stage>
    <span class="badge">DEMO</span>
  </div>
  <div class="steps">
    {#each STEPS as s, i (s.id)}
      <span class="step" class:active={i === step}>{s.label}</span>
    {/each}
  </div>
</div>

<style>
  .demo {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .screen {
    position: relative;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    border-radius: 8px;
    background: #000;
  }

  .badge {
    position: absolute;
    top: 8px;
    right: 8px;
    padding: 0.1rem 0.45rem;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: #fff;
    background: rgba(0, 0, 0, 0.6);
  }

  .steps {
    display: flex;
    gap: 0.35rem;
  }

  .step {
    flex: 1;
    padding: 0.2rem 0;
    border-radius: 999px;
    font-size: 0.78rem;
    text-align: center;
    color: var(--ice-300);
    background: var(--ice-950);
    transition:
      background 200ms,
      color 200ms;
  }

  .step.active {
    color: #fff;
    background: var(--ice-600);
  }
</style>
