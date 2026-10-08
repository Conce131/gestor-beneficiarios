import test from 'node:test';
import assert from 'node:assert/strict';
import { numeroLibre } from '../src/numeracion.mjs';

test('asigna el menor número libre sin cambiar las referencias existentes', () => {
  const familias = [{ numero: 4 }, { numero: 1 }, { numero: 3 }];
  assert.equal(numeroLibre(familias), 2);
  assert.deepEqual(familias.map(f => f.numero), [4, 1, 3]);
  familias.push({ numero: 2 });
  assert.equal(numeroLibre(familias), 5);
  familias.splice(familias.findIndex(f => f.numero === 3), 1);
  assert.equal(numeroLibre(familias), 3);
  assert.deepEqual(familias.map(f => f.numero), [4, 1, 2]);
});

test('permite empezar un listado y reutilizar números de listados importados', () => {
  assert.equal(numeroLibre([]), 1);
  assert.equal(numeroLibre([{ numero: 12 }, { numero: 120 }]), 1);
  assert.equal(numeroLibre([{ numero: '1' }, { numero: 3 }]), 2);
});
