import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { crearMensual } from '../src/mensual.mjs';
import { iniciarSeguimiento, activarAltas } from '../src/actividad.mjs';
import { registrarAtencion, cambiarOrigenRecuento } from '../src/atenciones.mjs';

test('persiste meses independientes, ordena los guardados, propaga errores y permite reintentar', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } });
  const previous = { window: globalThis.window, localStorage: globalThis.localStorage, indexedDB: globalThis.indexedDB, isTauri: globalThis.isTauri };
  try {
    globalThis.isTauri = false;
    const disk = new Map(), writes = [];
    let fail = false;
    const legacy = new Map();
    globalThis.localStorage = {
      getItem: key => legacy.get(key) ?? null,
      removeItem: key => legacy.delete(key),
    };
    const auxiliary = new Map([['gestor-importacion', { archivo: 'anterior.xlsx' }]]);
    const schemas = new Map([
      ['GestorBeneficiariosDB', new Set(['familias'])],
      ['GestorBeneficiariosDatos', new Set(['datos'])],
    ]);
    const versions = new Map([['GestorBeneficiariosDB', 1], ['GestorBeneficiariosDatos', 1]]);
    globalThis.indexedDB = {
      deleteDatabase: name => {
        const request = {};
        queueMicrotask(() => { schemas.delete(name); auxiliary.clear(); request.onsuccess(); });
        return request;
      },
      open: (name, version) => {
        const request = {};
        queueMicrotask(() => {
          const schema = schemas.get(name) ?? new Set();
          schemas.set(name, schema);
          request.result = {
            objectStoreNames: { contains: store => schema.has(store) },
            createObjectStore: store => schema.add(store),
            close() {},
            transaction: () => {
              const values = name === 'GestorBeneficiariosDB' ? disk : auxiliary;
              let pending = 0, failed = false;
              const enqueue = operation => {
                const result = {};
                pending++;
                queueMicrotask(() => {
                  if (failed) return;
                  try {
                    result.result = operation();
                    result.onsuccess?.();
                  } catch (error) {
                    failed = true; tx.error = error; tx.onabort(); return;
                  }
                  pending--;
                  if (!pending) queueMicrotask(() => { if (!pending && !failed) tx.oncomplete(); });
                });
                return result;
              };
              const tx = { objectStore: () => ({
                get: key => enqueue(() => structuredClone(values.get(key))),
                getAllKeys: () => enqueue(() => [...values.keys()]),
                getAll: () => enqueue(() => structuredClone([...values.values()])),
                put: (value, key) => {
                  const snapshot = structuredClone(value);
                  return enqueue(() => {
                    if (fail) throw new Error('Sin espacio');
                    writes.push(snapshot); values.set(key, snapshot);
                  });
                },
              }) };
              return tx;
            },
          };
          if ((versions.get(name) ?? 0) < version) {
            request.onupgradeneeded?.(); versions.set(name, version);
          }
          request.onsuccess();
        });
        return request;
      },
    };
    const { loadMensuales, saveMensuales, resetMensuales } = await server.ssrLoadModule('/src/mensual-storage.js');
    fail = true;
    await assert.rejects(loadMensuales(), /Sin espacio/);
    assert.equal(schemas.has('GestorBeneficiariosDatos'), true);
    assert.deepEqual(auxiliary.get('gestor-importacion'), { archivo: 'anterior.xlsx' });
    fail = false;
    assert.deepEqual(await loadMensuales(), {});
    const octubre = crearMensual('2026-10', 'Entidad');
    const meses = { '2026-10': octubre };
    assert.equal(schemas.has('GestorBeneficiariosDatos'), false);
    assert.deepEqual([...schemas.get('GestorBeneficiariosDB')].sort(), ['datos', 'familias']);
    assert.deepEqual(disk.get('gestor-importacion'), { archivo: 'anterior.xlsx' });
    writes.length = 0;
    const first = saveMensuales(meses);
    octubre.tamanos[0] = 12;
    meses['2026-11'] = crearMensual('2026-11', 'Entidad');
    const second = saveMensuales(meses);
    await Promise.all([first, second]);
    assert.equal(writes[0]['2026-10'].tamanos[0], '');
    assert.equal(writes[1]['2026-10'].tamanos[0], 12);
    assert.deepEqual(await loadMensuales(), meses);
    fail = true;
    await assert.rejects(saveMensuales(meses), /Sin espacio/);
    fail = false;
    octubre.tamanos[0] = 13;
    await saveMensuales(meses);
    assert.equal((await loadMensuales())['2026-10'].tamanos[0], 13);
    disk.delete('gestor-mensuales');
    legacy.set('gestor-mensuales', '{invalido');
    await assert.rejects(loadMensuales());
    legacy.set('gestor-mensuales', JSON.stringify(meses));
    fail = true;
    await assert.rejects(loadMensuales(), /Sin espacio/);
    assert.ok(legacy.has('gestor-mensuales'));
    fail = false;
    assert.deepEqual(await loadMensuales(), meses);
    assert.equal(legacy.has('gestor-mensuales'), false);
    // Los datos nuevos prevalecen si queda una copia antigua.
    legacy.set('gestor-mensuales', '{}');
    assert.deepEqual(await loadMensuales(), meses);
    const f = iniciarSeguimiento({ id: 'f-1', numero: 1, personas: [{ titular: true, nombre: 'Ana', nacimiento: '1980-01-01', vigencia: '2027-01-01' }] }, '2026-10');
    meses['2026-12'] = activarAltas(crearMensual('2026-12', 'Entidad'), [f]);
    await saveMensuales(meses);
    assert.deepEqual((await loadMensuales())['2026-12'], meses['2026-12']);
    await resetMensuales();
    assert.deepEqual(await loadMensuales(), {});

    const { loadReparto, saveReparto, resetReparto } = await server.ssrLoadModule('/src/reparto-storage.js');
    const { loadImportReport, saveImportReport } = await server.ssrLoadModule('/src/import-report.js');
    legacy.set('gestor-reparto', JSON.stringify(octubre.reparto));
    assert.deepEqual(await loadReparto(), octubre.reparto);
    assert.equal(legacy.has('gestor-reparto'), false);
    await saveReparto(octubre.reparto);
    await resetReparto();
    assert.equal(await loadReparto(), null);
    disk.delete('gestor-importacion');
    legacy.set('gestor-importacion', JSON.stringify({ archivo: 'listado.xlsx' }));
    assert.deepEqual(await loadImportReport(), { archivo: 'listado.xlsx' });
    assert.equal(legacy.has('gestor-importacion'), false);
    await saveImportReport({ archivo: 'nuevo.xlsx' });
    assert.deepEqual(await loadImportReport(), { archivo: 'nuevo.xlsx' });

    meses['2026-09'] = registrarAtencion(cambiarOrigenRecuento(crearMensual('2026-09', 'Entidad'), true), {
      id: 'familia-atendida', numero: 42, personas: [{ titular: true, nombre: 'Ana', nacimiento: '1980-01-01' }],
    }, '2026-09-15');
    await saveMensuales(meses);
    assert.deepEqual((await loadMensuales())['2026-09'], meses['2026-09']);

    // IndexedDB sigue funcionando aunque el navegador deniegue localStorage.
    globalThis.localStorage = {
      getItem() { throw new DOMException('Acceso denegado', 'SecurityError'); },
      removeItem() { throw new DOMException('Acceso denegado', 'SecurityError'); },
    };
    disk.delete('gestor-reparto');
    assert.equal(await loadReparto(), null);
    await saveMensuales(meses);
    assert.deepEqual(await loadMensuales(), meses);

    // El mismo contrato se comprueba a través de los comandos reales del plugin
    // de Tauri, simulando únicamente el transporte nativo.
    globalThis.isTauri = true;
    let pending, persisted, release, hold = false;
    globalThis.window = { __TAURI_INTERNALS__: { invoke: async (cmd, args) => {
      if (cmd === 'plugin:store|load') { assert.equal(args.path, 'mensuales.json'); return 1; }
      if (cmd === 'plugin:store|set') { pending = structuredClone(args.value); return; }
      if (cmd === 'plugin:store|save') {
        if (hold) await new Promise(resolve => { release = resolve; });
        persisted = structuredClone(pending); return;
      }
      if (cmd === 'plugin:store|get') return [structuredClone(persisted), persisted !== undefined];
      throw new Error(`Comando inesperado: ${cmd}`);
    } } };
    await saveMensuales(meses);
    assert.deepEqual(await loadMensuales(), meses);
    hold = true;
    const third = saveMensuales(meses);
    for (let i = 0; i < 20 && !release; i++) await Promise.resolve();
    assert.equal(typeof release, 'function');
    octubre.tamanos[0] = 14;
    const fourth = saveMensuales(meses);
    hold = false; release();
    await Promise.all([third, fourth]);
    assert.equal((await loadMensuales())['2026-10'].tamanos[0], 14);
    assert.ok((await loadMensuales())['2026-11']);
  } finally {
    Object.assign(globalThis, previous);
    await server.close();
  }
});
