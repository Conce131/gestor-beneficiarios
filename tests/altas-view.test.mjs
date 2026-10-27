import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { crearMensual } from '../src/mensual.mjs';
import { iniciarSeguimiento, cambiarAlta, activarAltas } from '../src/actividad.mjs';

test('la pantalla explica las altas al cierre, conserva el criterio anterior y escapa nombres', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } });
  try {
    const { paginaAltas } = await server.ssrLoadModule('/src/altas-view.js');
    const f = iniciarSeguimiento({ id: 'f-1', numero: 1, personas: [{ titular: true, nombre: '<img src=x>', nacimiento: '1980-01-01', vigencia: '2027-01-01' }] }, '2026-07');
    const baja = cambiarAlta(f, '2026-08', false);
    const datos = activarAltas(crearMensual('2026-08'), [baja]);
    const html = paginaAltas(datos, [baja]);
    assert.match(html, /31\/08\/2026/);
    assert.match(html, /siguiente mes/);
    assert.match(html, /No incluida/);
    assert.match(html, /De baja/);
    assert.match(html, /data-action="changeActiveFamily" data-id="f-1" data-next-active="true"/);
    assert.match(html, /Dar de alta a la familia 1 desde agosto de 2026/);
    assert.match(html, /&lt;img src=x&gt;/);
    assert.doesNotMatch(html, /<img src=x>|data-attendance-family|data-attendance-row-date/);
    assert.match(paginaAltas(crearMensual('2026-08'), [baja]), /criterio anterior/);
    assert.doesNotMatch(paginaAltas(activarAltas(crearMensual('2026-10'), [baja]), [baja]), /&lt;img/);
    assert.doesNotMatch(paginaAltas(datos, [baja], '', 'incluidas'), /&lt;img/);
    const alta = paginaAltas(activarAltas(crearMensual('2026-08'), [f]), [f]);
    assert.match(alta, /data-action="changeActiveFamily" data-id="f-1" data-next-active="false"/);
    assert.match(alta, /Dar de baja a la familia 1 desde agosto de 2026/);
    const futura = iniciarSeguimiento({ id: 'f-futura', numero: 2, personas: f.personas }, '2026-09');
    const sinHistorial = paginaAltas(activarAltas(crearMensual('2026-08'), [futura]), [futura]);
    assert.match(sinHistorial, /Sin historial para este mes/);
    assert.doesNotMatch(sinHistorial, /data-action="changeActiveFamily"/);
  } finally { await server.close(); }
});

test('la cuadrícula pagina todas las coincidencias y conserva acciones y criterios del mensual', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } });
  try {
    const { paginaAltas } = await server.ssrLoadModule('/src/altas-view.js');
    const familias = Array.from({ length: 125 }, (_, i) => iniciarSeguimiento({
      id: `f-${i + 1}`, numero: i + 1, personas: [{ id: `p-${i + 1}`, titular: true, nombre: `Titular ${i + 1}`, apellidos: 'Prueba', documento: `DOC${i + 1}`, nacimiento: '1980-01-01', vigencia: '2027-01-01' }],
    }, '2026-07'));
    familias[0] = cambiarAlta(familias[0], '2026-08', false);
    const datos = activarAltas(crearMensual('2026-08'), familias);
    const ids = html => [...html.matchAll(/data-active-row="f-(\d+)"/g)].map(m => Number(m[1]));
    const cuadricula = (consulta = '', filtro = '', pagina = 1) => paginaAltas(datos, [...familias].reverse(), consulta, filtro, { modo: 'cuadricula', pagina });
    const primera = cuadricula();
    assert.equal(ids(primera).length, 60);
    assert.deepEqual(ids(primera), Array.from({ length: 60 }, (_, i) => i + 1));
    assert.match(primera, /1–60 de 125 familias/);
    assert.match(primera, /data-mode="cuadricula" aria-pressed="true"/);
    assert.match(primera, /data-action="changeActiveFamily" data-id="f-1" data-next-active="true"/);
    assert.match(primera, /data-action="changeActiveFamily" data-id="f-2" data-next-active="false"/);
    assert.match(primera, /data-action="activeFamily" data-id="f-1"/);
    assert.match(primera, /data-status="baja"/);
    assert.match(primera, /1 miembro/);
    assert.deepEqual(ids(cuadricula('', '', 2)), Array.from({ length: 60 }, (_, i) => i + 61));
    assert.deepEqual(ids(cuadricula('', '', 999)), [121, 122, 123, 124, 125]);
    assert.deepEqual(ids(cuadricula('', '', -4)), ids(primera));
    // La búsqueda alcanza familias que no están en las tarjetas de la página actual.
    assert.deepEqual(ids(cuadricula('#125', '', 3)), [125]);
    assert.deepEqual(ids(cuadricula('DOC125')), [125]);
    assert.deepEqual(ids(cuadricula('', 'excluidas', 3)), [1]);
    assert.match(cuadricula('', 'excluidas', 3), /data-active-page-current="1"/);
    assert.doesNotMatch(cuadricula('', 'incluidas'), /data-active-row="f-1"/);
    const vacia = cuadricula('inexistente', '', 999);
    assert.deepEqual(ids(vacia), []);
    assert.match(vacia, /No hay coincidencias/);
    assert.doesNotMatch(vacia, /class="active-grid-pagination"/);
    // La lista conserva todas las familias y los totales no dependen de la página.
    const lista = paginaAltas(datos, familias);
    assert.equal(ids(lista).length, 125);
    assert.match(lista, /data-mode="tabla" aria-pressed="true"/);
    assert.deepEqual(datos.altas.length, 124);
  } finally { await server.close(); }
});

test('las tarjetas escapan texto y bloquean el cambio cuando no hay historial', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } });
  try {
    const { paginaAltas } = await server.ssrLoadModule('/src/altas-view.js');
    const familia = iniciarSeguimiento({ id: 'f-segura', numero: 7, personas: [{ titular: true, nombre: '<img src=x>', apellidos: '" onclick="alert(1)', documento: '<script>', nacimiento: '1980-01-01', vigencia: '2027-01-01' }] }, '2026-09');
    const datos = crearMensual('2026-08');
    const html = paginaAltas(datos, [familia], '', '', { modo: 'cuadricula' });
    assert.match(html, /data-status="desconocida"/);
    assert.match(html, /Sin historial para este mes/);
    assert.match(html, /&lt;img src=x&gt;/);
    assert.match(html, /&quot; onclick=&quot;/);
    assert.match(html, /&lt;script&gt;/);
    assert.doesNotMatch(html, /<img src=x>|<script>|data-action="changeActiveFamily"/);
    assert.match(html, /data-action="activeFamily" data-id="f-segura"/);
  } finally { await server.close(); }
});
