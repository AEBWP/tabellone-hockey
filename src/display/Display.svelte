<script lang="ts">
  import { onDestroy } from 'svelte'
  import { createChannel } from '../shared/channel'
  import { HEARTBEAT_TIMEOUT_MS } from '../shared/messages'
  import Stage from './Stage.svelte'

  const channel = createChannel()

  let lastHeartbeat = $state(0)
  let now = $state(Date.now())

  const connected = $derived(now - lastHeartbeat < HEARTBEAT_TIMEOUT_MS)

  const unsubscribe = channel.subscribe((message) => {
    if (message.type === 'heartbeat') lastHeartbeat = Date.now()
  })
  channel.send({ type: 'hello' })

  const ticker = setInterval(() => (now = Date.now()), 500)

  onDestroy(() => {
    clearInterval(ticker)
    unsubscribe()
    channel.close()
  })

  // Nella versione browser: doppio clic per lo schermo intero.
  // In Electron la finestra si aprirà già a schermo intero sul maxischermo.
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen()
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="root" ondblclick={toggleFullscreen}>
  <Stage>
    <div class="board">
      <h1>TABELLONE HOCKEY</h1>
      <p>Il tabellone vero e proprio arriverà nella fase 3.</p>
    </div>

    <div
      class="status"
      class:connected
      title={connected ? 'Console collegata' : 'Console non collegata'}
    >
      <span class="dot"></span>
      {connected ? 'Console collegata' : 'In attesa della console…'}
    </div>
  </Stage>
</div>

<style>
  .root {
    height: 100%;
  }

  .board {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    background: radial-gradient(ellipse at center, var(--ice-800), var(--ice-950) 70%);
  }

  h1 {
    margin: 0;
    font-size: 140px;
    font-weight: 800;
    letter-spacing: 0.04em;
  }

  p {
    margin: 24px 0 0;
    font-size: 40px;
    color: var(--ice-300);
  }

  .status {
    position: absolute;
    right: 32px;
    bottom: 24px;
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 24px;
    color: var(--warn);
  }

  .status.connected {
    color: var(--ok);
    opacity: 0.6;
  }

  .dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: currentColor;
  }
</style>
