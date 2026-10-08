import { isTauri } from "@tauri-apps/api/core";
import { load } from "@tauri-apps/plugin-store";

const DB_NAME = "GestorBeneficiariosDB", DB_VERSION = 1, STORE = "familias";
let desktopStore;
let desktopWriteQueue = Promise.resolve();

async function getDesktopStore(path = "familias.json") {
  if (path === "familias.json") desktopStore ??= load(path, { autoSave: false });
  return path === "familias.json" ? desktopStore : load(path, { autoSave: false });
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveBrowserDB(familias) {
  const db = await openDB(), tx = db.transaction(STORE, "readwrite"), store = tx.objectStore(STORE);
  store.clear();
  familias.forEach(family => store.put(family));
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

async function loadBrowserDB() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).getAll();
    request.onsuccess = () => { db.close(); resolve(request.result || []); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

export async function saveDB(familias) {
  if (!isTauri()) return saveBrowserDB(familias);
  const snapshot = structuredClone(familias);
  const write = desktopWriteQueue.then(async () => {
    const store = await getDesktopStore();
    const previous = await store.get("familias");
    if (Array.isArray(previous) && previous.length) {
      const recovery = await getDesktopStore("familias-recuperacion.json");
      await recovery.set("familias", previous);
      await recovery.save();
    }
    await store.set("familias", snapshot);
    await store.save();
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
