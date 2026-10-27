import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('el guardado web conserva la instantánea y aborta sin borrar datos si una fila no se puede escribir', async () => {
  const previous = { isTauri: globalThis.isTauri, open: globalThis.__openTestDatabase };
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false }, plugins: [{
    name: 'test-database-transport',
    transform(code, id) {
      if (id.endsWith('/src/browser-database.js')) return 'export const openBrowserDatabase = () => globalThis.__openTestDatabase();';
    },
  }] });
  try {
    globalThis.isTauri = false;
    let disk = [{ id: 'original', numero: 1 }], aborted = 0;
    const db = {
      close() {},
      transaction() {
        let pending = structuredClone(disk), cancelled = false;
        const tx = {
          objectStore: () => ({
            clear() { pending = []; },
            put(value) {
              if (!value.id) throw new DOMException('Falta id', 'DataError');
              pending.push(structuredClone(value));
            },
          }),
          abort() { cancelled = true; aborted++; queueMicrotask(() => tx.onabort?.()); },
        };
        setTimeout(() => { if (!cancelled) { disk = pending; tx.oncomplete?.(); } }, 0);
        return tx;
      },
    };
    let release;
    globalThis.__openTestDatabase = () => new Promise(resolve => { release = () => resolve(db); });
    const { saveDB } = await server.ssrLoadModule('/src/database.js');
    const families = [{ id: 'nuevo', numero: 2 }];
    const saving = saveDB(families);
    families[0].numero = 999;
    release();
    await saving;
    assert.equal(disk[0].numero, 2);
    globalThis.__openTestDatabase = async () => db;
    await assert.rejects(saveDB([{ id: 'valido', numero: 3 }, { numero: 4 }]), /Falta id/);
    await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(aborted, 1);
    assert.deepEqual(disk, [{ id: 'nuevo', numero: 2 }]);
  } finally {
    globalThis.isTauri = previous.isTauri;
    globalThis.__openTestDatabase = previous.open;
    await server.close();
  }
});

test('un error de disco en escritorio no convierte los cambios sin guardar en datos recuperados', async () => {
  const previous = { window: globalThis.window, isTauri: globalThis.isTauri };
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } });
  try {
    globalThis.isTauri = true;
    const cache = new Map(), disk = new Map();
    let fail = false;
    globalThis.window = { __TAURI_INTERNALS__: { invoke: async (cmd, args) => {
      if (cmd === 'plugin:store|load') return args.path;
      if (cmd === 'plugin:store|get') return [structuredClone(cache.get(args.rid)), cache.has(args.rid)];
      if (cmd === 'plugin:store|set') { cache.set(args.rid, structuredClone(args.value)); return; }
      if (cmd === 'plugin:store|save') {
        if (fail && args.rid === 'familias.json') throw new Error('Sin espacio');
        disk.set(args.rid, structuredClone(cache.get(args.rid))); return;
      }
      throw new Error(`Comando inesperado: ${cmd}`);
    } } };
    const { saveDB, loadDB } = await server.ssrLoadModule('/src/database.js');
    const original = [{ id: 'familia', numero: 1 }];
    await saveDB(original);
    fail = true;
    await assert.rejects(saveDB([{ id: 'familia', numero: 2 }]), /Sin espacio/);
    assert.deepEqual(await loadDB(), original);
    fail = false;
    await saveDB([{ id: 'familia', numero: 3 }]);
    assert.deepEqual(disk.get('familias-recuperacion.json'), original);
  } finally {
    Object.assign(globalThis, previous);
    await server.close();
  }
});
