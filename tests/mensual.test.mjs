import test from 'node:test';
import assert from 'node:assert/strict';
import { crearMensual, validarMensual, validarMensuales, resumenMensual, estadoMensual, erroresExportacionMensual, mesValido } from '../src/mensual.mjs';
import { envases } from '../src/reparto.mjs';

test('las casillas vacías suman cero y pueden generar el resumen si los totales coinciden', () => {
  const m = crearMensual('2026-10');
  assert.deepEqual(validarMensual(m), m);
  assert.equal(resumenMensual(m).personas, 0);
  assert.equal(resumenMensual(m).porEdad, 0);
  assert.equal(resumenMensual(m).coincide, true);
  assert.equal(resumenMensual(m).puedeRepartir, false);
  assert.deepEqual(erroresExportacionMensual(m), ['Escribe el nombre de la entidad.']);
  m.entidad = 'Entidad';
  assert.deepEqual(erroresExportacionMensual(m), []);
  m.tamanos.fill(0); m.edades.fill(0);
  assert.equal(resumenMensual(m).coincide, true);
  assert.equal(resumenMensual(m).puedeRepartir, false);
  assert.equal(estadoMensual(m).tipo, 'empty');
});

test('reparte según los recuentos mensuales y comprueba los cuatro grupos de edad', () => {
  const m = crearMensual('2026-10', 'Entidad');
  m.tamanos.fill(0); m.tamanos[1] = 1; m.tamanos[2] = 1;
  m.edades = [1, 1, 1, 2];
  const r = resumenMensual(m);
  assert.equal(r.familias, 2); assert.equal(r.personas, 5); assert.equal(r.porEdad, 5);
  assert.equal(r.puedeRepartir, true);
  assert.equal(estadoMensual(m).tipo, 'ok');
  assert.equal(envases(10, 2, m.tamanos[1], r.personas), 4);
  assert.deepEqual(erroresExportacionMensual(m), []);
  m.edades[0] = 0;
  assert.equal(resumenMensual(m).diferencia, -1);
  assert.equal(resumenMensual(m).puedeRepartir, false);
  assert.equal(estadoMensual(m).tipo, 'error');
});

test('cada mes conserva cifras independientes; el nuevo conserva solo entidad y nombres de alimentos', () => {
  const octubre = crearMensual('2026-10', 'Entidad');
  octubre.tamanos[0] = 10;
  octubre.reparto = [{ nombre: 'Arroz', cantidad: 30 }];
  const noviembre = crearMensual('2026-11', octubre.entidad, octubre.reparto);
  assert.equal(noviembre.entidad, 'Entidad');
  assert.deepEqual(noviembre.reparto, [{ nombre: 'Arroz', cantidad: '' }]);
  assert.ok(noviembre.tamanos.every(n => n === ''));
  assert.ok(noviembre.edades.every(n => n === ''));
  const meses = validarMensuales({ '2026-10': octubre, '2026-11': noviembre });
  meses['2026-10'].tamanos[0] = 12;
  assert.equal(octubre.tamanos[0], 10);
  assert.equal(meses['2026-11'].tamanos[0], '');
});

test('rechaza recuentos negativos, decimales, textos, edades ausentes, meses incorrectos y alimentos inválidos', () => {
  for (const valor of [-1, 1.5, '3', null, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    const m = crearMensual('2026-10'); m.edades[0] = valor;
    assert.throws(() => validarMensual(m), /no es válido/);
  }
  const m = crearMensual('2026-10');
  assert.throws(() => validarMensual({ ...m, edades: [0, 1, 2] }));
  assert.throws(() => validarMensual({ ...m, reparto: [{ nombre: 'Arroz', cantidad: -2 }] }));
  assert.throws(() => validarMensuales({ '2026-11': m }), /no coincide/);
  for (const mes of ['', '2026-00', '2026-13', '2026-1', '2026-10-01', '0000-01', null]) assert.equal(mesValido(mes), false);
  assert.throws(() => crearMensual('2026-99'));
});
