<script lang="ts">
  import { onMount } from 'svelte'
  import { audio } from './audio.svelte'
  import HelpTip from './HelpTip.svelte'
  import { SOUND_IDS, SOUND_LABELS, type SoundId } from './sound-events'

  onMount(() => {
    if (audio.canChooseOutput) void audio.refreshOutputs()
  })

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
      errors = { ...errors, [id]: e instanceof Error ? e.message : 'Impossibile usare il file.' }
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

<div class="audio-tab">
  <section class="panel">
    <h2 class="panel-title">Volume</h2>
    <div class="volume-row">
      <button
        type="button"
        class="btn {audio.settings.muted ? 'btn-stop' : ''}"
        onclick={() => audio.toggleMute()}
      >
        {audio.settings.muted ? '🔇 Audio disattivato' : '🔊 Audio attivo'}
        <kbd>M</kbd>
      </button>
      <input
        type="range"
        min="0"
        max="100"
        step="5"
        value={audio.settings.volume}
        oninput={(e) => audio.update({ volume: e.currentTarget.valueAsNumber })}
        aria-label="Volume"
      />
      <strong class="value">{audio.settings.volume}%</strong>
    </div>
    {#if !audio.unlocked}
      <p class="warn">
        Il browser tiene l’audio in pausa finché non clicchi o premi un tasto nella console: basta
        un’azione qualsiasi.
      </p>
    {/if}
  </section>

  <section class="panel">
    <h2 class="panel-title">
      Suoni
      <HelpTip title="Suoni">
        I suoni partono da soli al momento giusto. Togli la spunta per quelli che non vuoi (es. se
        il palazzetto ha già una sua sirena). “Prova” li fa sentire anche se sono disattivati. Con
        “Carica file…” puoi usare una tua registrazione (es. la sirena vera del palazzetto, in MP3 o
        WAV): resta salvata nel programma e funziona anche senza internet. “Ripristina” torna al
        suono incluso.
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
              <strong>{SOUND_LABELS[id].name}</strong>
              <small class="muted">{SOUND_LABELS[id].description}</small>
              {#if audio.settings.custom[id]}
                <small class="custom">🎵 {audio.settings.custom[id]}</small>
              {/if}
              {#if errors[id]}<small class="error">{errors[id]}</small>{/if}
            </span>
          </label>
          <div class="actions">
            <button type="button" class="btn btn-sm" onclick={() => audio.test(id)}>▶ Prova</button>
            {#if audio.settings.custom[id]}
              <button
                type="button"
                class="btn btn-sm"
                title="Torna al suono incluso nel programma"
                onclick={() => void audio.removeCustom(id)}>Ripristina</button
              >
            {:else}
              <button
                type="button"
                class="btn btn-sm"
                title="Usa un tuo file audio (MP3, WAV, OGG)"
                disabled={busy === id}
                onclick={() => pickFile(id)}>{busy === id ? 'Carico…' : 'Carica file…'}</button
              >
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  </section>

  <section class="panel">
    <h2 class="panel-title">
      Uscita audio
      <HelpTip title="Uscita audio">
        Scegli dove mandare i suoni: le casse del palazzetto, l’uscita HDMI del maxischermo o quella
        predefinita di Windows. Se l’elenco mostra solo nomi generici, prova le uscite con “Prova”.
      </HelpTip>
    </h2>
    {#if audio.canChooseOutput}
      <div class="output-row">
        <select
          class="input"
          value={audio.settings.outputId}
          onchange={(e) => void audio.setOutput(e.currentTarget.value)}
        >
          <option value="">Predefinita di Windows</option>
          {#each audio.outputs as o (o.id)}
            <option value={o.id}>{o.label}</option>
          {/each}
        </select>
        <button type="button" class="btn" onclick={() => void audio.refreshOutputs()}
          >Aggiorna</button
        >
      </div>
      {#if audio.outputError}<p class="warn">{audio.outputError}</p>{/if}
    {:else}
      <p class="muted">
        Questo browser usa sempre l’uscita predefinita di Windows. Nella versione installabile del
        programma si potrà scegliere l’uscita.
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
</style>
