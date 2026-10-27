import test from 'node:test';
import assert from 'node:assert/strict';
import { HistorialCeldas, mismaEstructura } from '../src/historial-celdas.mjs';
import { editarPersona } from '../src/edicion-listado.mjs';
import { guardarVersiones, familiaEnMes } from '../src/actividad.mjs';

const hoy = new Date('2026-10-27T12:00:00');
const original = { id: 'f1', numero: 12, personas: [
  { id: 'p1', titular: true, nombre: 'Ana', apellidos: 'Prueba', documento: 'ABC', nacimiento: '1980-01-01', derivacion: '2026-01-01', vigencia: '2027-01-01', serviciosSociales: true },
  { id: 'p2', titular: false, menor: true, nacimiento: '2016-01-01', documento: '', derivacion: '2026-01-01', vigencia: '2027-01-01', serviciosSociales: true },
] };
const contexto = { mes: '2026-10', personaId: 'p1', campo: 'nombre' };
function aplicar(historial, familias, rehacer = false) {
  const operacion = historial.preparar(familias, '2026-10', rehacer);
  historial.confirmar(operacion);
  return operacion.familias;
}

test('deshace varias celdas en orden y las rehace sin cambiar otras familias', () => {
  const h = new HistorialCeldas();
  const otra = { id: 'f2', numero: 99, personas: [{ id: 'p3', nombre: 'Otra familia' }] };
  const a = editarPersona(original, 'p1', 'nombre', 'Ana nueva', hoy);
  const b = editarPersona(a, 'p1', 'apellidos', 'Otro apellido', hoy);
  h.registrar(original, a, contexto);
  h.registrar(a, b, { ...contexto, campo: 'apellidos' });
  let familias = aplicar(h, [b, otra]);
  assert.deepEqual(familias[0].personas, a.personas);
  familias = aplicar(h, familias);
  assert.deepEqual(familias[0].personas, original.personas);
  familias = aplicar(h, aplicar(h, familias, true), true);
  assert.deepEqual(familias[0].personas, b.personas);
  assert.equal(familias[1], otra);
  assert.equal(original.personas[0].nombre, 'Ana');
});

test('las fechas compartidas se recuperan juntas y conservan los meses anteriores', () => {
  const h = new HistorialCeldas();
  const septiembre = guardarVersiones([], [original], '2026-09');
  const renovada = editarPersona(septiembre[0], 'p1', 'vigencia', '2028-02-01', hoy);
  const octubre = guardarVersiones(septiembre, [renovada], '2026-10');
  h.registrar(septiembre[0], renovada, { ...contexto, campo: 'vigencia' });
  const recuperada = guardarVersiones(octubre, aplicar(h, octubre), '2026-10');
  assert.deepEqual(recuperada[0].personas.map(p => p.vigencia), ['2027-01-01', '2027-01-01']);
  assert.equal(familiaEnMes(recuperada[0], '2026-09').personas[0].vigencia, '2027-01-01');
  assert.equal(octubre[0].personas[0].vigencia, '2028-02-01');
});

test('recupera nacimiento y condición de menor sin exigir su documentación', () => {
  const h = new HistorialCeldas();
  const adulta = editarPersona(original, 'p2', 'nacimiento', '2000-01-01', hoy);
  h.registrar(original, adulta, { ...contexto, personaId: 'p2', campo: 'nacimiento' });
  const menor = aplicar(h, [adulta])[0].personas[1];
  assert.equal(menor.nacimiento, '2016-01-01');
  assert.equal(menor.menor, true);
  assert.equal(menor.documento, '');
});

test('el origen compartido y sus propiedades opcionales se restauran exactamente', () => {
  const h = new HistorialCeldas();
  const cambiada = editarPersona(original, 'p1', 'serviciosSociales', false, hoy);
  h.registrar(original, cambiada, { ...contexto, campo: 'serviciosSociales' });
  assert.deepEqual(aplicar(h, [cambiada])[0], original);
});

test('preparar no consume el historial hasta confirmar el guardado', () => {
  const h = new HistorialCeldas();
  const editada = editarPersona(original, 'p1', 'nombre', 'Nombre nuevo', hoy);
  h.registrar(original, editada, contexto);
  const intento = h.preparar([editada], '2026-10');
  assert.equal(h.atras.length, 1);
  assert.equal(h.adelante.length, 0);
  assert.deepEqual(h.preparar([editada], '2026-10'), intento);
  h.confirmar(intento);
  assert.equal(h.atras.length, 0);
  assert.equal(h.adelante.length, 1);
});

test('una nueva edición descarta rehacer y los cambios sin efecto no crean pasos', () => {
  const h = new HistorialCeldas();
  const editada = editarPersona(original, 'p1', 'nombre', 'Nombre nuevo', hoy);
  assert.equal(h.registrar(original, structuredClone(original), contexto), false);
  h.registrar(original, editada, contexto);
  const recuperada = aplicar(h, [editada])[0];
  const siguiente = editarPersona(recuperada, 'p1', 'nombre', 'Otro nombre', hoy);
  h.registrar(recuperada, siguiente, contexto);
  assert.equal(h.preparar([siguiente], '2026-10', true), null);
});

test('no sobrescribe datos modificados por otra operación ni reutiliza otro mes', () => {
  const h = new HistorialCeldas();
  const editada = editarPersona(original, 'p1', 'nombre', 'Nombre nuevo', hoy);
  h.registrar(original, editada, contexto);
  const otraEdicion = editarPersona(editada, 'p1', 'nombre', 'Valor posterior', hoy);
  assert.throws(() => h.preparar([otraEdicion], '2026-10'), /datos han cambiado/);
  assert.throws(() => h.preparar([], '2026-10'), /ya no existe/);
  assert.equal(h.preparar([editada], '2026-11'), null);
  assert.equal(h.atras.length, 0);
});

test('limita la memoria y detecta altas y borrados que invalidan el historial', () => {
  const h = new HistorialCeldas(2);
  let actual = original;
  for (const nombre of ['A', 'B', 'C']) {
    const siguiente = editarPersona(actual, 'p1', 'nombre', nombre, hoy);
    h.registrar(actual, siguiente, contexto);
    actual = siguiente;
  }
  assert.equal(h.atras.length, 2);
  assert.equal(mismaEstructura([original], [actual]), true);
  assert.equal(mismaEstructura([original], []), false);
  assert.equal(mismaEstructura([original], [{ ...original, personas: [original.personas[0]] }]), false);
});
