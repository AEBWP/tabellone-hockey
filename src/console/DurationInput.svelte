<script lang="ts">
  import { t } from '../i18n/ui.svelte'
  /** Durata in minuti e secondi, salvata in millisecondi. */
  let {
    value = $bindable(),
    label,
    disabled = false,
  }: { value: number; label: string; disabled?: boolean } = $props()

  const minutes = $derived(Math.floor(Math.max(0, value) / 60_000))
  const seconds = $derived(Math.round((Math.max(0, value) % 60_000) / 1000))

  function set(min: number, sec: number) {
    value = (Number.isFinite(min) ? min : 0) * 60_000 + (Number.isFinite(sec) ? sec : 0) * 1000
  }
</script>

<div class="duration" class:disabled>
  <span class="label">{label}</span>
  <div class="inputs">
    <input
      class="input"
      type="number"
      min="0"
      max="99"
      value={minutes}
      {disabled}
      aria-label="{label}: {t('Minuti')}"
      oninput={(e) => set(e.currentTarget.valueAsNumber, seconds)}
    />
    <span class="unit">min</span>
    <input
      class="input"
      type="number"
      min="0"
      max="59"
      value={seconds}
      {disabled}
      aria-label="{label}: {t('Secondi')}"
      oninput={(e) => set(minutes, e.currentTarget.valueAsNumber)}
    />
    <span class="unit">s</span>
  </div>
</div>

<style>
  .duration {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .disabled {
    opacity: 0.45;
  }

  .label {
    font-size: 0.85rem;
    color: var(--ice-300);
  }

  .inputs {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .input {
    width: 4.5rem;
    text-align: center;
  }

  .unit {
    font-size: 0.85rem;
    color: var(--ice-300);
  }
</style>
