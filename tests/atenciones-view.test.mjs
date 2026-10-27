import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { crearMensual } from '../src/mensual.mjs';
import { registrarAtencion, cambiarOrigenRecuento } from '../src/atenciones.mjs';

test('las pantallas conservan atenciones históricas, escapan nombres y distinguen cifras automáticas de manuales', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } });
  try {
    const { paginaAtenciones } = await server.ssrLoadModule('/src/atenciones-view.js');
    const { paginaMensual } = await server.ssrLoadModule('/src/mensual-view.js');
    const manual = crearMensual('2026-10', 'Entidad');
    const datos = registrarAtencion(cambiarOrigenRecuento(manual, true), {
      id: 'f-42', numero: 42, personas: [{ titular: true, nombre: '<img src=x onerror=alert(1)>', nacimiento: '' }],
    }, '2026-10-05');
    const html = paginaAtenciones(datos, { '2026-10': datos }, [], { fecha: '2026-10-22' });
    assert.match(html, /data-attendance-family="42" checked/);
    assert.match(html, /Conservada del listado anterior/);
    assert.match(html, /data-attendance-row-date="42"/);
    assert.match(html, /value="2026-10-05"/);
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.doesNotMatch(html, /<img src=x/);
    assert.match(html, /Revisa nacimiento/);
    assert.match(html, /data-clear-field aria-label="Limpiar búsqueda de familias"/);
    assert.doesNotMatch(html, /toggleAttendanceView/);
    assert.match(html, /attendance-page attendance-compact/);
    assert.match(html, /data-attendance-quick-status role="status"/);
    assert.doesNotMatch(html, /data-action="refreshAttendance"/);
    assert.match(paginaMensual(datos, {}), /data-month-count="tamanos:0"[^>]*readonly/);
    assert.match(paginaMensual(datos, {}), /Falta revisar el nacimiento/);
    assert.doesNotMatch(paginaMensual(manual, {}), /readonly/);
    assert.match(paginaAtenciones(manual, {}, [], { fecha: '2026-10-22' }), /Contar desde las atenciones/);
  } finally { await server.close(); }
});
