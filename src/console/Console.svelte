<script lang="ts">
  import { onDestroy } from 'svelte'
  import { createChannel } from '../shared/channel'
  import { HEARTBEAT_INTERVAL_MS } from '../shared/messages'

  const channel = createChannel()

  const sendHeartbeat = () => channel.send({ type: 'heartbeat', sentAt: Date.now() })

  // Un tabellone appena aperto chiede subito lo stato: rispondiamo senza aspettare il prossimo giro.
  const unsubscribe = channel.subscribe((message) => {
    if (message.type === 'hello') sendHeartbeat()
  })
  const timer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS)
  sendHeartbeat()

  onDestroy(() => {
    clearInterval(timer)
    unsubscribe()
    channel.close()
  })

  function openDisplay() {
    window.open('./display.html', 'tabellone-hockey-display')
  }
</script>

<main>
  <header>
    <h1>Console operatore</h1>
    <button type="button" onclick={openDisplay}>Apri tabellone</button>
  </header>

  <section class="placeholder">
    <p>Struttura del progetto pronta.</p>
    <p class="hint">
      I controlli di gioco (tempo, punteggio, penalità) arriveranno nelle prossime fasi.
    </p>
  </section>
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 1.5rem;
    background: var(--ice-900);
    border-bottom: 1px solid var(--ice-800);
  }

  h1 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }

  button {
    padding: 0.6rem 1.1rem;
    border: 0;
    border-radius: 8px;
    background: var(--ice-600);
    color: white;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  button:hover {
    background: #3a7dbb;
  }

  .placeholder {
    margin: auto;
    text-align: center;
  }

  .hint {
    color: var(--ice-300);
  }
</style>
