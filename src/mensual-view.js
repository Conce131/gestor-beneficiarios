import { GRUPOS_MENSUALES, resumenMensual, nombreMes } from './mensual.mjs';
import { esc } from './utils.js';
import { icon } from './icons.js';
import { recuentoAtenciones } from './atenciones.mjs';
import keyArrowUp from './assets/key-arrow-up.svg';
import keyArrowDown from './assets/key-arrow-down.svg';
import keyArrowLeft from './assets/key-arrow-left.svg';
import keyArrowRight from './assets/key-arrow-right.svg';

export function barraMensual(datos, meses, { exportar = false } = {}) {
  const guardados = Object.keys(meses).sort().reverse();
  return `<div class="monthly-period" aria-label="Periodo del resumen mensual">
    <div class="month-field"><label for="monthly-period">Mes de cierre</label><div class="month-entry"><input id="monthly-period" type="month" min="1900-01" max="9999-12" value="${datos.mes}" data-month-period><details class="month-picker"><summary aria-label="Abrir selector de mes" title="Abrir selector de mes">${icon('calendar')}</summary><div class="month-picker-panel" role="group" aria-label="Seleccionar mes"><label>Año<input type="number" min="1900" max="9999" step="1" value="${Number(datos.mes.slice(0, 4))}" data-picker-year></label><div class="month-picker-grid">${Array.from({ length: 12 }, (_, i) => { const mes = String(i + 1).padStart(2, '0'); return `<button type="button" data-pick-month="${mes}" aria-pressed="${mes === datos.mes.slice(5)}">${esc(nombreMes(`2000-${mes}`).replace(/\s+de\s+2000|\s+2000/, ''))}</button>`; }).join('')}</div><button type="button" class="month-picker-today" data-pick-current-month>Este mes</button></div></details></div></div>
    ${guardados.length ? `<details class="month-history"><summary>Meses guardados <span>${guardados.length}</span></summary><div class="help-panel"><label>Abrir un mes guardado<select data-month-history><option value="">Seleccionar mes…</option>${guardados.map(mes => `<option value="${mes}" ${mes === datos.mes ? 'selected' : ''}>${esc(nombreMes(mes))}</option>`).join('')}</select></label><p>También puedes consultar cualquier mes con el selector de mes de cierre.</p></div></details>` : ''}
    ${exportar ? `<button class="primary" data-action="exportMonthly">${icon('excel')} Generar Excel mensual</button>` : ''}
  </div>`;
}

export function totalesMensuales(datos, bloque = 'estado') {
  const r = resumenMensual(datos);
  if (bloque === 'estado' && datos.recuentoDesdeAltas && datos.historialIncompleto) return '<p class="monthly-check" data-check="error">No hay historial suficiente para reconstruir este mes. Conserva las cifras anteriores o utiliza el recuento manual.</p>';
  if (bloque === 'estado' && (datos.recuentoDesdeAtenciones || datos.recuentoDesdeAltas)) {
    const atenciones = recuentoAtenciones(datos.recuentoDesdeAltas ? { atenciones: datos.altas } : datos), avisos = [];
    if (atenciones.pendientes.length) avisos.push(`Falta revisar el nacimiento de ${atenciones.pendientes.length} personas del recuento.`);
    if (atenciones.fueraDeModelo.length) avisos.push('Hay familias de más de 10 miembros que no caben en este modelo.');
    if (avisos.length) return `<p class="monthly-check" data-check="error" role="status">${avisos.join(' ')} Revisa Familias de alta antes de generar el Excel.</p>`;
  }
  if (bloque === 'estado') return `<p class="monthly-check" data-check="${r.coincide ? 'ok' : 'error'}" role="status">${r.coincide ? 'Los beneficiarios de ambos bloques coinciden.' : 'Los beneficiarios deben coincidir para generar el Excel.'}</p>`;
  const porFamilias = bloque === 'familias';
  return `<div class="monthly-total-tile monthly-beneficiary-total" data-match="${r.coincide ? 'ok' : 'error'}" aria-label="Beneficiarios por ${porFamilias ? 'familias' : 'edades'}"><strong>${porFamilias ? r.personas : r.porEdad}</strong><span>Beneficiarios</span></div>${porFamilias ? `<div class="monthly-total-tile"><strong>${r.familias}</strong><span>Familias</span></div>` : ''}`;
}

export function paginaMensual(datos, meses) {
  const input = (grupo, indice, label) => {
    const valor = datos[grupo][indice];
    const deshabilitarMenos = (datos.recuentoDesdeAtenciones || datos.recuentoDesdeAltas) || valor === '' || Number(valor) <= 0;
    const deshabilitarMas = (datos.recuentoDesdeAtenciones || datos.recuentoDesdeAltas) || Number(valor) >= 9999;
    return `<div class="monthly-number-control"><button type="button" tabindex="-1" class="monthly-step-button" data-month-adjust="-1" data-month-target="${grupo}:${indice}" aria-label="Disminuir ${esc(label)}" title="Disminuir" ${deshabilitarMenos ? 'disabled' : ''}>−</button><input type="number" inputmode="numeric" min="0" max="9999" step="1" autocomplete="off" data-month-count="${grupo}:${indice}" aria-label="${esc(label)}" value="${valor}" ${(datos.recuentoDesdeAtenciones || datos.recuentoDesdeAltas) ? 'readonly title="Calculado automáticamente"' : ''} data-select-on-focus><button type="button" tabindex="-1" class="monthly-step-button" data-month-adjust="1" data-month-target="${grupo}:${indice}" aria-label="Aumentar ${esc(label)}" title="Aumentar" ${deshabilitarMas ? 'disabled' : ''}>+</button></div>`;
  };
  return `<section class="card monthly-page ${(datos.recuentoDesdeAtenciones || datos.recuentoDesdeAltas) ? 'monthly-from-attendances' : ''}">
    <div class="monthly-heading"><div><h2>Resumen mensual <span class="monthly-heading-period">· ${esc(nombreMes(datos.mes))}</span></h2><p>Copia la imagen para pegarla en tu correo del navegador. El Excel incluye también el reparto.</p></div><div class="monthly-share-actions" role="group" aria-label="Compartir resumen mensual"><button class="secondary" data-action="copyMonthlyImage">${icon('copy')} Copiar imagen</button><button class="secondary" data-action="exportMonthlyImage">${icon('download')} Descargar imagen</button><button class="secondary" data-action="prepareMonthlyEmail">${icon('mail')} Preparar correo</button><button class="primary monthly-export" data-action="exportMonthly">${icon('excel')} Generar Excel mensual</button></div></div>
    <label class="monthly-entity">Entidad<input maxlength="200" data-month-entity value="${esc(datos.entidad)}" placeholder="Nombre de la entidad" autocomplete="organization" data-select-on-focus></label>
    <div class="monthly-attendance-source"><p><strong>${datos.recuentoDesdeAltas ? 'Recuento automático' : datos.recuentoDesdeAtenciones ? 'Recuento desde atenciones' : 'Recuento manual'}</strong><span>${datos.recuentoDesdeAltas ? `${(datos.altas ?? []).length} familias de alta al cierre para prever el siguiente mes. Las cifras se calculan desde el listado.` : datos.recuentoDesdeAtenciones ? 'Se conservan las familias atendidas con el criterio anterior.' : 'Introduce las cifras por familias y por edades; los totales deben coincidir.'}</span></p><div class="actions"><button type="button" class="secondary" data-action="section" data-view="atenciones">Revisar familias</button><details class="count-settings"><summary>Opciones del recuento</summary><div class="help-panel"><p>${datos.recuentoDesdeAltas ? 'Las cifras se actualizan desde el listado. Para corregirlas, revisa los datos de las familias.' : 'Puedes pasar al recuento de familias de alta al cierre del mes. Se conservará una copia del criterio anterior.'}</p><div class="actions">${!datos.recuentoDesdeAltas ? '<button type="button" class="primary" data-action="useActiveFamilies">Contar familias de alta</button>' : ''}${datos.recuentoDesdeAltas || datos.recuentoDesdeAtenciones ? '<button type="button" class="secondary" data-action="useManualCounts">Editar cifras manualmente</button>' : ''}${datos.recuentoAnterior ? '<button type="button" class="secondary" data-action="restorePreviousCounts">Restaurar criterio anterior</button>' : ''}</div><p>El Excel generado se envía por correo al almacén: <a href="mailto:almacen@bancoalimentostfe.org">almacen@bancoalimentostfe.org</a>.</p></div></details></div></div>
    <div class="monthly-layout"><div class="monthly-form">
      <div class="monthly-grid"><section><h3>Familias por miembros</h3><table class="monthly-counts"><thead><tr><th scope="col">Miembros</th><th scope="col">Familias</th></tr></thead><tbody>${datos.tamanos.map((n, i) => `<tr><th scope="row">${i + 1}</th><td>${input('tamanos', i, `Familias de ${i + 1} miembros`)}</td></tr>`).join('')}</tbody></table><div class="monthly-block-totals" data-month-totals="familias">${totalesMensuales(datos, 'familias')}</div></section>
      <section><h3>Beneficiarios por edad</h3><div class="monthly-age-fields"><table class="monthly-age-counts"><thead><tr><th scope="col">Rango de edad</th><th scope="col">Beneficiarios</th></tr></thead><tbody>${GRUPOS_MENSUALES.map((label, i) => `<tr><th scope="row">${label}</th><td>${input('edades', i, label)}</td></tr>`).join('')}</tbody></table><div class="monthly-keyboard-help" aria-label="Atajos de teclado"><p class="monthly-keyboard-title">Puedes usar las flechas para:</p><span aria-label="Flechas arriba y abajo: cambiar campo"><img src="${keyArrowUp}" alt="" width="26" height="28"><img src="${keyArrowDown}" alt="" width="26" height="28"> Subir / Bajar</span><span aria-label="Flecha izquierda: restar"><img src="${keyArrowLeft}" alt="" width="26" height="28"> Restar</span><span aria-label="Flecha derecha: sumar"><img src="${keyArrowRight}" alt="" width="26" height="28"> Sumar</span></div></div><div class="monthly-block-totals" data-month-totals="edades">${totalesMensuales(datos, 'edades')}</div></section></div>
    </div></div><div data-month-totals="estado">${totalesMensuales(datos)}</div>
  </section>`;
}
