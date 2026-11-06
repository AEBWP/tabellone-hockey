<script lang="ts">
  import appLogo from '../../build/icon.svg?url'
  import { isValidLiveName, liveLink, LIVE_DEFAULT_SERVICE, toLiveName } from '../shared/live'
  import { loadLogo, LOGO_ACCEPT } from '../shared/logo'
  import { t } from '../i18n/ui.svelte'
  import Modal from './Modal.svelte'
  import StreamPreview from './StreamPreview.svelte'
  import { downloadCanvas, drawQr } from './qr'
  import { streaming, StreamingError } from './streaming.svelte'

  const s = streaming

  let nameInput = $state(s.settings.name)
  const candidate = $derived(toLiveName(nameInput))
  const candidateValid = $derived(isValidLiveName(candidate))
  const changed = $derived(candidate !== s.settings.name)

  let message = $state<{ ok: boolean; text: string } | null>(null)
  let confirmChange = $state(false)
  let confirmRelease = $state(false)
  let serviceInput = $state(s.settings.service)
  let copied = $state(false)
  let canvas: HTMLCanvasElement | undefined = $state()
  let logoInput: HTMLInputElement | undefined = $state()

  const report = (e: unknown) => {
    message = {
      ok: false,
      text: t(e instanceof StreamingError || e instanceof Error ? e.message : String(e)),
    }
  }

  // Il QR code si ridisegna da solo quando cambiano link o logo.
  $effect(() => {
    const link = s.link
    const logo = s.settings.qrLogo ?? appLogo
    if (canvas && link) void drawQr(canvas, link, logo)
  })

  async function register() {
    message = null
    confirmChange = false
    try {
      await s.register(candidate)
      nameInput = s.settings.name
      message = { ok: true, text: t('Link e QR code pronti.') }
    } catch (e) {
      report(e)
    }
  }

  function askRegister() {
    if (s.settings.name) confirmChange = true
    else void register()
  }

  async function release() {
    confirmRelease = false
    await s.release()
    nameInput = ''
    message = { ok: true, text: t('Nome liberato: il link e il QR code non funzionano più.') }
  }

  async function saveService() {
    message = null
    try {
      await s.setService(serviceInput)
      serviceInput = s.settings.service
      nameInput = s.settings.name
    } catch (e) {
      report(e)
    }
  }

  async function copyLink() {
    if (!s.link) return
    try {
      await navigator.clipboard.writeText(s.link)
      copied = true
      setTimeout(() => (copied = false), 2000)
    } catch {
      message = { ok: false, text: t('Copia non riuscita: seleziona il link e copialo a mano.') }
    }
  }

  async function chooseLogo(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    try {
      s.setQrLogo(await loadLogo(file))
    } catch (e) {
      report(e)
    }
  }

  function saveQr() {
    if (canvas && s.settings.name) downloadCanvas(canvas, `qr-streaming-${s.settings.name}.png`)
    message = { ok: true, text: t('QR code salvato: lo trovi nella cartella dei download.') }
  }
</script>

<div class="streaming-tab">
  <section class="panel state" class:live={s.status === 'live'} class:warn={s.status === 'error'}>
    <div class="state-row">
      <span class="dot"></span>
      <strong>
        {#if s.status === 'live'}
          {t('Streaming in corso')}
        {:else if s.status === 'connecting'}
          {t('Avvio dello streaming…')}
        {:else if s.status === 'error'}
          {t('Streaming con problemi di collegamento')}
        {:else}
          {t('Streaming disabilitato')}
        {/if}
      </strong>
      <div class="spacer"></div>
      {#if s.active}
        <button type="button" class="btn btn-danger" disabled={s.busy} onclick={() => s.stop()}>
          {t('Ferma streaming')}
        </button>
      {:else}
        <button
          type="button"
          class="btn btn-primary"
          disabled={!s.link || s.busy}
          title={s.link ? '' : t('Prima registra un nome per il link')}
          onclick={() => s.start()}
        >
          {t('Avvia streaming')}
        </button>
      {/if}
    </div>
    {#if s.error && s.active}
      <p class="error-text">{t(s.error)} {t('Nuovo tentativo in automatico.')}</p>
    {/if}
    <p class="muted small">
      {t(
        'Lo streaming si può avviare anche prima della partita: chi apre il link vede una schermata di attesa finché non inizia. Chiudendo il programma lo streaming si ferma; alla riapertura va avviato di nuovo.',
      )}
    </p>
  </section>

  <section class="panel">
    <h2 class="panel-title">{t('Nome dello streaming')}</h2>
    <p>
      {@html t(
        'Di solito il nome del palaghiaccio. Diventa la <b>parte finale del link</b> che il pubblico apre per seguire la partita su internet:',
      )}
    </p>
    <p class="preview">
      {liveLink(s.settings.service, '')}<b>{candidate || '…'}</b>
    </p>
    <div class="row">
      <input
        class="input"
        type="text"
        maxlength="60"
        placeholder={t('es. Palaghiaccio Comunale')}
        aria-label={t('Nome dello streaming')}
        bind:value={nameInput}
        onkeydown={(e) => e.key === 'Enter' && candidateValid && changed && askRegister()}
      />
      <button
        type="button"
        class="btn btn-primary"
        disabled={!candidateValid || !changed || s.busy}
        onclick={askRegister}
      >
        {s.settings.name ? t('Cambia nome') : t('Genera link e QR code')}
      </button>
    </div>
    {#if nameInput && !candidateValid}
      <p class="muted small">{t('Nome non valido: usa da 3 a 40 lettere, numeri o trattini.')}</p>
    {/if}
  </section>

  {#if s.link}
    <section class="panel share">
      <div class="qr">
        <canvas bind:this={canvas} aria-label={t('QR code dello streaming')}></canvas>
      </div>
      <div class="share-text">
        <h2 class="panel-title">{t('Link e QR code')}</h2>
        <p class="link"><a href={s.link} target="_blank" rel="noreferrer">{s.link}</a></p>
        <div class="row">
          <button type="button" class="btn" onclick={copyLink}>
            {copied ? t('Copiato!') : t('Copia link')}
          </button>
          <button type="button" class="btn" onclick={saveQr}>{t('Salva QR code (PNG)')}</button>
        </div>
        <div class="row">
          <button type="button" class="btn btn-sm" onclick={() => logoInput?.click()}>
            {t('Logo personalizzato…')}
          </button>
          {#if s.settings.qrLogo}
            <button type="button" class="btn btn-sm btn-ghost" onclick={() => s.setQrLogo(null)}>
              {t('Usa il logo del programma')}
            </button>
          {/if}
          <input
            bind:this={logoInput}
            type="file"
            accept={LOGO_ACCEPT}
            hidden
            onchange={chooseLogo}
          />
        </div>
        <div class="disclaimer">
          <p>
            {@html t(
              'Il QR code porta a questo link, e il link è legato alla chiave segreta salvata su questo PC. <b>Finché non cambi nome, link e QR code restano sempre validi</b>: puoi stamparli e riusarli a ogni partita.',
            )}
          </p>
          <p>
            {t(
              'Quando lo streaming è fermo, chi apre il link vede il messaggio «Al momento non c’è nessuna partita in corso»; appena lo avvii, vede il tabellone in tempo reale.',
            )}
          </p>
          <p>
            {@html t(
              'Se cambi nome, <b>chi ha il link o il QR code vecchio non vedrà più lo streaming</b>. Il QR code si rigenera in automatico con il nuovo link.',
            )}
          </p>
        </div>
      </div>
    </section>
  {/if}

  {#if message}
    <p class="result" class:error={!message.ok} role="status">{message.text}</p>
  {/if}

  <details class="panel advanced">
    <summary>{t('Impostazioni avanzate')}</summary>
    <p class="muted small">
      {t(
        'Indirizzo del servizio online che riceve i dati. Cambialo solo se ne usi uno tuo: il nome andrà registrato di nuovo.',
      )}
    </p>
    <div class="row">
      <input
        class="input"
        type="url"
        aria-label={t('Indirizzo del servizio online')}
        placeholder={LIVE_DEFAULT_SERVICE}
        bind:value={serviceInput}
      />
      <button
        type="button"
        class="btn"
        disabled={s.busy || serviceInput.trim().replace(/\/+$/, '') === s.settings.service}
        onclick={saveService}>{t('Salva')}</button
      >
      <button
        type="button"
        class="btn btn-ghost"
        onclick={() => {
          serviceInput = LIVE_DEFAULT_SERVICE
        }}>{t('Predefinito')}</button
      >
    </div>
    {#if s.settings.name}
      <p class="muted small">
        {t('Non usi più lo streaming? Puoi liberare il nome, così potrà usarlo qualcun altro.')}
      </p>
      <button type="button" class="btn btn-sm btn-danger" onclick={() => (confirmRelease = true)}>
        {t('Libera il nome')}
      </button>
    {/if}
  </details>
</div>

<StreamPreview />

<Modal open={confirmChange} onclose={() => (confirmChange = false)} title={t('Cambiare nome?')}>
  <p>
    {@html t(
      'Il link diventerà <b>{link}</b>. Chi ha il link o il QR code vecchio non vedrà più lo streaming: dovrai condividere quelli nuovi.',
      { link: liveLink(s.settings.service, candidate) },
    )}
  </p>
  {#snippet actions()}
    <button type="button" class="btn" onclick={() => (confirmChange = false)}>{t('Annulla')}</button
    >
    <button type="button" class="btn btn-primary" onclick={register}>{t('Cambia nome')}</button>
  {/snippet}
</Modal>

<Modal
  open={confirmRelease}
  onclose={() => (confirmRelease = false)}
  title={t('Liberare il nome?')}
>
  <p>
    {t('Il link e il QR code smetteranno di funzionare e il nome potrà essere preso da altri.')}
  </p>
  {#snippet actions()}
    <button type="button" class="btn" onclick={() => (confirmRelease = false)}
      >{t('Annulla')}</button
    >
    <button type="button" class="btn btn-danger" onclick={release}>{t('Libera il nome')}</button>
  {/snippet}
</Modal>

<style>
  .streaming-tab {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 920px;
    /* Spazio per l'anteprima nell'angolo in basso. */
    padding-bottom: 260px;
  }

  p {
    margin: 0 0 0.75rem;
    line-height: 1.5;
  }

  .small {
    font-size: 0.88rem;
  }

  .state-row {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    margin-bottom: 0.75rem;
    font-size: 1.15rem;
    color: var(--ice-300);
  }

  .state.live .state-row {
    color: var(--ok);
  }

  .state.warn .state-row {
    color: var(--warn);
  }

  .state.live {
    border-color: var(--ok);
    box-shadow: 0 0 0 1px var(--ok) inset;
  }

  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: currentColor;
  }

  .state.live .dot {
    animation: pulse 1.6s ease-in-out infinite;
  }

  @keyframes pulse {
    50% {
      opacity: 0.35;
    }
  }

  .spacer {
    flex: 1;
  }

  .error-text {
    color: var(--warn);
  }

  .preview {
    padding: 0.55rem 0.8rem;
    border-radius: 8px;
    font-family: ui-monospace, monospace;
    font-size: 0.95rem;
    word-break: break-all;
    color: var(--ice-300);
    background: var(--ice-950);
  }

  .preview b {
    color: #fff;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    margin-bottom: 0.75rem;
  }

  .row .input {
    flex: 1;
    min-width: 260px;
  }

  .share {
    display: flex;
    gap: 1.5rem;
    align-items: flex-start;
  }

  .qr canvas {
    display: block;
    width: 240px;
    height: 240px;
    border-radius: 12px;
  }

  .share-text {
    flex: 1;
    min-width: 0;
  }

  .link {
    font-family: ui-monospace, monospace;
    font-size: 1.05rem;
    word-break: break-all;
  }

  .link a {
    color: #fff;
  }

  .disclaimer {
    margin-top: 0.5rem;
    padding: 0.75rem 0.9rem 0.1rem;
    border-left: 3px solid var(--ice-600);
    border-radius: 6px;
    font-size: 0.9rem;
    background: var(--ice-950);
  }

  .result {
    margin: 0;
    padding: 0.7rem 0.9rem;
    border-radius: 10px;
    background: rgba(60, 207, 122, 0.12);
    color: var(--ok);
  }

  .result.error {
    background: rgba(255, 77, 79, 0.12);
    color: #ff8a8c;
  }

  .advanced summary {
    font-weight: 600;
    cursor: pointer;
  }

  .advanced[open] summary {
    margin-bottom: 0.75rem;
  }
</style>
