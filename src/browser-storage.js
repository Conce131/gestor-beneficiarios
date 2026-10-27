import { openBrowserDatabase } from './browser-database.js';

const STORE = 'datos';

async function transact(key, value, write = false) {
  const db = await openBrowserDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, write ? 'readwrite' : 'readonly');
    const storage = transaction.objectStore(STORE);
    const request = write ? storage.put(value, key) : storage.get(key);
    transaction.oncomplete = () => { db.close(); resolve(request.result); };
    transaction.onabort = transaction.onerror = () => {
      db.close(); reject(transaction.error || request.error || new Error('No se pudieron guardar los datos.'));
    };
  });
}

export async function readBrowserData(key, validate = value => value) {
  const saved = await transact(key);
  if (saved !== undefined) return validate(saved);
  let legacy;
  try { legacy = localStorage.getItem(key); }
  catch (error) {
    if (error.name !== 'SecurityError') throw error;
    // El navegador puede permitir IndexedDB y denegar el almacén antiguo.
    return null;
  }
  if (legacy === null) return null;
  const migrated = validate(JSON.parse(legacy));
  await writeBrowserData(key, migrated);
  return migrated;
}

export async function writeBrowserData(key, value) {
  await transact(key, value, true);
  // Solo se retira la copia antigua cuando IndexedDB confirma la escritura.
  try { localStorage.removeItem(key); }
  catch (error) {
    // La escritura ya está confirmada; una copia antigua no debe convertirla
    // en un fallo. Las lecturas futuras priorizan los datos de IndexedDB.
    console.warn('Los datos se guardaron, pero no se pudo retirar la copia antigua.', error);
  }
}
