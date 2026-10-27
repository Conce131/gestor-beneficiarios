import test from 'node:test';
import assert from 'node:assert/strict';
import { detalleErrorExcel, pasoExcel } from '../src/excel-errors.mjs';

test('conserva los errores de Tauri enviados como texto, con el paso donde fallaron', async () => {
  await assert.rejects(pasoExcel('No se pudo guardar', () => Promise.reject('Access denied')), {
    message: 'No se pudo guardar: Access denied', cause: 'Access denied',
  });
});

test('conserva los errores de JavaScript y no muestra undefined sin detalle', async () => {
  const causa = new Error('Fecha inválida');
  await assert.rejects(pasoExcel('Preparar Excel', () => { throw causa; }), {
    message: 'Preparar Excel: Fecha inválida', cause: causa,
  });
  assert.equal(detalleErrorExcel(undefined), 'No se recibió información adicional del error.');
  assert.equal(await pasoExcel('Preparar Excel', () => 42), 42);
});
