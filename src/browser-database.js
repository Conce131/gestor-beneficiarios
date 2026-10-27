export const BROWSER_DB_NAME = 'GestorBeneficiariosDB';
let migration;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(BROWSER_DB_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('familias')) db.createObjectStore('familias', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('datos')) db.createObjectStore('datos');
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Cierra las otras pestañas de la aplicación y vuelve a abrirla para actualizar los datos.'));
  });
}

async function migrateAuxiliaryDatabase(db) {
  // Recupera también los datos guardados por la versión que usaba una segunda base.
  const previous = await new Promise((resolve, reject) => {
    const request = indexedDB.open('GestorBeneficiariosDatos', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  let entries = [];
  try {
    if (previous.objectStoreNames.contains('datos')) {
      entries = await new Promise((resolve, reject) => {
        const tx = previous.transaction('datos', 'readonly');
        const store = tx.objectStore('datos');
        const keys = store.getAllKeys(), values = store.getAll();
        tx.oncomplete = () => resolve(keys.result.map((key, i) => [key, values.result[i]]));
        tx.onerror = tx.onabort = () => reject(tx.error);
      });
    }
  } finally { previous.close(); }
  if (entries.length) {
    await new Promise((resolve, reject) => {
      const tx = db.transaction('datos', 'readwrite'), store = tx.objectStore('datos');
      for (const [key, value] of entries) {
        const request = store.get(key);
        request.onsuccess = () => { if (request.result === undefined) store.put(value, key); };
      }
      tx.oncomplete = resolve;
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  }
  // La base anterior solo se elimina tras confirmar la copia completa.
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase('GestorBeneficiariosDatos');
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Cierra las otras pestañas para terminar de trasladar los datos.'));
  });
}

export async function openBrowserDatabase() {
  const db = await openDatabase();
  try {
    migration ??= migrateAuxiliaryDatabase(db).catch(error => { migration = undefined; throw error; });
    await migration;
    return db;
  } catch (error) { db.close(); throw error; }
}
