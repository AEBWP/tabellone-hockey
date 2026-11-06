<script lang="ts">
  import type { TeamId, TeamSetup, TeamState } from '../engine'
  import { textColorOn } from '../shared/color'
  import { LOGO_ACCEPT, loadLogo } from '../shared/logo'
  import { t } from '../i18n/ui.svelte'

  let {
    id,
    team,
    onchange,
  }: {
    id: TeamId
    team: TeamState
    onchange: (setup: Partial<TeamSetup>) => void
  } = $props()

  let error = $state('')
  let fileInput: HTMLInputElement

  const title = $derived(id === 'home' ? t('Squadra di casa') : t('Squadra ospite'))

  async function pickLogo(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    error = ''
    try {
      onchange({ logo: await loadLogo(file) })
    } catch (e) {
      error = t(e instanceof Error ? e.message : String(e))
    }
  }
</script>

<fieldset>
  <legend>{title}</legend>

  <div class="logo-row">
    <button
      type="button"
      class="logo-box"
      style:--team={team.color}
      style:--on-team={textColorOn(team.color)}
      onclick={() => fileInput.click()}
      title={t('Carica il logo')}
    >
      {#if team.logo}
        <img src={team.logo} alt={t('Logo {name}', { name: team.name })} />
      {:else}
        <span>{team.shortName.slice(0, 3)}</span>
      {/if}
    </button>

    <div class="logo-actions">
      <button type="button" class="secondary" onclick={() => fileInput.click()}>
        {team.logo ? t('Cambia logo') : t('Carica logo')}
      </button>
      {#if team.logo}
        <button type="button" class="link" onclick={() => onchange({ logo: null })}
          >{t('Rimuovi')}</button
        >
      {/if}
      <small>{t('PNG, JPG, SVG o WebP. Meglio con sfondo trasparente.')}</small>
    </div>
    <input bind:this={fileInput} type="file" accept={LOGO_ACCEPT} onchange={pickLogo} hidden />
  </div>
  {#if error}<p class="error">{error}</p>{/if}

  <label>
    {t('Nome')}
    <input
      type="text"
      value={team.name}
      maxlength="40"
      oninput={(e) => onchange({ name: e.currentTarget.value })}
    />
  </label>

  <div class="row">
    <label class="grow">
      {t('Sigla sul tabellone')}
      <input
        type="text"
        value={team.shortName}
        maxlength="10"
        oninput={(e) => onchange({ shortName: e.currentTarget.value.toUpperCase() })}
      />
    </label>
    <label>
      {t('Colore')}
      <input
        type="color"
        value={team.color}
        oninput={(e) => onchange({ color: e.currentTarget.value })}
      />
    </label>
  </div>
</fieldset>

<style>
  fieldset {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    min-width: 0;
    margin: 0;
    padding: 1rem 1.25rem 1.25rem;
    border: 1px solid var(--ice-800);
    border-radius: 12px;
    background: var(--ice-900);
  }

  legend {
    padding: 0 0.4rem;
    font-weight: 600;
    color: var(--ice-300);
  }

  .logo-row {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .logo-box {
    display: grid;
    flex: none;
    place-items: center;
    width: 88px;
    height: 88px;
    padding: 6px;
    border: 2px dashed var(--ice-600);
    border-radius: 14px;
    background: var(--team);
    color: var(--on-team);
    font-size: 1.4rem;
    font-weight: 800;
    cursor: pointer;
  }

  .logo-box img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .logo-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0.8rem;
  }

  small {
    flex-basis: 100%;
    color: var(--ice-300);
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.9rem;
    color: var(--ice-300);
  }

  .row {
    display: flex;
    gap: 1rem;
  }

  .grow {
    flex: 1;
  }

  input[type='text'] {
    padding: 0.55rem 0.7rem;
    border: 1px solid var(--ice-800);
    border-radius: 8px;
    background: var(--ice-950);
    color: var(--ice-50);
    font: inherit;
    font-size: 1rem;
  }

  input[type='text']:focus {
    outline: 2px solid var(--ice-600);
    outline-offset: 1px;
  }

  input[type='color'] {
    width: 64px;
    height: 40px;
    padding: 2px;
    border: 1px solid var(--ice-800);
    border-radius: 8px;
    background: var(--ice-950);
    cursor: pointer;
  }

  button {
    font: inherit;
    cursor: pointer;
  }

  .secondary {
    padding: 0.45rem 0.9rem;
    border: 1px solid var(--ice-600);
    border-radius: 8px;
    background: transparent;
    color: var(--ice-50);
    font-weight: 600;
  }

  .secondary:hover {
    background: var(--ice-800);
  }

  .link {
    padding: 0;
    border: 0;
    background: none;
    color: var(--danger);
    text-decoration: underline;
  }

  .error {
    margin: 0;
    color: var(--danger);
  }
</style>
