<script lang="ts">
  import { onMount } from 'svelte'
  import { desktop, type ScreenItem } from '../shared/desktop'
  import { LANGUAGES, type Language } from '../engine/types'
  import { LANGUAGE_NAMES, requestBoardLanguage, t, ui } from '../i18n/ui.svelte'

  let screens = $state<ScreenItem[]>([])
  let consoleId = $state<number | null>(null)
  /** Schermi del tabellone: uno o più, con lo stesso tabellone su tutti. */
  let displayIds = $state<number[]>([])
  /** Schermi del tabellone girati verso la console: destra e sinistra rovesciate. */
  let mirrorIds = $state<number[]>([])

  /**
   * Lingua all'apertura: se l'operatore la cambia qui (o al primo avvio) diventa
   * anche la lingua del tabellone. Riaprendo la scelta degli schermi senza
   * cambiarla, il tabellone resta nella lingua scelta dalla console.
   */
  const initialLanguage = ui.lang
  const firstTime = ui.firstTime

  /**
   * Passi del wizard: lingua, schermi, verso di ogni tabellone rispetto al pubblico.
   * Il passo della lingua c'è solo al primo avvio; dopo basta il menu negli schermi.
   */
  const ALL_STEPS = ['language', 'screens', 'sides'] as const
  type Step = (typeof ALL_STEPS)[number]
  const STEPS: readonly Step[] = firstTime ? ALL_STEPS : ALL_STEPS.slice(1)
  const STEP_LABELS: Record<Step, string> = {
    language: 'Lingua',
    screens: 'Schermi',
    sides: 'Posizione',
  }
  let step = $state<Step>(STEPS[0])
  const stepIndex = $derived(STEPS.indexOf(step))

  /** Salva le preferenze: vale per tutto il wizard, di base acceso. */
  let remember = $state(true)
  let starting = $state(false)
  let error = $state<string | null>(null)

  let loaded = false

  /**
   * Elenco degli schermi (si ricarica ogni pochi secondi). La scelta salvata si
   * usa solo la prima volta: dopo resta quella dell'operatore, tolti gli schermi
   * scollegati.
   */
  async function load() {
    if (!desktop) return
    const data = await desktop.listScreens()
    screens = data.screens
    const connected = new Set(screens.map((s) => s.id))
    const first = !loaded
    if (first) {
      loaded = true
      remember = data.remember
      consoleId = data.choice?.consoleId ?? null
      displayIds = data.choice?.displayIds ?? []
      mirrorIds = data.choice?.mirrorIds ?? []
    }
    if (consoleId === null || !connected.has(consoleId)) consoleId = screens[0]?.id ?? null
    const kept = displayIds.filter((id) => connected.has(id))
    // Rimasti senza schermi per il tabellone perché scollegati: si propone il primo.
    // Se invece l'operatore ha tolto tutte le spunte, si lascia così.
    if (kept.length !== displayIds.length || (first && kept.length === 0)) {
      displayIds = kept.length || !screens[0] ? kept : [screens[0].id]
    }
  }

  onMount(() => {
    void load()
    // Se si collega o scollega uno schermo mentre questa finestra è aperta.
    const timer = setInterval(load, 3000)
    return () => clearInterval(timer)
  })

  // Disegno in scala degli schermi, disposti come in Windows.
  const layout = $derived.by(() => {
    if (!screens.length) return null
    const minX = Math.min(...screens.map((s) => s.bounds.x))
    const minY = Math.min(...screens.map((s) => s.bounds.y))
    const maxX = Math.max(...screens.map((s) => s.bounds.x + s.bounds.width))
    const maxY = Math.max(...screens.map((s) => s.bounds.y + s.bounds.height))
    return { minX, minY, width: maxX - minX, height: maxY - minY }
  })

  const single = $derived(screens.length === 1)

  /** "Schermo 1 (principale) – DELL U2419H" nella lingua scelta. */
  const screenTitle = (s: ScreenItem) =>
    [t('Schermo {n}', { n: s.number }), s.primary ? t('(principale)') : '']
      .filter(Boolean)
      .join(' ') + (s.label ? ` – ${s.label}` : '')

  /** Schermi del tabellone nell'ordine dell'elenco (da sinistra a destra). */
  const displays = $derived(screens.filter((s) => displayIds.includes(s.id)))

  function setMirror(id: number, on: boolean) {
    mirrorIds = on ? [...new Set([...mirrorIds, id])] : mirrorIds.filter((m) => m !== id)
  }

  async function start() {
    if (!desktop || consoleId === null || displayIds.length === 0) return
    starting = true
    error = null
    // Salvata anche la lingua (la console la tiene comunque): diventa quella iniziale del tabellone.
    ui.set(ui.lang)
    if (firstTime || ui.lang !== initialLanguage) requestBoardLanguage(ui.lang)
    const ok = await desktop.startWithScreens({
      consoleId,
      displayIds: $state.snapshot(displayIds),
      mirrorIds: mirrorIds.filter((id) => displayIds.includes(id)),
      remember,
    })
    if (!ok) {
      error = t('Uno degli schermi scelti non è più collegato. Riprova.')
      starting = false
      step = 'screens'
      await load()
    }
  }
</script>

<main>
  <header>
    <div class="title-row">
      <h1>Tabellone Hockey <small class="version">v{__APP_VERSION__}</small></h1>
      {#if !firstTime && step === 'screens'}
        <label class="lang-menu">
          {t('Lingua')}
          <select
            value={ui.lang}
            aria-label={t('Lingua della console')}
            onchange={(e) => ui.set(e.currentTarget.value as Language)}
          >
            {#each LANGUAGES as l (l)}
              <option value={l}>{LANGUAGE_NAMES[l]}</option>
            {/each}
          </select>
        </label>
      {/if}
    </div>
    <ol class="steps">
      {#each STEPS as s, i (s)}
        <li class:current={s === step} class:done={i < stepIndex}>
          <span class="step-num">{i < stepIndex ? '✓' : i + 1}</span>
          {t(STEP_LABELS[s])}
        </li>
      {/each}
    </ol>
  </header>

  {#if step === 'language'}
    <section class="language">
      <h2>{t('Scegli la lingua')}</h2>
      <p class="muted">
        {t(
          'È la lingua della console e anche quella iniziale del tabellone. Potrai cambiarle in qualsiasi momento dalla console.',
        )}
      </p>
      <div class="lang-grid" role="radiogroup" aria-label={t('Lingua della console')}>
        {#each LANGUAGES as l (l)}
          <label class="option lang-option" class:selected={ui.lang === l}>
            <input
              type="radio"
              name="language"
              value={l}
              checked={ui.lang === l}
              onchange={() => ui.set(l as Language)}
            />
            <span class="lang-code">{l.toUpperCase()}</span>
            <strong>{LANGUAGE_NAMES[l]}</strong>
            {#if ui.lang === l}<span class="check" aria-hidden="true">✓</span>{/if}
          </label>
        {/each}
      </div>
    </section>
  {:else if !desktop}
    <p class="warn">{t('Questa schermata funziona solo nel programma installato.')}</p>
  {:else if !screens.length}
    <p class="muted">{t('Ricerca degli schermi…')}</p>
  {:else if step === 'sides'}
    <section class="sides">
      <h2>{t('Posizione rispetto al pubblico')}</h2>
      <p class="muted">
        {t(
          'Così la squadra che il pubblico vede giocare a sinistra è a sinistra anche sul tabellone. Per ogni schermo scegli come è girato rispetto a te, seduto alla console con la faccia verso il campo.',
        )}
      </p>
      {#each displays as d (d.id)}
        {@const mirror = mirrorIds.includes(d.id)}
        <fieldset class="side-card">
          <legend><span class="tag display">{t('Tabellone')}</span> {screenTitle(d)}</legend>
          <div class="side-options">
            <label class="option side" class:selected={!mirror}>
              <input
                type="radio"
                name="side-{d.id}"
                checked={!mirror}
                onchange={() => setMirror(d.id, false)}
              />
              <span>
                <strong>{t('Come la console')}</strong>
                <small>
                  {t(
                    'Lo schermo è davanti a te, dall’altra parte del campo: il pubblico guarda nella tua stessa direzione.',
                  )}
                </small>
                <span class="sides-demo" aria-hidden="true">
                  <span class="home">{t('Casa')}</span><span class="away">{t('Ospiti')}</span>
                </span>
              </span>
            </label>
            <label class="option side" class:selected={mirror}>
              <input
                type="radio"
                name="side-{d.id}"
                checked={mirror}
                onchange={() => setMirror(d.id, true)}
              />
              <span>
                <strong>{t('Specchiato')}</strong>
                <small>
                  {t(
                    'Lo schermo è alle tue spalle o sopra di te, girato verso il pubblico di fronte: destra e sinistra si scambiano.',
                  )}
                </small>
                <span class="sides-demo" aria-hidden="true">
                  <span class="away">{t('Ospiti')}</span><span class="home">{t('Casa')}</span>
                </span>
              </span>
            </label>
          </div>
        </fieldset>
      {/each}
      <p class="muted hint">
        {t(
          'Con “Inverti squadre” (sopra il tempo, nella console) o con il cambio campo del regolamento, tutti i tabelloni si girano di conseguenza.',
        )}
      </p>
    </section>
  {:else}
    <p class="muted">
      {t('Scegli dove mostrare la console dell’operatore e dove il tabellone per il pubblico.')}
    </p>
    {#if layout}
      <div class="map" style:aspect-ratio="{layout.width} / {layout.height}">
        {#each screens as s (s.id)}
          <div
            class="screen"
            class:is-console={s.id === consoleId}
            class:is-display={displayIds.includes(s.id)}
            style:left="{((s.bounds.x - layout.minX) / layout.width) * 100}%"
            style:top="{((s.bounds.y - layout.minY) / layout.height) * 100}%"
            style:width="{(s.bounds.width / layout.width) * 100}%"
            style:height="{(s.bounds.height / layout.height) * 100}%"
          >
            <span class="num">{s.number}</span>
            <span class="res">{s.resolution}</span>
            <span class="roles">
              {#if s.id === consoleId}<span class="tag console">{t('Console')}</span>{/if}
              {#if displayIds.includes(s.id)}<span class="tag display">{t('Tabellone')}</span>{/if}
            </span>
          </div>
        {/each}
      </div>
    {/if}

    <button type="button" class="btn identify" onclick={() => desktop?.identifyScreens()}>
      {t('Mostra il numero su ogni schermo')}
    </button>

    <div class="choices">
      <fieldset>
        <legend><span class="tag console">{t('Console')}</span> {t('per l’operatore')}</legend>
        {#each screens as s (s.id)}
          <label class="option" class:selected={s.id === consoleId}>
            <input type="radio" name="console" value={s.id} bind:group={consoleId} />
            <span>
              <strong>{screenTitle(s)}</strong>
              <small>{s.resolution}</small>
            </span>
          </label>
        {/each}
      </fieldset>

      <fieldset>
        <legend>
          <span class="tag display">{t('Tabellone')}</span>
          {t('per il pubblico (maxischermo)')}
        </legend>
        {#if !single}
          <p class="multi">
            {t('Puoi sceglierne anche più di uno: il tabellone sarà identico su tutti.')}
          </p>
        {/if}
        {#each screens as s (s.id)}
          <label class="option" class:selected={displayIds.includes(s.id)}>
            <input type="checkbox" name="display" value={s.id} bind:group={displayIds} />
            <span>
              <strong>{screenTitle(s)}</strong>
              <small>{s.resolution}</small>
            </span>
          </label>
        {/each}
      </fieldset>
    </div>

    {#if single}
      <p class="note">
        {t(
          'È collegato un solo schermo: il tabellone si aprirà in una finestra normale, comoda per le prove. Collega il maxischermo per averlo a schermo intero.',
        )}
      </p>
    {:else if consoleId !== null && displayIds.includes(consoleId)}
      <p class="note">
        {t(
          'Console e tabellone sullo stesso schermo: lì il tabellone si aprirà in una finestra normale.',
        )}
      </p>
    {/if}
  {/if}

  <!-- Piede comune a tutti i passi: "Salva preferenze" vale per l'intero wizard. -->
  <footer>
    {#if error}<p class="error">{error}</p>{/if}
    {#if step === 'screens' && screens.length && displayIds.length === 0}
      <p class="error">{t('Scegli almeno uno schermo per il tabellone.')}</p>
    {/if}
    <div class="footer-row">
      {#if stepIndex > 0}
        <button type="button" class="btn" onclick={() => (step = STEPS[stepIndex - 1])}>
          ← {t('Indietro')}
        </button>
      {/if}
      <label class="remember">
        <input type="checkbox" bind:checked={remember} />
        <span>
          <strong>{t('Salva preferenze')}</strong>
          <small>
            {t(
              'Lingua, schermi e posizione restano salvati e la prossima volta il tabellone parte subito.',
            )}
          </small>
        </span>
      </label>
      {#if step === 'sides'}
        <button type="button" class="btn btn-primary start" disabled={starting} onclick={start}>
          {starting ? t('Avvio…') : t('Avvia il tabellone')}
        </button>
      {:else}
        <button
          type="button"
          class="btn btn-primary start"
          disabled={step === 'screens' && (!desktop || !screens.length || displayIds.length === 0)}
          onclick={() => (step = STEPS[stepIndex + 1])}
        >
          {t('Avanti')} →
        </button>
      {/if}
    </div>
    <p class="muted hint">
      {@html t(
        'Potrai cambiare la scelta in qualsiasi momento dalla console, in <b>Impostazioni → Schermi</b>.',
      )}
    </p>
  </footer>
</main>

<style>
  .title-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem 1rem;
  }

  /* Lingua dopo il primo avvio: un menu piccolo, in disparte. */
  .lang-menu {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.85rem;
    color: var(--ice-300);
  }

  .lang-menu select {
    padding: 0.2rem 0.4rem;
    border: 1px solid var(--ice-800);
    border-radius: 6px;
    background: var(--ice-900);
    color: inherit;
    font: inherit;
  }

  /* Passi del wizard: Lingua (solo al primo avvio) · Schermi · Posizione. */
  .steps {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.4rem;
    margin: 0.5rem 0 0;
    padding: 0;
    list-style: none;
    color: var(--ice-300);
  }

  .steps li {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-weight: 600;
  }

  .step-num {
    display: inline-grid;
    place-items: center;
    width: 1.6rem;
    height: 1.6rem;
    border: 2px solid var(--ice-700, #2a4a6e);
    border-radius: 50%;
    font-size: 0.85rem;
  }

  .steps li.current {
    color: var(--ice-50, #fff);
  }

  .steps li.current .step-num {
    border-color: var(--ice-400, #5aa0e6);
    background: var(--ice-600, #2f6fb2);
  }

  .steps li.done .step-num {
    border-color: #3ccf7a;
    color: #3ccf7a;
  }

  .language {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .language h2 {
    margin: 0;
    font-size: 1.2rem;
  }

  .language > p {
    margin: 0;
  }

  /* Elenco verticale, una lingua per riga, come nella prima configurazione di un sistema operativo. */
  .lang-grid {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 460px;
    margin: 0.25rem auto 0;
    border: 1px solid var(--ice-800);
    border-radius: 12px;
    background: var(--ice-900);
    overflow: hidden;
  }

  .option.lang-option {
    flex-direction: row;
    gap: 0.85rem;
    padding: 0.8rem 1.1rem;
    border: none;
    border-left: 4px solid transparent;
    border-radius: 0;
    background: transparent;
    font-size: 1.1rem;
  }

  .option.lang-option + .option.lang-option {
    border-top: 1px solid var(--ice-800);
  }

  .option.lang-option:hover {
    background: var(--ice-800);
  }

  .option.lang-option.selected {
    border-left-color: var(--ice-400, #5aa0e6);
    background: color-mix(in srgb, var(--ice-600, #2f6fb2) 35%, transparent);
  }

  /* Il pallino della scelta resta per la tastiera, ma non si vede: basta la riga evidenziata. */
  .option.lang-option input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .option.lang-option:focus-within {
    outline: 2px solid var(--ice-400, #5aa0e6);
    outline-offset: -2px;
  }

  .check {
    margin-left: auto;
    color: #3ccf7a;
    font-weight: 800;
  }

  .option .lang-code {
    display: inline-block;
    width: 2.3rem;
    text-align: center;
  }

  .lang-code {
    padding: 0.15rem 0.45rem;
    border-radius: 6px;
    background: var(--ice-800);
    font-size: 0.8rem;
    font-weight: 800;
    letter-spacing: 0.05em;
  }

  main {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    max-width: 900px;
    margin: 0 auto;
    padding: 1.25rem 2rem 1.5rem;
  }

  .version {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--ice-300);
  }

  header h1 {
    margin: 0;
    font-size: 1.6rem;
  }

  /* Altezza fissa e compatta: la larghezza segue le proporzioni degli schermi. */
  .map {
    position: relative;
    height: 170px;
    max-width: 100%;
    margin: 0 auto;
  }

  .screen {
    position: absolute;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.2rem;
    border: 3px solid #23476e;
    border-radius: 8px;
    background: var(--ice-900);
    outline: 4px solid var(--ice-950);
    overflow: hidden;
    /* Gli schermi piccoli nel disegno mostrano meno cose (vedi @container sotto). */
    container-type: size;
  }

  .screen.is-console {
    border-color: #3ccf7a;
  }

  .screen.is-display {
    border-color: #ffb020;
  }

  .num {
    font-size: 2.6rem;
    font-weight: 800;
    line-height: 1;
  }

  .res {
    font-size: 0.8rem;
    color: var(--ice-300);
  }

  .roles {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.2rem 0.3rem;
    padding: 0 0.2rem;
  }

  /* Schermo piccolo nel disegno (es. portatile accanto a un maxischermo grande):
     numero più piccolo, niente risoluzione, così le etichette ci stanno. */
  @container (max-height: 110px) {
    .num {
      font-size: 1.6rem;
    }

    .res {
      display: none;
    }

    .roles .tag {
      padding: 0 0.35rem;
      font-size: 0.65rem;
    }
  }

  .tag {
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 700;
    color: #06121f;
  }

  .tag.console {
    background: #3ccf7a;
  }

  .tag.display {
    background: #ffb020;
  }

  .identify {
    align-self: center;
  }

  .choices {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  fieldset {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 0;
    padding: 1rem;
    border: 1px solid var(--ice-800);
    border-radius: 14px;
    background: var(--ice-900);
  }

  legend {
    padding: 0 0.4rem;
    font-weight: 600;
  }

  .multi {
    margin: 0 0 0.4rem;
    font-size: 0.85rem;
    color: var(--ice-300, #9cc3ea);
  }

  .option {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.6rem 0.75rem;
    border: 2px solid transparent;
    border-radius: 10px;
    background: var(--ice-950);
    cursor: pointer;
  }

  .option.selected {
    border-color: var(--ice-600);
  }

  .option span {
    display: flex;
    flex-direction: column;
  }

  .option small {
    color: var(--ice-300);
  }

  .option input {
    width: 18px;
    height: 18px;
  }

  .note {
    margin: 0;
    padding: 0.7rem 0.9rem;
    border-radius: 10px;
    background: rgba(255, 176, 32, 0.12);
    color: #ffd166;
  }

  /* Piede fisso in fondo a tutti i passi, separato dal contenuto. */
  footer {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    margin-top: 0.4rem;
    padding-top: 0.9rem;
    border-top: 1px solid var(--ice-800);
  }

  footer p {
    margin: 0;
  }

  .footer-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
  }

  .remember {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-width: 260px;
    padding: 0.55rem 0.8rem;
    border: 1px solid var(--ice-800);
    border-radius: 10px;
    background: var(--ice-900);
    cursor: pointer;
  }

  .remember > span {
    display: flex;
    flex-direction: column;
  }

  .remember small {
    color: var(--ice-300);
    font-size: 0.82rem;
  }

  .remember input {
    flex: none;
    width: 20px;
    height: 20px;
  }

  .start {
    padding: 0.85rem 1.6rem;
    font-size: 1.15rem;
  }

  .sides {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .sides h2 {
    margin: 0;
    font-size: 1.2rem;
  }

  .sides > p {
    margin: 0;
  }

  .side-options {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .option.side {
    align-items: flex-start;
  }

  .option.side > span {
    gap: 0.3rem;
  }

  /* Disegnino: come si vedranno le squadre su quello schermo (casa a sinistra in console). */
  .option .sides-demo {
    display: flex;
    flex-direction: row;
    margin-top: 0.3rem;
    border-radius: 6px;
    overflow: hidden;
    font-size: 0.8rem;
    font-weight: 700;
  }

  .sides-demo span {
    flex: 1;
    padding: 0.25rem 0.5rem;
    text-align: center;
    color: #fff;
  }

  .sides-demo .home {
    background: #d62839;
  }

  .sides-demo .away {
    background: #1f6feb;
  }

  .error,
  .warn {
    color: #ff8a8c;
  }

  .hint {
    margin: 0;
    font-size: 0.88rem;
  }
</style>
