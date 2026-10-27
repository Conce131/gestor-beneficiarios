import { nombreMes } from './mensual.mjs';
import { filasAtenciones, recuentoAtenciones } from './atenciones.mjs';
import { esc } from './utils.js';

export function resumenAtenciones(datos) {
  const r = recuentoAtenciones(datos);
  return `<div><strong>${r.familias}</strong><span>Familias atendidas</span></div><div><strong>${r.personas}</strong><span>Beneficiarios atendidos</span></div><div><strong>${r.pendientes.length}</strong><span>Edades por revisar</span></div>`;
}

export function tablaAtenciones(datos, familias, consulta, filtro) {
  const rows = filasAtenciones(datos, familias, consulta, filtro);
  const pendientes = recuentoAtenciones(datos).pendientes;
  const [ano, mes] = datos.mes.split('-').map(Number);
  const ultimaFecha = new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
  return rows.map(row => {
    const avisos = [];
    const sinEdad = pendientes.filter(p => p.numero === row.numero);
    if (!row.familia) avisos.push('Conservada del listado anterior');
    if (!row.miembros) avisos.push('Completa los miembros de esta familia en el listado antes de marcarla');
    if (row.miembros > 10) avisos.push('Más de 10 miembros: requiere ampliar el modelo');
    if (sinEdad.length) avisos.push(`Revisa nacimiento: ${sinEdad.map(p => p.nombre).join(', ')}. Los cambios del listado se incorporan automáticamente a este mes.`);
    const marcada = Boolean(row.atencion);
    return `<tr class="${marcada ? 'attendance-marked' : ''}"><td><label class="attendance-check"><input type="checkbox" data-attendance-family="${row.numero}" ${marcada ? 'checked' : ''} ${!datos.recuentoDesdeAtenciones || (!row.miembros && !marcada) ? 'disabled' : ''} aria-label="Familia ${row.numero}, ${esc(row.titular)}: atendida en ${esc(nombreMes(datos.mes))}"><span>${marcada ? 'Atendida' : 'Pendiente'}</span></label></td><td class="attendance-family-number">#${row.numero}</td><td><strong>${esc(row.titular)}</strong>${row.documento ? `<small>${esc(row.documento)}</small>` : ''}${avisos.length ? `<small class="attendance-warning">${avisos.map(esc).join(' · ')}</small>` : ''}${(sinEdad.length || !row.miembros) && row.familia ? `<button type="button" class="column-sort attendance-review" data-action="attendanceFamily" data-number="${row.numero}">Revisar familia en el listado</button>` : ''}</td><td class="attendance-members">${row.miembros}</td><td>${marcada ? `<input type="date" data-attendance-row-date="${row.numero}" aria-label="Fecha de atención de la familia ${row.numero}" min="${datos.mes}-01" max="${ultimaFecha}" value="${esc(row.atencion.fecha)}" required ${!datos.recuentoDesdeAtenciones ? 'disabled' : ''}>` : '—'}</td></tr>`;
  }).join('') || `<tr><td colspan="5" class="empty">${familias.length || datos.atenciones?.length ? 'No hay familias que coincidan con esta búsqueda.' : 'Carga o añade las familias en Trimestral → Listado para empezar a marcar atenciones.'}</td></tr>`;
}

export function paginaAtenciones(datos, meses, familias, { consulta = '', filtro = '', fecha }) {
  const [ano, mes] = datos.mes.split('-').map(Number);
  const max = new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
  return `<section class="card attendance-page attendance-compact">
    <div class="attendance-heading"><div><h2>Atenciones de ${esc(nombreMes(datos.mes))}</h2><p>Marca las familias que aparecen en el listado de firmas de la entrega. Cada familia cuenta una sola vez en este mes.</p></div><button type="button" class="primary" data-action="section" data-view="mensual">Ver resumen mensual</button></div>
    <div class="attendance-mode">${datos.recuentoDesdeAtenciones ? '<p>El resumen mensual se calcula automáticamente con las familias marcadas.</p>' : '<p>Este mes utiliza cifras introducidas a mano. Activa el recuento para calcularlas con las familias atendidas.</p><button type="button" class="primary" data-action="useAttendances">Contar desde las atenciones</button>'}</div>
    <div class="attendance-summary" aria-label="Totales de atenciones" aria-live="polite">${resumenAtenciones(datos)}</div>
    <div class="attendance-filters"><label>Buscar familia<span class="clearable-field"><input type="search" data-attendance-search value="${esc(consulta)}" placeholder="N.º de familia, titular o documento" autocomplete="off" aria-describedby="attendance-quick-help"><button type="button" class="field-clear" data-clear-field aria-label="Limpiar búsqueda de familias" title="Limpiar campo" ${consulta ? '' : 'hidden'}>×</button></span></label><label>Mostrar<select data-attendance-filter><option value="" ${!filtro ? 'selected' : ''}>Todas las familias</option><option value="pendientes" ${filtro === 'pendientes' ? 'selected' : ''}>Pendientes de atender</option><option value="atendidas" ${filtro === 'atendidas' ? 'selected' : ''}>Atendidas este mes</option></select></label><label>Fecha para nuevas marcas<input type="date" data-attendance-date min="${datos.mes}-01" max="${max}" value="${esc(fecha)}" required ${!datos.recuentoDesdeAtenciones ? 'disabled' : ''}></label></div>
    <p id="attendance-quick-help" class="attendance-date-help">Marcación rápida: escribe el número de familia y pulsa Enter. La búsqueda se vacía para continuar con la siguiente.</p><p class="attendance-quick-status" data-attendance-quick-status role="status" aria-live="polite"></p>
    <p class="attendance-date-help">Las edades se calculan en la fecha de atención de cada familia. Puedes corregir la fecha directamente en la tabla. Los cambios del listado se incorporan automáticamente al mes seleccionado.</p>
    <div class="table-wrap attendance-table-wrap"><table class="attendance-table"><thead><tr><th scope="col">Atendida</th><th scope="col">Familia</th><th scope="col">Titular</th><th scope="col">Miembros</th><th scope="col">Fecha</th></tr></thead><tbody data-attendance-rows>${tablaAtenciones(datos, familias, consulta, filtro)}</tbody></table></div>
  </section>`;
}
