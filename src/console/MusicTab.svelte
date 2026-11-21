<script lang="ts">
  import { onMount } from 'svelte'
  import { audio } from './audio.svelte'
  import type { ConfirmRequest } from './confirm'
  import HelpTip from './HelpTip.svelte'
  import { music } from './music.svelte'
  import { t } from '../i18n/ui.svelte'

  let {
    confirm,
    clockRunning,
  }: {
    confirm: (request: ConfirmRequest) => void
    /** Si sta giocando a tempo in moto: la musica parte da sola solo alle pause. */
    clockRunning: boolean
  } = $props()

  onMount(() => void music.check())

  const playing = $derived(!!music.current && !music.paused)
  const canPlay = $derived(
    music.settings.enabled && music.settings.tracks.length > 0 && !clockRunning && !playing,
  )

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
</script>

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

<div class="music-tab">
  <section class="panel">
    <h2 class="panel-title">
      {t('Musica')}
      <HelpTip title={t('Musica')}>
        {t(
          'Una playlist tua: trascina qui i file o sceglili dal computer. Il programma ricorda dove stanno, non ne fa una copia. Durante la partita la musica parte da sola alla sirena di fine periodo e 2 secondi dopo ogni stop del tempo (arbitro, timeout) e si ferma subito quando si gioca: le regole della partita vincono sempre. Prima della partita la musica parte solo con “Avvia musica” e si ferma da sola al via. Le tracce sono in ordine casuale e non si ripetono finché non sono state suonate tutte. Con “Riprendi canzone precedente” la traccia ferma a metà riprende da dove era. Se un file non si trova più compare ⚠: la traccia viene saltata e torna buona appena il file è di nuovo al suo posto.',
        )}
      </HelpTip>
    </h2>

    <div class="transport">
      <button
        type="button"
        class="btn"
        disabled={!canPlay}
        title={clockRunning ? t('Partita in corso') : undefined}
        onclick={() => music.play()}>▶ {t('Avvia musica')}</button
      >
      <button type="button" class="btn" disabled={!music.current} onclick={() => music.stop()}
        >⏹ {t('Ferma musica')}</button
      >
      <button type="button" class="btn" disabled={!playing} onclick={() => music.skip()}
        >⏭ {t('Traccia successiva')}</button
      >
      <button
        type="button"
        class="btn off-toggle {music.settings.enabled ? '' : 'btn-stop'}"
        title={t('Se disattivata, la musica non parte mai: né da sola né a mano.')}
        aria-pressed={!music.settings.enabled}
        onclick={() => music.setEnabled(!music.settings.enabled)}
      >
        {music.settings.enabled ? `🎵 ${t('Musica automatica')}` : `🚫 ${t('Musica disattivata')}`}
      </button>
    </div>
    {#if clockRunning}
      <p class="muted hint">{t('Si sta giocando: la musica parte da sola alle pause.')}</p>
    {/if}
    {#if audio.settings.muted}
      <p class="warn">
        {t('L’audio generale è disattivato (altoparlante in alto): la musica non si sente.')}
      </p>
    {/if}
    {#if music.error}<p class="warn">{t(music.error)}</p>{/if}

    <div class="music-options">
      <label class="check">
        <input
          type="checkbox"
          checked={music.settings.continueTrack}
          onchange={(e) => music.update({ continueTrack: e.currentTarget.checked })}
        />
        <span>{t('Riprendi canzone precedente')}</span>
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
            <small class="muted">{duration(track.seconds)}</small>
            <div class="actions">
              <button
                type="button"
                class="btn btn-sm"
                disabled={missing || clockRunning || !music.settings.enabled}
                title={clockRunning ? t('Partita in corso') : t('Suona questa traccia')}
                aria-label={t('Suona questa traccia')}
                onclick={() => void music.playTrack(track.id)}>▶</button
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
</div>

<style>
  .music-tab {
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

  .hint {
    margin: 0.6rem 0 0;
    font-size: 0.9rem;
  }

  .check {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    cursor: pointer;
  }

  .check input {
    flex: none;
    width: 18px;
    height: 18px;
  }

  .actions {
    display: flex;
    flex: none;
    gap: 0.4rem;
  }

  .off-toggle {
    margin-left: auto;
  }

  .music-options {
    margin-top: 0.75rem;
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
</style>
