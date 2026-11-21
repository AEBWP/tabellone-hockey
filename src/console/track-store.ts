/**
 * Copia delle tracce audio nella versione da browser. Lì il percorso dei file non
 * si conosce, quindi senza questo archivio la playlist diventerebbe irraggiungibile
 * a ogni riavvio. Sta nel database interno del browser: funziona offline.
 * Nel programma desktop non serve: si tiene il percorso e basta.
 */

const DB_NAME = 'tabellone-hockey-tracce'
const STORE = 'tracce'

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

export function saveTrack(id: string, file: Blob): Promise<IDBValidKey> {
  return withStore('readwrite', (s) => s.put(file, id))
}

export function loadTrack(id: string): Promise<Blob | undefined> {
  return withStore('readonly', (s) => s.get(id) as IDBRequest<Blob | undefined>)
}

export function deleteTrack(id: string): Promise<undefined> {
  return withStore('readwrite', (s) => s.delete(id))
}

export function clearTracks(): Promise<undefined> {
  return withStore('readwrite', (s) => s.clear())
}
