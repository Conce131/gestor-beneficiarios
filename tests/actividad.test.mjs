import test from 'node:test';
import assert from 'node:assert/strict';
import { iniciarSeguimiento, cambiarAlta, familiaEnMes, guardarVersiones, visibleEnTrimestre, activarAltas, actualizarAltas, familiasRecuentoTrimestral, resumenTrimestral, incorporarImportacion, validarSeguimiento } from '../src/actividad.mjs';
import { crearMensual, validarMensual, erroresExportacionMensual, resumenMensual } from '../src/mensual.mjs';
const familia = (numero = 12) => ({ id: `f-${numero}`, numero, personas: [{ id: `p-${numero}`, titular: true, nombre: 'Ana', apellidos: 'Prueba', documento: `DOC-${numero}`, nacimiento: '1980-01-01', derivacion: '2026-01-01', vigencia: '2027-01-01' }] });
const mensual = mes => crearMensual(mes, 'Entidad');

test('la baja de agosto sale del mensual de agosto, permanece en su trimestre y se archiva en octubre', () => {
  const original = iniciarSeguimiento(familia(), '2026-07');
  const baja = cambiarAlta(original, '2026-08', false);
  assert.equal(familiaEnMes(original, '2026-08').deAlta, true);
  assert.equal(resumenMensual(activarAltas(mensual('2026-07'), [baja])).personas, 1);
  for (const mes of ['2026-08', '2026-09', '2026-10']) assert.equal(resumenMensual(activarAltas(mensual(mes), [baja])).personas, 0);
  assert.equal(visibleEnTrimestre(baja, '2026-09'), true);
  assert.equal(visibleEnTrimestre(baja, '2026-10'), false);
  assert.equal(resumenTrimestral([baja], '2026-09').personas, 1);
  assert.equal(resumenTrimestral([baja], '2026-10').personas, 0);
  assert.equal(visibleEnTrimestre(baja, '2026-07'), true, 'el trimestre anterior sigue accesible');
});

test('la baja dentro del primer mes conserva la participación trimestral anterior a la baja', () => {
  const baja = cambiarAlta(iniciarSeguimiento(familia(), '2026-07'), '2026-07', false);
  assert.equal(activarAltas(mensual('2026-07'), [baja]).altas.length, 0);
  assert.equal(familiasRecuentoTrimestral([baja], '2026-09').length, 1);
});

test('la continuidad de alta se hereda y una reactivación no modifica la baja de meses anteriores', () => {
  const baja = cambiarAlta(iniciarSeguimiento(familia(), '2026-07'), '2026-08', false);
  const reactivada = cambiarAlta(baja, '2026-11', true);
  assert.equal(activarAltas(mensual('2026-10'), [reactivada]).altas.length, 0);
  assert.equal(activarAltas(mensual('2026-11'), [reactivada]).altas.length, 1);
  assert.equal(activarAltas(mensual('2026-12'), [reactivada]).altas.length, 1);
  assert.equal(visibleEnTrimestre(reactivada, '2027-01'), true);
});

test('la vigencia se evalúa al cierre: el día 90 cuenta y el 91 no; el trimestral conserva la participación', () => {
  const f = familia(); f.personas[0].vigencia = '2026-08-02';
  const vigente = iniciarSeguimiento(f, '2026-07');
  assert.equal(activarAltas(mensual('2026-10'), [vigente]).altas.length, 1, '31 de octubre: día 90');
  const antes = familia(); antes.personas[0].vigencia = '2026-08-01';
  const vencida = iniciarSeguimiento(antes, '2026-07');
  assert.equal(activarAltas(mensual('2026-10'), [vencida]).altas.length, 0);
  assert.equal(resumenTrimestral([vencida], '2026-12').familias, 1, 'estuvo vigente durante octubre');
  const sinVigencia = familia(); sinVigencia.personas[0].vigencia = '';
  assert.equal(activarAltas(mensual('2026-10'), [iniciarSeguimiento(sinVigencia, '2026-07')]).altas.length, 0);
});

test('editar miembros en agosto no modifica los miembros contados en julio y conserva la fecha de cierre', () => {
  const f = iniciarSeguimiento(familia(), '2026-07');
  const editada = structuredClone(f);
  editada.personas.push({ id: 'menor', menor: true, nacimiento: '2024-08-15', nombre: 'Niño' });
  const [guardada] = guardarVersiones([f], [editada], '2026-08');
  assert.equal(activarAltas(mensual('2026-07'), [guardada]).altas[0].personas.length, 1);
  const agosto = activarAltas(mensual('2026-08'), [guardada]);
  assert.equal(agosto.altas[0].personas.length, 2);
  assert.equal(agosto.altas[0].fecha, '2026-08-31');
  assert.deepEqual(agosto.edades, [0, 1, 0, 1]);
  assert.deepEqual(validarMensual(agosto), agosto);
  assert.deepEqual(erroresExportacionMensual(agosto), []);
  assert.equal(actualizarAltas(agosto, [cambiarAlta(guardada, '2026-09', false)]).altas.length, 1);
});

test('cambiar al criterio de altas conserva una copia de las cifras y las marcas anteriores', () => {
  const anterior = { ...mensual('2026-08'), tamanos: [3, ...Array(9).fill(0)], edades: [0, 0, 0, 3] };
  const datos = activarAltas(anterior, [iniciarSeguimiento(familia(), '2026-07')]);
  assert.deepEqual(datos.recuentoAnterior, { tamanos: anterior.tamanos, edades: anterior.edades, desdeAtenciones: false });
  assert.equal(datos.tamanos[0], 1);
  assert.equal(anterior.tamanos[0], 3);
  assert.deepEqual(validarMensual(datos).recuentoAnterior, datos.recuentoAnterior);
});

test('la importación conserva expedientes e históricos; las ausentes pasan a baja y las bajas no se reactivan', () => {
  const a = iniciarSeguimiento(familia(1), '2026-07');
  const b = cambiarAlta(iniciarSeguimiento(familia(2), '2026-07'), '2026-08', false);
  const nueva = familia(2); nueva.id = 'id-de-excel'; nueva.personas[0].nombre = 'Ana corregida';
  const next = guardarVersiones([a, b], incorporarImportacion([a, b], [nueva], '2026-09'), '2026-09');
  assert.equal(next.length, 2);
  assert.equal(familiaEnMes(next.find(f => f.id === a.id), '2026-09').deAlta, false);
  assert.equal(familiaEnMes(next.find(f => f.id === b.id), '2026-09').deAlta, false);
  assert.equal(familiaEnMes(next.find(f => f.id === b.id), '2026-07').personas[0].nombre, 'Ana');
  const colision = familia(1); colision.id = 'distinta'; colision.personas[0].documento = 'OTRO';
  assert.throws(() => incorporarImportacion([a], [colision], '2026-09'), /otro expediente/);
});

test('no se inventan meses anteriores al inicio del seguimiento y se rechazan historias dañadas', () => {
  const f = iniciarSeguimiento(familia(), '2026-10');
  assert.equal(familiaEnMes(f, '2026-09'), null);
  assert.throws(() => cambiarAlta(f, '2026-09', false), /anterior/);
  assert.throws(() => validarSeguimiento({ ...f.seguimiento, estados: [{ mes: '2026-10', alta: 'sí' }] }));
  assert.throws(() => validarSeguimiento({ ...f.seguimiento, versiones: [] }));
});

test('los meses anteriores a una migración no se exportan como un mensual vacío confirmado', () => {
  const migrada = iniciarSeguimiento(familia(), '2026-10', 'migracion');
  const septiembre = activarAltas(mensual('2026-09'), [migrada]);
  assert.equal(septiembre.historialIncompleto, true);
  assert.match(erroresExportacionMensual(septiembre).join(' '), /No hay historial suficiente/);
  assert.equal(validarMensual(septiembre).historialIncompleto, true);
  const nueva = iniciarSeguimiento(familia(), '2026-10');
  assert.equal(activarAltas(mensual('2026-09'), [nueva]).historialIncompleto, false, 'una nueva alta real no existía antes');
});
