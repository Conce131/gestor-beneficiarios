import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coincideNumeroFamilia } from '../src/busqueda.mjs';

test('Buscar familia 12 excluye 120 y 112', () => {
  assert.deepEqual([12, 120, 112].filter(n => coincideNumeroFamilia(n, '12')), [12]);
  assert.equal(coincideNumeroFamilia(120, '120'), true);
});

test('El filtro vacío incluye todas y acepta espacios y ceros iniciales', () => {
  assert.equal(coincideNumeroFamilia(12, ''), true);
  assert.equal(coincideNumeroFamilia(12, ' 012 '), true);
  for (const consulta of ['12a', '1.2', '-12', '1e2']) {
    assert.equal(coincideNumeroFamilia(12, consulta), false);
  }
});
