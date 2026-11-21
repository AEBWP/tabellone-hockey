<script lang="ts">
  import { onMount } from 'svelte'
  import { audio } from './audio.svelte'
  import type { ConfirmRequest } from './confirm'
  import HelpTip from './HelpTip.svelte'
  import { t } from '../i18n/ui.svelte'
  import { SOUND_IDS, SOUND_LABELS, type SoundId } from './sound-events'
  import { SOUND_PRESETS, type SoundSource } from './sound-presets'

  let { confirm }: { confirm: (request: ConfirmRequest) => void } = $props()

  onMount(() => {
    if (audio.canChooseOutput) void audio.refreshOutputs()
  })

  // ── Suoni ─────────────────────────────────────────────────────────────
  /** Valore della voce "Carica file…" del menu: non è una sorgente. */
  const UPLOAD = '__upload__'

  let errors = $state<Partial<Record<SoundId, string>>>({})
  let busy = $state<SoundId | null>(null)
  let fileInput: HTMLInputElement
  let target: SoundId | null = null

  function showError(id: SoundId, e: unknown, fallback: string) {
    errors = { ...errors, [id]: t(e instanceof Error ? e.message : fallback) }
  }

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
      showError(id, e, 'Impossibile usare il file.')
    } finally {
      busy = null
    }
  }

  async function chooseSource(id: SoundId, select: HTMLSelectElement) {
    const value = select.value
    // Il menu torna sempre alla sorgente attiva: cambia solo se la scelta riesce.
    select.value = audio.sourceOf(id)
    if (value === UPLOAD) {
      pickFile(id)
      return
    }
    busy = id
    errors = { ...errors, [id]: undefined }
    try {
      await audio.setSource(id, value as SoundSource)
    } catch (e) {
      showError(id, e, 'Impossibile usare il suono scelto.')
    } finally {
      busy = null
      select.value = audio.sourceOf(id)
    }
  }

  function askRemoveCustom(id: SoundId) {
    const name = audio.settings.custom[id]
    if (!name) return
    confirm({
      title: t('Eliminare il file personale?'),
      message: t(
        '“{name}” viene cancellato dal programma (il file sul computer resta). Se era il suono in uso, si torna a quello sintetizzato.',
        { name },
      ),
      confirmLabel: t('Elimina'),
      danger: true,
      action: () => {
        errors = { ...errors, [id]: undefined }
        void audio.removeCustom(id)
      },
    })
  }
</script>

<input
  bind:this={fileInput}
  type="file"
  accept="audio/*,.mp3,.wav,.ogg,.m4a"
  hidden
  onchange={() => void onFile()}
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
          'I suoni partono da soli al momento giusto. Togli la spunta per quelli che non vuoi (es. se il palazzetto ha già una sua sirena). Dal menu di ogni suono scegli cosa far sentire: il suono sintetizzato, uno dei suoni inclusi (trombe, sirena, cicalini, campanella: in cima quelli più adatti) oppure un file personale con “Carica file…” (es. la sirena vera del palazzetto, in MP3 o WAV). Tutto resta salvato nel programma e funziona anche senza internet. “Prova” fa sentire il suono scelto anche se è disattivato; 🗑 cancella il file personale.',
        )}
      </HelpTip>
    </h2>
    <ul class="sounds">
      {#each SOUND_IDS as id (id)}
        {@const customName = audio.settings.custom[id]}
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
            </span>
          </label>
          <div class="sound-controls">
            <select
              class="input source"
              value={audio.sourceOf(id)}
              disabled={busy === id}
              aria-label={`${t('Suono')}: ${t(SOUND_LABELS[id].name)}`}
              title={t('Suono')}
              onchange={(e) => void chooseSource(id, e.currentTarget)}
            >
              <option value="synth">{t('Incluso (sintetizzato)')}</option>
              {#each SOUND_PRESETS as preset (preset.id)}
                <option value={preset.id}>{t(preset.name)}</option>
              {/each}
              <optgroup label={t('File personale')}>
                {#if customName}
                  <option value="custom">{t('Il mio file: {name}', { name: customName })}</option>
                {/if}
                <option value={UPLOAD}>{t('Carica file…')}</option>
              </optgroup>
            </select>
            <div class="actions">
              <button
                type="button"
                class="btn btn-sm"
                disabled={busy === id}
                onclick={() => audio.test(id)}
                >{busy === id ? t('Carico…') : `▶ ${t('Prova')}`}</button
              >
              {#if customName}
                <button
                  type="button"
                  class="btn btn-sm"
                  title={t('Elimina il file personale')}
                  aria-label={t('Elimina il file personale')}
                  disabled={busy === id}
                  onclick={() => askRemoveCustom(id)}>🗑</button
                >
              {/if}
            </div>
          </div>
          {#if errors[id]}<p class="error" role="alert">{errors[id]}</p>{/if}
        </li>
      {/each}
    </ul>
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
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem 1rem;
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
    flex: none;
    width: 18px;
    height: 18px;
  }

  .check span {
    display: flex;
    flex-direction: column;
  }

  .sounds .check {
    flex: 1 1 16rem;
    min-width: 0;
  }

  .sound-controls {
    display: flex;
    flex: 1 1 18rem;
    align-items: center;
    gap: 0.4rem;
    min-width: 0;
  }

  .source {
    flex: 1;
    width: auto;
    min-width: 0;
    padding: 0.3rem 0.5rem;
    font-size: 0.9rem;
  }

  .error {
    flex-basis: 100%;
    margin: 0;
    font-size: 0.85rem;
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
</style>
