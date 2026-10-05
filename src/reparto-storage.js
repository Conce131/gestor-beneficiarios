import { isTauri } from '@tauri-apps/api/core';
import { load } from '@tauri-apps/plugin-store';
import { validarReparto } from './reparto.mjs';
let store, queue = Promise.resolve();
async function getStore() { return store ??= load('reparto.json', {autoSave:false}); }
export async function loadReparto() {
  const data = isTauri() ? await (await getStore()).get('alimentos') : JSON.parse(localStorage.getItem('gestor-reparto') || 'null');
  return validarReparto(data);
}
export function saveReparto(data) {
  const snapshot = structuredClone(data);
  const write = queue.then(async () => {
    if (isTauri()) {
      const s = await getStore(); await s.set('alimentos', snapshot); await s.save();
    } else localStorage.setItem('gestor-reparto', JSON.stringify(snapshot));
  });
  queue = write.catch(() => {});
  return write;
}
