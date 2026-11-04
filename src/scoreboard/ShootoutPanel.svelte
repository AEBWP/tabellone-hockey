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

<div class="panel" class:winner>
  <div class="title">RIGORI · {goals}</div>
  <div class="dots">
    {#each slots as shot, i (i)}
      <span class="dot" class:goal={shot === true} class:miss={shot === false}>
        {shot === true ? '●' : shot === false ? '✕' : ''}
      </span>
    {/each}
  </div>
</div>

<style>
  .panel {
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

  .dot {
    display: grid;
    place-items: center;
    width: 96px;
    height: 96px;
    border: 5px solid rgba(156, 195, 234, 0.5);
    border-radius: 50%;
    font-size: 56px;
    font-weight: 800;
  }

  .dot.goal {
    border-color: #3ccf7a;
    color: #3ccf7a;
    background: rgba(60, 207, 122, 0.15);
  }

  .dot.miss {
    border-color: #ff5d5d;
    color: #ff5d5d;
  }
</style>
