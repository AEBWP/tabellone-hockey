/**
 * Servizio online dello streaming del Tabellone Hockey (Cloudflare Worker).
 *
 * - `/<nome>`: pagina per gli spettatori (file statici in `server/public`,
 *   creati da `npm run live:build`).
 * - `/api/channels/<nome>/…`: un "canale" per palaghiaccio (Durable Object).
 *   La console registra il nome e riceve una chiave segreta; solo con quella
 *   chiave può inviare la situazione. Gli spettatori ricevono gli
 *   aggiornamenti in tempo reale (WebSocket), in sola lettura.
 *
 * ⚠️ Compatibilità: vedi `src/shared/live.ts`. Le console già installate
 * nei palaghiacci usano queste API: si possono aggiungere cose, non cambiare
 * o togliere quelle esistenti.
 */

import { DurableObject } from 'cloudflare:workers'
import {
  isValidLiveName,
  LIVE_MAX_LOGO_BYTES,
  LIVE_MAX_STATE_BYTES,
  LIVE_PROTOCOL,
  type LiveMessage,
  type LiveUpdate,
} from '../../src/shared/live'

interface Env {
  CHANNELS: DurableObjectNamespace<Channel>
  ASSETS: Fetcher
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
  })

const error = (status: number, code: string, message: string) =>
  json({ error: code, message }, status)

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

    if (url.pathname === '/api/info') {
      return json({ service: 'tabellone-hockey-live', protocol: LIVE_PROTOCOL })
    }

    const match = url.pathname.match(/^\/api\/channels\/([^/]+)(\/.*)?$/)
    if (match) {
      const name = decodeURIComponent(match[1]).toLowerCase()
      if (!isValidLiveName(name)) return error(400, 'invalid-name', 'Nome non valido.')
      const stub = env.CHANNELS.get(env.CHANNELS.idFromName(name))
      return stub.fetch(request)
    }
    if (url.pathname.startsWith('/api/')) return error(404, 'not-found', 'Indirizzo sconosciuto.')

    // Tutto il resto è la pagina per gli spettatori.
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function newKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Riferimenti ai loghi presenti in uno stato (impronte). */
function logoRefs(update: LiveUpdate | undefined): string[] {
  const teams = update?.state?.teams
  return [teams?.home?.logo, teams?.away?.logo].filter(
    (v): v is string => typeof v === 'string' && v.length > 0,
  )
}

/** Un canale: il nome di un palaghiaccio, con la sua chiave e l'ultima situazione. */
export class Channel extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    // Le pagine mandano "ping" per tenere vivo il collegamento: risposta automatica.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'))
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const action = url.pathname.replace(/^\/api\/channels\/[^/]+/, '') || '/'
    const method = request.method

    if (action === '/watch' && method === 'GET') return this.watch(request)
    if (action === '/' && method === 'GET') return json(await this.status())
    if (action === '/claim' && method === 'POST') return this.claim()

    // Da qui in poi serve la chiave del palaghiaccio.
    if (!(await this.authorized(request))) {
      return error(401, 'unauthorized', 'Chiave non valida per questo nome.')
    }
    if (action === '/' && method === 'DELETE') return this.release()
    if (action === '/state' && method === 'PUT') return this.putState(request)
    if (action === '/stop' && method === 'POST') return this.stop()
    const logo = action.match(/^\/logos\/([0-9a-f]{8,64})$/)
    if (logo && method === 'PUT') return this.putLogo(logo[1], request)
    return error(404, 'not-found', 'Indirizzo sconosciuto.')
  }

  // ── Registrazione del nome ─────────────────────────────────────────────

  private async claim(): Promise<Response> {
    if (await this.ctx.storage.get<string>('keyHash')) {
      return error(409, 'taken', 'Questo nome è già usato da un altro palaghiaccio.')
    }
    const key = newKey()
    await this.ctx.storage.put({ keyHash: await sha256(key), claimedAt: Date.now() })
    this.broadcast(await this.statusMessage())
    return json({ key }, 201)
  }

  private async authorized(request: Request): Promise<boolean> {
    const stored = await this.ctx.storage.get<string>('keyHash')
    const header = request.headers.get('Authorization') ?? ''
    const key = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
    return !!stored && !!key && (await sha256(key)) === stored
  }

  /** Il palaghiaccio lascia il nome: chi ha il link vecchio non vede più nulla. */
  private async release(): Promise<Response> {
    await this.ctx.storage.deleteAll()
    this.broadcast(await this.statusMessage())
    return new Response(null, { status: 204, headers: CORS })
  }

  // ── Situazione della partita ───────────────────────────────────────────

  private async putState(request: Request): Promise<Response> {
    const text = await request.text()
    if (text.length > LIVE_MAX_STATE_BYTES) return error(413, 'too-large', 'Dati troppo grandi.')
    let update: LiveUpdate
    try {
      update = JSON.parse(text)
    } catch {
      return error(400, 'invalid-json', 'Dati non validi.')
    }
    if (
      !update ||
      typeof update !== 'object' ||
      !update.state ||
      typeof update.sentAt !== 'number'
    ) {
      return error(400, 'invalid-update', 'Dati non validi.')
    }
    const now = Date.now()
    const clockOffset = update.sentAt - now
    await this.ctx.storage.put({ update, clockOffset, lastSeen: now, live: true })

    // Loghi: si tengono solo quelli in uso; si chiedono quelli che mancano.
    const refs = logoRefs(update)
    const stored = await this.ctx.storage.list<string>({ prefix: 'logo:' })
    const missing = refs.filter((h) => !stored.has(`logo:${h}`))
    const unused = [...stored.keys()].filter((k) => !refs.includes(k.slice(5)))
    if (unused.length) await this.ctx.storage.delete(unused)

    this.broadcast({ type: 'state', serverNow: now, lastSeen: now, clockOffset, update })
    return json({ ok: true, missingLogos: missing })
  }

  private async putLogo(hash: string, request: Request): Promise<Response> {
    const data = await request.text()
    if (data.length > LIVE_MAX_LOGO_BYTES) return error(413, 'too-large', 'Logo troppo grande.')
    if (!/^data:image\/(png|webp|jpeg|svg\+xml);base64,/.test(data)) {
      return error(400, 'invalid-logo', 'Logo non valido.')
    }
    await this.ctx.storage.put(`logo:${hash}`, data)
    this.broadcast({ type: 'logo', hash, data })
    return json({ ok: true })
  }

  private async stop(): Promise<Response> {
    await this.ctx.storage.put({ live: false, lastSeen: Date.now() })
    this.broadcast(await this.statusMessage())
    return json({ ok: true })
  }

  // ── Spettatori ─────────────────────────────────────────────────────────

  private async status() {
    const [keyHash, live, lastSeen] = await Promise.all([
      this.ctx.storage.get<string>('keyHash'),
      this.ctx.storage.get<boolean>('live'),
      this.ctx.storage.get<number>('lastSeen'),
    ])
    return { claimed: !!keyHash, live: !!keyHash && !!live, lastSeen: lastSeen ?? 0 }
  }

  private async statusMessage(): Promise<LiveMessage> {
    return { type: 'status', serverNow: Date.now(), ...(await this.status()) }
  }

  private async watch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return error(426, 'websocket', 'Serve un collegamento WebSocket.')
    }
    const { 0: client, 1: server } = new WebSocketPair()
    this.ctx.acceptWebSocket(server)

    // Chi arriva riceve subito la situazione completa.
    const status = await this.status()
    server.send(JSON.stringify({ type: 'status', serverNow: Date.now(), ...status }))
    if (status.live) {
      const logos = await this.ctx.storage.list<string>({ prefix: 'logo:' })
      for (const [key, data] of logos) {
        server.send(JSON.stringify({ type: 'logo', hash: key.slice(5), data }))
      }
      const update = await this.ctx.storage.get<LiveUpdate>('update')
      const clockOffset = (await this.ctx.storage.get<number>('clockOffset')) ?? 0
      if (update) {
        server.send(
          JSON.stringify({
            type: 'state',
            serverNow: Date.now(),
            lastSeen: status.lastSeen,
            clockOffset,
            update,
          } satisfies LiveMessage),
        )
      }
    }
    return new Response(null, { status: 101, webSocket: client })
  }

  private broadcast(message: LiveMessage) {
    const text = JSON.stringify(message)
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(text)
      } catch {
        // Spettatore già andato via.
      }
    }
  }

  async webSocketMessage(): Promise<void> {
    // Gli spettatori non inviano nulla (il "ping" ha la risposta automatica).
  }

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    try {
      ws.close(code, 'chiuso')
    } catch {
      // Già chiuso.
    }
  }
}
