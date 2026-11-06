<script lang="ts">
  import type { TeamId, TeamSetup, TeamState } from '../engine'
  import { textColorOn } from '../shared/color'
  import HelpTip from './HelpTip.svelte'
  import { t, t as tr } from '../i18n/ui.svelte'
  import { library } from './library.svelte'
  import TeamEditor from './TeamEditor.svelte'

  let {
    teams,
    showLogos,
    onchange,
    onShowLogos,
  }: {
    teams: Record<TeamId, TeamState>
    /** Loghi visibili sul tabellone (per le squadre che ne hanno uno). */
    showLogos: boolean
    onchange: (team: TeamId, setup: Partial<TeamSetup>) => void
    onShowLogos: (show: boolean) => void
  } = $props()

  const logosAvailable = $derived(!!teams.home.logo || !!teams.away.logo)
  const onlyOneLogo = $derived(!!teams.home.logo !== !!teams.away.logo)

  let message = $state<string | null>(null)

  const setupOf = ({ name, shortName, color, logo }: TeamState): TeamSetup => ({
    name,
    shortName,
    color,
    logo,
  })

  function pick(team: TeamId, id: string) {
    const saved = library.teams.find((t) => t.id === id)
    if (!saved) return
    onchange(team, setupOf({ ...saved, goals: 0, shots: 0, timeoutsUsed: 0 }))
    message =
      team === 'home'
        ? t('{name} impostata come squadra di casa.', { name: saved.name })
        : t('{name} impostata come squadra ospite.', { name: saved.name })
  }

  function save(team: TeamId) {
    const current = teams[team]
    if (!current.name.trim()) return
    const exists = library.teams.some(
      (x) => x.name.trim().toLowerCase() === current.name.trim().toLowerCase(),
    )
    library.saveTeam(setupOf(current))
    message =
      (library.error && t(library.error)) ??
      (exists
        ? t('{name} aggiornata nell’archivio.', { name: current.name })
        : t('{name} salvata nell’archivio.', { name: current.name }))
  }

  function swap() {
    const home = setupOf(teams.home)
    const away = setupOf(teams.away)
    onchange('home', away)
    onchange('away', home)
    message = t('Squadre invertite.')
  }

  function remove(id: string, name: string) {
    if (!confirm(t('Eliminare {name} dall’archivio?', { name }))) return
    library.deleteTeam(id)
  }
</script>

<div class="teams-tab">
  <p class="muted intro">
    {t(
      'Le modifiche compaiono subito sul tabellone. Salva nell’archivio le squadre che giocano spesso: la prossima volta basta sceglierle dall’elenco.',
    )}
  </p>

  <div class="team-grid">
    {#each ['home', 'away'] as const as id (id)}
      <div class="column">
        <TeamEditor {id} team={teams[id]} onchange={(setup) => onchange(id, setup)} />
        <div class="library-row">
          <select
            class="input"
            value=""
            disabled={library.teams.length === 0}
            onchange={(e) => {
              pick(id, e.currentTarget.value)
              e.currentTarget.value = ''
            }}
            aria-label={t('Scegli dall’archivio')}
          >
            <option value="" disabled>
              {library.teams.length ? t('Scegli dall’archivio…') : t('Archivio vuoto')}
            </option>
            {#each library.teams as t (t.id)}
              <option value={t.id}>{t.name}</option>
            {/each}
          </select>
          <button type="button" class="btn" onclick={() => save(id)}
            >{t('Salva nell’archivio')}</button
          >
        </div>
      </div>
    {/each}
  </div>

  <div class="swap-row">
    <button type="button" class="btn" onclick={swap}>⇄ {t('Inverti casa e ospiti')}</button>
    <HelpTip title={t('Inverti casa e ospiti')}>
      {t(
        'Scambia nomi, colori e loghi delle due squadre. Il punteggio resta dov’è: usalo prima dell’inizio della partita.',
      )}
    </HelpTip>

    <span class="separator" aria-hidden="true"></span>

    <button
      type="button"
      class="btn"
      class:active={!showLogos}
      aria-pressed={!showLogos}
      disabled={!logosAvailable}
      onclick={() => {
        const show = !showLogos
        onShowLogos(show)
        message = show ? t('Loghi di nuovo visibili.') : t('Loghi nascosti sul tabellone.')
      }}
    >
      {showLogos ? `🚫 ${t('Nascondi loghi')}` : `🖼 ${t('Mostra loghi')}`}
    </button>
    <HelpTip title={t('Nascondi loghi')}>
      {@html t(
        'Toglie i loghi di tutte e due le squadre dal tabellone (fascia della squadra e animazione del gol), senza cancellarli. Utile quando una sola squadra ha il logo. Con <b>Nuova partita</b> i loghi tornano visibili.',
      )}
    </HelpTip>
    {#if showLogos && onlyOneLogo}
      <span class="hint">{t('Solo una squadra ha il logo: puoi nasconderli per uniformità.')}</span>
    {/if}
    {#if message}<span class="message">{message}</span>{/if}
  </div>

  <section class="panel archive">
    <h2 class="panel-title">{t('Archivio squadre ({n})', { n: library.teams.length })}</h2>
    {#if library.teams.length}
      <ul>
        {#each library.teams as t (t.id)}
          <li>
            <span class="badge" style:background={t.color} style:color={textColorOn(t.color)}>
              {#if t.logo}<img src={t.logo} alt="" />{:else}{t.shortName.slice(0, 3)}{/if}
            </span>
            <span class="name">
              <strong>{t.name}</strong>
              <small class="muted">{t.shortName}</small>
            </span>
            <button type="button" class="btn btn-sm" onclick={() => pick('home', t.id)}
              >{tr('Casa')}</button
            >
            <button type="button" class="btn btn-sm" onclick={() => pick('away', t.id)}>
              {tr('Ospiti')}
            </button>
            <button
              type="button"
              class="btn btn-sm btn-danger"
              aria-label={tr('Elimina {name}', { name: t.name })}
              onclick={() => remove(t.id, t.name)}
            >
              ✕
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="muted">
        {t('Nessuna squadra salvata. Usa “Salva nell’archivio” sotto ogni squadra.')}
      </p>
    {/if}
  </section>
</div>

<style>
  .teams-tab {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 1100px;
  }

  .intro {
    margin: 0;
  }

  .team-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 1rem;
  }

  .column {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .library-row {
    display: flex;
    gap: 0.5rem;
  }

  .library-row select {
    flex: 1;
  }

  .separator {
    width: 1px;
    height: 1.6rem;
    margin: 0 0.4rem;
    background: var(--ice-800);
  }

  .btn.active {
    border-color: var(--warn);
    color: #ffd166;
  }

  .hint {
    font-size: 0.88rem;
    color: #ffd166;
  }

  .swap-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
  }

  .message {
    color: var(--ok);
  }

  .archive ul {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .archive li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.45rem 0.6rem;
    border-radius: 10px;
    background: var(--ice-950);
  }

  .badge {
    display: grid;
    flex: none;
    place-items: center;
    width: 38px;
    height: 38px;
    padding: 3px;
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 800;
    overflow: hidden;
  }

  .badge img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .name {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  .name strong {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
</style>
