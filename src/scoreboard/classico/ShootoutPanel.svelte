<script lang="ts">
  let { shots, rounds, winner }: { shots: boolean[]; rounds: number; winner: boolean } = $props()

  /** Sempre almeno la serie regolare; nella morte improvvisa compaiono i tiri in più. */
  const slots = $derived(
    Array.from(
      { length: Math.max(rounds, shots.length) },
      (_, i) => shots[i] as boolean | undefined,
    ),
  )
  const goals = $derived(shots.filter(Boolean).length)
</script>

<div class="so-panel" class:winner>
  <div class="title">RIGORI · {goals}</div>
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
  .so-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
    padding-top: 20px;
  }

  .title {
    font-size: 52px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: #9cc3ea;
  }

  .winner .title {
    color: #ffd166;
  }

  .dots {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 18px;
  }

  /* Vuoto = da tirare, verde = gol, rosso = sbagliato. */
  .dot {
    width: 88px;
    height: 88px;
    border: 5px solid rgba(156, 195, 234, 0.5);
    border-radius: 50%;
  }

  .dot.goal {
    border-color: #3ccf7a;
    background: radial-gradient(circle at 35% 35%, #7cf0ab, #2fb868 70%);
    box-shadow: 0 0 30px rgba(60, 207, 122, 0.55);
  }

  .dot.miss {
    border-color: #ff5d5d;
    background: radial-gradient(circle at 35% 35%, #ff9a9a, #e04848 70%);
    box-shadow: 0 0 30px rgba(255, 93, 93, 0.45);
  }
</style>
