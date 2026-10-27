import { openBrowserDatabase } from './browser-database.js';
import { isTauri } from "@tauri-apps/api/core";
import { load } from "@tauri-apps/plugin-store";

const STORE = "familias";
let desktopStore;
let desktopWriteQueue = Promise.resolve();

async function getDesktopStore(path = "familias.json") {
  if (path === "familias.json") desktopStore ??= load(path, { autoSave: false });
  return path === "familias.json" ? desktopStore : load(path, { autoSave: false });
}


async function saveBrowserDB(familias) {
  const db = await openBrowserDatabase(), tx = db.transaction(STORE, "readwrite"), store = tx.objectStore(STORE);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error); };
    try {
      store.clear();
      familias.forEach(family => store.put(family));
    } catch (error) {
      // Un fallo síncrono de put no aborta la transacción por sí solo. Evita
      // confirmar el clear y dejar un listado parcial o vacío.
      tx.abort();
      reject(error);
    }
  });
}

async function loadBrowserDB() {
  const db = await openBrowserDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).getAll();
    request.onsuccess = () => { db.close(); resolve(request.result || []); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

export async function saveDB(familias) {
  const snapshot = structuredClone(familias);
  if (!isTauri()) return saveBrowserDB(snapshot);
  const write = desktopWriteQueue.then(async () => {
    const store = await getDesktopStore();
    const previous = await store.get("familias");
    if (Array.isArray(previous) && previous.length) {
      const recovery = await getDesktopStore("familias-recuperacion.json");
      await recovery.set("familias", previous);
      await recovery.save();
    }
    await store.set("familias", snapshot);
    try { await store.save(); }
    catch (error) {
      // El plugin mantiene una caché incluso si falla la escritura en disco.
      // Restáurala para no usar cambios fallidos como copia de recuperación.
      await store.set('familias', previous ?? []);
      throw error;
    }
  });
  desktopWriteQueue = write.catch(() => {});
  return write;
}

export async function resetDB() {
  await desktopWriteQueue;
  if (!isTauri()) return saveBrowserDB([]);
  const store = await getDesktopStore();
  const recovery = await getDesktopStore("familias-recuperacion.json");
  await store.set("familias", []);
  await store.save();
  await recovery.set("familias", []);
  await recovery.save();
  // Borra también el almacén antiguo para que no se migre al abrir de nuevo.
  await saveBrowserDB([]);
}

export async function loadDB() {
  if (!isTauri()) return loadBrowserDB();
  try {
    const store = await getDesktopStore();
    const saved = await store.get("familias");
    if (Array.isArray(saved)) return saved;
  } catch (error) {
    console.error("No se pudo leer el archivo local principal; se probará la copia de recuperación.", error);
  }
  const recovery = await getDesktopStore("familias-recuperacion.json");
  const recovered = await recovery.get("familias");
  if (Array.isArray(recovered)) return recovered;

  // Migra los datos que ya existían en IndexedDB de esta instalación.
  try {
    const oldData = await loadBrowserDB();
    if (oldData.length) {
      await saveDB(oldData);
      return oldData;
    }
  } catch (error) {
    console.warn("No había una base anterior de IndexedDB disponible.", error);
  }
  return [];
}
