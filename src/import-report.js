import { isTauri } from '@tauri-apps/api/core';
import { load } from '@tauri-apps/plugin-store';

let store;
async function getStore() { return store ??= load('importacion.json', { autoSave: false }); }

export async function loadImportReport() {
  return isTauri() ? (await getStore()).get('ultimoInforme') : JSON.parse(localStorage.getItem('gestor-importacion') || 'null');
}

export async function saveImportReport(report) {
  if (isTauri()) {
    const storage = await getStore();
    await storage.set('ultimoInforme', report);
    await storage.save();
  } else localStorage.setItem('gestor-importacion', JSON.stringify(report));
}
