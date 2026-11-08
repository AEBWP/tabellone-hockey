<script lang="ts">
  import { onMount } from 'svelte'
  import { audio } from './audio.svelte'
  import type { ConfirmRequest } from './confirm'
  import HelpTip from './HelpTip.svelte'
  import { music } from './music.svelte'
  import { t } from '../i18n/ui.svelte'
  import { SOUND_IDS, SOUND_LABELS, type SoundId } from './sound-events'

  let { confirm }: { confirm: (request: ConfirmRequest) => void } = $props()

  onMount(() => {
    if (audio.canChooseOutput) void audio.refreshOutputs()
    void music.check()
  })

  // ── Tracce audio ──────────────────────────────────────────────────────
  let trackInput: HTMLInputElement
  let dragging = $state(false)
  let adding = $state(false)
  let addResult = $state('')

  async function addTracks(files: File[]) {
    if (!files.length) return
    adding = true
    addResult = ''
    const { added, rejected } = await music.add(files)
    adding = false
    addResult = [
      added ? t('Tracce aggiunte: {n}.', { n: added }) : '',
      rejected.length ? t('Non riesco a usare: {names}.', { names: rejected.join(', ') }) : '',
    ]
      .filter(Boolean)
      .join(' ')
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    dragging = false
    void addTracks([...(event.dataTransfer?.files ?? [])])
  }

  function askClear() {
    confirm({
      title: t('Svuotare la playlist?'),
      message: t('Le tracce escono dalla playlist. I file sul computer non vengono toccati.'),
      confirmLabel: t('Svuota'),
      danger: true,
      action: () => music.clear(),
    })
  }

  function duration(seconds: number): string {
    if (!seconds) return ''
    const s = Math.round(seconds)
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  let errors = $state<Partial<Record<SoundId, string>>>({})
  let busy = $state<SoundId | null>(null)
  let fileInput: HTMLInputElement
  let target: SoundId | null = null

  function pickFile(id: SoundId) {
    target = id
    fileInput.value = ''
    fileInput.click()
  }

  async function onFile() {
    const file = fileInput.files?.[0]
    const id = target
    if (!file || !id) return
    busy = id
    errors = { ...errors, [id]: undefined }
    try {
      await audio.setCustom(id, file)
      audio.test(id)
    } catch (e) {
      errors = {
        ...errors,
        [id]: t(e instanceof Error ? e.message : 'Impossibile usare il file.'),
      }
    } finally {
      busy = null
    }
  }
</script>

<input
  bind:this={fileInput}
  type="file"
  accept="audio/*,.mp3,.wav,.ogg,.m4a"
  hidden
  onchange={() => void onFile()}
/>

<input
  bind:this={trackInput}
  type="file"
  multiple
  accept="audio/*,.mp3,.wav,.ogg,.opus,.m4a,.aac,.flac"
  hidden
  onchange={() => {
    void addTracks([...(trackInput.files ?? [])])
    trackInput.value = ''
  }}
/>

<div class="audio-tab">
  <section class="panel">
    <h2 class="panel-title">{t('Volume')}</h2>
    <div class="volume-row">
      <button
        type="button"
        class="btn {audio.settings.muted ? 'btn-stop' : ''}"
        onclick={() => audio.toggleMute()}
      >
        {audio.settings.muted ? `🔇 ${t('Audio disattivato')}` : `🔊 ${t('Audio attivo')}`}
        <kbd>M</kbd>
      </button>
      <input
        type="range"
        min="0"
        max="100"
        step="5"
        value={audio.settings.volume}
        oninput={(e) => audio.update({ volume: e.currentTarget.valueAsNumber })}
        aria-label={t('Volume')}
      />
      <strong class="value">{audio.settings.volume}%</strong>
    </div>
    {#if !audio.unlocked}
      <p class="warn">
        {t(
          'Il browser tiene l’audio in pausa finché non clicchi o premi un tasto nella console: basta un’azione qualsiasi.',
        )}
      </p>
    {/if}
  </section>

  <section class="panel">
    <h2 class="panel-title">
      {t('Suoni')}
      <HelpTip title={t('Suoni')}>
        {t(
          'I suoni partono da soli al momento giusto. Togli la spunta per quelli che non vuoi (es. se il palazzetto ha già una sua sirena). “Prova” li fa sentire anche se sono disattivati. Con “Carica file…” puoi usare una tua registrazione (es. la sirena vera del palazzetto, in MP3 o WAV): resta salvata nel programma e funziona anche senza internet. “Ripristina” torna al suono incluso.',
        )}
      </HelpTip>
    </h2>
    <ul class="sounds">
      {#each SOUND_IDS as id (id)}
        <li>
          <label class="check">
            <input
              type="checkbox"
              checked={audio.settings.enabled[id]}
              onchange={(e) => audio.setEnabled(id, e.currentTarget.checked)}
            />
            <span>
              <strong>{t(SOUND_LABELS[id].name)}</strong>
              <small class="muted">{t(SOUND_LABELS[id].description)}</small>
              {#if audio.settings.custom[id]}
                <small class="custom">🎵 {audio.settings.custom[id]}</small>
              {/if}
              {#if errors[id]}<small class="error">{errors[id]}</small>{/if}
            </span>
          </label>
          <div class="actions">
            <button type="button" class="btn btn-sm" onclick={() => audio.test(id)}
              >▶ {t('Prova')}</button
            >
            {#if audio.settings.custom[id]}
              <button
                type="button"
                class="btn btn-sm"
                title={t('Torna al suono incluso nel programma')}
                onclick={() => void audio.removeCustom(id)}>{t('Ripristina')}</button
              >
            {:else}
              <button
                type="button"
                class="btn btn-sm"
                title={t('Usa un tuo file audio (MP3, WAV, OGG)')}
                disabled={busy === id}
                onclick={() => pickFile(id)}
                >{busy === id ? t('Carico…') : t('Carica file…')}</button
              >
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  </section>

  <section class="panel">
    <h2 class="panel-title">
      {t('Tracce audio')}
      <HelpTip title={t('Tracce audio')}>
        {t(
          'Una playlist tua: trascina qui i file o sceglili dal computer. Il programma ricorda dove stanno, non ne fa una copia. Dopo la sirena di fine periodo parte sempre la traccia successiva, mai quella interrotta, e a fine intervallo la musica sfuma da sola. Se un file non si trova più compare ⚠: la traccia viene saltata e torna buona appena il file è di nuovo al suo posto.',
        )}
      </HelpTip>
    </h2>

    <div class="music-options">
      <label class="check">
        <input
          type="checkbox"
          checked={music.settings.enabled}
          onchange={(e) => music.setEnabled(e.currentTarget.checked)}
        />
        <span>{t('Musica negli intervalli')}</span>
      </label>
      <label class="check">
        <input
          type="checkbox"
          checked={music.settings.shuffle}
          onchange={(e) => music.update({ shuffle: e.currentTarget.checked })}
        />
        <span>{t('Ordine casuale')}</span>
      </label>
    </div>

    <div class="volume-row music-volume">
      <span>{t('Volume delle tracce')}</span>
      <input
        type="range"
        min="0"
        max="100"
        step="5"
        value={music.settings.volume}
        oninput={(e) => music.update({ volume: e.currentTarget.valueAsNumber })}
        aria-label={t('Volume delle tracce')}
      />
      <strong class="value">{music.settings.volume}%</strong>
    </div>

    <div class="transport">
      {#if music.current}
        <button type="button" class="btn btn-sm" onclick={() => music.skip()}
          >⏭ {t('Traccia successiva')}</button
        >
        <button type="button" class="btn btn-sm" onclick={() => music.stop()}
          >⏹ {t('Ferma musica')}</button
        >
      {:else}
        <button
          type="button"
          class="btn btn-sm"
          disabled={!music.settings.tracks.length}
          onclick={() => music.play()}>▶ {t('Avvia musica')}</button
        >
      {/if}
      {#if music.settings.tracks.length}
        <button type="button" class="btn btn-sm" onclick={askClear}>{t('Svuota playlist')}</button>
      {/if}
    </div>
    {#if music.error}<p class="warn">{t(music.error)}</p>{/if}

    <div
      class="dropzone"
      class:dragging
      role="group"
      aria-label={t('Tracce audio')}
      ondragover={(e) => {
        e.preventDefault()
        dragging = true
      }}
      ondragleave={() => (dragging = false)}
      ondrop={onDrop}
    >
      <span>{t('Trascina qui i file audio, oppure')}</span>
      <button type="button" class="btn btn-sm" disabled={adding} onclick={() => trackInput.click()}
        >{adding ? t('Carico…') : t('Scegli file…')}</button
      >
    </div>
    {#if addResult}<p class="muted add-result" role="status">{addResult}</p>{/if}

    {#if music.settings.tracks.length}
      <ol class="tracks">
        {#each music.settings.tracks as track, i (track.id)}
          {@const missing = music.missing.has(track.id)}
          <li class:missing class:playing={music.current?.id === track.id}>
            {#if missing}
              <span
                class="track-mark warn-icon"
                role="img"
                aria-label={t(
                  'File non raggiungibile: la traccia viene saltata finché non torna disponibile.',
                )}
                title={t(
                  'File non raggiungibile: la traccia viene saltata finché non torna disponibile.',
                )}>⚠</span
              >
            {:else}
              <span class="track-mark">{music.current?.id === track.id ? '🎵' : i + 1}</span>
            {/if}
            <span class="track-name" title={track.path ?? track.name}>{track.name}</span>
            {#if music.nextId === track.id && !music.current}
              <small class="next-tag">{t('Prossima')}</small>
            {/if}
            <small class="muted">{duration(track.seconds)}</small>
            <div class="actions">
              <button
                type="button"
                class="btn btn-sm"
                disabled={i === 0}
                title={t('Sposta su')}
                aria-label={t('Sposta su')}
                onclick={() => music.move(track.id, -1)}>↑</button
              >
              <button
                type="button"
                class="btn btn-sm"
                disabled={i === music.settings.tracks.length - 1}
                title={t('Sposta giù')}
                aria-label={t('Sposta giù')}
                onclick={() => music.move(track.id, 1)}>↓</button
              >
              <button
                type="button"
                class="btn btn-sm"
                title={t('Togli dalla playlist')}
                aria-label={t('Togli dalla playlist')}
                onclick={() => music.remove(track.id)}>✕</button
              >
            </div>
          </li>
        {/each}
      </ol>
    {:else}
      <p class="muted add-result">{t('La playlist è vuota.')}</p>
    {/if}
  </section>

  <section class="panel">
    <h2 class="panel-title">
      {t('Uscita audio')}
      <HelpTip title={t('Uscita audio')}>
        {t(
          'Scegli dove mandare i suoni: le casse del palazzetto, l’uscita HDMI del maxischermo o quella predefinita di Windows. Se l’elenco mostra solo nomi generici, prova le uscite con “Prova”.',
        )}
      </HelpTip>
    </h2>
    {#if audio.canChooseOutput}
      <div class="output-row">
        <select
          class="input"
          value={audio.settings.outputId}
          onchange={(e) => void audio.setOutput(e.currentTarget.value)}
        >
          <option value="">{t('Predefinita di Windows')}</option>
          {#each audio.outputs as o (o.id)}
            <option value={o.id}>{o.label}</option>
          {/each}
        </select>
        <button type="button" class="btn" onclick={() => void audio.refreshOutputs()}
          >{t('Aggiorna')}</button
        >
      </div>
      {#if audio.outputError}<p class="warn">{t(audio.outputError)}</p>{/if}
    {:else}
      <p class="muted">
        {t(
          'Questo browser usa sempre l’uscita predefinita di Windows. Nella versione installabile del programma si potrà scegliere l’uscita.',
        )}
      </p>
    {/if}
  </section>
</div>

<style>
  .audio-tab {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 760px;
  }

  .volume-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
  }

  input[type='range'] {
    flex: 1;
    min-width: 180px;
    accent-color: var(--ice-600);
  }

  .value {
    min-width: 3.5ch;
    font-variant-numeric: tabular-nums;
  }

  .warn {
    margin: 0.75rem 0 0;
    color: var(--warn);
  }

  .sounds {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .sounds li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.5rem 0.65rem;
    border-radius: 10px;
    background: var(--ice-950);
  }

  .check {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    cursor: pointer;
  }

  .check input {
    width: 18px;
    height: 18px;
  }

  .check span {
    display: flex;
    flex-direction: column;
  }

  .custom {
    color: var(--ice-50);
  }

  .error {
    color: var(--warn);
  }

  .actions {
    display: flex;
    flex: none;
    gap: 0.4rem;
  }

  .output-row {
    display: flex;
    gap: 0.5rem;
  }

  .music-options {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem 1.5rem;
  }

  .music-volume {
    margin-top: 0.75rem;
  }

  .transport {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.75rem;
  }

  .dropzone {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    margin-top: 0.75rem;
    padding: 1.1rem;
    border: 2px dashed var(--ice-600);
    border-radius: 10px;
  }

  .dropzone.dragging {
    background: color-mix(in srgb, var(--ice-600) 20%, transparent);
  }

  .add-result {
    margin: 0.6rem 0 0;
    font-size: 0.9rem;
  }

  .tracks {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    margin: 0.75rem 0 0;
    padding: 0;
    list-style: none;
  }

  .tracks li {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.3rem 0.65rem;
    border-radius: 10px;
    background: var(--ice-950);
  }

  .tracks li.playing {
    outline: 1px solid var(--ok);
  }

  .tracks li.missing .track-name {
    opacity: 0.55;
  }

  .track-mark {
    flex: none;
    width: 1.6rem;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .warn-icon {
    color: var(--warn);
    cursor: help;
  }

  .track-name {
    flex: 1;
    overflow: hidden;
    min-width: 0;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .next-tag {
    flex: none;
    color: var(--ok);
  }
</style>
