import test from 'node:test';
import assert from 'node:assert/strict';
import { editarPersona, eliminarMiembro, restaurarMiembro } from '../src/edicion-listado.mjs';

const hoy = new Date('2026-10-07T12:00:00');
const familia = { id: 'f', numero: 42, personas: [
  { id: 'a', titular: true, nombre: 'Titular ficticio', apellidos: 'Prueba', documento: 'FICTICIO', nacimiento: '1980-01-01', vigencia: '2027-01-01' },
  { id: 'b', titular: false, menor: true, nombre: '', apellidos: '', documento: '', nacimiento: '2020-01-01', vigencia: '2027-01-01' },
] };

test('edita un dato y conserva la referencia y los datos originales', () => {
  const copia = editarPersona(familia, 'a', 'nombre', 'Otro nombre ficticio', hoy);
  assert.equal(copia.numero, 42);
  assert.equal(copia.personas[0].nombre, 'Otro nombre ficticio');
  assert.equal(familia.personas[0].nombre, 'Titular ficticio');
  assert.deepEqual(copia.personas[1], familia.personas[1]);
});

test('cambiar vigencia desde un miembro actualiza toda la familia', () => {
  const copia = editarPersona(familia, 'b', 'vigencia', '2028-02-01', hoy);
  assert.deepEqual(copia.personas.map(p => p.vigencia), ['2028-02-01', '2028-02-01']);
  assert.equal(familia.personas[0].vigencia, '2027-01-01');
});

test('impide guardar datos incompletos o fechas imposibles sin alterar la familia', () => {
  assert.throws(() => editarPersona(familia, 'a', 'documento', '', hoy), /Completa documento/);
  assert.throws(() => editarPersona(familia, 'a', 'nacimiento', '2026-02-30', hoy), /fecha válida/);
  assert.throws(() => editarPersona(familia, 'a', 'nacimiento', '2027-01-01', hoy), /futura/);
  assert.throws(() => editarPersona(familia, 'b', 'nacimiento', '2000-01-01', hoy), /Completa nombre/);
  assert.throws(() => editarPersona(familia, 'a', 'numero', 1, hoy), /no se puede editar/);
  assert.equal(familia.numero, 42);
});

test('borrar un miembro conserva al titular y no permite borrarlo desde la fila', () => {
  const copia = eliminarMiembro(familia, 'b');
  assert.equal(copia.numero, 42);
  assert.deepEqual(copia.personas, [familia.personas[0]]);
  assert.equal(familia.personas.length, 2);
  assert.throws(() => eliminarMiembro(familia, 'a'), /titular/);
  assert.throws(() => eliminarMiembro(familia, 'inexistente'), /No se encontró/);
});

test('deshacer recupera solo el miembro y conserva las ediciones posteriores de la familia', () => {
  const sinMiembro = eliminarMiembro(familia, 'b');
  const editada = editarPersona(sinMiembro, 'a', 'nombre', 'Nombre actualizado', hoy);
  const recuperada = restaurarMiembro(editada, familia.personas[1], 1);
  assert.equal(recuperada.personas.length, 2);
  assert.equal(recuperada.personas[0].nombre, 'Nombre actualizado');
  assert.deepEqual(recuperada.personas[1], familia.personas[1]);
  assert.equal(editada.personas.length, 1);
  assert.throws(() => restaurarMiembro(recuperada, familia.personas[1], 1), /ya está/);
});

test('un identificador duplicado no permite borrar varias filas por accidente', () => {
  const duplicada = structuredClone(familia);
  duplicada.personas.push({ ...duplicada.personas[1] });
  assert.throws(() => eliminarMiembro(duplicada, 'b'), /duplicado/);
  assert.equal(duplicada.personas.length, 3);
});
