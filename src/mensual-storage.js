import { readBrowserData, writeBrowserData } from './browser-storage.js';
import { isTauri } from '@tauri-apps/api/core';
import { load } from '@tauri-apps/plugin-store';
import { validarMensuales } from './mensual.mjs';

let store, queue = Promise.resolve();
async function getStore() { return store ??= load('mensuales.json', { autoSave: false }); }

export async function loadMensuales() {
  const data = isTauri() ? await (await getStore()).get('meses') : await readBrowserData('gestor-mensuales', value => value == null ? {} : validarMensuales(value));
  return data == null ? {} : validarMensuales(data);
}

export function saveMensuales(datos) {
  const snapshot = validarMensuales(datos);
  const write = queue.then(async () => {
    if (isTauri()) {
      const s = await getStore();
      await s.set('meses', snapshot);
      await s.save();
    } else await writeBrowserData('gestor-mensuales', snapshot);
  });
  queue = write.catch(() => {});
  return write;
}

export function resetMensuales() { return saveMensuales({}); }
