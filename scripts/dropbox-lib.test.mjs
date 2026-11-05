import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { apiArg, dropboxContentHash, installersToPrune, sortInstallers } from './dropbox-lib.mjs'

const exe = (v) => `Tabellone-Hockey-${v}-installazione.exe`
const sha = (b) => createHash('sha256').update(b).digest()

describe('release su Dropbox', () => {
  it('tiene le 5 versioni più recenti, confrontando i numeri (non il testo)', () => {
    const names = ['0.9.5', '0.9.10', '0.9.2', '1.0.0', '0.9.9', '0.9.3', '0.10.0'].map(exe)
    expect(installersToPrune(names, 5)).toEqual([exe('0.9.3'), exe('0.9.2')])
    expect(sortInstallers(names)[0]).toBe(exe('1.0.0'))
  })

  it('non tocca altri file nella cartella', () => {
    const names = ['note.txt', 'Tabellone-Hockey-0.9.5-installazione.exe.blockmap', exe('0.9.5')]
    expect(sortInstallers(names)).toEqual([exe('0.9.5')])
    expect(installersToPrune(names, 0)).toEqual([exe('0.9.5')])
  })

  it('calcola il content hash di Dropbox a blocchi da 4 MB', () => {
    const block = 4 * 1024 * 1024
    const data = Buffer.alloc(block + 10, 7)
    const expected = createHash('sha256')
      .update(Buffer.concat([sha(data.subarray(0, block)), sha(data.subarray(block))]))
      .digest('hex')
    expect(dropboxContentHash(data)).toBe(expected)
  })

  it("codifica l'intestazione in ASCII", () => {
    const backslash = String.fromCharCode(92)
    expect(apiArg({ path: '/Applicazioni/Città' })).toBe(
      `{"path":"/Applicazioni/Citt${backslash}u00e0"}`,
    )
  })
})
