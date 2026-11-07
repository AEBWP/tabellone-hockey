import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { errorKind, localFeed, shortDetail } = require('./updater.cjs')

describe('aggiornamento del programma', () => {
  it('riconosce la mancanza di internet', () => {
    expect(errorKind('net::ERR_INTERNET_DISCONNECTED', 'check')).toBe('offline')
    expect(errorKind('getaddrinfo ENOTFOUND github.com', 'download')).toBe('offline')
    expect(errorKind('net::ERR_NAME_NOT_RESOLVED', 'check')).toBe('offline')
  })

  it('gli altri errori restano legati alla fase', () => {
    expect(errorKind('Cannot find latest.yml in the latest release artifacts', 'check')).toBe(
      'check',
    )
    expect(errorKind('sha512 checksum mismatch', 'download')).toBe('download')
  })

  it('dettagli tecnici brevi, senza stack', () => {
    const e = new Error(
      'Cannot find channel\n"method: GET url: x"\n    at createHttpError (a.js:1)',
    )
    expect(shortDetail(e)).toBe('Cannot find channel "method: GET url: x"')
    expect(shortDetail('x'.repeat(500))).toHaveLength(300)
  })

  it('il server di prova può essere solo locale', () => {
    expect(localFeed('http://localhost:8123/')).toBe('http://localhost:8123/')
    expect(localFeed('http://127.0.0.1:8123/x/')).toBe('http://127.0.0.1:8123/x/')
    expect(localFeed('https://example.com/')).toBeNull()
    expect(localFeed('file:///C:/x')).toBeNull()
    expect(localFeed('non valido')).toBeNull()
    expect(localFeed(undefined)).toBeNull()
  })
})
