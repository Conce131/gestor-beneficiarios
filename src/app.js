import "./styles.css";
import { loadImportReport, saveImportReport } from "./import-report.js";
import { erroresFamilia } from "./validacion.mjs";
import { coincideNumeroFamilia } from "./busqueda.mjs";
import { loadDB, saveDB } from "./database.js";
import { persona, familia, estado } from "./familias.js";
import { edad, caducada, esc, fmt } from "./utils.js";
import { exportExcel } from "./excel.js";
import { version as appVersion } from "../package.json";
import { readExcel } from "./excel-import.js";
import { icon } from "./icons.js";
import { isTauri } from "@tauri-apps/api/core";

import { prepararReparto, MAX_REPARTO_FILAS, resumen, envases } from "./reparto.mjs";
import { loadReparto, saveReparto } from "./reparto-storage.js";
import companyLogo from "../bancoteide_logo.png?url";
import { toPng } from "html-to-image";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

let reparto = [], modoListado = "familias", busqueda = "", numeroFamilia = "", filtroEstado = "";
let ultimoInforme = null, avisoExcel = "";
const ordenListado = { familias: { columna: "numero", direccion: 1 }, personas: { columna: "numero", direccion: 1 } };
const comparadorListado = new Intl.Collator("es", { numeric: true, sensitivity: "base" });
function encabezadosListado(columnas) {
  const orden = ordenListado[modoListado];
  return '<tr>' + columnas.map(([columna, texto]) => `<th aria-sort="${orden.columna === columna ? (orden.direccion === 1 ? 'ascending' : 'descending') : 'none'}"><button class="column-sort" data-action="sortColumn" data-column="${columna}" title="Ordenar por ${texto}">${texto} <span aria-hidden="true">${orden.columna === columna ? (orden.direccion === 1 ? '↑' : '↓') : '↕'}</span></button></th>`).join('') + (modoListado === 'personas' ? '<th class="list-actions-column"></th>' : '') + '</tr>';
}
function ordenarListado(list, valor) {
  const { columna, direccion } = ordenListado[modoListado];
  return list.sort((a, b) => {
    const x = valor(a, columna), y = valor(b, columna);
    const vacio = v => v === undefined || v === null || v === '';
    if (vacio(x) || vacio(y)) return Number(vacio(x)) - Number(vacio(y));
    return direccion * (typeof x === 'number' && typeof y === 'number' ? x - y : comparadorListado.compare(String(x), String(y)));
  });
}
let familias = [], siguienteFamilia = 1, vista = "listado", editando = null;
const dateDrafts = new Map();
function renumerar() {
  familias.sort((a, b) => a.numero - b.numero);
  familias.forEach((family, index) => family.numero = index + 1);
  siguienteFamilia = familias.length + 1;
}

function setSaveState(message, status = "saved") {
  const indicator = document.getElementById("saveState");
  if (indicator) {
    indicator.innerHTML = `<span class="save-symbol">${icon("save")}</span><span>${status === "saved" ? "Autoguardado" : status === "saving" ? "Guardando…" : status === "pending" ? "Pendiente de guardar" : "No se ha podido guardar"}</span>`;
    indicator.title = message;
    indicator.dataset.status = status;
  }
}
function erroresFormulario() {
  if (!editando) return [];
  const errores = erroresFamilia(editando);
  for (const [indice, person] of editando.personas.entries()) {
    for (const campo of ["nacimiento", "derivacion", "vigencia", "proximaCita"]) {
      const draft = dateDrafts.get(`${person.id}:${campo}`);
      if (draft && !parseTypedDate(draft)) {
        const anterior = errores.findIndex(error => error.indice === indice && error.campo === campo);
        if (anterior >= 0) errores.splice(anterior, 1);
        errores.push({ indice, campo, mensaje: "Escribe una fecha válida como 15/06/1967." });
      }
    }
  }
  return errores;
}
function errorFormulario() {
  return erroresFormulario()[0] ?? null;
}
function mostrarPendiente(error) {
  setSaveState(error.mensaje, "pending");
  const notice = document.getElementById("formValidation");
  if (notice) {
    const errores = erroresFormulario();
    notice.hidden = false;
    notice.innerHTML = `<strong>No se puede guardar todavía.</strong><ul>${(errores.length ? errores : [error]).map(item => `<li>${esc(editando?.personas[item.indice]?.titular ? 'Titular' : `Miembro ${(item.indice ?? 0) + 1}`)}: ${esc(item.mensaje)}</li>`).join('')}</ul><p>Completa o corrige estos campos y pulsa «Guardar y volver». Para salir, puedes descartar los cambios pendientes.</p>`;
  }
}
function validarFormulario() {
  const error = errorFormulario();
  if (!error) return true;
  mostrarPendiente(error);
  for (const item of erroresFormulario()) {
    const field = app.querySelector(`[data-person="${item.indice}"] input[data-field="${item.campo}"]:not([data-date-picker])`);
    if (field) field.setAttribute('aria-invalid', 'true');
  }
  const input = app.querySelector(`[data-person="${error.indice}"] input[data-field="${error.campo}"]:not([data-date-picker])`);
  if (input) {
    input.setCustomValidity(error.mensaje);
    input.focus();
    input.reportValidity();
  }
  return false;
}
async function changed() {
  const error = errorFormulario();
  if (error) {
    mostrarPendiente(error);
    return;
  }
  const notice = document.getElementById("formValidation");
  if (notice) notice.hidden = true;
  const where = isTauri() ? "este ordenador" : "este navegador";
  setSaveState(`Guardando en ${where}…`, "saving");
  try {
    const next = editando ? [...familias.filter(f => f.id !== editando.id), structuredClone(editando)].sort((a, b) => a.numero - b.numero) : familias;
    await saveDB(next);
    familias = next;
    siguienteFamilia = Math.max(0, ...familias.map(f => f.numero)) + 1;
    setSaveState(`Guardado en ${where}.`, "saved");
  } catch (error) {
    setSaveState("Error: no se guardaron los últimos cambios.", "error");
    throw error;
  }
}
function navegacion() {
  return `<nav class="card toolbar" aria-label="Secciones">${[['listado', 'Listado'], ['reparto', 'Reparto'], ['resumen', 'Resumen']].map(([id, texto]) => `<button data-action="section" data-view="${id}" class="${vista === id ? 'primary' : 'secondary'}" aria-current="${vista === id ? 'page' : 'false'}">${texto}</button>`).join('')}</nav>`;
}
function render() {
  document.getElementById("app").dataset.view = vista;
  if (vista === 'formulario') renderFormulario();
  else if (vista === 'resumen') renderResumen();
  else if (vista === 'reparto') renderReparto();
  else renderListado();
  renderExcelNotice();
  renderAppointmentAlert();
  renderDuplicateAlert();
  requestAnimationFrame(updatePageNav);
}
function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
function renderAppointmentAlert() {
  const alertBox = document.getElementById('appointmentAlert');
  if (!alertBox) return;
  const overdue = familias.flatMap(family => {
    const titular = family.personas.find(p => p.titular) ?? family.personas[0];
    const name = `${titular?.nombre ?? ''} ${titular?.apellidos ?? ''}`.trim();
    return family.personas.filter(person => person.proximaCita && person.proximaCita < todayISO())
      .map(person => ({ numero: family.numero, name, cita: person.proximaCita }));
  }).sort((a, b) => a.numero - b.numero || a.cita.localeCompare(b.cita));
  alertBox.hidden = overdue.length === 0;
  if (!overdue.length) { alertBox.replaceChildren(); return; }
  alertBox.innerHTML = `<strong>Hay ${overdue.length === 1 ? 'una cita de renovación vencida' : `${overdue.length} citas de renovación vencidas`}.</strong> Revisa estos casos, confirma que la vigencia está al día y actualízala antes de enviar el listado:<ul>${overdue.map(item => `<li>Familia ${item.numero}${item.name ? ` — ${esc(item.name)}` : ''}: cita del ${fmt(item.cita)}</li>`).join('')}</ul>`;
}
function normalizeDuplicateKey(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/[^\p{L}\p{N}]/gu, "");
}
function findDuplicateGroups() {
  const people = familias.flatMap(family => family.personas.map((person, index) => ({
    family,
    person,
    key: `${family.id}:${index}`,
    name: `${person.nombre} ${person.apellidos}`.trim(),
  })));
  const groups = new Map();
  for (const [label, valueOf] of [
    ["Nombre y apellidos", item => {
      if (!String(item.person.nombre ?? "").trim() || !String(item.person.apellidos ?? "").trim()) return "";
      return normalizeDuplicateKey(`${item.person.nombre} ${item.person.apellidos}`);
    }],
    ["Documento", item => normalizeDuplicateKey(item.person.documento)],
  ]) {
    const byValue = new Map();
    for (const item of people) {
      const value = valueOf(item);
      if (!value) continue;
      if (!byValue.has(value)) byValue.set(value, []);
      byValue.get(value).push(item);
    }
    for (const matches of byValue.values()) {
      if (matches.length < 2) continue;
      const groupKey = matches.map(item => item.key).sort().join("|");
      const group = groups.get(groupKey) ?? { people: matches, reasons: [] };
      group.reasons.push(label);
      groups.set(groupKey, group);
    }
  }
  return [...groups.values()].sort((a, b) => a.people[0].family.numero - b.people[0].family.numero);
}
function renderDuplicateAlert() {
  const alertBox = document.getElementById("duplicateAlert");
  if (!alertBox) return;
  const groups = findDuplicateGroups();
  alertBox.hidden = groups.length === 0;
  if (!groups.length) {
    alertBox.replaceChildren();
    return;
  }
  const count = groups.reduce((sum, group) => sum + group.people.length, 0);
  alertBox.innerHTML = `<strong>Revisa posibles duplicados: ${groups.length} coincidencia${groups.length === 1 ? "" : "s"} en ${count} registros.</strong><details><summary>Ver coincidencias</summary><ul>${groups.map(group => `<li><span>${group.reasons.join(" y ")}:</span> ${group.people.map(item => `<button type="button" class="duplicate-family-link" data-duplicate-family="${esc(item.family.id)}">Familia ${item.family.numero} · ${esc(item.name || "Persona sin nombre")}</button>`).join(" ")}</li>`).join("")}</ul></details>`;
}
function updatePageNav() {
  const up = document.getElementById('pageUp'), down = document.getElementById('pageDown');
  if (!up || !down) return;
  const maxY = document.documentElement.scrollHeight - window.innerHeight;
  up.hidden = window.scrollY < 80;
  down.hidden = maxY < 80 || window.scrollY > maxY - 80;
}
function renderResumen() {
  const r = resumen(familias);
  app.innerHTML = navegacion() + `<div class="card summary-actions"><div><h2>Resumen de beneficiarios</h2><p>Consulta y comparte una imagen de este resumen.</p></div><button class="primary" data-action="exportSummary">${icon("download")} Descargar imagen</button></div>
  <div id="summaryImage" class="summary-image"><h2>Resumen de beneficiarios</h2><p class="summary-date">Generado el ${fmt(todayISO())}</p><div class="card"><div class="summary"><div class="stat"><strong>${r.familias}</strong>Familias</div><div class="stat"><strong>${r.personas}</strong>Beneficiarios</div></div></div>
  <div class="report-grid"><div class="card"><h2>Familias por número de miembros</h2><table><thead><tr><th>Miembros</th><th>Familias</th></tr></thead><tbody>${r.tamanos.map((n, i) => `<tr><td>${i + 1}</td><td>${n}</td></tr>`).join('')}${r.fuera ? `<tr><td>Más de 10</td><td>${r.fuera}</td></tr>` : ''}</tbody></table></div>
  <div class="card"><h2>Personas por rango de edad</h2><table><thead><tr><th>Rango de la plantilla</th><th>Personas</th></tr></thead><tbody>${['0–2 años', '3–18 años', '19–100 años'].map((label, i) => `<tr><td>${label}</td><td>${r.edades[i]}</td></tr>`).join('')}<tr><td>Sin fecha o fuera de los rangos</td><td>${r.sinRango}</td></tr></tbody></table><p>Se utilizan los límites de fechas de la plantilla: desde hace 3 años hasta antes de hoy; desde hace 18 hasta antes de hace 3 años; y desde hace 100 hasta antes de hace 18 años. Estos límites no coinciden exactamente con las etiquetas de edad.</p></div></div></div>`;
}

async function exportSummary() {
  try {
    const target = document.getElementById('summaryImage');
    const dataUrl = await toPng(target, { pixelRatio: 2, backgroundColor: '#f3f5f7' });
    const filename = `Resumen-beneficiarios-${todayISO()}.png`;
    if (isTauri()) {
      const path = await save({ title: 'Guardar imagen del resumen', defaultPath: filename, filters: [{ name: 'Imagen PNG', extensions: ['png'] }] });
      if (!path) return;
      const blob = await (await fetch(dataUrl)).blob();
      await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
      alert('La imagen del resumen se ha guardado. Ya puedes adjuntarla a un correo.');
      return;
    }
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
  } catch (error) {
    console.error(error);
    alert(`No se pudo crear la imagen del resumen. ${error.message}`);
  }
}
function renderReparto() {
  const r = resumen(familias), total = r.tamanos.reduce((n, c, i) => n + c * (i + 1), 0);
  const tamanosActivos = r.tamanos.flatMap((cantidad, i) => cantidad ? [i + 1] : []);
  const anchoColumnaFamilia = tamanosActivos.length ? (62 / tamanosActivos.length).toFixed(3) : "0";
  app.innerHTML = navegacion() + `<section class="card reparto-page">
    <div class="reparto-heading"><div><div class="reparto-print-brand"><img src="${companyLogo}" alt="Banco de Alimentos de Tenerife"></div><h2>Reparto de alimentos</h2><p class="reparto-intro">Introduce la cantidad asignada de cada alimento en envases. La tabla calcula los envases por familia según su número de miembros, como en Excel.</p></div><div class="reparto-actions"><button class="secondary" data-action="printReparto">Imprimir reparto</button><button class="primary" data-action="exportExcel">Generar Excel</button></div></div>
    <div class="reparto-summary"><span><strong>${r.tamanos.reduce((a, b) => a + b, 0)}</strong> familias</span><span><strong>${total}</strong> beneficiarios para el reparto</span></div>
    ${r.fuera ? `<div class="notice reparto-screen-note">${r.fuera} familias de más de 10 miembros quedan fuera del cálculo de Reparto, igual que en la plantilla.</div>` : ''}${!total ? '<p class="notice reparto-screen-note">Añade familias de 1 a 10 miembros para calcular el reparto.</p>' : ''}
    <div class="table-wrap"><table class="reparto-table"><thead><tr><th>Alimento</th><th>Cantidad asignada</th>${tamanosActivos.map(size => `<th class="reparto-size-column" style="--print-width:${anchoColumnaFamilia}%">${size} miembros</th>`).join('')}<th class="reparto-row-action-heading">Acciones</th></tr><tr><th>Familias</th><th></th>${tamanosActivos.map(size => `<th class="reparto-size-column" style="--print-width:${anchoColumnaFamilia}%">${r.tamanos[size - 1]}</th>`).join('')}<th></th></tr><tr><th>Beneficiarios</th><th></th>${tamanosActivos.map(size => `<th class="reparto-size-column" style="--print-width:${anchoColumnaFamilia}%">${r.tamanos[size - 1] * size}</th>`).join('')}<th></th></tr></thead><tbody>${reparto.map((a, i) => `<tr><td><input aria-label="Nombre del alimento ${i + 1}" maxlength="100" data-food-name="${i}" value="${esc(a.nombre)}"></td><td><input aria-label="Cantidad de ${esc(a.nombre)}" type="number" min="0" step="any" data-food-amount="${i}" value="${a.cantidad}"></td>${tamanosActivos.map(size => `<td class="reparto-size-column" style="--print-width:${anchoColumnaFamilia}%" data-result="${i}:${size - 1}">${envases(a.cantidad, size, r.tamanos[size - 1], total) ?? '—'}</td>`).join('')}<td class="reparto-row-action"><button type="button" class="danger" data-action="removeRepartoRow" data-index="${i}" aria-label="Quitar ${esc(a.nombre || `fila ${i + 1}`)}" title="Quitar fila">${icon("trash")}</button></td></tr>`).join('')}</tbody></table></div>
    <div class="reparto-row-actions"><button class="secondary" data-action="addRepartoRow" ${reparto.length >= MAX_REPARTO_FILAS ? "disabled" : ""}>${icon("add")} Añadir fila</button><span>${reparto.length} de ${MAX_REPARTO_FILAS} filas · el Excel admite hasta ${MAX_REPARTO_FILAS}</span></div>
    <p class="reparto-explanation">Se divide cada cantidad entre los beneficiarios de esta tabla, se multiplica por los miembros y se redondea al entero más próximo. El redondeo puede producir un total distinto de la cantidad asignada.</p>
  </section>`;
}

function displayDate(value) {
  return value ? value.split("-").reverse().join("/") : "";
}
function parseTypedDate(value) {
  const match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, day, month, year] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (year < 1900 || year > 9999 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function dateField(person, index, field, label, note = "") {
  const key = `${person.id}:${field}`;
  const current = dateDrafts.get(key) ?? displayDate(person[field]);
  const pickerId = `date-picker-${person.id}-${field}`;
  return `<div class="date-field"><label for="date-text-${person.id}-${field}">${label}</label><div class="date-entry"><input id="date-text-${person.id}-${field}" type="text" inputmode="numeric" autocomplete="off" placeholder="dd/mm/aaaa" aria-label="${label}, formato día/mes/año" value="${esc(current)}" data-date-text data-field="${field}" data-index="${index}" data-person-id="${esc(person.id)}"><button class="date-picker-button" type="button" title="Abrir calendario" aria-label="Abrir calendario para ${label}" data-action="datePicker" data-picker-id="${esc(pickerId)}">${icon("calendar")}</button><input class="date-picker-native" id="${esc(pickerId)}" type="date" min="1900-01-01" max="9999-12-31" value="${esc(person[field])}" data-date-picker data-field="${field}" data-index="${index}" data-person-id="${esc(person.id)}" tabindex="-1" aria-hidden="true"></div>${note}</div>`;
}
function sharedDateField(person, field, label) {
  return `<div class="date-field"><label>${label}</label><input type="text" value="${esc(displayDate(person[field]))}" readonly aria-label="${label}, compartida con la persona titular"><small>Fecha compartida con el titular.</small></div>`;
}
function normalizeTitulares(familias) {
  let wasChanged = false;
  for (const family of familias) {
    if (!family.personas.length) continue;
    const chosen = Math.max(0, family.personas.findIndex(person => person.titular === true));
    family.personas.forEach((person, index) => {
      const titular = index === chosen;
      if (person.titular !== titular) wasChanged = true;
      person.titular = titular;
    });
    const titular = family.personas[chosen];
    for (const person of family.personas) {
      for (const field of ["derivacion", "vigencia"]) {
        if (person[field] !== titular[field]) wasChanged = true;
        person[field] = titular[field] ?? "";
      }
    }
  }
  return wasChanged;
}
function renderExcelNotice() {
  let notice = document.getElementById('excelNotice');
  if (!notice) {
    notice = document.createElement('div');
    notice.id = 'excelNotice';
    notice.className = 'notice excel-notice';
    notice.setAttribute('role', 'status');
    app.prepend(notice);
  }
  notice.hidden = !avisoExcel;
  notice.textContent = avisoExcel;
}
function informeImportacion() {
  if (!ultimoInforme) return '';
  return `<section class="card import-report" aria-label="Resultado de la última importación"><h2>Última importación de Excel</h2><p><strong>${esc(ultimoInforme.archivo)}</strong> · ${esc(new Date(ultimoInforme.fecha).toLocaleString('es-ES'))}</p><p>${ultimoInforme.familias} familias y ${ultimoInforme.personas} beneficiarios cargados. <strong>${ultimoInforme.issues.length} filas omitidas.</strong></p>${ultimoInforme.issues.length ? `<details open><summary>Filas omitidas y motivos</summary><p>Revisa estas filas en el Excel original para corregirlas o añadir sus beneficiarios manualmente.</p><div class="table-wrap"><table><thead><tr><th>Fila del Excel</th><th>Familia</th><th>Persona</th><th>Motivo</th></tr></thead><tbody>${ultimoInforme.issues.map(issue => `<tr><td>${esc(issue.row)}</td><td>${esc(issue.familia || '—')}</td><td>${esc([issue.nombre, issue.apellidos].filter(Boolean).join(' ') || 'Sin nombre en el archivo')}</td><td>${esc(issue.reason)}</td></tr>`).join('')}</tbody></table></div></details>` : '<p>Se cargaron todos los registros válidos encontrados.</p>'}${ultimoInforme.warnings?.length ? `<details><summary>Datos informativos importados con ajustes (${ultimoInforme.warnings.length})</summary><ul>${ultimoInforme.warnings.map(item => `<li>Fila ${esc(item.row)}, familia ${esc(item.familia)}: ${esc(item.reason)}</li>`).join('')}</ul></details>` : ''}${ultimoInforme.sinPersistir ? '<p class="notice">Este informe no pudo guardarse para la próxima apertura. Consérvalo antes de cerrar la aplicación.</p>' : ''}</section>`;
}
function renderListado() {
  document.getElementById("app").innerHTML = navegacion() + `
 <div class="card list-controls"><div class="list-heading"><h2>Listado de beneficiarios</h2><button class="primary" data-action="newFamily">${icon("add")} Nueva familia</button></div><div class="toolbar list-filters">
 <div class="list-modes" role="group" aria-label="Mostrar familias o personas"><button data-action="listMode" data-mode="familias" aria-pressed="${modoListado === 'familias'}" class="${modoListado === 'familias' ? 'primary' : 'secondary'}">Familias</button>
 <button data-action="listMode" data-mode="personas" aria-pressed="${modoListado === 'personas'}" class="${modoListado === 'personas' ? 'primary' : 'secondary'}">Personas</button>
 </div><label class="state-filter">Estado de la familia
 <select data-state-filter aria-label="Filtrar por estado de la familia">${[['', 'Todos'], ['ok', 'Correcta'], ['warn', 'Próxima'], ['expired', 'Caducada'], ['overdue', 'Todas las caducadas'], ['appointment', 'Cita pendiente']].map(([value, label]) => `<option value="${value}" ${filtroEstado === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
 <label class="family-search" for="familyNumber">N.º de familia<input id="familyNumber" value="${esc(numeroFamilia)}" inputmode="numeric" placeholder="Ej.: 12" data-family-search aria-describedby="familySearchHelp"></label>
 <label class="text-search" for="search">Nombre o documento<input value="${esc(busqueda)}" id="search" class="search" placeholder="Nombre, apellidos o documento" data-search></label>
 </div><p id="familySearchHelp" class="filter-help">El número busca una familia exacta: 12 no incluye 120. Puedes combinar los filtros.</p></div>
 <div class="summary">
 <div class="stat"><strong>${familias.length}</strong>Familias</div>
 <div class="stat"><strong>${familias.reduce((n, f) => n + f.personas.length, 0)}</strong>Beneficiarios</div>
 <button type="button" class="stat stat-filter" data-action="toggleExpired" aria-pressed="${filtroEstado === 'overdue'}" title="Activar o quitar el filtro de vigencias caducadas"><strong>${familias.filter(f => f.personas.some(p => caducada(p.vigencia))).length}</strong><span>Caducadas</span><small data-filter-hint>${filtroEstado === 'overdue' ? 'Quitar filtro' : 'Filtrar familias'}</small></button>
 <div class="stat"><strong>${familias.filter(f => f.personas.some(p => p.proximaCita)).length}</strong>Con próxima cita</div>
 </div>
 <details class="card status-legend" aria-label="Leyenda de estados de las familias">
 <summary>Qué significa cada estado</summary>
 <ul>
 <li><span class="badge ok">Correcta</span><span>Las vigencias están al día y no vencen en los próximos 60 días.</span></li>
 <li><span class="badge warn">Próxima</span><span>Alguna vigencia vencerá en los próximos 60 días.</span></li>
 <li><span class="badge expired">Caducada</span><span>Alguna vigencia ya venció y no hay una próxima cita anotada.</span></li>
 <li><span class="badge appointment">Cita pendiente</span><span>Hay una vigencia vencida y una próxima cita anotada.</span></li>
 </ul>
 <small>El estado de la familia depende de las vigencias y citas de sus miembros.</small>
 </details>
 <div class="card list-print-card"><div class="list-print-heading"><img src="${companyLogo}" alt="Banco de Alimentos de Tenerife"><h2 id="listPrintTitle"></h2><p id="listPrintFilters"></p></div><div class="table-wrap"><table><thead id="listHead"><tr><th>N.º</th><th>Familia</th><th>Miembros</th><th>Vigencia más próxima</th><th>Próxima cita</th><th>Estado</th><th></th></tr></thead><tbody id="rows"></tbody></table></div><p id="counter" style="font-size:13px;color:#666"></p></div>
 <div class="card">
 <h2 style="margin-top:0">Datos y copias de seguridad</h2>
 <div class="actions">
 <button class="secondary" data-action="importExcel">${icon("excel")} Cargar Excel en este ordenador</button>
 <input id="importExcel" class="hidden" type="file" accept=".xlsx" data-import-excel>
 <button class="primary" data-action="exportExcel">${icon("excel")} Generar Excel</button>
 <button class="secondary" data-action="printListado">Imprimir listado</button>
 </div>
 <p class="save">El estado del guardado aparece en la parte superior de la aplicación.</p>
 <details class="backup-help"><summary>Cómo usar el Excel y las copias de seguridad</summary><div class="notice">Los cambios se guardan automáticamente en este ordenador. Para continuar en otro equipo, genera el Excel y cárgalo allí desde este apartado. Mantén una sola copia activa del listado para evitar ediciones distintas en cada equipo.</div>
 <div class="notice">Al cargar un Excel, las familias actuales se sustituirán por las de la hoja Listado. Usa un archivo generado con la plantilla oficial. Los datos de Reparto no se importan y el archivo no se modifica.</div>
 <div class="notice">El Excel conserva las hojas Listado, Reparto y Resumen. Sus cálculos se actualizan al abrirlo en Excel o LibreOffice. La plantilla admite hasta 995 beneficiarios; Reparto y el resumen por tamaño contemplan familias de 1 a 10 miembros.</div></details>
 </div>${informeImportacion()}`;
  filterTable();
  renderExcelNotice();
}
function coincideEstado(f) {
  return !filtroEstado || (filtroEstado === 'overdue' ? f.personas.some(p => caducada(p.vigencia)) : estado(f)[0] === filtroEstado);
}
function filterTable() {
  const stat = app.querySelector('[data-action="toggleExpired"]');
  if (stat) {
    stat.setAttribute('aria-pressed', String(filtroEstado === 'overdue'));
    stat.querySelector('[data-filter-hint]').textContent = filtroEstado === 'overdue' ? 'Quitar filtro' : 'Filtrar familias';
  }
  const q = (document.getElementById("search")?.value || "").toLowerCase().trim();
  busqueda = q;
  numeroFamilia = document.getElementById("familyNumber")?.value.trim() || "";
  if (modoListado === 'personas') {
    const all = familias.flatMap(f => f.personas.map(p => ({ f, p })));
    const list = ordenarListado(all.filter(({ f, p }) => coincideEstado(f) && coincideNumeroFamilia(f.numero, numeroFamilia) && (!q || (p.nombre + ' ' + p.apellidos + ' ' + p.documento).toLowerCase().includes(q))), ({ f, p }, col) => col === 'numero' ? f.numero : col === 'edad' ? edad(p.nacimiento) : col === 'titular' ? Number(Boolean(p.titular)) : p[col]);
    document.getElementById('listHead').innerHTML = encabezadosListado([['numero', 'Familia'], ['nombre', 'Nombre'], ['apellidos', 'Apellidos'], ['documento', 'Documento'], ['titular', 'Titular'], ['nacimiento', 'Nacimiento'], ['edad', 'Edad'], ['derivacion', 'Derivación'], ['vigencia', 'Vigencia'], ['proximaCita', 'Próxima cita']]);
    document.getElementById('rows').innerHTML = list.map(({ f, p }) => `<tr class="click" data-action="openFamily" data-id="${esc(f.id)}"><td>${f.numero}</td><td>${esc(p.nombre)}</td><td>${esc(p.apellidos)}</td><td>${esc(p.documento)}</td><td>${p.titular ? 'Sí' : '—'}</td><td>${fmt(p.nacimiento)}</td><td>${edad(p.nacimiento) || (edad(p.nacimiento) === 0 ? 0 : '—')}</td><td>${fmt(p.derivacion)}</td><td>${fmt(p.vigencia)}</td><td>${fmt(p.proximaCita)}</td><td class="list-actions-column"><button class="secondary" data-action="openFamily" data-id="${esc(f.id)}">Editar familia</button></td></tr>`).join('') || '<tr><td colspan="11" class="empty">No se encontraron personas.</td></tr>';
    document.getElementById('counter').textContent = `Mostrando ${list.length} de ${all.length} personas`;
    return;
  }
  const list = ordenarListado(familias.filter(f => coincideEstado(f) && coincideNumeroFamilia(f.numero, numeroFamilia) && (!q || f.personas.some(p => (p.nombre + " " + p.apellidos + " " + p.documento).toLowerCase().includes(q)))), (f, col) => {
    const titular = f.personas.find(p => p.titular) ?? f.personas[0];
    if (col === 'numero') return f.numero;
    if (col === 'nombre') return `${titular.nombre} ${titular.apellidos}`.trim();
    if (col === 'documento') return titular.documento;
    if (col === 'miembros') return f.personas.length;
    if (col === 'estado') return estado(f)[1];
    return f.personas.map(p => p[col]).filter(Boolean).sort()[0];
  });
  document.getElementById("listHead").innerHTML = encabezadosListado([['numero', 'N.º'], ['nombre', 'Titular'], ['documento', 'Documento'], ['miembros', 'Miembros'], ['vigencia', 'Vigencia más próxima'], ['proximaCita', 'Próxima cita'], ['estado', 'Estado']]);
  document.getElementById("rows").innerHTML = list.length ? list.map(f => {
    const titular = f.personas.find(p => p.titular) ?? f.personas[0];
    const names = (esc(titular.nombre) + " " + esc(titular.apellidos)).trim() || "Sin datos";
    const vig = f.personas.map(p => p.vigencia).filter(Boolean).sort()[0], cita = f.personas.map(p => p.proximaCita).filter(Boolean).sort()[0], [cl, tx] = estado(f);
    return `<tr class="click" data-action="openFamily" data-id="${esc(f.id)}"><td><b>${f.numero}</b></td><td>${names}</td><td>${esc(titular.documento) || "—"}</td><td>${f.personas.length}</td><td>${fmt(vig)}</td><td>${fmt(cita)}</td><td><span class="badge ${cl}">${tx}</span></td></tr>`
  }).join("") : `<tr><td colspan="7" class="empty">No se encontraron familias.</td></tr>`;
  document.getElementById("counter").textContent = `Mostrando ${list.length} de ${familias.length} familias`;
}
async function newFamily() { editando = familia(siguienteFamilia); vista = "formulario"; setSaveState("Completa el titular para crear la familia.", "pending"); render() }
function openFamily(id) { if (!validarFormulario()) return; const f = familias.find(f => f.id === id); if (!f) return; editando = structuredClone(f); vista = "formulario"; render() }
async function back(target) {
  const isNewFamily = editando && !familias.some(f => f.id === editando.id);
  const titular = editando?.personas.find(person => person.titular);
  const titularVacio = titular && ["nombre", "apellidos", "documento", "nacimiento", "derivacion", "vigencia", "proximaCita"].every(key => !String(titular[key] ?? "").trim());
  if (target?.dataset.action === "back" && isNewFamily && editando.personas.length === 1 && titularVacio && !dateDrafts.size) {
    dateDrafts.clear();
    editando = null;
    vista = "listado";
    setSaveState("Borrador vacío descartado.", "saved");
    render();
    return;
  }
  if (!validarFormulario()) return;
  await changed();
  dateDrafts.clear();
  editando = null;
  vista = "listado";
  render();
}
async function removeFamily() { if (!confirm("¿Eliminar esta familia y todas sus personas?")) return; familias = familias.filter(f => f.id !== editando.id); editando = null; renumerar(); await changed(); vista = "listado"; render() }
async function addPerson() {
  if (!validarFormulario()) return;
  const titular = editando.personas.find(person => person.titular) ?? editando.personas[0];
  const nueva = persona();
  nueva.derivacion = titular.derivacion;
  nueva.vigencia = titular.vigencia;
  editando.personas.push(nueva);
  await changed();
  render();
}
async function removePerson(i) { if (editando.personas.length === 1) { alert("Una familia debe tener al menos una persona."); return } const eraTitular = editando.personas[i].titular; editando.personas.splice(i, 1); if (eraTitular) { editando.personas[0].titular = true; editando.personas[0].menor = false; } await changed(); render() }
async function updateTitular(index, checked) {
  if (!checked) {
    app.querySelector(`[data-titular][data-index="${index}"]`).checked = true;
    return;
  }
  editando.personas.forEach((person, personIndex) => person.titular = personIndex === index);
  editando.personas[index].menor = false;
  await changed();
  renderFormulario();
  const error = errorFormulario();
  if (error) mostrarPendiente(error);
}
async function updatePerson(i, k, v) {
  const shared = k === "derivacion" || k === "vigencia";
  if (shared) {
    const titular = editando.personas.find(person => person.titular) ?? editando.personas[0];
    titular[k] = v;
    editando.personas.forEach(person => person[k] = v);
    app.querySelectorAll(`[data-shared-date="${k}"]`).forEach(input => input.value = displayDate(v));
  } else {
    editando.personas[i][k] = v;
    if (k === "nacimiento" && v) {
      editando.personas[i].menor = !editando.personas[i].titular && typeof edad(v) === "number" && edad(v) < 18;
      const checkbox = app.querySelector(`[data-menor][data-index="${i}"]`);
      if (checkbox) checkbox.checked = editando.personas[i].menor;
    }
  }
  // Actualizar solo los avisos conserva el foco y la selección del año.
  const card = app.querySelector(`[data-person="${i}"]`);
  if (k === "nacimiento") {
    card.querySelector("[data-age]").textContent = edad(v) === "" ? "—" : edad(v);
    const person = editando.personas[i];
    card.querySelectorAll('input[data-field="nombre"], input[data-field="apellidos"], input[data-field="documento"]').forEach(input => {
      input.required = input.dataset.field === 'documento' ? Boolean(person.titular) : person.titular || !person.menor;
      input.setCustomValidity("");
    });
    const note = card.querySelector('[data-adult-note]');
    if (note) note.hidden = Boolean(person.menor);
  }
  if (k === "vigencia") {
    app.querySelectorAll("[data-vigencia-status]").forEach(status => {
      status.hidden = !v;
      status.textContent = v ? (caducada(v) ? "VIGENCIA CADUCADA" : "Vigencia vigente") : "";
      status.classList.toggle("is-expired", Boolean(v && caducada(v)));
      status.classList.toggle("is-current", Boolean(v && !caducada(v)));
    });
  }
  await changed();
  renderAppointmentAlert();
  renderDuplicateAlert();
}
function renderFormulario() {
  const f = editando;
  document.getElementById("app").innerHTML = `
 <div class="card"><div class="form-head"><div><button class="secondary" data-action="back">${icon("back")} Volver al listado</button><h2>Familia ${f.numero}</h2></div><button class="danger" data-action="removeFamily">${icon("trash")} Eliminar familia</button></div>
 <p style="color:#666">Rellene únicamente los datos de las personas. La edad y el número de miembros se calculan automáticamente. Escriba las fechas como día/mes/año (por ejemplo, 15/06/1967) o use el botón de calendario. Las fechas de derivación y vigencia son comunes a la familia: edítelas en la persona titular. En los demás miembros se muestran como referencia.</p></div>
 <div class="notice" id="formValidation" role="status" hidden></div>
 <div class="card">${f.personas.map((p, i) => `
 <div class="person" data-person="${i}"><div class="person-head"><div><h3>${p.titular ? "Titular" : `Miembro ${i + 1}`}</h3><label class="titular-toggle"><input type="checkbox" data-titular data-index="${i}" ${p.titular ? "checked" : ""}> Es titular</label></div><button class="danger" data-action="removePerson" data-index="${i}">${icon("trash")} Eliminar persona</button></div>
 ${!p.titular ? `<label class="titular-toggle"><input type="checkbox" data-menor data-index="${i}" ${p.menor ? "checked" : ""}> Menor de edad (fecha de nacimiento obligatoria; nombre y documento opcionales)</label><p data-adult-note ${p.menor ? 'hidden' : ''}>Nombre y apellidos del adulto son obligatorios. El documento es opcional; se recomienda completarlo.</p>` : '<p>Nombre, apellidos y documento del titular son obligatorios.</p>'}
 <div class="grid">
 <div><label>Nombre</label><input value="${esc(p.nombre)}" data-field="nombre" data-index="${i}" ${(p.titular || !p.menor) ? 'required pattern=".*\\S.*"' : ""}></div>
 <div><label>Apellidos</label><input value="${esc(p.apellidos)}" data-field="apellidos" data-index="${i}" ${(p.titular || !p.menor) ? 'required pattern=".*\\S.*"' : ""}></div>
 <div><label>Documento${p.titular ? ' (obligatorio)' : ' (opcional)'}</label><input value="${esc(p.documento)}" data-field="documento" data-index="${i}" ${p.titular ? 'required pattern=".*\\S.*"' : ""}></div>
 ${dateField(p, i, "nacimiento", "Fecha de nacimiento", `<small>Edad: <b data-age>${edad(p.nacimiento) === "" ? "—" : edad(p.nacimiento)}</b></small>`)}
 ${p.titular ? dateField(p, i, "derivacion", "Fecha derivación") : sharedDateField(p, "derivacion", "Fecha derivación")}
 ${p.titular ? dateField(p, i, "vigencia", "Vigencia", `<small data-vigencia-status class="date-status ${p.vigencia ? (caducada(p.vigencia) ? "is-expired" : "is-current") : ""}" ${p.vigencia ? "" : "hidden"}>${p.vigencia ? (caducada(p.vigencia) ? "VIGENCIA CADUCADA" : "Vigencia vigente") : ""}</small>`) : sharedDateField(p, "vigencia", "Vigencia")}
 ${dateField(p, i, "proximaCita", "Próxima cita", `<small>Rellénela si la vigencia está caducada y ya tiene cita de renovación.</small>`)}
 <div><label>N.º de miembros</label><input value="${f.personas.length}" disabled></div>
 </div></div>`).join("")}
 <div class="actions"><button class="secondary" data-action="addPerson">${icon("add")} Añadir persona</button><button class="primary" data-action="saveFamily">Guardar y volver</button><button class="secondary" data-action="cancelFamily">Descartar cambios pendientes</button></div></div>`;
  const error = errorFormulario();
  if (error) mostrarPendiente(error);
}

async function importExcelFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const imported = await readExcel(file);
    const count = imported.reduce((sum, family) => sum + family.personas.length, 0);
    const issues = imported.issues ?? [];
    const detail = issues.length
      ? `\n\nSe omitirán ${issues.length} fila${issues.length === 1 ? "" : "s"}:\n${issues.slice(0, 12).map(issue => `• Fila ${issue.row}: ${issue.reason}`).join("\n")}${issues.length > 12 ? `\n• Y ${issues.length - 12} más.` : ""}`
      : "";
    if (!confirm(`Se han encontrado ${imported.length} familias y ${count} beneficiarios válidos.${detail}\n\nSe sustituirán los datos actuales de la aplicación. ¿Continuar?`)) return;
    normalizeTitulares(imported);
    setSaveState("Importando Excel y guardando…", "saving");
    await saveDB(imported);
    familias = imported;
    ultimoInforme = { archivo: file.name, fecha: new Date().toISOString(), familias: imported.length, personas: count, issues, warnings: imported.warnings ?? [] };
    try { await saveImportReport(ultimoInforme); }
    catch (error) { console.error(error); ultimoInforme.sinPersistir = true; }
    siguienteFamilia = Math.max(0, ...familias.map(f => f.numero)) + 1;
    editando = null;
    vista = "listado";
    render();
    setSaveState(`Importación completada: ${familias.length} familias y ${count} personas guardadas${issues.length ? `; ${issues.length} filas omitidas` : ""}.`, "saved");
  } catch (error) {
    console.error(error);
    alert(`No se pudo importar el Excel. ${error.message}`);
  } finally {
    event.target.value = "";
  }
}

function reportError(error) {
  console.error(error);
  setSaveState("Error: no se pudieron guardar los cambios.", "error");
  alert("No se pudieron guardar los cambios. Realice una copia de seguridad antes de cerrar.");
}

const app = document.getElementById("app");
document.getElementById("appVersion").textContent = appVersion;
const actions = {
  newFamily, back, removeFamily, addPerson,
  saveFamily: () => back(),
  cancelFamily: () => { editando = null; dateDrafts.clear(); vista = "listado"; setSaveState("Cambios pendientes descartados.", "saved"); render(); },
  toggleExpired: () => {
    filtroEstado = filtroEstado === 'overdue' ? '' : 'overdue';
    app.querySelector('[data-state-filter]').value = filtroEstado;
    filterTable();
  },
  reload: () => location.reload(),
  section: target => { vista = target.dataset.view; render(); },
  sortColumn: target => { const orden = ordenListado[modoListado]; orden.direccion = orden.columna === target.dataset.column ? -orden.direccion : 1; orden.columna = target.dataset.column; filterTable(); },
  listMode: target => { modoListado = target.dataset.mode; renderListado(); renderAppointmentAlert(); requestAnimationFrame(updatePageNav); },
  exportSummary,
  printReparto: () => window.print(),
  printListado: () => window.print(),
  addRepartoRow: async () => {
    if (reparto.length >= MAX_REPARTO_FILAS) return;
    reparto.push({ nombre: "Nuevo alimento", cantidad: "" });
    setSaveState("Guardando Reparto…", "saving");
    try {
      await saveReparto(reparto);
      setSaveState("Reparto guardado.", "saved");
      render();
    } catch (error) { reportError(error); }
  },
  removeRepartoRow: async target => {
    const index = Number(target.dataset.index), alimento = reparto[index];
    if (!alimento) return;
    if ((alimento.cantidad !== "" || (alimento.nombre && alimento.nombre !== "Nuevo alimento")) && !confirm(`¿Quitar «${alimento.nombre}» y su cantidad asignada del Reparto?`)) return;
    reparto.splice(index, 1);
    setSaveState("Guardando Reparto…", "saving");
    try {
      await saveReparto(reparto);
      setSaveState("Reparto guardado.", "saved");
      render();
    } catch (error) { reportError(error); }
  },
  openFamily: target => openFamily(target.dataset.id),
  removePerson: target => removePerson(Number(target.dataset.index)),
  exportExcel: async target => {
    target.disabled = true;
    target.textContent = "Generando Excel…";
    avisoExcel = "";
    renderExcelNotice();
    try {
      const generated = await exportExcel(familias, reparto);
      if (generated) {
        avisoExcel = isTauri() ? `Excel generado y guardado correctamente en ${generated.path}.${generated.opened ? '' : ' No se pudo abrir automáticamente; puedes abrirlo desde esa ubicación.'}` : "Excel generado. Se ha solicitado su descarga al navegador.";
        renderExcelNotice();
      }
    }
    catch (error) {
      console.error(error);
      alert(`No se pudo generar el Excel. ${error.message}`);
    } finally {
      target.disabled = false;
      target.textContent = "Generar Excel";
    }
  },
  importExcel: () => document.getElementById("importExcel").click(),
  datePicker: target => {
    const picker = document.getElementById(target.dataset.pickerId);
    try {
      if (typeof picker.showPicker === "function") picker.showPicker();
      else picker.click();
    } catch { picker.click(); }
  },
};
app.addEventListener("click", async event => {
  const target = event.target.closest("[data-action]");
  if (!target || !app.contains(target)) return;
  try { await actions[target.dataset.action]?.(target); } catch (error) { reportError(error); }
});
document.getElementById("duplicateAlert").addEventListener("click", event => {
  const target = event.target.closest("[data-duplicate-family]");
  if (target) openFamily(target.dataset.duplicateFamily);
});
document.getElementById('pageUp').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
document.getElementById('pageDown').addEventListener('click', () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }));
window.addEventListener('scroll', updatePageNav, { passive: true });
window.addEventListener('resize', updatePageNav);
window.addEventListener("beforeprint", () => {
  if (vista !== "listado") return;
  document.getElementById("listPrintTitle").textContent = `Listado de ${modoListado} · ${fmt(todayISO())}`;
  const estadoSeleccionado = app.querySelector("[data-state-filter] option:checked")?.textContent;
  document.getElementById("listPrintFilters").textContent = [numeroFamilia && `Familia: ${numeroFamilia}`, busqueda && `Búsqueda: ${busqueda}`, filtroEstado && `Estado: ${estadoSeleccionado}`].filter(Boolean).join(" · ");
});
app.addEventListener("input", async event => {
  const target = event.target;
  target.removeAttribute("aria-invalid");
  if (target.hasAttribute('data-food-name') || target.hasAttribute('data-food-amount')) {
    const index = Number(target.dataset.foodName ?? target.dataset.foodAmount);
    if (target.hasAttribute('data-food-name')) reparto[index].nombre = target.value;
    else {
      if (!target.validity.valid || (target.value !== '' && !Number.isFinite(Number(target.value)))) return;
      reparto[index].cantidad = target.value === '' ? '' : Number(target.value);
      const r = resumen(familias), total = r.tamanos.reduce((n, c, i) => n + c * (i + 1), 0);
      r.tamanos.forEach((n, j) => {
        const cell = app.querySelector(`[data-result="${index}:${j}"]`);
        if (cell) cell.textContent = envases(reparto[index].cantidad, j + 1, n, total) ?? '—';
      });
    }
    setSaveState('Guardando reparto…', 'saving');
    try { await saveReparto(reparto); setSaveState('Reparto guardado.'); } catch (error) { reportError(error); }
    return;
  }
  if (target.hasAttribute("data-search") || target.hasAttribute("data-family-search")) return filterTable();
  if (target.hasAttribute("data-date-text")) {
    target.setCustomValidity("");
    const key = `${target.dataset.personId}:${target.dataset.field}`;
    const value = target.value.trim();
    if (!value) {
      dateDrafts.delete(key);
      try { await updatePerson(Number(target.dataset.index), target.dataset.field, ""); }
      catch (error) { reportError(error); }
      return;
    }
    dateDrafts.set(key, value);
    if (!parseTypedDate(value)) mostrarPendiente({ mensaje: "Completa la fecha con el formato día/mes/año." });
    const parsed = parseTypedDate(value);
    if (parsed) {
      dateDrafts.delete(key);
      const picker = document.getElementById(`date-picker-${target.dataset.personId}-${target.dataset.field}`);
      if (picker) picker.value = parsed;
      try { await updatePerson(Number(target.dataset.index), target.dataset.field, parsed); }
      catch (error) { reportError(error); }
    }
    return;
  }
  if (!target.dataset.field || target.type === "date") return;
  target.setCustomValidity("");
  try { await updatePerson(Number(target.dataset.index), target.dataset.field, target.value); }
  catch (error) { reportError(error); }
});
app.addEventListener("change", async event => {
  const target = event.target;
  if (target.hasAttribute("data-menor")) {
    const person = editando.personas[Number(target.dataset.index)];
    if (target.checked && person.nacimiento && edad(person.nacimiento) >= 18) {
      target.checked = false;
      alert("La fecha de nacimiento indica que esta persona es mayor de edad.");
      return;
    }
    person.menor = target.checked;
    try { await changed(); renderFormulario(); const error = errorFormulario(); if (error) mostrarPendiente(error); } catch (error) { reportError(error); }
    return;
  }
  if (target.hasAttribute("data-state-filter")) { filtroEstado = target.value; filterTable(); return; }
  if (target.hasAttribute("data-titular")) {
    try { await updateTitular(Number(target.dataset.index), target.checked); }
    catch (error) { reportError(error); }
    return;
  }
  if (target.hasAttribute("data-import-excel")) return importExcelFile(event);
  if (!target.dataset.field || target.type !== "date") return;
  if (!target.validity.valid) return;
  dateDrafts.delete(`${target.dataset.personId}:${target.dataset.field}`);
  const textInput = app.querySelector(`[data-date-text][data-person-id="${target.dataset.personId}"][data-field="${target.dataset.field}"]`);
  if (textInput) textInput.value = displayDate(target.value);
  try { await updatePerson(Number(target.dataset.index), target.dataset.field, target.value); }
  catch (error) { reportError(error); }
});

app.addEventListener("focusout", event => {
  const target = event.target;
  if (target.hasAttribute("data-date-text") && target.value.trim() && !parseTypedDate(target.value)) {
    target.setCustomValidity("Escriba una fecha válida como 15/06/1967.");
    target.reportValidity();
    return;
  }
  if (target.hasAttribute("data-date-text")) target.setCustomValidity("");
});

async function init() {
  try {
    familias = await loadDB();
    try { ultimoInforme = await loadImportReport(); }
    catch (error) { console.error('No se pudo recuperar el informe de importación.', error); }
    const savedReparto = await loadReparto();
    reparto = prepararReparto(savedReparto);
    if (normalizeTitulares(familias)) await saveDB(familias);
    siguienteFamilia = Math.max(0, ...familias.map(f => f.numero)) + 1;
    render();
    const storageStatus = document.getElementById("storageState");
    if (isTauri()) {
      setSaveState("Datos cargados desde este ordenador.", "saved");
      if (storageStatus) storageStatus.textContent = "Guardado automático en este ordenador. Puedes cerrar la aplicación con seguridad.";
    } else {
      setSaveState("Datos cargados desde este navegador. Los cambios se guardan automáticamente.", "saved");
      const persistent = await navigator.storage?.persist?.().catch(() => false);
      if (storageStatus) storageStatus.textContent = persistent
        ? "Almacenamiento local persistente concedido por el navegador."
        : "Datos guardados en este navegador. Genera y conserva el Excel para tener una copia trasladable.";
    }
  } catch (error) {
    console.error(error);
    const storageStatus = document.getElementById("storageState");
    setSaveState("No se pudo abrir el almacenamiento local.", "error");
    const mode = isTauri() ? "aplicación de escritorio" : "navegador";
    if (storageStatus) storageStatus.textContent = `Falló la carga del almacenamiento (${mode}).`;
    const detail = error instanceof Error ? error.message : String(error);
    app.innerHTML = `<div class="card"><h2>No se pudieron cargar los datos</h2><p>La aplicación se está ejecutando en modo ${mode} y no ha podido abrir el almacenamiento local. Los datos existentes no se han borrado.</p><p class="notice">Detalle: ${esc(detail)}</p><p>${isTauri()
      ? "Cierra y vuelve a abrir la aplicación. Si sigue ocurriendo, copia aquí el detalle anterior para que podamos corregir la causa."
      : "Si querías abrir la aplicación de escritorio, cierra esta pestaña y ejecuta npm run tauri dev desde la carpeta del proyecto. Si querías usar el navegador, comprueba que lo abriste con npm run dev y que el almacenamiento del sitio está permitido."}</p><button class="secondary" data-action="reload">Reintentar</button></div>`;
  }
}
init();
