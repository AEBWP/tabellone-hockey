<script lang="ts">
  import { untrack } from 'svelte'
  import { apply, deriveView, type BoardStyle, type GameState, type Language } from '../engine'
  import { t } from '../i18n/ui.svelte'
  import { DEMO_SCENES } from '../display/demo'
  import Stage from '../display/Stage.svelte'
  import Scoreboard from '../scoreboard/Scoreboard.svelte'
  import { now } from '../shared/time'

  /**
   * Demo animata di uno stile del tabellone. Parte con Play, mostra una volta
   * la sequenza (presentazione → inizio partita → gioco → gol → intervallo) e
   * si ferma. È generata dal tabellone stesso: sempre fedele alla grafica reale.
   */
  let {
    style,
    language,
    playing,
    onplay,
    onend,
  }: {
    style: BoardStyle
    /** Lingua scelta per il tabellone: la demo la mostra subito. */
    language: Language
    /** True mentre questa demo è in riproduzione (una sola alla volta). */
    playing: boolean
    onplay: () => void
    onend: () => void
  } = $props()

  const STEPS = [
    { id: 'intro', label: 'Presentazione', ms: 2_800 },
    { id: 'start', label: 'Inizio', ms: 2_600 },
    { id: 'play', label: 'Gioco', ms: 3_000 },
    { id: 'goal', label: 'Gol', ms: 6_500 },
    { id: 'pause', label: 'Intervallo', ms: 3_000 },
  ] as const
  const TOTAL_MS = STEPS.reduce((sum, s) => sum + s.ms, 0)

  const scene = (key: string) => DEMO_SCENES.find((s) => s.key === key)!

  /** Fermo immagine mostrato quando la demo non è in riproduzione. */
  const posterTime = now()
  const posterGame = scene('1').build(posterTime)

  let game = $state.raw<GameState>(posterGame)
  let time = $state(posterTime)
  let step = $state(-1)
  let frame = 0
  let startedAt = 0

  const view = $derived({ ...deriveView(game, time), language })
  const progress = $derived(step < 0 ? 0 : Math.min(1, (time - startedAt) / TOTAL_MS))

  function stepAt(elapsed: number): number {
    let acc = 0
    for (let i = 0; i < STEPS.length; i++) {
      acc += STEPS[i].ms
      if (elapsed < acc) return i
    }
    return STEPS.length
  }

  function enter(i: number, at: number) {
    switch (STEPS[i].id) {
      case 'intro':
        game = scene('0').build(at)
        break
      case 'start':
        game = apply(game, { type: 'startClock' }, at)
        break
      case 'play':
        game = scene('1').build(at)
        break
      case 'goal':
        game = apply(game, { type: 'goal', team: 'home' }, at)
        break
      case 'pause':
        game = scene('5').build(at)
        break
    }
  }

  function stop() {
    cancelAnimationFrame(frame)
    step = -1
    game = posterGame
    time = posterTime
  }

  function start() {
    cancelAnimationFrame(frame)
    startedAt = now()
    step = -1
    const tick = () => {
      time = now()
      const next = stepAt(time - startedAt)
      if (next >= STEPS.length) {
        stop()
        onend()
        return
      }
      if (next !== step) {
        step = next
        enter(next, time)
      }
      frame = requestAnimationFrame(tick)
    }
    tick()
  }

  // Avvio e arresto comandati dalla scheda (una demo alla volta).
  // untrack: l'effetto deve dipendere solo da `playing`, non dallo stato della demo.
  $effect(() => {
    const shouldPlay = playing
    untrack(() => (shouldPlay ? start() : stop()))
    return () => cancelAnimationFrame(frame)
  })
</script>

<div class="demo">
  <div class="screen">
    <Stage>
      <Scoreboard {view} {style} animations={playing} />
    </Stage>

    {#if playing}
      <button type="button" class="stop" onclick={onend} aria-label={t('Ferma la demo')}>■</button>
      <div class="progress" style:width="{progress * 100}%"></div>
    {:else}
      <button type="button" class="play" onclick={onplay} aria-label={t('Guarda la demo')}>
        <span class="play-icon">▶</span>
        <span>{t('Guarda la demo')}</span>
      </button>
    {/if}
  </div>

  <div class="steps" class:idle={!playing}>
    {#each STEPS as s, i (s.id)}
      <span class="step" class:active={i === step}>{t(s.label)}</span>
    {/each}
  </div>
</div>

<style>
  .demo {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .screen {
    position: relative;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    border-radius: 8px;
    background: #000;
  }

  .play {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    border: 0;
    background: rgba(2, 6, 12, 0.55);
    color: #fff;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    transition: background 150ms;
  }

  .play:hover {
    background: rgba(2, 6, 12, 0.35);
  }

  .play-icon {
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    padding-left: 4px;
    border-radius: 50%;
    background: var(--ice-600);
    font-size: 1.3rem;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
  }

  .stop {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 30px;
    height: 30px;
    border: 0;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.65);
    color: #fff;
    font-size: 0.8rem;
    cursor: pointer;
  }

  .progress {
    position: absolute;
    left: 0;
    bottom: 0;
    height: 4px;
    background: var(--ice-300);
  }

  .steps {
    display: flex;
    gap: 0.25rem;
  }

  .steps.idle {
    opacity: 0.5;
  }

  .step {
    flex: 1;
    padding: 0.15rem 0;
    border-radius: 999px;
    font-size: 0.68rem;
    text-align: center;
    color: var(--ice-300);
    background: var(--ice-950);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .step.active {
    color: #fff;
    background: var(--ice-600);
  }
</style>
