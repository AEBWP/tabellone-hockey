<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import { BOARD_STYLES, type BoardStyle, type GameView } from '../engine'
  import Arena from './arena/Scoreboard.svelte'
  import Broadcast from './broadcast/Scoreboard.svelte'
  import Classico from './classico/Scoreboard.svelte'
  import Ghiaccio from './ghiaccio/Scoreboard.svelte'
  import Retro from './retro/Scoreboard.svelte'

  /**
   * "Prova generale" invisibile, fatta una volta all'apertura del tabellone:
   * disegna ogni stile e la sua animazione del gol, con opacità quasi nulla.
   * Sui PC senza scheda grafica supportata il primo disegno di ogni effetto
   * (sfocature, maschere, sfumature) è molto lento: farlo adesso evita che il
   * primo gol vero, o l'inizio partita, vada a scatti.
   */
  let { view, style, ondone }: { view: GameView; style: BoardStyle; ondone: () => void } = $props()

  const STEP_MS = 400
  const GOAL_MS = 2_400

  // Fotografia della partita (nomi, colori, loghi veri) a tempo in corso.
  const base: GameView = untrack(() => ({
    ...view,
    pregame: false,
    phase: 'play',
    timeout: null,
    intermission: null,
    shootout: null,
    powerPlay: null,
  }))
  // Prima lo stile in uso, poi gli altri.
  const order = untrack(() => [style, ...BOARD_STYLES.filter((s) => s !== style)])

  let current = $state<BoardStyle | null>(null)
  let scored = $state(false)
  const warmView = $derived<GameView>(
    scored
      ? {
          ...base,
          teams: {
            ...base.teams,
            home: {
              ...base.teams.home,
              goals: base.teams.home.goals + 1,
              score: base.teams.home.score + 1,
            },
          },
        }
      : base,
  )

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  onMount(() => {
    let cancelled = false
    void (async () => {
      for (const s of order) {
        scored = false
        current = s
        await sleep(STEP_MS)
        if (cancelled) return
        scored = true
        await sleep(GOAL_MS)
        if (cancelled) return
      }
      current = null
      ondone()
    })()
    return () => {
      cancelled = true
    }
  })
</script>

{#if current}
  <div class="warmup" aria-hidden="true">
    {#key current}
      {#if current === 'classico'}
        <Classico view={warmView} />
      {:else if current === 'ghiaccio'}
        <Ghiaccio view={warmView} />
      {:else if current === 'retro'}
        <Retro view={warmView} />
      {:else if current === 'broadcast'}
        <Broadcast view={warmView} />
      {:else}
        <Arena view={warmView} />
      {/if}
    {/key}
  </div>
{/if}

<style>
  /* Sopra al tabellone (sotto verrebbe saltato perché coperto), ma invisibile. */
  .warmup {
    position: absolute;
    inset: 0;
    opacity: 0.002;
    pointer-events: none;
  }
</style>
