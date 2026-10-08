import "./styles.css";
import { loadImportReport, saveImportReport } from "./import-report.js";
import { erroresFamilia } from "./validacion.mjs";
import { numeroLibre } from "./numeracion.mjs";
import { incorporarAlta } from "./alta-listado.mjs";
import { editarPersona, eliminarMiembro, restaurarMiembro } from "./edicion-listado.mjs";
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

let familiasEliminadas = [], stickyToolsObserver = null;
let reparto = [], modoListado = "personas", busqueda = "", numeroFamilia = "", filtroEstado = "";
let ultimoInforme = null, avisoExcel = "", edicionListado = true;
const ordenListado = { familias: { columna: "numero", direccion: 1 }, personas: { columna: "numero", direccion: 1 } };
const comparadorListado = new Intl.Collator("es", { numeric: true, sensitivity: "base" });
function encabezadosListado(columnas) {
  const orden = ordenListado[modoListado];
  return '<tr>' + columnas.map(([columna, texto]) => `<th aria-sort="${orden.columna === columna ? (orden.direccion === 1 ? 'ascending' : 'descending') : 'none'}"><button class="column-sort" data-action="sortColumn" data-column="${columna}" title="Ordenar por ${texto}">${texto} <span aria-hidden="true">${orden.columna === columna ? (orden.direccion === 1 ? '↑' : '↓') : '↕'}</span></button></th>`).join('') + '<th class="list-actions-column">Acciones</th>' + '</tr>';
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
let familias = [], vista = "listado", editando = null;
const dateDrafts = new Map();

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
    setSaveState(`Guardado en ${where}.`, "saved");
  } catch (error) {
    setSaveState("Error: no se guardaron los últimos cambios.", "error");
    throw error;
  }
}
function navegacion() {
  return `<nav class="app-sections" aria-label="Secciones">${[['listado', 'Listado'], ['reparto', 'Reparto'], ['resumen', 'Resumen'], ['importar', 'Cargar Excel']].map(([id, texto]) => `<button data-action="section" data-view="${id}" class="${vista === id ? 'primary' : 'secondary'}" aria-current="${vista === id ? 'page' : 'false'}">${texto}</button>`).join('')}</nav>`;
}
function render() {
  document.getElementById("app").dataset.view = vista;
  if (vista === 'formulario') renderFormulario();
  else if (vista === 'resumen') renderResumen();
  else if (vista === 'reparto') renderReparto();
  else if (vista === 'importar') renderImportar();
  else renderListado();
  renderExcelNotice();
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
function getPendingActions() {
  const today = todayISO();
  const actions = [];
  for (const family of familias) {
    const titular = family.personas.find(p => p.titular) ?? family.personas[0];
    const name = `${titular?.nombre ?? ''} ${titular?.apellidos ?? ''}`.trim();
    const vencida = family.personas.some(person => caducada(person.vigencia));
    const citaPasada = family.personas.find(person => person.proximaCita && person.proximaCita < today);
    if (vencida && !family.personas.some(person => person.proximaCita)) {
      actions.push({ family, name, message: 'Vigencia caducada: anota la próxima cita cuando esté concertada.' });
    }
    if (citaPasada) {
      actions.push({ family, name, message: `La cita del ${fmt(citaPasada.proximaCita)} ya pasó: revisa y actualiza la vigencia.` });
    }
  }
  return actions.sort((a, b) => a.family.numero - b.family.numero);
}
function renderPendingActions() {
  const details = app.querySelector('#pendingActions');
  if (!details) return;
  const actions = getPendingActions();
  const summary = details.querySelector('summary');
  summary.innerHTML = `Acciones pendientes <span class="pending-count">${actions.length}</span>`;
  const list = details.querySelector('[data-pending-list]');
  list.innerHTML = actions.length ? `<ul>${actions.map(item => `<li><span><strong>Familia ${item.family.numero}${item.name ? ` · ${esc(item.name)}` : ''}:</strong> ${esc(item.message)}</span><button type="button" class="secondary pending-family-link" data-pending-family="${esc(item.family.id)}">Ver familia</button></li>`).join('')}</ul>` : '<p>No hay acciones pendientes.</p>';
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
const listDrafts = new Map();
let listSaving = Promise.resolve(), altaListado = null, guardandoAlta = false;
const listLabels = { nombre: 'Nombre', apellidos: 'Apellidos', documento: 'Documento', nacimiento: 'Nacimiento', derivacion: 'Derivación', vigencia: 'Vigencia', proximaCita: 'Próxima cita' };
const listDates = new Set(['nacimiento', 'derivacion', 'vigencia', 'proximaCita']);
function listKey(input) { return `${input.dataset.familyId}:${input.dataset.personId}:${input.dataset.listField}`; }
function listCell(f, p, campo) {
  const esAlta = altaListado?.persona.id === p.id;
  const valor = esAlta && listDates.has(campo) ? altaListado.fechas[campo] : listDates.has(campo) ? displayDate(p[campo]) : p[campo] ?? '';
  const compartida = esAlta && altaListado.familiaId && ['derivacion', 'vigencia'].includes(campo);
  return `<td class="editable-cell ${campo === 'vigencia' && caducada(p[campo]) ? 'cell-expired' : campo === 'proximaCita' && p[campo] && p[campo] < todayISO() ? 'cell-expired' : ''}"><span class="cell-print">${esc(valor || '—')}</span>${campo === 'nombre' && p.titular ? '<span class="titular-label">Titular</span>' : ''}<input type="text" value="${esc(valor)}" ${esAlta ? 'data-inline-field' : 'data-list-field'}="${campo}" ${compartida || (altaListado && !esAlta) ? 'readonly aria-readonly="true"' : ''} data-family-id="${esc(f.id)}" data-person-id="${esc(p.id)}" aria-label="${listLabels[campo]}, familia ${f.numero}, ${esc(p.nombre || 'persona')}" ${listDates.has(campo) ? 'placeholder="dd/mm/aaaa" inputmode="numeric"' : ''}></td>`;
}
function listNotice(message) {
  const notice = document.getElementById('listEditNotice');
  if (notice) {
    notice.hidden = !message;
    notice.textContent = message;
    if (message && listDrafts.size) {
      const button = document.createElement('button');
      button.className = 'secondary';
      button.dataset.action = 'discardListChanges';
      button.textContent = 'Recuperar datos anteriores';
      notice.append(' ', button);
    }
  }
}
async function guardarCelda(input) {
  if (!listDrafts.has(listKey(input))) return;
  const f = familias.find(f => f.id === input.dataset.familyId);
  const campo = input.dataset.listField;
  let guardando = false;
  try {
    let valor = input.value.trim();
    if (listDates.has(campo) && valor) {
      valor = parseTypedDate(valor);
      if (!valor) throw new Error('Escribe una fecha válida como 15/06/1967.');
    }
    const copia = editarPersona(f, input.dataset.personId, campo, valor);
    const next = familias.map(family => family.id === copia.id ? copia : family);
    input.disabled = true;
    guardando = true;
    setSaveState('Guardando el dato…', 'saving');
    await saveDB(next);
    familias = next;
    listDrafts.delete(listKey(input));
    input.value = listDates.has(campo) ? displayDate(valor) : valor;
    input.closest('td').querySelector('.cell-print').textContent = input.value || '—';
    // Actualizar las fechas comunes sin reconstruir la tabla ni mover el foco.
    if (campo === 'derivacion' || campo === 'vigencia') {
      app.querySelectorAll('[data-list-field]').forEach(other => {
        if (other.dataset.familyId === copia.id && other.dataset.listField === campo && !listDrafts.has(listKey(other))) {
          other.value = displayDate(valor);
          other.previousElementSibling.textContent = other.value || '—';
        }
      });
    }
    if (campo === 'nacimiento') {
      const ageCell = input.closest('td').nextElementSibling;
      const calculada = edad(valor);
      ageCell.textContent = calculada === '' ? '—' : calculada;
    }
    app.querySelectorAll('[data-row-family]').forEach(row => {
      if (row.dataset.rowFamily !== copia.id) return;
      const [cl, tx] = estado(copia);
      const badge = row.querySelector('.badge');
      if (badge) { badge.className = `badge ${cl}`; badge.textContent = tx; }
      row.querySelectorAll('[data-list-field]').forEach(field => {
        const person = copia.personas.find(p => p.id === field.dataset.personId);
        const value = person?.[field.dataset.listField];
        field.closest('td').classList.toggle('cell-expired', Boolean(field.dataset.listField === 'vigencia' ? caducada(value) : field.dataset.listField === 'proximaCita' && value && value < todayISO()));
      });
    });
    app.querySelector('[data-action="toggleExpired"] strong').textContent = familias.filter(f => f.personas.some(p => caducada(p.vigencia))).length;
    listNotice(listDrafts.size ? 'Hay otras casillas pendientes de corregir o guardar.' : '');
    setSaveState(listDrafts.size || altaListado ? 'Hay datos pendientes en el listado.' : 'Dato guardado en este ordenador.', listDrafts.size || altaListado ? 'pending' : 'saved');
    renderPendingActions();
    renderDuplicateAlert();
  } catch (error) {
    input.setAttribute('aria-invalid', 'true');
    input.setCustomValidity(error.message);
    listNotice(`${listLabels[campo]}: ${error.message} Corrige la casilla o pulsa Escape para recuperar el dato anterior.`);
    setSaveState('El dato de la casilla no se ha guardado.', guardando ? 'error' : 'pending');
  } finally { input.disabled = false; }
}
function recuperarCelda(input) {
  const person = familias.find(f => f.id === input.dataset.familyId)?.personas.find(p => p.id === input.dataset.personId);
  const campo = input.dataset.listField;
  input.value = listDates.has(campo) ? displayDate(person[campo]) : person[campo] ?? '';
  listDrafts.delete(listKey(input));
  input.removeAttribute('aria-invalid');
  input.setCustomValidity('');
  listNotice(listDrafts.size ? 'Hay otras casillas pendientes de corregir o guardar.' : '');
  setSaveState(listDrafts.size ? 'Hay datos pendientes en el listado.' : 'Dato anterior recuperado.', listDrafts.size ? 'pending' : 'saved');
}
async function listoParaSalirListado() {
  await listSaving;
  if (altaListado) {
    listNotice('Hay una fila nueva pendiente. Completa sus datos y pulsa «Guardar fila», o «Cancelar» para descartarla.');
    app.querySelector('[data-inline-field]:not([readonly])')?.focus();
    return false;
  }
  // También guardar el campo con foco si la acción llega desde el teclado.
  for (const input of listDrafts.values()) await guardarCelda(input);
  if (!listDrafts.size) return true;
  const input = listDrafts.values().next().value;
  input.focus();
  input.reportValidity();
  return false;
}

function sincronizarEncabezadoTabla() {
  const tools = app.querySelector('.list-controls');
  const table = document.getElementById('beneficiaryTable');
  if (!tools || !table || typeof ResizeObserver === 'undefined') return;
  stickyToolsObserver?.disconnect();
  const update = () => {
    const height = tools.getBoundingClientRect().height;
    table.style.setProperty('--sticky-tools-height', `${height}px`);
  };
  stickyToolsObserver = new ResizeObserver(update);
  stickyToolsObserver.observe(tools);
  update();
}

function renderImportar() {
  app.innerHTML = navegacion() + `<section class="card import-page"><h2>Cargar listado desde Excel</h2><p>Selecciona un Excel de la plantilla oficial para sustituir las familias guardadas en este ordenador.</p><div class="notice">Comprueba que sea la versión más reciente. La importación sustituye el listado actual. El reparto no se importa y el archivo original no se modifica.</div><div class="actions"><button class="primary" data-action="importExcel">${icon("excel")} Seleccionar archivo Excel</button><input id="importExcel" class="hidden" type="file" accept=".xlsx" data-import-excel><button class="secondary" data-action="section" data-view="listado">Volver al listado</button></div><details class="backup-help"><summary>Detalles sobre el Excel y las copias</summary><div class="notice">El Excel generado contiene las hojas Listado, Reparto y Resumen. La plantilla admite hasta 995 beneficiarios; Reparto y el resumen por tamaño contemplan familias de 1 a 10 miembros.</div></details>${informeImportacion()}</section>`;
}

function renderListado() {
  app.innerHTML = `<section class="card list-print-card" aria-label="Listado de beneficiarios"><div class="table-wrap" id="beneficiaryTable" tabindex="0" aria-label="Tabla de beneficiarios">
  <div class="list-controls" role="region" aria-label="Herramientas del listado">
    ${navegacion()}
    <div class="list-workspace-heading"><div><h2>Beneficiarios</h2><p class="list-intro">Familias agrupadas · edición directa en la tabla</p></div><div class="list-workspace-actions"><button class="secondary" data-action="exportExcel">${icon("excel")} Generar Excel</button><button class="secondary" data-action="printListado">Imprimir</button><button class="secondary" data-action="sortMembers" aria-pressed="${ordenListado.personas.columna === 'miembros'}">Miembros ↕</button></div></div>
    <div class="summary list-summary"><div class="stat"><strong>${familias.length}</strong>Familias</div><div class="stat"><strong>${familias.reduce((n, f) => n + f.personas.length, 0)}</strong>Beneficiarios</div><button type="button" class="stat stat-filter" data-action="toggleExpired" aria-pressed="${filtroEstado === 'overdue'}" title="Filtrar familias con vigencias caducadas"><strong>${familias.filter(f => f.personas.some(p => caducada(p.vigencia))).length}</strong><span>Caducadas</span><small data-filter-hint>${filtroEstado === 'overdue' ? 'Quitar filtro' : 'Filtrar familias'}</small></button><div class="stat"><strong>${familias.filter(f => f.personas.some(p => p.proximaCita)).length}</strong>Con próxima cita</div></div>
    <div class="toolbar list-filters"><label class="state-filter">Estado de la familia<select data-state-filter aria-label="Filtrar por estado de la familia">${[['', 'Todos'], ['ok', 'Correcta'], ['warn', 'Próxima'], ['expired', 'Caducada'], ['overdue', 'Todas las caducadas'], ['appointment', 'Cita pendiente']].map(([value, label]) => `<option value="${value}" ${filtroEstado === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label class="family-search" for="familyNumber">N.º de familia<input id="familyNumber" value="${esc(numeroFamilia)}" inputmode="numeric" placeholder="Todos" data-family-search></label><label class="text-search" for="search">Nombre o documento<input value="${esc(busqueda)}" id="search" class="search" placeholder="Buscar en el listado" data-search></label><button class="primary list-add-family" data-action="newFamily" title="Se asignará el primer número libre: ${numeroLibre([...familias, ...familiasEliminadas.map(item => ({ numero: item.familia.numero }))])}">${icon("add")} Añadir familia</button>${familiasEliminadas.length ? `<button class="secondary list-undo-family" data-action="undoDeleteFamily" title="Deshacer el último borrado en la familia ${familiasEliminadas.at(-1).familia.numero}">${icon("restore")} Deshacer borrado</button>` : ''}<button class="secondary table-nav-button" data-action="tableStart" title="Ir al inicio de la tabla">↑ Inicio</button><button class="secondary table-nav-button" data-action="tableEnd" title="Ir al final de la tabla">↓ Final</button></div>
    <details class="pending-actions" id="pendingActions"><summary>Acciones pendientes <span class="pending-count">0</span></summary><div data-pending-list></div></details>
    <p class="filter-help">La búsqueda conserva juntos a los miembros de cada familia.</p><p class="list-edit-help">Los cambios se guardan al salir de la casilla; derivación y vigencia son comunes a la familia.</p><p id="listEditNotice" class="notice" role="status" hidden></p>
    <details class="status-legend"><summary>Significado de los estados</summary><ul><li><span class="badge ok">Correcta</span><span>Vigencias al día, sin vencer en 60 días.</span></li><li><span class="badge warn">Próxima</span><span>Alguna vigencia vence en los próximos 60 días.</span></li><li><span class="badge expired">Caducada</span><span>Hay una vigencia vencida.</span></li><li><span class="badge appointment">Cita pendiente</span><span>Hay una vigencia vencida con cita anotada.</span></li></ul></details>
  </div>
  <table><thead id="listHead"><tr><th>N.º</th><th>Nombre</th><th>Apellidos</th><th>Documento</th><th>Nacimiento</th><th>Edad</th><th>Derivación</th><th>Vigencia</th><th>Próxima cita</th><th>Estado</th><th>Acciones</th></tr></thead><tbody id="rows"></tbody></table>
  </div><p id="counter" class="list-counter"></p></section>`;
  filterTable();
  renderPendingActions();
  renderExcelNotice();
  sincronizarEncabezadoTabla();
}

function coincideEstado(f) {
  return !filtroEstado || (filtroEstado === 'overdue' ? f.personas.some(p => caducada(p.vigencia)) : estado(f)[0] === filtroEstado);
}
function filterTable() {
  const memberSort = app.querySelector('[data-action="sortMembers"]');
  if (memberSort) {
    const orden = ordenListado.personas;
    memberSort.setAttribute('aria-pressed', String(orden.columna === 'miembros'));
    memberSort.textContent = orden.columna === 'miembros' ? (orden.direccion === 1 ? 'Miembros ↑' : 'Miembros ↓') : 'Miembros ↕';
    memberSort.title = orden.columna === 'miembros' && orden.direccion === 1 ? 'Ordenar de más a menos miembros' : 'Ordenar de menos a más miembros';
  }
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
    const visibles = familias.map(f => altaListado?.familiaId === f.id ? { ...f, personas: [...f.personas, altaListado.persona] } : f);
    if (altaListado && !altaListado.familiaId) visibles.push({ id: altaListado.id, numero: altaListado.numero, personas: [altaListado.persona] });
    const grupos = ordenarListado(visibles.filter(f => (altaListado && (f.id === altaListado.familiaId || f.id === altaListado.id)) || (coincideEstado(f) && coincideNumeroFamilia(f.numero, numeroFamilia) && (!q || f.personas.some(p => (p.nombre + ' ' + p.apellidos + ' ' + p.documento).toLowerCase().includes(q))))), (f, col) => {
      const titular = f.personas.find(p => p.titular) ?? f.personas[0];
      if (col === 'numero') return f.numero;
      if (col === 'miembros') return f.personas.length;
      if (col === 'edad') return edad(titular?.nacimiento);
      if (col === 'estado') return estado(f)[1];
      return titular?.[col];
    });
    const list = grupos.flatMap((f, grupo) => [...f.personas].sort((a, b) => Number(Boolean(b.titular)) - Number(Boolean(a.titular))).map(p => ({ f, p, grupo })));
    document.getElementById('listHead').innerHTML = encabezadosListado([['numero', 'Familia'], ['nombre', 'Nombre'], ['apellidos', 'Apellidos'], ['documento', 'Documento'], ['nacimiento', 'Nacimiento'], ['edad', 'Edad'], ['derivacion', 'Derivación'], ['vigencia', 'Vigencia'], ['proximaCita', 'Próxima cita'], ['estado', 'Estado']]);
    document.getElementById('rows').innerHTML = list.map(({ f, p, grupo }, index) => {
      const primero = index === 0 || list[index - 1].f.id !== f.id;
      const ultimo = index === list.length - 1 || list[index + 1].f.id !== f.id;
      const esAlta = altaListado?.persona.id === p.id;
      const [cl, tx] = esAlta ? ['draft', 'Sin guardar'] : estado(f);
      const match = q && (p.nombre + ' ' + p.apellidos + ' ' + p.documento).toLowerCase().includes(q);
      return `<tr data-row-family="${esc(f.id)}" class="family-group ${grupo % 2 ? 'group-tinted' : ''} ${primero ? 'family-start' : ''} ${ultimo ? 'family-end' : ''} ${p.titular ? 'titular-row' : ''} ${esAlta ? 'inline-draft-row' : ''} ${match ? 'search-match' : ''}">${primero ? `<td class="family-group-number ${f.personas.length === 1 ? 'family-single' : ''}" rowspan="${f.personas.length}">${!altaListado ? `<button class="family-delete-cross" data-action="deleteFamily" data-id="${esc(f.id)}" title="Borrar familia ${f.numero}" aria-label="Borrar familia ${f.numero}">×</button>` : ''}<small>Familia</small><span class="family-number">${f.numero}</span><small>${f.personas.length} ${f.personas.length === 1 ? 'miembro' : 'miembros'}</small></td>` : ''}${listCell(f, p, 'nombre')}${listCell(f, p, 'apellidos')}${listCell(f, p, 'documento')}${listCell(f, p, 'nacimiento')}<td class="age-cell">${edad(p.nacimiento) === '' ? '—' : edad(p.nacimiento)}</td>${listCell(f, p, 'derivacion')}${listCell(f, p, 'vigencia')}${listCell(f, p, 'proximaCita')}<td><span class="badge ${cl}">${tx}</span></td><td class="list-actions-column">${esAlta ? `<button class="primary" data-action="saveInlineRow">Guardar fila</button><button class="secondary" data-action="cancelInlineRow">Cancelar</button>` : ''}${!esAlta && !p.titular ? `<button class="danger" data-action="deleteMember" data-id="${esc(f.id)}" data-person-id="${esc(p.id)}" aria-label="Borrar miembro de la familia ${f.numero}" title="Borrar esta persona">${icon("trash")}</button>` : ''}${!esAlta && !altaListado && (index === list.length - 1 || list[index + 1].f.id !== f.id) ? `<button class="secondary" data-action="addFamilyPerson" data-id="${esc(f.id)}">${icon('add')} Miembro</button>` : ''}</td></tr>`;
    }).join('') || '<tr><td colspan="11" class="empty">No se encontraron familias. Prueba con otros filtros.</td></tr>';
    document.getElementById('counter').textContent = `Mostrando ${grupos.length} de ${familias.length} familias · ${list.filter(({ p }) => p.id !== altaListado?.persona.id).length} de ${all.length} personas${altaListado ? ' · 1 fila sin guardar' : ''}`;
    return;
  }

}
function enfocarAlta() {
  requestAnimationFrame(() => {
    const input = app.querySelector('[data-inline-field="nombre"]');
    input?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    input?.focus({ preventScroll: true });
  });
}
function iniciarAlta(familiaId = null) {
  const f = familiaId ? familias.find(f => f.id === familiaId) : familia(numeroLibre([...familias, ...familiasEliminadas.map(item => ({ numero: item.familia.numero }))]));
  if (!f) return;
  const nueva = familiaId ? persona() : f.personas[0];
  if (familiaId) {
    const titular = f.personas.find(p => p.titular) ?? f.personas[0];
    nueva.derivacion = titular.derivacion;
    nueva.vigencia = titular.vigencia;
  }
  if (!familiaId) { busqueda = ''; numeroFamilia = ''; filtroEstado = ''; }
  altaListado = { id: f.id, numero: f.numero, familiaId, persona: nueva, fechas: Object.fromEntries([...listDates].map(campo => [campo, displayDate(nueva[campo])])) };
  modoListado = 'personas';
  edicionListado = true;
  vista = 'listado';
  setSaveState('Fila nueva pendiente de completar. Pulsa Guardar fila al terminar.', 'pending');
  renderListado();
  listNotice(nueva.titular ? 'Nueva familia: completa nombre, apellidos y documento del titular y pulsa «Guardar fila».' : 'Nuevo miembro: completa nombre y apellidos. Para un menor, basta la fecha de nacimiento. Pulsa «Guardar fila» al terminar.');
  enfocarAlta();
}
function newFamily() { iniciarAlta(); }
async function guardarAltaListado() {
  if (!altaListado || guardandoAlta) return;
  guardandoAlta = true;
  app.querySelectorAll('[data-action="saveInlineRow"], [data-action="cancelInlineRow"]').forEach(button => button.disabled = true);
  let persistiendo = false;
  try {
    await listSaving;
    const alta = structuredClone(altaListado);
    for (const campo of listDates) {
      const texto = alta.fechas[campo].trim();
      const fecha = texto ? parseTypedDate(texto) : '';
      if (texto && !fecha) {
        const error = new Error(`${listLabels[campo]}: escribe una fecha válida como 15/06/1967.`);
        error.campos = [campo];
        throw error;
      }
      alta.persona[campo] = fecha;
    }
    const next = incorporarAlta(familias, alta, new Date(), familiasEliminadas.map(item => item.familia.numero));
    persistiendo = true;
    setSaveState('Guardando la nueva fila…', 'saving');
    await saveDB(next);
    familias = next;
    const personaId = alta.persona.id;
    altaListado = null;
    setSaveState('Fila guardada.', 'saved');
    render();
    requestAnimationFrame(() => {
      const input = [...app.querySelectorAll('[data-list-field="nombre"]')].find(field => field.dataset.personId === personaId);
      input?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      input?.focus({ preventScroll: true });
    });
  } catch (error) {
    listNotice(`${error.message} La fila sigue aquí para que puedas completarla.`);
    setSaveState(persistiendo ? 'No se pudo guardar la fila. Reintenta el guardado.' : 'Completa los datos de la fila nueva.', persistiendo ? 'error' : 'pending');
    for (const campo of error.campos ?? []) app.querySelector(`[data-inline-field="${campo}"]`)?.setAttribute('aria-invalid', 'true');
    app.querySelector('[data-inline-field][aria-invalid="true"]')?.focus();
  } finally {
    guardandoAlta = false;
    app.querySelectorAll('[data-action="saveInlineRow"], [data-action="cancelInlineRow"]').forEach(button => button.disabled = false);
  }
}
function cancelarAltaListado() {
  if (guardandoAlta) return;
  altaListado = null;
  setSaveState('Fila nueva descartada.', 'saved');
  render();
}
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
async function borrarFamiliaListado(id) {
  const eliminada = familias.find(f => f.id === id);
  if (!eliminada) return;
  if (!confirm(`¿Desea borrar la familia nº ${eliminada.numero} y sus ${eliminada.personas.length} ${eliminada.personas.length === 1 ? 'persona' : 'personas'}? Podrás recuperarla desde la barra del listado.`)) return;
  const table = document.getElementById('beneficiaryTable');
  const tableTop = table?.scrollTop ?? 0;
  const pageTop = window.scrollY;
  const next = familias.filter(f => f.id !== id);
  setSaveState('Guardando el listado…', 'saving');
  await saveDB(next);
  familias = next;
  familiasEliminadas.push({ tipo: 'familia', familia: structuredClone(eliminada) });
  setSaveState(`Familia ${eliminada.numero} borrada. Puedes recuperarla desde la barra del listado.`, 'saved');
  renderListado();
  requestAnimationFrame(() => {
    const nuevaTabla = document.getElementById('beneficiaryTable');
    if (nuevaTabla) nuevaTabla.scrollTop = Math.min(tableTop, nuevaTabla.scrollHeight - nuevaTabla.clientHeight);
    window.scrollTo({ top: pageTop, behavior: 'instant' });
  });
}
async function borrarMiembroListado(familiaId, personaId) {
  const f = familias.find(item => item.id === familiaId);
  const p = f?.personas.find(item => item.id === personaId);
  if (!p || p.titular) return;
  const nombre = `${p.nombre} ${p.apellidos}`.trim() || 'este miembro';
  if (!confirm(`¿Borrar a ${nombre} de la familia nº ${f.numero}? Se eliminará únicamente esta persona. Podrás recuperarla con «Deshacer borrado».`)) return;
  const tabla = document.getElementById('beneficiaryTable');
  const top = tabla?.scrollTop ?? 0, left = tabla?.scrollLeft ?? 0;
  const copia = eliminarMiembro(f, personaId);
  const next = familias.map(item => item.id === copia.id ? copia : item);
  setSaveState('Guardando el listado…', 'saving');
  await saveDB(next);
  familias = next;
  familiasEliminadas.push({ tipo: 'persona', familia: structuredClone(f), persona: structuredClone(p), indice: f.personas.findIndex(item => item.id === personaId) });
  // No ocultar la familia si el único resultado de la búsqueda era la persona borrada.
  if (busqueda && !copia.personas.some(item => `${item.nombre} ${item.apellidos} ${item.documento}`.toLowerCase().includes(busqueda))) busqueda = '';
  if (!coincideEstado(copia)) filtroEstado = '';
  setSaveState('Persona borrada. Puedes recuperarla con Deshacer borrado.', 'saved');
  render();
  const nuevaTabla = document.getElementById('beneficiaryTable');
  if (nuevaTabla) { nuevaTabla.scrollTop = top; nuevaTabla.scrollLeft = left; }
}
async function recuperarFamilia() {
  const ultima = familiasEliminadas.at(-1);
  if (!ultima) return;
  const next = ultima.tipo === 'persona'
    ? familias.map(f => f.id === ultima.familia.id ? restaurarMiembro(f, ultima.persona, ultima.indice) : f)
    : [...familias, structuredClone(ultima.familia)].sort((a, b) => a.numero - b.numero);
  setSaveState('Recuperando la familia…', 'saving');
  await saveDB(next);
  familias = next;
  familiasEliminadas.pop();
  setSaveState(ultima.tipo === 'persona' ? `Persona recuperada en la familia ${ultima.familia.numero}.` : `Familia ${ultima.familia.numero} recuperada.`, 'saved');
  renderListado();
  requestAnimationFrame(() => app.querySelector(`[data-row-family="${CSS.escape(ultima.familia.id)}"]`)?.scrollIntoView({ block: 'nearest' }));
}

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
    if (k === "nacimiento") {
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
    familiasEliminadas = [];
    ultimoInforme = { archivo: file.name, fecha: new Date().toISOString(), familias: imported.length, personas: count, issues, warnings: imported.warnings ?? [] };
    try { await saveImportReport(ultimoInforme); }
    catch (error) { console.error(error); ultimoInforme.sinPersistir = true; }
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
app.addEventListener('keydown', event => {
  const input = event.target;
  if (input.hasAttribute('data-inline-field')) {
    if (event.key === 'Enter') { event.preventDefault(); guardarAltaListado(); }
    return;
  }
  if (!input.hasAttribute('data-list-field')) return;
  if (event.key === 'Enter') { event.preventDefault(); input.blur(); }
  if (event.key === 'Escape' && !input.disabled) {
    recuperarCelda(input);
  }
});
document.getElementById("appVersion").textContent = appVersion;
const actions = {
  discardListChanges: async () => { await listSaving; for (const input of listDrafts.values()) recuperarCelda(input); },
  saveInlineRow: guardarAltaListado,
  cancelInlineRow: cancelarAltaListado,
  newFamily, back, addPerson,
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
  addFamilyPerson: target => iniciarAlta(target.dataset.id),
  deleteFamily: target => borrarFamiliaListado(target.dataset.id),
  deleteMember: target => borrarMiembroListado(target.dataset.id, target.dataset.personId),
  sortMembers: () => { const orden = ordenListado.personas; orden.direccion = orden.columna === 'miembros' ? -orden.direccion : 1; orden.columna = 'miembros'; filterTable(); },
  undoDeleteFamily: recuperarFamilia,
  tableStart: () => document.getElementById('beneficiaryTable')?.scrollTo({ top: 0, behavior: 'smooth' }),
  tableEnd: () => { const table = document.getElementById('beneficiaryTable'); table?.scrollTo({ top: table.scrollHeight, behavior: 'smooth' }); },
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
  try {
    if (guardandoAlta) return;
    if (!['discardListChanges', 'saveInlineRow', 'cancelInlineRow'].includes(target.dataset.action) && !await listoParaSalirListado()) return;
    await actions[target.dataset.action]?.(target);
  } catch (error) { reportError(error); }
});
document.getElementById("duplicateAlert").addEventListener("click", event => {
  const target = event.target.closest("[data-duplicate-family]");
  if (target) listoParaSalirListado().then(listo => { if (listo) {
    const family = familias.find(item => item.id === target.dataset.duplicateFamily);
    if (!family) return;
    vista = 'listado'; modoListado = 'personas';
    numeroFamilia = String(family.numero); busqueda = '';
    render();
    requestAnimationFrame(() => app.querySelector(`[data-row-family="${CSS.escape(family.id)}"]`)?.scrollIntoView({ block: 'center' }));
  } });
});
app.addEventListener('click', event => {
  const target = event.target.closest('[data-pending-family]');
  if (!target) return;
  listoParaSalirListado().then(listo => {
    if (!listo) return;
    const family = familias.find(item => item.id === target.dataset.pendingFamily);
    if (!family) return;
    vista = 'listado'; modoListado = 'personas';
    numeroFamilia = String(family.numero); busqueda = '';
    render();
    requestAnimationFrame(() => app.querySelector(`[data-row-family="${CSS.escape(family.id)}"]`)?.scrollIntoView({ block: 'center' }));
  });
});
document.getElementById('pageUp').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
document.getElementById('pageDown').addEventListener('click', () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }));
window.addEventListener('scroll', updatePageNav, { passive: true });
window.addEventListener('resize', updatePageNav);
window.addEventListener('beforeunload', event => {
  if (!altaListado && !listDrafts.size) return;
  event.preventDefault();
  event.returnValue = '';
});
window.addEventListener("beforeprint", () => {
  if (vista !== "listado") return;
  document.getElementById("listPrintTitle").textContent = `Listado de ${modoListado} · ${fmt(todayISO())}`;
  const estadoSeleccionado = app.querySelector("[data-state-filter] option:checked")?.textContent;
  document.getElementById("listPrintFilters").textContent = [numeroFamilia && `Familia: ${numeroFamilia}`, busqueda && `Búsqueda: ${busqueda}`, filtroEstado && `Estado: ${estadoSeleccionado}`].filter(Boolean).join(" · ");
});
app.addEventListener("input", async event => {
  const target = event.target;
  target.removeAttribute("aria-invalid");
  if (target.hasAttribute('data-inline-field') && altaListado) {
    const campo = target.dataset.inlineField;
    if (listDates.has(campo)) {
      altaListado.fechas[campo] = target.value;
      if (campo === 'nacimiento') {
        const fecha = parseTypedDate(target.value);
        altaListado.persona.nacimiento = fecha || '';
        const cell = target.closest('tr').querySelector('.age-cell');
        if (cell) cell.textContent = fecha ? edad(fecha) : '—';
      }
    } else altaListado.persona[campo] = target.value.trim();
    setSaveState('Fila nueva pendiente de guardar.', 'pending');
    return;
  }
  if (target.hasAttribute("data-list-field")) {
    listDrafts.set(listKey(target), target);
    target.setCustomValidity("");
    setSaveState("El dato se guardará al salir de la casilla.", "pending");
    return;
  }
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
  if (target.hasAttribute("data-search") || target.hasAttribute("data-family-search")) { if (!listDrafts.size) filterTable(); return; }
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
  if (target.hasAttribute("data-list-field")) {
    listSaving = listSaving.then(() => guardarCelda(target)).catch(reportError);
    await listSaving;
    return;
  }
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
  if (target.hasAttribute("data-state-filter") && !await listoParaSalirListado()) { target.value = filtroEstado; return; }
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
