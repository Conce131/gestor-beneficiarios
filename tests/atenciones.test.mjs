import test from 'node:test';
import assert from 'node:assert/strict';
import { crearMensual, validarMensual, validarMensuales, erroresExportacionMensual, resumenMensual } from '../src/mensual.mjs';
import { marcarAtencionRapida, sincronizarAtenciones, cambiarFechaAtencion, fechaParaAtenciones, registrarAtencion, quitarAtencion, recuentoAtenciones, cambiarOrigenRecuento, filasAtenciones } from '../src/atenciones.mjs';

const familia = (numero = 12) => ({ id: `f-${numero}`, numero, personas: [
  { id: 'titular', titular: true, nombre: 'Ana', apellidos: 'Prueba', documento: 'DOC-12', nacimiento: '1980-01-01', vigencia: '2020-01-01' },
  { id: 'menor', titular: false, menor: true, nombre: '', nacimiento: '' },
] });
const mes = (periodo = '2026-10') => cambiarOrigenRecuento(crearMensual(periodo, 'Entidad'), true);

test('una familia atendida cuenta una sola vez en el mes, con independencia de la vigencia trimestral', () => {
  const datos = mes(), original = structuredClone(datos), f = familia();
  const marcado = registrarAtencion(datos, f, '2026-10-05');
  const repetido = registrarAtencion(marcado, f, '2026-10-20');
  assert.deepEqual(datos, original);
  assert.equal(repetido.atenciones.length, 1);
  assert.equal(repetido.atenciones[0].fecha, '2026-10-05');
  assert.deepEqual(repetido.tamanos, [0, 1, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(repetido.edades, [1, 0, 0, 1]);
  assert.equal(resumenMensual(repetido).personas, 2);
  assert.deepEqual(erroresExportacionMensual(repetido), []);
});

test('las atenciones de dos o tres meses del trimestre son independientes y el nuevo mes empieza sin marcas', () => {
  const octubre = registrarAtencion(mes(), familia(), '2026-10-05');
  const noviembre = registrarAtencion(mes('2026-11'), familia(), '2026-11-05');
  const diciembre = mes('2026-12');
  const guardados = validarMensuales({ '2026-10': octubre, '2026-11': noviembre, '2026-12': diciembre });
  const sinOctubre = quitarAtencion(guardados['2026-10'], 12);
  assert.equal(sinOctubre.atenciones.length, 0);
  assert.equal(guardados['2026-11'].atenciones.length, 1);
  assert.equal(guardados['2026-12'].atenciones.length, 0);
  assert.equal(resumenMensual(sinOctubre).personas, 0);
  assert.equal(resumenMensual(guardados['2026-11']).personas, 2);
});

test('las edades se calculan en la fecha de atención, con los límites de 3 y 18 años', () => {
  const f = familia();
  f.personas = [
    { nombre: 'Adulto', titular: true, nacimiento: '1980-01-01' },
    { nombre: 'Cumple tres', nacimiento: '2023-10-10', menor: true },
    { nombre: 'Cumple dieciocho', nacimiento: '2008-10-10', menor: true },
  ];
  const antes = registrarAtencion(mes(), f, '2026-10-09');
  const despues = registrarAtencion(mes(), f, '2026-10-10');
  assert.deepEqual(antes.edades, [0, 1, 1, 1]);
  assert.deepEqual(despues.edades, [0, 0, 1, 2]);
});

test('los miembros atendidos se conservan aunque se edite, borre o reimporte el listado', () => {
  const f = familia();
  const marcado = registrarAtencion(mes(), f, '2026-10-05');
  f.personas[0].nombre = 'Nombre editado';
  f.personas.push({ nombre: 'Nuevo miembro', nacimiento: '2010-01-01' });
  assert.equal(marcado.atenciones[0].titular, 'Ana Prueba');
  assert.equal(marcado.atenciones[0].personas.length, 2);
  const historicas = filasAtenciones(marcado, []);
  assert.equal(historicas[0].familia, null);
  assert.equal(historicas[0].miembros, 2);
  f.id = 'id-tras-importar';
  const repetido = registrarAtencion(marcado, f, '2026-10-20');
  assert.equal(repetido.atenciones.length, 1);
  assert.equal(repetido.atenciones[0].personas.length, 2);
  assert.equal(filasAtenciones(marcado, [f]).length, 1);
  const actualizado = registrarAtencion(marcado, f, '2026-10-20', { actualizar: true });
  assert.equal(actualizado.atenciones[0].personas.length, 3);
  assert.equal(actualizado.atenciones[0].fecha, '2026-10-05');
  assert.equal(marcado.atenciones[0].personas.length, 2);
});

test('las fechas ausentes o inválidas de adultos bloquean el Excel; los menores declarados sin nacimiento tienen su grupo', () => {
  for (const nacimiento of ['', '2026-02-30', '2030-01-01']) {
    const f = familia(); f.personas[0].nacimiento = nacimiento;
    const datos = registrarAtencion(mes(), f, '2026-10-05');
    assert.equal(recuentoAtenciones(datos).pendientes.length, 1);
    assert.equal(datos.edades[0], 1);
    assert.ok(erroresExportacionMensual(datos).some(e => e.includes('fecha de nacimiento')));
  }
});

test('se registran familias mayores de diez sin ocultarlas ni generar un modelo con tamaños incorrectos', () => {
  const f = familia();
  f.personas = Array.from({ length: 11 }, (_, i) => ({ nombre: `Persona ${i}`, nacimiento: '1980-01-01', titular: i === 0 }));
  const datos = registrarAtencion(mes(), f, '2026-10-05');
  assert.equal(recuentoAtenciones(datos).personas, 11);
  assert.deepEqual(recuentoAtenciones(datos).fueraDeModelo, [12]);
  assert.ok(erroresExportacionMensual(datos).some(e => e.includes('más de 10')));
});

test('no se calcula un reparto incorrecto cuando las edades pendientes y un tamaño no admitido compensan sus diferencias', () => {
  const grande = familia();
  grande.personas = Array.from({ length: 11 }, (_, i) => ({ nombre: `Persona ${i}`, nacimiento: '', titular: i === 0 }));
  const pequena = familia(20);
  pequena.personas = [{ titular: true, nombre: 'Adulto', nacimiento: '1980-01-01' }];
  let datos = registrarAtencion(mes(), grande, '2026-10-05');
  datos = registrarAtencion(datos, pequena, '2026-10-05');
  assert.equal(resumenMensual(datos).coincide, true);
  assert.equal(resumenMensual(datos).puedeRepartir, false);
  assert.equal(erroresExportacionMensual(datos).length, 2);
});

test('los meses manuales anteriores se conservan y se puede cambiar de modo manteniendo las marcas', () => {
  const manual = crearMensual('2026-10', 'Entidad');
  manual.tamanos[0] = 8; manual.edades[3] = 8;
  assert.deepEqual(validarMensual(manual), manual);
  const marcado = registrarAtencion(cambiarOrigenRecuento(manual, true), familia(), '2026-10-05');
  const vuelta = cambiarOrigenRecuento(marcado, false);
  vuelta.tamanos[0] = 10;
  assert.equal(vuelta.atenciones.length, 1);
  assert.equal(validarMensual(vuelta).tamanos[0], 10);
  const automatico = cambiarOrigenRecuento(vuelta, true);
  assert.equal(automatico.tamanos[0], 0);
  assert.equal(automatico.tamanos[1], 1);
  const alterado = { ...automatico, tamanos: Array(10).fill(9) };
  assert.deepEqual(validarMensual(alterado).tamanos, automatico.tamanos);
});

test('no acepta fechas de otro mes, atenciones duplicadas ni familias sin miembros', () => {
  assert.throws(() => registrarAtencion(mes(), familia(), '2026-11-05'), /inválida/);
  assert.throws(() => registrarAtencion(mes(), familia(), '2026-10-32'), /inválida/);
  assert.throws(() => registrarAtencion(mes(), { ...familia(), personas: [{ titular: true }] }, '2026-10-05'), /miembros/);
  assert.throws(() => registrarAtencion(crearMensual('2026-10'), familia(), '2026-10-05'), /Activa/);
  const datos = registrarAtencion(mes(), familia(), '2026-10-05');
  assert.throws(() => validarMensual({ ...datos, atenciones: [...datos.atenciones, ...datos.atenciones] }), /repetida/);
});

test('permite localizar familias por número, titular o documento y filtrar atendidas y pendientes', () => {
  const datos = registrarAtencion(mes(), familia(), '2026-10-05'), families = [familia(), familia(20)];
  assert.deepEqual(filasAtenciones(datos, families, '12').map(f => f.numero), [12]);
  assert.equal(filasAtenciones(datos, families, 'ana').length, 2);
  assert.equal(filasAtenciones(datos, families, 'DOC-12').length, 2);
  assert.deepEqual(filasAtenciones(datos, families, '', 'atendidas').map(f => f.numero), [12]);
  assert.deepEqual(filasAtenciones(datos, families, '', 'pendientes').map(f => f.numero), [20]);
});

test('la fecha inicial usa hoy en el mes actual y el cierre en meses pasados, sin cambiar con la zona horaria', () => {
  assert.equal(fechaParaAtenciones('2026-10', '2026-10-22'), '2026-10-22');
  assert.equal(fechaParaAtenciones('2026-02', '2026-10-22'), '2026-02-28');
  assert.equal(fechaParaAtenciones('2024-02', '2026-10-22'), '2024-02-29');
  assert.equal(fechaParaAtenciones('2026-11', '2026-10-22'), '2026-11-01');
});

test('editar el listado sincroniza solo el mes indicado y conserva fecha y familias ausentes', () => {
  const f = familia();
  const octubre = registrarAtencion(mes(), f, '2026-10-05');
  const noviembre = registrarAtencion(mes('2026-11'), f, '2026-11-05');
  const corregida = structuredClone(f);
  corregida.personas[1].nacimiento = '2025-01-01';
  const actualizado = sincronizarAtenciones(octubre, [f], [corregida]);
  assert.equal(actualizado.atenciones[0].fecha, '2026-10-05');
  assert.deepEqual(actualizado.edades, [0, 1, 0, 1]);
  assert.deepEqual(noviembre.edades, [1, 0, 0, 1]);
  assert.equal(sincronizarAtenciones(octubre, [f], []), octubre);
  const manual = cambiarOrigenRecuento(octubre, false);
  const sincronizadoManual = sincronizarAtenciones(manual, [f], [corregida]);
  assert.deepEqual(sincronizadoManual.edades, manual.edades);
  assert.equal(sincronizadoManual.atenciones[0].personas[1].nacimiento, '2025-01-01');
});

test('corregir fecha recalcula edades conservando los miembros y exige una fecha del mes', () => {
  const f = familia();
  f.personas[1].nacimiento = '2023-10-15';
  const datos = registrarAtencion(mes(), f, '2026-10-05');
  const actualizado = cambiarFechaAtencion(datos, 12, '2026-10-20');
  assert.deepEqual(actualizado.edades, [0, 0, 1, 1]);
  assert.deepEqual(actualizado.atenciones[0].personas, datos.atenciones[0].personas);
  assert.equal(datos.atenciones[0].fecha, '2026-10-05');
  for (const fecha of ['', '2026-11-01', '2026-10-32']) {
    assert.throws(() => cambiarFechaAtencion(datos, 12, fecha));
  }
});

test('marcación rápida exige número exacto, no duplica ni cambia la fecha de una atención', () => {
  const familias = [familia(12), familia(120)];
  const inicial = mes();
  const resultado = marcarAtencionRapida(inicial, familias, ' 12 ', '2026-10-05');
  assert.equal(resultado.numero, 12);
  assert.equal(resultado.yaAtendida, false);
  assert.equal(resultado.datos.atenciones.length, 1);
  assert.equal(inicial.atenciones.length, 0);
  const repetida = marcarAtencionRapida(resultado.datos, familias, '12', '2026-10-20');
  assert.equal(repetida.yaAtendida, true);
  assert.equal(repetida.datos.atenciones[0].fecha, '2026-10-05');
  for (const consulta of ['', 'Ana', '1', '12abc', '999']) {
    assert.throws(() => marcarAtencionRapida(inicial, familias, consulta, '2026-10-05'));
  }
  assert.throws(() => marcarAtencionRapida(crearMensual('2026-10'), familias, '12', '2026-10-05'));
  assert.throws(() => marcarAtencionRapida(inicial, familias, '12', '2026-11-05'));
});
