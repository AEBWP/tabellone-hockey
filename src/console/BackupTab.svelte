<script lang="ts">
  import { exportLibrary, parseBackup } from '../shared/library'
  import { library } from './library.svelte'

  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

  let result = $state<{ ok: boolean; text: string } | null>(null)
  let fileInput: HTMLInputElement | undefined = $state()

  function download() {
    const text = exportLibrary({ teams: library.teams, presets: library.presets })
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tabellone-hockey-impostazioni-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    result = { ok: true, text: 'File di backup creato: lo trovi nella cartella dei download.' }
  }

  async function importFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    try {
      const data = parseBackup(await file.text())
      library.import(data)
      result = library.error
        ? { ok: false, text: library.error }
        : {
            ok: true,
            text: `Importati: ${count(data.teams.length, 'squadra', 'squadre')} e ${count(data.presets.length, 'regolamento', 'regolamenti')}.`,
          }
    } catch (e) {
      result = { ok: false, text: e instanceof Error ? e.message : String(e) }
    }
  }
</script>

<div class="backup-tab">
  <section class="panel">
    <h2 class="panel-title">Esporta</h2>
    <p>
      Salva in un file l’archivio di <b>{count(library.teams.length, 'squadra', 'squadre')}</b> (con
      i loghi) e
      <b>{count(library.presets.length, 'regolamento', 'regolamenti')}</b>. Utile per portare le
      impostazioni dal tuo PC a quello del palaghiaccio, o come copia di sicurezza.
    </p>
    <button type="button" class="btn btn-primary" onclick={download}>Scarica file di backup</button>
  </section>

  <section class="panel">
    <h2 class="panel-title">Importa</h2>
    <p>
      Carica un file di backup. Le squadre e i regolamenti vengono <b>aggiunti</b> a quelli che hai già;
      quelli presenti in entrambi vengono aggiornati. Niente viene cancellato.
    </p>
    <button type="button" class="btn" onclick={() => fileInput?.click()}>
      Scegli file di backup…
    </button>
    <input
      bind:this={fileInput}
      type="file"
      accept="application/json,.json"
      hidden
      onchange={importFile}
    />
  </section>

  {#if result}
    <p class="result" class:error={!result.ok} role="status">{result.text}</p>
  {/if}

  <p class="muted note">
    La partita in corso non fa parte del backup: viene già salvata in automatico.
  </p>
</div>

<style>
  .backup-tab {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 720px;
  }

  p {
    margin: 0 0 0.9rem;
    line-height: 1.5;
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

  .note {
    font-size: 0.88rem;
  }
</style>
