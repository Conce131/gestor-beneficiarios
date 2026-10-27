import { filasAltas, finMes, visibleEnTrimestre } from './actividad.mjs';
import { nombreMes } from './mensual.mjs';
import { recuentoAtenciones } from './atenciones.mjs';
import { miembrosContabilizados } from './reparto.mjs';
import { esc, fmt } from './utils.js';
import { icon } from './icons.js';

const FAMILIAS_POR_PAGINA = 60;

function accionesFamilia(f, mes, desconocida, cuadricula = false) {
  return `<div class="active-family-actions">${desconocida ? '' : `<button type="button" class="${cuadricula || f.deAlta === false ? 'secondary' : 'danger'}" data-action="changeActiveFamily" data-id="${esc(f.id)}" data-next-active="${f.deAlta === false}" aria-label="${f.deAlta === false ? 'Dar de alta' : 'Dar de baja'} a la familia ${f.numero} desde ${esc(nombreMes(mes))}">${f.deAlta === false ? 'Dar de alta' : 'Dar de baja'}</button>`}<button type="button" class="secondary" data-action="activeFamily" data-id="${esc(f.id)}" aria-label="Ver familia ${f.numero} en el listado">${cuadricula ? 'Ver listado' : 'Ver en el listado'}</button></div>`;
}

function tarjetaFamilia({ familia: f, incluida, motivo, desconocida }, mes) {
  const t = f.personas.find(p => p.titular) ?? f.personas[0];
  const nombre = [t?.nombre, t?.apellidos].filter(Boolean).join(' ') || 'Titular sin nombre';
  const miembros = miembrosContabilizados(f);
  const situacion = desconocida ? 'Sin historial' : f.deAlta === false ? 'De baja' : 'De alta';
  const razon = motivo || 'Vigencia válida';
  return `<li class="active-family-card" data-active-row="${esc(f.id)}" data-included="${incluida}" data-status="${desconocida ? 'desconocida' : f.deAlta === false ? 'baja' : 'alta'}"><div class="active-card-heading"><strong class="active-card-number">#${f.numero}</strong><span class="active-card-state">${situacion}</span></div><strong class="active-card-holder" title="${esc(nombre)}">${esc(nombre)}</strong><div class="active-card-meta"><span title="${esc(t?.documento || 'Sin documento')}">${esc(t?.documento || 'Sin documento')}</span><span>${miembros} ${miembros === 1 ? 'miembro' : 'miembros'}</span></div><p class="active-card-reason" title="${esc(razon)}"><span class="active-card-inclusion">${incluida ? 'Incluida' : 'No incluida'}</span> · ${esc(razon)}</p>${accionesFamilia(f, mes, desconocida, true)}</li>`;
}

export function paginaAltas(datos, familias, consulta = '', filtro = '', { modo = 'tabla', pagina = 1 } = {}) {
  const cuadricula = modo === 'cuadricula';
  const r = recuentoAtenciones({ atenciones: datos.altas ?? [] });
  const q = consulta.trim().toLocaleLowerCase('es');
  const numero = /^#?\d+$/.test(q) ? Number(q.replace(/^#/, '')) : null;
  const filas = filasAltas(familias.filter(f => visibleEnTrimestre(f, datos.mes)), datos.mes).filter(({ familia: f, incluida }) => {
    const texto = `${f.numero} ${f.personas.map(p => `${p.nombre ?? ''} ${p.apellidos ?? ''} ${p.documento ?? ''}`).join(' ')}`.toLocaleLowerCase('es');
    return (!q || (numero !== null ? f.numero === numero : texto.includes(q))) && (!filtro || incluida === (filtro === 'incluidas'));
  }).sort((a, b) => a.familia.numero - b.familia.numero);
  const paginas = Math.max(1, Math.ceil(filas.length / FAMILIAS_POR_PAGINA));
  const paginaActual = Math.max(1, Math.min(paginas, Number.isSafeInteger(pagina) ? pagina : 1));
  const inicio = (paginaActual - 1) * FAMILIAS_POR_PAGINA;
  const visibles = cuadricula ? filas.slice(inicio, inicio + FAMILIAS_POR_PAGINA) : filas;
  const vacio = `<div class="empty-state"><strong>${consulta || filtro ? 'No hay coincidencias' : 'No hay familias para este mes'}</strong><p>${consulta || filtro ? 'Prueba otra búsqueda o selecciona «Todas» en Mostrar.' : 'Añade las familias o carga tu Excel desde el listado trimestral.'}</p>${!consulta && !filtro ? '<div class="actions"><button class="secondary" data-action="section" data-view="listado">Ir al listado</button></div>' : ''}</div>`;
  const paginacion = cuadricula && filas.length ? `<nav class="active-grid-pagination" aria-label="Páginas de familias"><span role="status">${inicio + 1}–${Math.min(inicio + FAMILIAS_POR_PAGINA, filas.length)} de ${filas.length} familias</span><div><button type="button" class="secondary" data-action="activeGridPage" data-page="${paginaActual - 1}" ${paginaActual === 1 ? 'disabled' : ''}>Anterior</button><label>Página<select data-active-page aria-label="Ir a página de familias">${Array.from({ length: paginas }, (_, i) => `<option value="${i + 1}" ${i + 1 === paginaActual ? 'selected' : ''}>${i + 1} de ${paginas}</option>`).join('')}</select></label><button type="button" class="secondary" data-action="activeGridPage" data-page="${paginaActual + 1}" ${paginaActual === paginas ? 'disabled' : ''}>Siguiente</button></div></nav>` : '';

  return `<section class="card attendance-page attendance-compact" data-active-page-current="${paginaActual}"><div class="attendance-heading"><div><h2>Familias de alta · ${esc(nombreMes(datos.mes))}</h2><p>Situación al ${fmt(finMes(datos.mes))} para prever los alimentos del siguiente mes. Se cuentan las familias de alta con vigencia válida y su margen de 90 días.</p></div><button class="primary" data-action="section" data-view="mensual">Ver resumen mensual</button></div>
  ${datos.historialIncompleto ? '<p class="notice">No hay historial suficiente para reconstruir este mes. El Excel automático queda pendiente; conserva las cifras anteriores o utiliza el recuento manual.</p>' : ''}
  ${!datos.recuentoDesdeAltas ? '<div class="notice">Este mes conserva sus cifras con el criterio anterior. No se han sustituido sus datos.<button class="primary" data-action="useActiveFamilies">Contar familias de alta</button></div>' : ''}
  <div class="attendance-summary"><div><strong>${datos.recuentoDesdeAltas ? r.familias : '—'}</strong><span>Familias que continúan</span></div><div><strong>${datos.recuentoDesdeAltas ? r.personas : '—'}</strong><span>Beneficiarios para el siguiente mes</span></div><div><strong>${datos.recuentoDesdeAltas ? r.pendientes.length : '—'}</strong><span>Edades por revisar</span></div></div>
  <div class="attendance-filters"><label>Buscar familia<span class="clearable-field"><input type="search" data-active-search value="${esc(consulta)}" placeholder="Número, nombre o documento"><button type="button" class="field-clear" data-clear-field aria-label="Limpiar búsqueda" ${consulta ? '' : 'hidden'}>×</button></span></label><label>Mostrar<select data-active-filter><option value="">Todas</option><option value="incluidas" ${filtro === 'incluidas' ? 'selected' : ''}>Incluidas en el mensual</option><option value="excluidas" ${filtro === 'excluidas' ? 'selected' : ''}>Fuera del mensual</option></select></label><div class="active-view-switch" role="group" aria-label="Vista de familias"><button type="button" class="secondary" data-action="activeView" data-mode="tabla" aria-pressed="${!cuadricula}">${icon('list')} Lista</button><button type="button" class="secondary" data-action="activeView" data-mode="cuadricula" aria-pressed="${cuadricula}">${icon('grid')} Cuadrícula</button></div></div>
  <p class="attendance-date-help">Las altas y bajas se aplican desde ${esc(nombreMes(datos.mes))} y conservan el histórico. Para editar los datos, pulsa «${cuadricula ? 'Ver listado' : 'Ver en el listado'}».</p>
  ${cuadricula ? `<div class="attendance-table-wrap active-family-grid-wrap" tabindex="0" aria-label="Cuadrícula de familias del mes">${visibles.length ? `<ul class="active-family-grid">${visibles.map(fila => tarjetaFamilia(fila, datos.mes)).join('')}</ul>` : vacio}</div>${paginacion}` : `<div class="table-wrap attendance-table-wrap" tabindex="0" aria-label="Familias del mes"><table class="attendance-table active-families-table"><thead><tr><th>Familia</th><th>Titular</th><th>Recuento</th><th>Situación al cierre</th><th>Acciones</th></tr></thead><tbody>${visibles.map(({ familia: f, incluida, motivo, desconocida }) => {
    const t = f.personas.find(p => p.titular) ?? f.personas[0];
    return `<tr data-active-row="${esc(f.id)}" class="${incluida ? 'attendance-marked' : ''}"><td class="attendance-family-number">#${f.numero}</td><td class="active-family-holder"><strong>${esc([t?.nombre, t?.apellidos].filter(Boolean).join(' ') || 'Titular sin nombre')}</strong><small>${t?.documento ? esc(t.documento) : 'Sin documento'}</small></td><td><span class="badge ${incluida ? 'ok' : 'warn'}">${incluida ? 'Incluida' : 'No incluida'}</span></td><td>${esc(motivo || 'De alta y con vigencia válida')}</td><td>${accionesFamilia(f, datos.mes, desconocida)}</td></tr>`;
  }).join('') || `<tr><td colspan="5" class="empty">${vacio}</td></tr>`}</tbody></table></div>`}</section>`;
}
