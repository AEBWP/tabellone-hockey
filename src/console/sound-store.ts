import type { SoundId } from './sound-events'

/**
 * Archivio dei suoni personalizzati (file audio caricati dall'operatore,
 * es. la registrazione della sirena del proprio palazzetto). Sta nel
 * database interno del programma: funziona offline e sopravvive ai riavvii.
 */

const DB_NAME = 'tabellone-hockey-suoni'
const STORE = 'suoni'

export interface StoredSound {
  name: string
  data: ArrayBuffer
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const req = action(tx.objectStore(STORE))
      tx.oncomplete = () => resolve(req.result)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

export function saveSound(id: SoundId, sound: StoredSound): Promise<IDBValidKey> {
  return withStore('readwrite', (s) => s.put(sound, id))
}

export function loadSound(id: SoundId): Promise<StoredSound | undefined> {
  return withStore('readonly', (s) => s.get(id) as IDBRequest<StoredSound | undefined>)
}

export function deleteSound(id: SoundId): Promise<undefined> {
  return withStore('readwrite', (s) => s.delete(id))
}
