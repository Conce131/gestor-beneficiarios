import test from 'node:test';
import assert from 'node:assert/strict';
import { pngBytes } from '../src/png.mjs';

test('convierte un PNG en los bytes originales sin conexiones fetch', () => {
  const original = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO1sAAAAASUVORK5CYII=', 'base64');
  const previous = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('CSP: conexión bloqueada'); };
  try {
    assert.deepEqual(pngBytes(`data:image/png;base64,${original.toString('base64')}`), new Uint8Array(original));
  } finally { globalThis.fetch = previous; }
});

test('rechaza capturas vacías, tipos incorrectos y datos corruptos', () => {
  for (const value of [null, 'data:,', 'data:image/jpeg;base64,AAAA', 'data:image/png;base64,', 'data:image/png;base64,AAAA', 'data:image/png;base64,???']) {
    assert.throws(() => pngBytes(value));
  }
});
