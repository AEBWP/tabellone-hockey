<script lang="ts">
  import { onDestroy } from 'svelte'
  import { t, ui } from '../i18n/ui.svelte'
  import { streaming } from './streaming.svelte'

  /**
   * Anteprima dello streaming nell'angolo della scheda: la stessa pagina che
   * vede il pubblico, in piccolo. Prima di caricarla si controlla che il
   * servizio online sia raggiungibile; senza connessione si mostra un avviso
   * e si riprova da soli.
   */

  type Reach = 'checking' | 'ok' | 'offline'

  const CHECK_OK_MS = 20_000
  const CHECK_OFFLINE_MS = 10_000
  const TIMEOUT_MS = 6_000

  let reach = $state<Reach>('checking')
  let collapsed = $state(false)
  /** Cambia quando la connessione torna: la pagina si ricarica da capo. */
  let reload = $state(0)
  let timer: ReturnType<typeof setTimeout> | undefined
  let destroyed = false

  const src = $derived(
    streaming.link ? `${streaming.link}?embed&lang=${encodeURIComponent(ui.lang)}` : null,
  )

  async function check() {
    clearTimeout(timer)
    if (destroyed) return
    let ok = false
    if (navigator.onLine !== false) {
      const abort = new AbortController()
      const stop = setTimeout(() => abort.abort(), TIMEOUT_MS)
      try {
        const base = streaming.settings.service.replace(/\/+$/, '')
        const res = await fetch(`${base}/api/info`, { cache: 'no-store', signal: abort.signal })
        ok = res.ok
      } catch {
        ok = false
      } finally {
        clearTimeout(stop)
      }
    }
    if (destroyed) return
    if (ok && reach !== 'ok') reload++
    reach = ok ? 'ok' : 'offline'
    timer = setTimeout(check, ok ? CHECK_OK_MS : CHECK_OFFLINE_MS)
  }

  // Si ricontrolla quando cambia il servizio o il nome, e quando la rete va e viene.
  $effect(() => {
    void streaming.settings.service
    void streaming.link
    reach = 'checking'
    void check()
  })
  const onNetwork = () => void check()
  window.addEventListener('online', onNetwork)
  window.addEventListener('offline', onNetwork)

  onDestroy(() => {
    destroyed = true
    clearTimeout(timer)
    window.removeEventListener('online', onNetwork)
    window.removeEventListener('offline', onNetwork)
  })
</script>

<aside class="preview" class:collapsed aria-label={t('Anteprima dello streaming')}>
  <header>
    <span class="dot" class:live={streaming.status === 'live'}></span>
    <strong>{t('Anteprima dello streaming')}</strong>
    <span class="spacer"></span>
    {#if src && reach === 'ok' && !collapsed}
      <a href={streaming.link} target="_blank" rel="noreferrer">{t('Apri nel browser')}</a>
    {/if}
    <button
      type="button"
      class="btn btn-ghost btn-sm"
      title={collapsed ? t('Mostra anteprima') : t('Nascondi anteprima')}
      aria-label={collapsed ? t('Mostra anteprima') : t('Nascondi anteprima')}
      onclick={() => (collapsed = !collapsed)}>{collapsed ? '▴' : '▾'}</button
    >
  </header>

  {#if !collapsed}
    <div class="screen">
      {#if !src}
        <p>{t('Registra un nome per lo streaming per vederne qui l’anteprima.')}</p>
      {:else if reach === 'checking'}
        <p>{t('Verifica della connessione…')}</p>
      {:else if reach === 'offline'}
        <p class="warn">
          {t(
            'Anteprima non disponibile: nessuna connessione a internet o servizio online non raggiungibile.',
          )}
          <br />
          <span class="small">{t('Nuovo controllo in automatico.')}</span>
        </p>
      {:else}
        {#key `${src}#${reload}`}
          <iframe {src} title={t('Anteprima dello streaming')} tabindex="-1"></iframe>
        {/key}
      {/if}
    </div>
    {#if src && reach === 'ok' && streaming.status !== 'live'}
      <p class="note">{t('Questa è la pagina che vede il pubblico: lo streaming ora è fermo.')}</p>
    {/if}
  {/if}
</aside>

<style>
  .preview {
    position: fixed;
    right: 1rem;
    bottom: 1rem;
    z-index: 5;
    width: 380px;
    border: 1px solid var(--ice-800);
    border-radius: 12px;
    overflow: hidden;
    background: var(--ice-900);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
  }

  .preview.collapsed {
    width: auto;
  }

  header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.4rem 0.35rem 0.75rem;
    font-size: 0.85rem;
  }

  header a {
    font-size: 0.8rem;
    color: var(--ice-300);
  }

  .spacer {
    flex: 1;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--ice-300);
    opacity: 0.5;
  }

  .dot.live {
    background: var(--ok);
    opacity: 1;
  }

  .screen {
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 16 / 9;
    background: #000;
  }

  iframe {
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
    /* Solo da guardare: i clic restano alla console. */
    pointer-events: none;
  }

  .screen p {
    margin: 0;
    padding: 1rem;
    font-size: 0.85rem;
    line-height: 1.45;
    text-align: center;
    color: var(--ice-300);
  }

  .screen p.warn {
    color: var(--warn);
  }

  .small {
    font-size: 0.78rem;
    color: var(--ice-300);
  }

  .note {
    margin: 0;
    padding: 0.4rem 0.75rem;
    font-size: 0.78rem;
    color: var(--ice-300);
  }
</style>
