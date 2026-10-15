import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('la confirmación espera la respuesta nativa y respeta Cancelar', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } });
  const previousWindow = globalThis.window;
  const previousTauri = globalThis.isTauri;
  try {
    globalThis.isTauri = true;
    let respond;
    globalThis.window = { __TAURI_INTERNALS__: { invoke: (command, args) => {
      assert.equal(command, 'plugin:dialog|message');
      assert.equal(args.message, '¿Sustituir los datos?');
      return new Promise(resolve => { respond = resolve; });
    } } };
    const { confirm } = await server.ssrLoadModule('/src/dialogs.js');
    let settled = false;
    const cancelled = confirm('¿Sustituir los datos?').then(value => { settled = true; return value; });
    await Promise.resolve();
    assert.equal(settled, false);
    respond('Cancelar');
    assert.equal(await cancelled, false);
    const accepted = confirm('¿Sustituir los datos?');
    respond('Continuar');
    assert.equal(await accepted, true);
    globalThis.isTauri = false;
    globalThis.window = { confirm: () => false };
    assert.equal(await confirm('¿Sustituir los datos?'), false);
  } finally {
    globalThis.window = previousWindow;
    globalThis.isTauri = previousTauri;
    await server.close();
  }
});
