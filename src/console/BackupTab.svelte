<script lang="ts">
  import { exportLibrary, parseBackup } from '../shared/library'
  import { library } from './library.svelte'
  import { t } from '../i18n/ui.svelte'

  const teamsCount = (n: number) => (n === 1 ? t('1 squadra') : t('{n} squadre', { n }))
  const presetsCount = (n: number) => (n === 1 ? t('1 regolamento') : t('{n} regolamenti', { n }))

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
    result = { ok: true, text: t('File di backup creato: lo trovi nella cartella dei download.') }
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
        ? { ok: false, text: t(library.error) }
        : {
            ok: true,
            text: t('Importati: {teams} e {presets}.', {
              teams: teamsCount(data.teams.length),
              presets: presetsCount(data.presets.length),
            }),
          }
    } catch (e) {
      result = { ok: false, text: t(e instanceof Error ? e.message : String(e)) }
    }
  }
</script>

<div class="backup-tab">
  <section class="panel">
    <h2 class="panel-title">{t('Esporta')}</h2>
    <p>
      {@html t(
        'Salva in un file l’archivio di <b>{teams}</b> (con i loghi) e <b>{presets}</b>. Utile per portare le impostazioni dal tuo PC a quello del palaghiaccio, o come copia di sicurezza.',
        { teams: teamsCount(library.teams.length), presets: presetsCount(library.presets.length) },
      )}
    </p>
    <button type="button" class="btn btn-primary" onclick={download}
      >{t('Scarica file di backup')}</button
    >
  </section>

  <section class="panel">
    <h2 class="panel-title">{t('Importa')}</h2>
    <p>
      {@html t(
        'Carica un file di backup. Le squadre e i regolamenti vengono <b>aggiunti</b> a quelli che hai già; quelli presenti in entrambi vengono aggiornati. Niente viene cancellato.',
      )}
    </p>
    <button type="button" class="btn" onclick={() => fileInput?.click()}>
      {t('Scegli file di backup…')}
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
    {t('La partita in corso non fa parte del backup: viene già salvata in automatico.')}
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
