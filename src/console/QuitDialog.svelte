<script lang="ts">
  import type { GameView } from '../engine'
  import { textColorOn } from '../shared/color'
  import { phaseLabel } from '../i18n/board'
  import { t, ui } from '../i18n/ui.svelte'

  /**
   * Conferma di chiusura del programma, nello stile della console.
   * Ricorda la situazione della partita (che resta comunque salvata).
   */
  let {
    open,
    view,
    onanswer,
  }: { open: boolean; view: GameView; onanswer: (confirmed: boolean) => void } = $props()

  let dialog: HTMLDialogElement
  let cancelButton = $state<HTMLButtonElement>()

  $effect(() => {
    if (open && !dialog.open) {
      dialog.showModal()
      // Il tasto predefinito è "Annulla": un Invio distratto non chiude il programma.
      cancelButton?.focus()
    }
    if (!open && dialog.open) dialog.close()
  })

  const running = $derived(view.clockRunning && view.phase === 'play')
</script>

<dialog
  bind:this={dialog}
  oncancel={(e) => {
    e.preventDefault()
    onanswer(false)
  }}
>
  {#if open}
    <div class="box">
      <div class="icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="30" height="30">
          <path
            d="M12 3v8M6.3 6.3a8 8 0 1 0 11.4 0"
            fill="none"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
          />
        </svg>
      </div>
      <h2>{t('Chiudere il Tabellone Hockey?')}</h2>
      <p>{@html t('Si chiuderà anche il <b>tabellone sul maxischermo</b>.')}</p>

      <div class="match">
        <span class="team" style:--team={view.teams.home.color}>
          <span class="chip" style:color={textColorOn(view.teams.home.color)}
            >{view.teams.home.shortName}</span
          >
          <b>{view.teams.home.score}</b>
        </span>
        <span class="dash">–</span>
        <span class="team away" style:--team={view.teams.away.color}>
          <b>{view.teams.away.score}</b>
          <span class="chip" style:color={textColorOn(view.teams.away.color)}
            >{view.teams.away.shortName}</span
          >
        </span>
        <span class="meta"
          >{phaseLabel({ ...view, language: ui.lang })}{view.phase === 'play' ||
          view.phase === 'ready'
            ? ` · ${view.clockText}`
            : ''}</span
        >
      </div>

      {#if running}
        <p class="warn">⚠ {t('Il tempo sta scorrendo: forse vuoi fermarlo prima.')}</p>
      {/if}
      <p class="muted">
        {t('La partita resta salvata: alla riapertura il programma riparte esattamente da qui.')}
      </p>

      <div class="actions">
        <button
          bind:this={cancelButton}
          type="button"
          class="btn btn-lg"
          onclick={() => onanswer(false)}
        >
          {t('Annulla')}
        </button>
        <button type="button" class="btn btn-lg btn-stop" onclick={() => onanswer(true)}>
          {t('Chiudi il programma')}
        </button>
      </div>
    </div>
  {/if}
</dialog>

<style>
  dialog {
    width: min(92vw, 500px);
    padding: 0;
    border: 1px solid var(--ice-600);
    border-radius: 18px;
    background: linear-gradient(180deg, #0f2440, var(--ice-900));
    color: var(--ice-50);
    box-shadow: 0 30px 90px rgba(0, 0, 0, 0.7);
  }

  dialog::backdrop {
    background: rgba(2, 6, 12, 0.75);
    backdrop-filter: blur(3px);
  }

  .box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
    padding: 1.6rem 1.6rem 1.4rem;
    text-align: center;
  }

  .icon {
    display: grid;
    place-items: center;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    font-size: 1.9rem;
    color: #ff8a8c;
    background: rgba(198, 47, 58, 0.18);
    border: 2px solid rgba(255, 77, 79, 0.5);
  }

  h2 {
    margin: 0.3rem 0 0;
    font-size: 1.35rem;
  }

  p {
    margin: 0;
    line-height: 1.45;
  }

  .match {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.4rem 0.8rem;
    margin: 0.4rem 0;
    padding: 0.7rem 1rem;
    border-radius: 12px;
    background: var(--ice-950);
    font-family: 'Barlow Condensed', var(--font-ui);
  }

  .team {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .team b {
    font-size: 2rem;
    line-height: 1;
  }

  .chip {
    padding: 0.15rem 0.5rem;
    border-radius: 6px;
    font-weight: 700;
    letter-spacing: 0.06em;
    background: var(--team);
  }

  .dash {
    font-size: 1.6rem;
    color: var(--ice-300);
  }

  .meta {
    flex-basis: 100%;
    font-size: 0.95rem;
    letter-spacing: 0.1em;
    color: var(--ice-300);
  }

  .warn {
    padding: 0.45rem 0.8rem;
    border-radius: 8px;
    color: #ffd166;
    background: rgba(255, 176, 32, 0.12);
  }

  .muted {
    font-size: 0.9rem;
  }

  .actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 0.8rem;
  }
</style>
