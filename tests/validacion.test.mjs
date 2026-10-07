import { test } from 'node:test';
import assert from 'node:assert/strict';
import { errorFamilia, erroresFamilia } from '../src/validacion.mjs';

const hoy = new Date(2026, 9, 7);
const titular = { titular: true, nombre: 'Ana', apellidos: 'Pérez', documento: 'ABC' };
const validar = (...personas) => errorFamilia({ personas }, hoy);

test('Una familia vacía muestra todos los campos obligatorios del titular', () => {
  const errores = erroresFamilia({ personas: [{ titular: true }] }, hoy);
  assert.deepEqual(errores.map(error => error.campo), ['nombre', 'apellidos', 'documento']);
  assert.ok(errores.every(error => error.indice === 0 && error.mensaje));
});

test('Recoge errores de distintos miembros y fechas en una misma revisión', () => {
  const errores = erroresFamilia({ personas: [
    { ...titular, nacimiento: '2026-02-30' },
    { nombre: 'Luis', documento: '  ', vigencia: 'incorrecta' },
  ] }, hoy);
  assert.deepEqual(errores.map(error => [error.indice, error.campo]), [
    [0, 'nacimiento'], [1, 'apellidos'], [1, 'vigencia'],
  ]);
});

test('Una familia necesita titular completo y no admite miembros adultos vacíos', () => {
  assert.ok(validar());
  assert.ok(validar({ ...titular, nombre: '  ' }));
  assert.equal(validar(titular), null);
  assert.equal(validar(titular, {}).indice, 1);
  assert.equal(validar(titular, { nombre: 'Luis', apellidos: 'Pérez' }), null);
  assert.ok(validar(titular, titular));
});

test('Solo el titular necesita documento, incluso al cambiar quién es titular', () => {
  const miembro = { nombre: 'Luis', apellidos: 'Pérez', documento: '  ' };
  assert.equal(validar(titular, miembro), null);
  assert.equal(validar({ ...titular, documento: '' }).campo, 'documento');
  assert.equal(validar({ ...titular, titular: false }, { ...miembro, titular: true }).campo, 'documento');
  assert.equal(validar({ ...titular, titular: false, documento: '' }, { ...miembro, titular: true, documento: 'XYZ' }), null);
});

test('Un menor sin identidad necesita una fecha que confirme su edad', () => {
  assert.ok(validar(titular, { menor: true }));
  assert.equal(validar(titular, { menor: true, nacimiento: '2016-10-07' }), null);
  assert.equal(validar(titular, { menor: true, nacimiento: '2008-10-08' }), null);
  assert.ok(validar(titular, { menor: true, nacimiento: '2008-10-07' }));
  assert.ok(validar(titular, { menor: true, nacimiento: '2026-10-08' }));
});

test('Rechaza fechas imposibles y nacimientos futuros', () => {
  for (const nacimiento of ['2026-02-30', '2026-13-01', 'fecha', '2027-01-01']) {
    assert.equal(validar({ ...titular, nacimiento }).campo, 'nacimiento');
  }
  assert.equal(validar({ ...titular, nacimiento: '2000-02-29' }), null);
});
