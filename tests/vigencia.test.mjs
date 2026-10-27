import test from 'node:test';
import assert from 'node:assert/strict';
import { vigenciaAplicada, errorProximaCita, motivoExclusion } from '../src/vigencia.mjs';
import { editarPersona, restaurarMiembro } from '../src/edicion-listado.mjs';
import { incorporarAlta } from '../src/alta-listado.mjs';
import { resumen } from '../src/reparto.mjs';
import { estado } from '../src/estado-familia.mjs';
import { erroresFamilia } from '../src/validacion.mjs';

const hoy = new Date(2026, 9, 19, 23, 50);
const titular = { id: 't', titular: true, nombre: 'Ana', apellidos: 'Prueba', documento: 'DOC',
  nacimiento: '1980-01-01', derivacion: '2026-01-01', vigencia: '2026-07-21' };
const familia = cambios => ({ id: 'f', numero: 1, personas: [{ ...titular, ...cambios }, { id: 'm', menor: true }] });

test('sin cita cuentan las vigencias vigentes y caducadas hasta 90 días', () => {
  for (const vigencia of ['2026-10-20', '2026-10-19', '2026-10-18', '2026-07-22', '2026-07-21']) {
    const f = familia({ vigencia });
    assert.equal(motivoExclusion(f, hoy), '');
    const r = resumen([f], hoy);
    assert.equal(r.personas, 2);
    assert.equal(r.familias, 1);
    assert.equal(r.tamanos[1], 1);
  }
  const f = familia({ serviciosSociales: false, derivacion: '2026-07-18', vigencia: '2027-01-01' });
  assert.equal(resumen([f], hoy).personas, 2);
  // La cita sigue pendiente aunque la familia cuente.
  assert.ok(erroresFamilia(f, hoy).some(e => e.campo === 'proximaCita'));
});

test('sin cita del titular cuentan el día 90 y dejan de contar el 91', () => {
  const f = familia({});
  assert.equal(motivoExclusion(f, hoy), '');
  assert.equal(resumen([f], hoy).personas, 2);
  f.personas[1].proximaCita = '2026-10-19';
  assert.equal(resumen([f], hoy).personas, 2);
  f.personas[0].proximaCita = '2026-10-19';
  assert.equal(resumen([f], hoy).personas, 2);
  f.personas[0].proximaCita = '';
  assert.equal(resumen([f], new Date(2026, 9, 20)).personas, 0);
});

test('el recuento incluye el día 90 completo y excluye a toda la familia el día 91', () => {
  const f = familia({ proximaCita: '2026-10-19' });
  assert.equal(motivoExclusion(f, hoy), '');
  assert.equal(resumen([f], hoy).personas, 2);
  const manana = new Date(2026, 9, 20, 0, 1);
  assert.match(motivoExclusion(f, manana), /más de 90/);
  assert.equal(resumen([f], manana).personas, 0);
  assert.equal(resumen([f], manana).familias, 0);
  assert.deepEqual(estado(f, manana), ['expired', 'Fuera de recuento']);
  // Una cita futura no permite prolongar el plazo.
  f.personas[0].proximaCita = '2026-10-21';
  assert.equal(resumen([f], manana).personas, 0);
});

test('la cita debe ser de hoy o futura, permite anticiparse al vencimiento y llega hasta el día 90', () => {
  assert.equal(errorProximaCita(titular, '2026-10-19', hoy), '');
  assert.match(errorProximaCita(titular, '2026-10-20', hoy), /90 días/);
  assert.match(errorProximaCita(titular, '2026-10-18', hoy), /ya pasó/);
  assert.match(errorProximaCita(titular, '2026-02-30', hoy), /fecha válida/);
  const antes = new Date(2026, 6, 1);
  assert.equal(errorProximaCita(titular, '2026-07-21', antes), '');
  assert.equal(errorProximaCita(titular, '2026-07-20', antes), '');
  assert.equal(errorProximaCita(titular, '2026-07-22', antes), '');
  assert.equal(errorProximaCita(titular, '', hoy), '');
});

test('las citas inválidas avisan sin excluir y las nuevas se rechazan', () => {
  const f = familia({ proximaCita: '2026-10-19' });
  f.personas[1].proximaCita = '2026-10-20';
  assert.equal(resumen([f], hoy).personas, 2);
  assert.ok(erroresFamilia(f, hoy).some(e => e.indice === 1 && e.campo === 'proximaCita'));
  assert.throws(() => editarPersona(f, 't', 'proximaCita', '2026-10-20', hoy), /90 días/);
  const corregida = editarPersona(f, 'm', 'proximaCita', '', hoy);
  assert.equal(resumen([corregida], hoy).personas, 2);
  // Una edición ajena a la cita sigue siendo posible para corregir una familia importada.
  assert.equal(editarPersona(f, 't', 'nombre', 'Ana María', hoy).personas[0].nombre, 'Ana María');
});

test('los tres meses son naturales y ajustan fines de mes y años bisiestos', () => {
  for (const [derivacion, esperado] of [
    ['2026-01-31', '2026-04-30'], ['2023-11-30', '2024-02-29'],
    ['2024-11-30', '2025-02-28'], ['2026-12-01', '2027-03-01'],
  ]) assert.equal(vigenciaAplicada({ serviciosSociales: false, derivacion }), esperado);
  assert.equal(vigenciaAplicada({ serviciosSociales: false, derivacion: '2026-02-30' }), '');
  assert.equal(vigenciaAplicada({ serviciosSociales: false, derivacion: '', vigencia: '2027-01-01' }), '');
});

test('marcar, cambiar derivación, guardar y desmarcar conserva siempre la vigencia manual', () => {
  const original = familia({ vigencia: '2027-08-01', derivacion: '2026-07-31', serviciosSociales: true });
  const marcada = editarPersona(original, 't', 'serviciosSociales', false, hoy);
  assert.equal(vigenciaAplicada(marcada.personas[0]), '2026-10-31');
  assert.equal(marcada.personas[0].vigencia, '2027-08-01');
  assert.ok(marcada.personas.every(p => !p.serviciosSociales));
  assert.throws(() => editarPersona(marcada, 't', 'vigencia', '2026-09-01', hoy), /Desmarca No/);
  const cambiada = editarPersona(marcada, 't', 'derivacion', '2026-08-31', hoy);
  assert.equal(vigenciaAplicada(cambiada.personas[0]), '2026-11-30');
  const guardada = JSON.parse(JSON.stringify(cambiada));
  const desmarcada = editarPersona(guardada, 't', 'serviciosSociales', true, hoy);
  assert.equal(vigenciaAplicada(desmarcada.personas[0]), '2027-08-01');
  assert.equal(original.personas[0].serviciosSociales, true);
  assert.equal(vigenciaAplicada(editarPersona(desmarcada, 't', 'serviciosSociales', false, hoy).personas[0]), '2026-11-30');
});

test('altas, restauraciones, validación y recuento usan el origen compartido y la fecha automática', () => {
  const f = familia({ serviciosSociales: false, vigencia: '', derivacion: '2026-07-21' });
  assert.deepEqual(erroresFamilia(f, hoy), []);
  assert.equal(resumen([f], hoy).personas, 2);
  const [alta] = incorporarAlta([f], { familiaId: 'f', persona: { id: 'nuevo', menor: true } }, hoy);
  assert.equal(vigenciaAplicada(alta.personas.at(-1)), '2026-10-21');
  const restaurada = restaurarMiembro(f, { id: 'r', menor: true, serviciosSociales: true }, 2);
  assert.equal(vigenciaAplicada(restaurada.personas.at(-1)), '2026-10-21');
  const manual = restaurarMiembro(familia({}), { id: 'r', menor: true, serviciosSociales: false }, 2);
  assert.equal(manual.personas.at(-1).serviciosSociales, true);
  assert.equal(resumen([familia({ vigencia: '' })], hoy).personas, 0);
});

test('el límite usa días de calendario incluso durante cambios de hora', () => {
  const f = familia({ vigencia: '2026-07-27', proximaCita: '2026-10-25' });
  assert.equal(resumen([f], new Date(2026, 9, 25, 23, 59)).personas, 2);
  assert.equal(resumen([f], new Date(2026, 9, 26, 0, 0)).personas, 0);
});


test('las citas escritas inválidas no excluyen del recuento durante los 90 días', () => {
  for (const proximaCita of ['2026-10-18', '2027-01-17', '2026-02-30']) {
    const f = familia({ vigencia: '2026-10-18' });
    f.personas[1].proximaCita = proximaCita;
    assert.equal(motivoExclusion(f, hoy), '');
    assert.equal(resumen([f], hoy).personas, 2);
  }
});

test('la vigencia automática respeta los límites de 89, 90 y 91 días sin cita', () => {
  const f = familia({ serviciosSociales: false, derivacion: '2026-04-21', vigencia: '2027-01-01' });
  assert.equal(vigenciaAplicada(f.personas[0]), '2026-07-21');
  assert.equal(resumen([f], new Date(2026, 9, 18)).personas, 2);
  assert.equal(resumen([f], new Date(2026, 9, 19)).personas, 2);
  assert.equal(resumen([f], new Date(2026, 9, 20)).personas, 0);
});


test('puede guardarse la cita antes del vencimiento para preparar la renovación', () => {
  const f = familia({ vigencia: '2026-11-01' });
  const editada = editarPersona(f, 't', 'proximaCita', '2026-10-25', hoy);
  assert.equal(editada.personas[0].proximaCita, '2026-10-25');
  assert.deepEqual(erroresFamilia(editada, hoy), []);
  assert.equal(resumen([editada], hoy).personas, 2);
});

test('día 90 cuenta toda la familia y el día 91 excluye todos sus miembros con cualquier cita', () => {
  for (const proximaCita of ['', '2026-10-18', '2026-10-19', '2026-10-21']) {
    const f = familia({ proximaCita });
    const incluido = resumen([f], hoy);
    assert.equal(incluido.personas, 2);
    assert.equal(incluido.familias, 1);
    assert.equal(incluido.tamanos[1], 1);
    const excluido = resumen([f], new Date(2026, 9, 20));
    assert.equal(excluido.personas, 0);
    assert.equal(excluido.familias, 0);
    assert.equal(excluido.tamanos[1], 0);
  }
});


test('No Servicios sociales limita a tres meses sin ampliar una vigencia menor', () => {
  for (const [vigencia, esperada] of [
    ['2026-08-10', '2026-08-10'], ['2026-10-31', '2026-10-31'],
    ['2027-01-01', '2026-10-31'], ['', '2026-10-31'],
    ['2026-02-30', ''],
  ]) assert.equal(vigenciaAplicada({ serviciosSociales: false, derivacion: '2026-07-31', vigencia }), esperada);
  assert.equal(vigenciaAplicada({ serviciosSociales: true, derivacion: '2026-07-31', vigencia: '2027-01-01' }), '2027-01-01');
});

test('el recuento y las citas usan la vigencia corta, sin prolongar el margen de renovación', () => {
  const f = familia({ serviciosSociales: false, derivacion: '2026-05-01', vigencia: '2026-06-01' });
  assert.equal(resumen([f], new Date(2026, 7, 30)).personas, 2);
  assert.equal(resumen([f], new Date(2026, 7, 31)).personas, 0);
  assert.match(errorProximaCita(f.personas[0], '2026-08-31', new Date(2026, 7, 1)), /90 días/);
  assert.throws(() => editarPersona(f, 't', 'vigencia', '2026-02-30', hoy), /Desmarca No/);
});
