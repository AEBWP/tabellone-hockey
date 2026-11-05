<script lang="ts">
  import type { TeamView } from '../../engine'

  let {
    team,
    shots,
    rounds,
    winner,
  }: { team: TeamView; shots: boolean[]; rounds: number; winner: boolean } = $props()

  /** Sempre almeno la serie regolare; nella morte improvvisa compaiono i tiri in più. */
  const slots = $derived(
    Array.from(
      { length: Math.max(rounds, shots.length) },
      (_, i) => shots[i] as boolean | undefined,
    ),
  )
  const goals = $derived(shots.filter(Boolean).length)
</script>

<div class="so" class:winner style:--team={team.color}>
  <div class="head">
    <span>RIGORI {team.shortName}</span>
    <span class="goals">{goals}</span>
  </div>
  <div class="dots">
    {#each slots as shot, i (i)}
      <span
        class="dot"
        class:goal={shot === true}
        class:miss={shot === false}
        title={shot === true ? 'Gol' : shot === false ? 'Sbagliato' : 'Da tirare'}
      ></span>
    {/each}
  </div>
</div>

<style>
  .so {
    display: flex;
    flex-direction: column;
    border: 2px solid rgba(150, 180, 220, 0.22);
    border-radius: 6px;
    background: linear-gradient(180deg, #111a28 0%, #0a101a 100%);
    box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.07);
    overflow: hidden;
  }

  .so.winner {
    border-color: #ffd166;
    box-shadow: 0 0 40px rgba(255, 209, 102, 0.3);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 22px 8px;
    border-bottom: 2px solid rgba(150, 180, 220, 0.22);
    box-shadow: inset 6px 0 0 var(--team);
    font-size: 30px;
    font-weight: 700;
    letter-spacing: 0.24em;
    color: #8fa9c8;
  }

  .goals {
    font-size: 48px;
    font-weight: 800;
    letter-spacing: 0;
    line-height: 1;
    color: #f4f7fb;
  }

  .winner .goals {
    color: #ffd166;
  }

  .dots {
    display: flex;
    flex: 1;
    flex-wrap: wrap;
    align-content: center;
    justify-content: center;
    gap: 22px;
    padding: 16px;
  }

  /* Vuoto = da tirare, verde = gol, rosso = sbagliato. */
  .dot {
    width: 86px;
    height: 86px;
    border: 5px solid rgba(143, 169, 200, 0.35);
    border-radius: 50%;
  }

  .dot.goal {
    border-color: #2fd27a;
    background: radial-gradient(circle at 35% 35%, #7cf0ab, #22b864 70%);
    box-shadow: 0 0 26px rgba(47, 210, 122, 0.55);
  }

  .dot.miss {
    border-color: #ff4d4d;
    background: radial-gradient(circle at 35% 35%, #ff9a9a, #d93a3a 70%);
    box-shadow: 0 0 26px rgba(255, 77, 77, 0.45);
  }
</style>
