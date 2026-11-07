<script lang="ts">
  import type { GameView } from '../engine'
  import { t } from '../i18n/ui.svelte'
  import Modal from './Modal.svelte'
  import { updates } from './updates.svelte'

  /**
   * Aggiornamento del programma: versione nuova, cosa succede premendo
   * "Aggiorna ora", avanzamento dello scaricamento ed eventuali errori.
   */
  let { open, view, onclose }: { open: boolean; view: GameView; onclose: () => void } = $props()

  const REPO = 'https://github.com/AEBWP/tabellone-hockey'
  const s = $derived(updates.state)
  const busy = $derived(s.status === 'downloading' || s.status === 'installing')
  /** Partita in corso: il tabellone si spegne per circa un minuto. */
  const playing = $derived(!view.pregame && view.phase !== 'final')
  const mb = (bytes?: number) => ((bytes ?? 0) / 1024 / 1024).toFixed(0)
</script>

<Modal {open} title={t('Aggiornamento del programma')} onclose={() => !busy && onclose()}>
  <p class="versions">
    {t('Versione installata')}: <b>{s.current}</b>
    {#if s.version && updates.pending}
      → <b class="new">{s.version}</b>
    {/if}
  </p>

  {#if s.status === 'checking'}
    <p class="muted">{t('Controllo degli aggiornamenti…')}</p>
  {:else if s.status === 'none'}
    <p class="ok">✓ {t('Hai già l’ultima versione.')}</p>
  {:else if s.status === 'idle'}
    <p class="muted">{t('Il programma controlla da solo se ci sono aggiornamenti.')}</p>
  {:else if s.status === 'available'}
    <p>{@html t('È disponibile la versione <b>{version}</b>.', { version: s.version ?? '' })}</p>
    <p>
      <a href="{REPO}/releases/tag/v{s.version}" target="_blank" rel="noreferrer"
        >{t('Cosa c’è di nuovo')} ↗</a
      >
    </p>
    <ul class="how">
      <li>{t('Il programma scarica l’aggiornamento da GitHub.')}</li>
      <li>{t('Poi si chiude, si installa da solo e si riapre: circa un minuto.')}</li>
      <li>
        {t('Partita, squadre, loghi, regolamenti e impostazioni restano come sono.')}
      </li>
    </ul>
    {#if playing}
      <p class="warn">
        ⚠ {t(
          'La partita è in corso: durante l’aggiornamento il tabellone si spegne. Meglio aggiornare a fine partita.',
        )}
      </p>
    {/if}
  {:else if s.status === 'downloading'}
    <p>{t('Scaricamento della versione {version}…', { version: s.version ?? '' })}</p>
    <div
      class="bar"
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={s.percent ?? 0}
    >
      <span style:width="{s.percent ?? 0}%"></span>
    </div>
    <p class="muted small">
      {s.percent ?? 0}%{#if s.total}
        · {mb(s.transferred)} / {mb(s.total)} MB{/if}
    </p>
  {:else if s.status === 'installing'}
    <p>
      <b>{t('Installazione in corso…')}</b>
      {t('Il programma si chiude e si riapre da solo con la nuova versione.')}
    </p>
  {:else if s.status === 'error'}
    <p class="error">
      {#if s.error === 'offline'}
        {t('Nessuna connessione a internet: impossibile raggiungere GitHub.')}
      {:else if s.error === 'download'}
        {t('Lo scaricamento non è riuscito.')}
      {:else if s.error === 'install'}
        {t('L’installazione non è partita.')}
      {:else}
        {t('Impossibile controllare gli aggiornamenti.')}
      {/if}
    </p>
    <p class="muted small">
      {@html t(
        'Puoi sempre scaricare l’installer dalla <a href="{url}" target="_blank" rel="noreferrer">pagina dei download</a>.',
        { url: `${REPO}/wiki/Download` },
      )}
    </p>
    {#if s.detail}
      <details>
        <summary>{t('Dettagli tecnici')}</summary>
        <code>{s.detail}</code>
      </details>
    {/if}
  {/if}

  {#snippet actions()}
    {#if s.status === 'available' || (s.status === 'error' && s.version)}
      <button type="button" class="btn" onclick={onclose}>{t('Più tardi')}</button>
      <button type="button" class="btn btn-primary" onclick={() => void updates.install()}>
        {s.status === 'error' ? t('Riprova') : t('Aggiorna ora')}
      </button>
    {:else if !busy}
      <button
        type="button"
        class="btn"
        disabled={s.status === 'checking'}
        onclick={() => void updates.check()}
      >
        {t('Controlla adesso')}
      </button>
      <button type="button" class="btn btn-primary" onclick={onclose}>{t('Chiudi')}</button>
    {/if}
  {/snippet}
</Modal>

<style>
  p {
    margin: 0 0 0.7rem;
  }

  .versions {
    color: var(--ice-300);
  }

  .versions b {
    color: var(--ice-50);
  }

  .versions .new {
    color: #3ccf7a;
  }

  .how {
    margin: 0 0 0.8rem;
    padding-left: 1.2rem;
    color: var(--ice-200, #c9dcf0);
  }

  .how li {
    margin-bottom: 0.25rem;
  }

  .ok {
    color: #3ccf7a;
  }

  .warn {
    padding: 0.6rem 0.8rem;
    border-radius: 10px;
    background: rgba(255, 176, 32, 0.12);
    color: #ffd166;
  }

  .error {
    color: #ff8a8c;
  }

  .small {
    font-size: 0.88rem;
  }

  .bar {
    height: 12px;
    margin-bottom: 0.4rem;
    border-radius: 999px;
    background: var(--ice-950);
    overflow: hidden;
  }

  .bar span {
    display: block;
    height: 100%;
    background: #3ccf7a;
    transition: width 0.3s;
  }

  a {
    color: var(--ice-300, #9cc3ea);
  }

  details {
    font-size: 0.8rem;
    color: var(--ice-300);
  }

  code {
    display: block;
    margin-top: 0.3rem;
    word-break: break-word;
    white-space: pre-wrap;
  }
</style>
