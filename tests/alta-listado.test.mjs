import test from 'node:test';
import assert from 'node:assert/strict';
import { incorporarAlta } from '../src/alta-listado.mjs';

const hoy = new Date('2026-10-08T12:00:00');
const titular = { id: 't', titular: true, nombre: 'Ana', apellidos: 'Prueba', documento: 'TEST', nacimiento: '1980-01-01', derivacion: '2025-01-01', vigencia: '2027-01-01' };
const familias = [{ id: 'f', numero: 2, personas: [titular] }];

test('alta de familia reutiliza el primer número libre sin modificar las existentes', () => {
  const next = incorporarAlta(familias, { id: 'nueva', familiaId: null, persona: { ...titular, id: 'nuevo', titular: true } }, hoy);
  assert.equal(next[0].numero, 1);
  assert.equal(next[1].numero, 2);
  assert.deepEqual(familias, [{ id: 'f', numero: 2, personas: [titular] }]);
});

test('añade el adulto debajo, conservando datos y fechas actuales de la familia', () => {
  const next = incorporarAlta(familias, { familiaId: 'f', persona: { id: 'p', nombre: 'Luis', apellidos: 'Prueba', documento: '', nacimiento: '1990-01-01', vigencia: '2000-01-01' } }, hoy);
  assert.equal(next[0].personas.length, 2);
  assert.equal(next[0].personas[1].titular, false);
  assert.equal(next[0].personas[1].vigencia, '2027-01-01');
  assert.equal(next[0].personas[1].derivacion, '2025-01-01');
  assert.deepEqual(next[0].personas[0], titular);
  assert.equal(familias[0].personas.length, 1);
});

test('permite un menor con nacimiento y sin nombre ni documento', () => {
  const next = incorporarAlta(familias, { familiaId: 'f', persona: { id: 'menor', nombre: '', apellidos: '', documento: '', nacimiento: '2020-03-01' } }, hoy);
  assert.equal(next[0].personas[1].menor, true);
});

test('rechaza filas incompletas y fechas inválidas sin alterar datos guardados', () => {
  assert.throws(() => incorporarAlta(familias, { id: 'n', persona: { id: 'p', nombre: 'Ana', apellidos: '', documento: '' } }, hoy), /Completa/);
  assert.throws(() => incorporarAlta(familias, { familiaId: 'f', persona: { id: 'p', nombre: 'Luis', apellidos: 'Prueba', nacimiento: '2026-02-30' } }, hoy), /fecha válida/);
  assert.throws(() => incorporarAlta(familias, { familiaId: 'f', persona: { id: 'p', nombre: 'Luis', apellidos: 'Prueba', nacimiento: '2027-01-01' } }, hoy), /futura/);
  assert.throws(() => incorporarAlta(familias, { familiaId: 'inexistente', persona: { id: 'p' } }, hoy), /ya no existe/);
  assert.throws(() => incorporarAlta(familias, { familiaId: 'f', persona: titular }, hoy), /ya se ha añadido/);
  assert.equal(familias[0].personas.length, 1);
});
