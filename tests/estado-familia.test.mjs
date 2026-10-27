import test from 'node:test';
import assert from 'node:assert/strict';
import { estado, descripcionEstado } from '../src/estado-familia.mjs';
import { erroresFamilia } from '../src/validacion.mjs';
import { editarPersona } from '../src/edicion-listado.mjs';

const hoy = new Date(2026, 9, 14, 12);
const titular = { id: 't', titular: true, nombre: 'Ana', apellidos: 'Prueba', documento: 'DOC', nacimiento: '1980-01-01', derivacion: '2026-01-01', vigencia: '2027-01-01' };
const familia = cambios => ({ personas: [{ ...titular, ...cambios }] });

test('Los documentos de adultos y las fechas compartidas son obligatorios', () => {
  for (const campo of ['documento', 'derivacion', 'vigencia']) {
    const f = familia({ [campo]: ' ' });
    assert.equal(estado(f, hoy)[0], 'incomplete');
    assert.ok(erroresFamilia(f, hoy).some(error => error.campo === campo));
  }
  const f = familia({});
  f.personas.push({ id: 'm', nombre: 'Luis', apellidos: 'Prueba', documento: '' });
  assert.equal(estado(f, hoy)[0], 'incomplete');
  f.personas[1].menor = true;
  assert.equal(estado(f, hoy)[0], 'ok');
});

test('La vigencia sigue caducada aunque tenga una próxima cita válida', () => {
  for (const proximaCita of ['', '2026-10-13', '2026-02-30']) {
    const f = familia({ vigencia: '2026-10-01', proximaCita });
    assert.equal(estado(f, hoy)[0], 'expired');
    assert.ok(erroresFamilia(f, hoy).some(error => error.campo === 'proximaCita'));
  }
  for (const proximaCita of ['2026-10-14', '2026-10-15']) {
    const f = familia({ vigencia: '2026-10-01', proximaCita });
    assert.deepEqual(estado(f, hoy), ['expired', 'Caducada']);
    assert.deepEqual(erroresFamilia(f, hoy), []);
  }
});

test('Servicios sociales No utiliza la vigencia automática para el estado', () => {
  const f = familia({ serviciosSociales: false, derivacion: '2026-07-01', vigencia: '2027-01-01' });
  assert.deepEqual(estado(f, hoy), ['expired', 'Caducada']);
  assert.match(descripcionEstado(f, hoy), /continúa de alta.*puede contar en el mensual.*aunque no tenga cita/);
  assert.deepEqual(estado(familia({ serviciosSociales: false, derivacion: '2026-10-01' }), hoy), ['ok', 'Correcta']);
  const antigua = familia({ serviciosSociales: false, derivacion: '2026-01-01' });
  assert.deepEqual(estado(antigua, hoy), ['expired', 'Fuera de recuento']);
  assert.match(descripcionEstado(antigua, hoy), /más de 90 días/);
});

test('Fuera de plazo identifica las citas no válidas y explica qué corregir', () => {
  for (const proximaCita of ['2026-10-13', '2026-02-30', '2027-01-01']) {
    const f = familia({ vigencia: '2026-10-01', proximaCita });
    assert.deepEqual(estado(f, hoy), ['expired', 'Fuera de plazo']);
    assert.match(descripcionEstado(f, hoy), /Corrige la cita/);
  }
});

test('Una cita no oculta documentos o fechas obligatorias que falten', () => {
  for (const campo of ['documento', 'derivacion']) {
    assert.equal(estado(familia({ vigencia: '2026-10-01', proximaCita: '2026-10-15', [campo]: '' }), hoy)[0], 'incomplete');
  }
});

test('Mantiene el aviso de 60 días y permite completar datos casilla a casilla', () => {
  assert.equal(estado(familia({ vigencia: '2026-12-13' }), hoy)[0], 'warn');
  assert.equal(estado(familia({ vigencia: '2026-12-14' }), hoy)[0], 'ok');
  assert.equal(estado(familia({ vigencia: '2026-10-14' }), hoy)[0], 'warn');
  const f = familia({ vigencia: '2026-10-01' });
  const editada = editarPersona(f, 't', 'nombre', 'Ana María', hoy);
  assert.equal(estado(editada, hoy)[0], 'expired');
  const completada = editarPersona(editada, 't', 'proximaCita', '2026-10-15', hoy);
  assert.deepEqual(estado(completada, hoy), ['expired', 'Caducada']);
});
