import { test } from 'node:test';
import assert from 'node:assert/strict';
import { errorFamilia, erroresFamilia } from '../src/validacion.mjs';

const hoy = new Date(2026, 9, 7);
const titular = { titular: true, nombre: 'Ana', apellidos: 'Pérez', documento: 'ABC', nacimiento: '1980-01-01', derivacion: '2026-01-01', vigencia: '2027-01-01' };
const validar = (...personas) => errorFamilia({ personas }, hoy);

test('Una familia vacía muestra todos los campos obligatorios del titular', () => {
  const errores = erroresFamilia({ personas: [{ titular: true, nacimiento: '1980-01-01' }] }, hoy);
  assert.deepEqual(errores.map(error => error.campo), ['nombre', 'apellidos', 'documento', 'derivacion', 'vigencia']);
  assert.ok(errores.every(error => error.indice === 0 && error.mensaje));
});

test('Recoge errores de distintos miembros y fechas en una misma revisión', () => {
  const errores = erroresFamilia({ personas: [
    { ...titular, nacimiento: '2026-02-30' },
    { nombre: 'Luis', documento: '  ', vigencia: 'incorrecta' },
  ] }, hoy);
  assert.deepEqual(errores.map(error => [error.indice, error.campo]), [
    [0, 'nacimiento'], [1, 'apellidos'], [1, 'documento'], [1, 'nacimiento'], [1, 'vigencia'],
  ]);
});

test('Una familia necesita titular completo y no admite miembros adultos vacíos', () => {
  assert.ok(validar());
  assert.ok(validar({ ...titular, nombre: '  ' }));
  assert.equal(validar(titular), null);
  assert.equal(validar(titular, {}).indice, 1);
  assert.equal(validar(titular, { nombre: 'Luis', apellidos: 'Pérez', documento: 'XYZ', nacimiento: '1990-01-01' }), null);
  assert.ok(validar(titular, titular));
});

test('Todos los adultos necesitan documento y los menores pueden dejarlo vacío', () => {
  const miembro = { nombre: 'Luis', apellidos: 'Pérez', documento: '  ', nacimiento: '1990-01-01' };
  assert.equal(validar(titular, miembro).campo, 'documento');
  assert.equal(validar({ ...titular, documento: '' }).campo, 'documento');
  assert.equal(validar(titular, { ...miembro, documento: 'XYZ' }), null);
  assert.equal(validar(titular, { menor: true, documento: '' }), null);
});

test('Acepta documentos sin letras, como algunos pasaportes extranjeros', () => {
  assert.equal(validar({ ...titular, documento: '12345678' }), null);
  assert.equal(validar({ ...titular, documento: '12345678Z' }), null);
  assert.equal(validar(titular, { nombre: 'Luis', apellidos: 'Pérez', documento: '123456', nacimiento: '1990-01-01' }), null);
});

test('Un menor sin identidad necesita una fecha que confirme su edad', () => {
  assert.equal(validar(titular, { menor: true }), null);
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

test('La fecha de derivación no puede ser futura', () => {
  assert.deepEqual(validar({ ...titular, derivacion: '2026-10-08' }), {
    indice: 0, campo: 'derivacion', mensaje: 'La fecha de derivación no puede ser futura.',
  });
  assert.equal(validar({ ...titular, derivacion: '2026-10-07' }), null);
});

test('La derivación del titular es obligatoria y puede completarse después en el listado', () => {
  assert.equal(validar({ ...titular, derivacion: '' }).campo, 'derivacion');
  assert.deepEqual(erroresFamilia({ personas: [{ ...titular, derivacion: '' }] }, hoy, { permitirIncompletos: true }), []);
});

test('Todo adulto necesita nacimiento aunque tenga documento; se permite guardar el borrador', () => {
  const adulto = { nombre: 'Luis', apellidos: 'Pérez', documento: 'XYZ' };
  assert.equal(validar(titular, adulto).campo, 'nacimiento');
  assert.deepEqual(erroresFamilia({ personas: [titular, adulto] }, hoy, { permitirIncompletos: true }), []);
});
