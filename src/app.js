import "./styles.css";
import { loadImportReport, saveImportReport } from "./import-report.js";
import { erroresFamilia, datosPendientesFamilia } from "./validacion.mjs";
import { numeroLibre, numeroParaRestaurar } from "./numeracion.mjs";
import { incorporarAlta } from "./alta-listado.mjs";
import { editarPersona, eliminarMiembro, restaurarMiembro } from "./edicion-listado.mjs";
import { coincideNumeroFamilia } from "./busqueda.mjs";
import { loadDB, saveDB, resetDB } from "./database.js";
import { persona, familia, estado } from "./familias.js";
import { edad, caducada, esc, fmt } from "./utils.js";
import { exportExcel } from "./excel.js";
import { version as appVersion } from "../package.json";
import { readExcel } from "./excel-import.js";
import { icon } from "./icons.js";
import { isTauri } from "@tauri-apps/api/core";

import { prepararReparto, MAX_REPARTO_FILAS, resumen, envases, miembrosContabilizados, familiasParaExportar, tieneDatosBeneficiario } from "./reparto.mjs";
import { loadReparto, saveReparto, resetReparto } from "./reparto-storage.js";
import companyLogo from "../bancoteide_logo.png?url";
import { toPng } from "html-to-image";
import { save } from "@tauri-apps/plugin-dialog";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";

let importandoExcel = false;
let familiasEliminadas = [], stickyToolsObserver = null;
let reparto = [], modoListado = "personas", busqueda = "", numeroFamilia = "", filtroEstado = "";
let ultimoInforme = null, avisoExcel = "", edicionListado = true;
const ordenListado = { familias: { columna: "numero", direccion: 1 }, personas: { columna: "numero", direccion: 1 } };
const comparadorListado = new Intl.Collator("es", { numeric: true, sensitivity: "base" });
function encabezadosListado(columnas) {
  const orden = ordenListado[modoListado];
  return '<tr>' + columnas.map(([columna, texto]) => `<th aria-sort="${orden.columna === columna ? (orden.direccion === 1 ? 'ascending' : 'descending') : 'none'}"><button class="column-sort" data-action="sortColumn" data-column="${columna}" title="Ordenar por ${texto}">${texto} <span aria-hidden="true">${orden.columna === columna ? (orden.direccion === 1 ? '↑' : '↓') : '↕'}</span></button></th>`).join('') + '<th class="list-actions-column"><span class="visually-hidden">Acciones</span></th>' + '</tr>';
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
let posicionListado = null;
let familiasCoincidencia = null;
let zoomListado = 100;
function aplicarZoomListado(valor) {
  zoomListado = Math.min(150, Math.max(70, Number(valor) || 100));
  app.style.setProperty('--list-zoom', zoomListado / 100);
  const slider = app.querySelector('[data-list-zoom]');
  if (slider) slider.value = zoomListado;
  const output = app.querySelector('#listZoomValue');
  if (output) output.textContent = `${zoomListado}%`;
  app.querySelector('[data-zoom-step="-10"]')?.toggleAttribute('disabled', zoomListado === 70);
  app.querySelector('[data-zoom-step="10"]')?.toggleAttribute('disabled', zoomListado === 150);
}
const filtrosRapidos = [['incomplete', 'Datos pendientes'], ['overdue', 'Caducadas'], ['pastAppointment', 'Citas vencidas']];
function coincideFiltro(f, value) {
  if (value === 'incomplete') return datosPendientesFamilia(f).length > 0;
  if (value === 'overdue') return f.personas.some(p => caducada(p.vigencia));
  if (value === 'pastAppointment') { const t = f.personas.find(p => p.titular) ?? f.personas[0]; return Boolean(t?.proximaCita && t.proximaCita < todayISO()); }
  return !value || estadoListado(f)[0] === value;
}
function cuentaFiltro(value) {
  return familias.filter(f => coincideFiltro(f, value)).length;
}
function actualizarFiltrosRapidos() {
  app.querySelectorAll('[data-quick-filter]').forEach(button => {
    const value = button.dataset.quickFilter;
    const nombre = filtrosRapidos.find(([id]) => id === value)[1];
    const cantidad = cuentaFiltro(value);
    button.innerHTML = `${nombre} <strong>${cantidad}</strong>`;
    button.setAttribute('aria-pressed', String(filtroEstado === value));
    button.setAttribute('aria-label', `${nombre}: ${cantidad} familias${filtroEstado === value ? ', quitar filtro' : ''}`);
  });
}

function setSaveState(message, status = "saved") {
  const indicator = document.getElementById("saveState");
  if (indicator) {
    const texto = status === 'saved' ? 'Guardado' : status === 'saving' ? 'Guardando…' : status === 'error' ? 'No se pudo guardar' : /fecha|nacimiento/i.test(message) ? 'Corrige esta fecha' : /casilla|salir/i.test(message) ? 'Sal de la casilla para guardar' : 'Revisa los datos pendientes';
    indicator.innerHTML = `<span class="save-symbol">${icon("save")}</span><span>${texto}</span>`;
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
  document.getElementById("sectionNavigation").innerHTML = navegacion();
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
function getPendingActions(familiasRevisar = familias) {
  const today = todayISO();
  const actions = [];
  for (const family of familiasRevisar) {
    const titular = family.personas.find(p => p.titular) ?? family.personas[0];
    const name = `${titular?.nombre ?? ''} ${titular?.apellidos ?? ''}`.trim();
    for (const pendiente of datosPendientesFamilia(family)) {
      const etiqueta = pendiente.persona.titular ? 'Titular' : `${pendiente.persona.nombre || 'Miembro'} ${pendiente.persona.apellidos || ''}`.trim();
      actions.push({ tipo: 'datos', family, name, personId: pendiente.persona.id, campo: pendiente.campos[0], message: `${etiqueta}: completar o revisar ${pendiente.campos.map(campo => listLabels[campo]).join(', ')}.` });
    }
    const vencida = family.personas.some(person => caducada(person.vigencia));
    const citaPasada = titular?.proximaCita && titular.proximaCita < today ? titular.proximaCita : '';
    if (vencida && !titular?.proximaCita) {
      actions.push({ tipo: 'cita', family, name, message: 'Vigencia caducada: anota la próxima cita cuando esté concertada.' });
    }
    if (citaPasada) {
      actions.push({ tipo: 'vigencia', family, name, message: `La cita del ${fmt(citaPasada)} ya pasó: revisa y actualiza la vigencia.` });
    }
  }
  const prioridad = { vigencia: 0, cita: 1, datos: 2 };
  return actions.sort((a, b) => prioridad[a.tipo] - prioridad[b.tipo] || a.family.numero - b.family.numero);
}
function renderPendingActions() {
  const details = app.querySelector('#pendingActions');
  if (!details) return;
  const actions = getPendingActions();
  const summary = details.querySelector('summary');
  summary.innerHTML = `Ver detalles <span class="pending-count">${actions.length}</span>`;
  const list = details.querySelector('[data-pending-list]');
  const familiasId = [...new Set(actions.map(item => item.family.id))];
  const botonVer = familiasId.length ? `<button type="button" class="primary pending-show-families" data-pending-families="${esc(familiasId.join(','))}">Ver familias (${familiasId.length})</button>` : '';
  const grupos = [
    ['vigencia', 'Revisar vigencias'],
    ['cita', 'Anotar próximas citas'],
    ['datos', 'Completar datos'],
  ].map(([tipo, titulo]) => {
    const grupo = actions.filter(item => item.tipo === tipo);
    if (!grupo.length) return '';
    return `<section class="pending-group pending-${tipo}"><h3>${titulo} <span>${grupo.length}</span></h3><ul>${grupo.map(item => `<li><span><strong>Familia ${item.family.numero}${item.name ? ` · ${esc(item.name)}` : ''}:</strong> ${esc(item.message)}</span></li>`).join('')}</ul></section>`;
  }).join('');
  details.closest('.pending-workspace').querySelector('[data-pending-overview]').innerHTML = botonVer || '<span class="pending-clear">Sin tareas pendientes</span>';
  list.innerHTML = grupos || '<p>No hay acciones pendientes.</p>';
}
function avisarExportacionBloqueada(familiasRevisar = familias) {
  const acciones = getPendingActions(familiasRevisar);
  const duplicados = findDuplicateGroups();
  if (!acciones.length && !duplicados.length) return false;
  const partes = [];
  if (duplicados.length) partes.push(`${duplicados.length} incidencia${duplicados.length === 1 ? '' : 's'} de duplicados, que tienen prioridad`);
  if (acciones.length) partes.push(`${acciones.length} acción${acciones.length === 1 ? '' : 'es'} pendiente${acciones.length === 1 ? '' : 's'}`);
  avisoExcel = `No se puede generar el Excel hasta resolver ${partes.join(' y ')}.`;
  familiasCoincidencia = null;
  vista = 'listado'; modoListado = 'personas'; filtroEstado = '';
  busqueda = ''; numeroFamilia = '';
  render();
  const panel = app.querySelector('#pendingActions');
  if (panel) panel.open = true;
  setSaveState(avisoExcel, 'pending');
  requestAnimationFrame(() => panel?.scrollIntoView({ block: 'center' }));
  return true;
}
function normalizeDuplicateKey(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/[^\p{L}\p{N}]/gu, "");
}
function findDuplicateGroups() {
  const borradores = new Map();
  for (const input of listDrafts.values()) {
    if (!['nombre', 'apellidos', 'documento'].includes(input.dataset.listField)) continue;
    const datos = borradores.get(input.dataset.personId) ?? {};
    datos[input.dataset.listField] = input.value.trim();
    borradores.set(input.dataset.personId, datos);
  }
  const people = familias.flatMap(family => family.personas.map((guardada, index) => {
    const person = { ...guardada, ...borradores.get(guardada.id) };
    return {
    family,
    person,
    key: `${family.id}:${index}`,
    name: `${person.nombre} ${person.apellidos}`.trim(),
    };
  }));
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
  const desplegadas = alertBox.querySelector('details')?.open ?? false;
  const groups = findDuplicateGroups();
  actualizarMarcasDuplicadas(groups);
  alertBox.hidden = groups.length === 0;
  if (!groups.length) {
    alertBox.replaceChildren();
    return;
  }
  const count = new Set(groups.flatMap(group => group.people.map(item => item.person.id))).size;
  alertBox.innerHTML = `<strong>Revisa posibles duplicados: ${groups.length} coincidencia${groups.length === 1 ? "" : "s"} en ${count} registros.</strong><details ${desplegadas ? 'open' : ''}><summary>Ver coincidencias</summary><ul>${groups.map((group, index) => {
    const participantes = group.people.map(item => `Familia ${item.family.numero} · ${esc(item.name || "Persona sin nombre")}`).join(" y ");
    const numeros = group.people.map(item => item.family.numero).join(" y ");
    return `<li><span>${group.reasons.join(" y ")} duplicados: ${participantes}.</span> <button type="button" class="duplicate-family-link" data-duplicate-group="${index}">Filtrar familias ${numeros}</button></li>`;
  }).join("")}</ul></details>`;
}
function actualizarMarcasDuplicadas(groups = findDuplicateGroups()) {
  const marcas = new Map();
  for (const group of groups) {
    const campos = group.reasons.flatMap(reason => reason === 'Documento' ? ['documento'] : ['nombre', 'apellidos']);
    for (const item of group.people) {
      for (const campo of campos) {
        const otras = group.people.filter(other => other.person.id !== item.person.id).map(other => `familia ${other.family.numero}`).join(', ');
        marcas.set(`${item.person.id}:${campo}`, `Posible duplicado de ${group.reasons.join(' y ')}. Coincide con ${otras}. Revisa los datos antes de eliminar una persona.`);
      }
    }
  }
  app.querySelectorAll('[data-list-field]').forEach(input => {
    const cell = input.closest('td');
    cell.querySelector('.duplicate-field-warning')?.remove();
    input.removeAttribute('aria-describedby');
    const mensaje = marcas.get(`${input.dataset.personId}:${input.dataset.listField}`);
    cell.classList.toggle('cell-duplicate', Boolean(mensaje));
    if (!mensaje) return;
    const warning = document.createElement('span');
    warning.className = 'duplicate-field-warning';
    warning.id = `duplicate-${input.dataset.personId}-${input.dataset.listField}`;
    warning.textContent = '⚠';
    warning.title = mensaje;
    warning.setAttribute('aria-label', mensaje);
    input.setAttribute('aria-describedby', warning.id);
    cell.append(warning);
  });
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
  app.innerHTML = `<div class="card summary-actions"><div><h2>Resumen de beneficiarios</h2><p>Consulta y comparte una imagen de este resumen.</p></div><button class="primary" data-action="exportSummary">${icon("download")} Descargar imagen</button></div>
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
  app.innerHTML = `<section class="card reparto-page">
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
let listSaving = Promise.resolve(), guardandoAlta = false;
const listLabels = { nombre: 'Nombre', apellidos: 'Apellidos', documento: 'Documento', nacimiento: 'Nacimiento', derivacion: 'Derivación', vigencia: 'Vigencia', proximaCita: 'Próxima cita' };
const listDates = new Set(['nacimiento', 'derivacion', 'vigencia', 'proximaCita']);
function listKey(input) { return `${input.dataset.familyId}:${input.dataset.personId}:${input.dataset.listField}`; }
function validarFechaLista(input, avisar = true) {
  if (!listDates.has(input.dataset.listField)) return true;
  const valor = input.value.trim();
  let mensajeError = '';
  if (valor) {
    const fecha = parseTypedDate(valor);
    if (!fecha) mensajeError = 'Escribe una fecha válida como 15/06/1967.';
    else {
      const family = familias.find(item => item.id === input.dataset.familyId);
      try { editarPersona(family, input.dataset.personId, input.dataset.listField, fecha); }
      catch (error) { mensajeError = error.message; }
    }
  }
  const invalida = Boolean(mensajeError);
  const celda = input.closest('td');
  celda?.classList.toggle('cell-invalid', invalida);
  if (invalida) {
    input.setAttribute('aria-invalid', 'true');
    input.title = mensajeError;
    input.setCustomValidity(mensajeError);
    if (avisar) {
      listNotice(`${listLabels[input.dataset.listField]}: ${mensajeError}`);
      setSaveState('Corrige esta fecha.', 'pending');
    }
    return false;
  }
  input.removeAttribute('aria-invalid');
  input.title = '';
  input.setCustomValidity('');
  return true;
}
function diasVigencia(fecha) {
  const fin = fecha ? Date.parse(`${fecha}T00:00:00Z`) : NaN;
  const dias = Math.round((fin - Date.parse(`${todayISO()}T00:00:00Z`)) / 86400000);
  if (!Number.isFinite(dias)) return '<span class="validity-days" hidden></span>';
  const texto = dias < 0 ? `Hace ${Math.abs(dias)} ${dias === -1 ? 'día' : 'días'}` : dias === 0 ? 'Vence hoy' : `${dias} ${dias === 1 ? 'día' : 'días'}`;
  const titulo = dias < 0 ? `Caducada desde hace ${Math.abs(dias)} días` : dias === 0 ? 'La vigencia vence hoy' : `Quedan ${dias} días de vigencia`;
  const clase = dias < 0 ? 'expired' : dias <= 60 ? 'warn' : 'ok';
  return `<span class="validity-days ${clase}" title="${titulo}" aria-label="${titulo}">${texto}</span>`;
}
function listCell(f, p, campo, pendientes = []) {
  if (!p.titular && ['derivacion', 'vigencia', 'proximaCita'].includes(campo)) {
    return '<td class="shared-date-empty" aria-hidden="true"></td>';
  }
  const valor = listDates.has(campo) ? displayDate(p[campo]) : p[campo] ?? '';
  const pendiente = pendientes.includes(campo);
  return `<td class="editable-cell ${campo === 'vigencia' ? 'cell-validity' : ''} ${pendiente ? 'cell-missing' : ''} ${campo === 'vigencia' && caducada(p[campo]) ? 'cell-expired' : campo === 'proximaCita' && p[campo] && p[campo] < todayISO() ? 'cell-expired' : ''}"><span class="cell-print">${esc(valor || (campo === 'nombre' && p.menor ? 'MENOR' : '—'))}</span><input type="text" value="${esc(valor)}" data-list-field="${campo}" data-family-id="${esc(f.id)}" data-person-id="${esc(p.id)}" aria-label="${listLabels[campo]}, familia ${f.numero}, ${esc(p.nombre || 'persona')}${p.titular ? ', titular' : ''}${pendiente ? ', dato pendiente' : ''}" ${pendiente ? 'title="Dato pendiente de completar"' : ''} ${campo === 'nombre' && p.menor ? 'placeholder="MENOR"' : ''} ${listDates.has(campo) ? 'placeholder="dd/mm/aaaa" inputmode="numeric"' : ''}>${campo === 'vigencia' ? diasVigencia(p.vigencia) : ''}${campo === 'nacimiento' && !p.titular ? `<label class="list-minor-toggle"><input type="checkbox" data-list-minor data-family-id="${esc(f.id)}" data-person-id="${esc(p.id)}" ${p.menor ? 'checked' : ''} aria-label="Menor de edad, familia ${f.numero}">Menor</label>` : ''}</td>`;
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
      const row = input.closest('tr');
      const menor = copia.personas.find(p => p.id === input.dataset.personId)?.menor;
      const check = row.querySelector('[data-list-minor]');
      if (check) check.checked = Boolean(menor);
      const nombre = row.querySelector('[data-list-field="nombre"]');
      if (nombre) {
        nombre.placeholder = menor ? 'MENOR' : '';
        nombre.previousElementSibling.textContent = nombre.value || (menor ? 'MENOR' : '—');
      }
    }
    const pendientesDatos = datosPendientesFamilia(copia);
    app.querySelectorAll('[data-row-family]').forEach(row => {
      if (row.dataset.rowFamily !== copia.id) return;
      const rowPerson = copia.personas.find(person => person.id === row.dataset.rowPerson);
      const errorMiembro = pendientesDatos.some(item => item.persona.id === rowPerson?.id);
      const [cl, tx] = rowPerson?.titular ? estadoListado(copia) : errorMiembro ? ['incomplete', 'Datos pendientes'] : ['', ''];
      const statusCell = row.querySelector('[data-person-status]');
      if (statusCell) statusCell.innerHTML = tx ? `<span class="badge ${cl}">${tx}</span>` : '';
      row.querySelectorAll('[data-list-field]').forEach(field => {
        const person = copia.personas.find(p => p.id === field.dataset.personId);
        const value = person?.[field.dataset.listField];
        if (field.dataset.listField === 'vigencia') field.closest('td').querySelector('.validity-days').outerHTML = diasVigencia(value);
        const pendiente = pendientesDatos.some(item => item.persona.id === person?.id && item.campos.includes(field.dataset.listField));
        field.closest('td').classList.toggle('cell-missing', pendiente);
        field.setAttribute('aria-label', `${listLabels[field.dataset.listField]}, familia ${copia.numero}, ${person?.nombre || 'persona'}${pendiente ? ', dato pendiente' : ''}`);
        if (pendiente) field.title = 'Dato pendiente de completar';
        else field.removeAttribute('title');
        field.closest('td').classList.toggle('cell-expired', Boolean(field.dataset.listField === 'vigencia' ? caducada(value) : field.dataset.listField === 'proximaCita' && value && value < todayISO()));
      });
    });
    actualizarFiltrosRapidos();
    const recuento = resumen(familias);
    app.querySelector('[data-total-beneficiarios]').textContent = recuento.personas;
    app.querySelector('[data-total-familias]').textContent = recuento.familias;
    const contadorFamilia = app.querySelector(`[data-family-member-count="${CSS.escape(copia.id)}"]`);
    const miembros = miembrosContabilizados(copia);
    if (contadorFamilia) contadorFamilia.textContent = `${miembros} ${miembros === 1 ? 'miembro' : 'miembros'}`;
    listNotice(listDrafts.size ? 'Hay otras casillas pendientes de corregir o guardar.' : '');
    setSaveState(listDrafts.size ? 'Hay datos pendientes en el listado.' : 'Dato guardado en este ordenador.', listDrafts.size ? 'pending' : 'saved');
    renderPendingActions();
    renderDuplicateAlert();
  } catch (error) {
    input.setAttribute('aria-invalid', 'true');
    input.setCustomValidity(error.message);
    if (listDates.has(campo)) {
      input.closest('td')?.classList.add('cell-invalid');
      input.title = error.message;
    }
    listNotice(`${listLabels[campo]}: ${error.message} Corrige la casilla o pulsa Escape para recuperar el dato anterior.`);
    setSaveState(listDates.has(campo) ? 'Corrige esta fecha.' : 'Revisa el dato de esta casilla.', guardando ? 'error' : 'pending');
  } finally { input.disabled = false; }
}
function recuperarCelda(input) {
  const person = familias.find(f => f.id === input.dataset.familyId)?.personas.find(p => p.id === input.dataset.personId);
  const campo = input.dataset.listField;
  input.value = listDates.has(campo) ? displayDate(person[campo]) : person[campo] ?? '';
  listDrafts.delete(listKey(input));
  input.removeAttribute('aria-invalid');
  input.setCustomValidity('');
  input.closest('td')?.classList.remove('cell-invalid');
  input.removeAttribute('title');
  listNotice(listDrafts.size ? 'Hay otras casillas pendientes de corregir o guardar.' : '');
  setSaveState(listDrafts.size ? 'Hay datos pendientes en el listado.' : 'Dato anterior recuperado.', listDrafts.size ? 'pending' : 'saved');
  renderDuplicateAlert();
}
async function listoParaSalirListado() {
  await listSaving;
  // También guardar el campo con foco si la acción llega desde el teclado.
  for (const input of listDrafts.values()) await guardarCelda(input);
  if (!listDrafts.size) {
    return true;
  }
  const input = listDrafts.values().next().value;
  input.focus();
  input.reportValidity();
  return false;
}

async function limpiarFilasVacias() {
  const next = familias.map(f => ({ ...f, personas: f.personas.filter(p => p.titular || tieneDatosBeneficiario(p) || String(p.proximaCita ?? '').trim()) }))
    .filter(f => f.personas.some(p => tieneDatosBeneficiario(p) || ['nombre', 'apellidos', 'documento', 'nacimiento', 'derivacion', 'vigencia', 'proximaCita'].some(campo => String(p[campo] ?? '').trim())));
  const eliminadas = familias.reduce((n, f) => n + f.personas.length, 0) - next.reduce((n, f) => n + f.personas.length, 0);
  if (!eliminadas) return false;
  setSaveState('Retirando filas vacías…', 'saving');
  await saveDB(next);
  familias = next;
  setSaveState('Filas vacías eliminadas. Listado guardado.', 'saved');
  return true;
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
  app.innerHTML = `<section class="card import-page"><h2>Cargar listado desde Excel</h2><p>Selecciona un Excel de la plantilla oficial para sustituir las familias guardadas en este ordenador.</p><div class="notice">Comprueba que sea la versión más reciente. La importación sustituye el listado actual. El reparto no se importa y el archivo original no se modifica.</div><div class="excel-drop-zone" data-excel-drop><span class="drop-icon">${icon("excel")}</span><strong>Arrastra aquí tu archivo Excel</strong><span>Un archivo .xlsx de la plantilla oficial, o selecciónalo con el botón.</span></div><div class="actions"><button class="primary" data-action="importExcel">${icon("excel")} Seleccionar archivo Excel</button><input id="importExcel" class="hidden" type="file" accept=".xlsx" data-import-excel><button class="secondary" data-action="section" data-view="listado">Volver al listado</button></div><details class="backup-help"><summary>Detalles sobre el Excel y las copias</summary><div class="notice">El Excel generado contiene las hojas Listado, Reparto y Resumen. La plantilla admite hasta 995 beneficiarios; Reparto y el resumen por tamaño contemplan familias de 1 a 10 miembros.</div></details>${informeImportacion()}${isTauri() ? `<section class="owner-tools"><h3>Herramientas del propietario</h3><p>Borra de este ordenador las familias, el reparto, el historial de importación y las copias de recuperación.</p><button type="button" class="danger" data-action="resetAllData">Eliminar todos los datos de este ordenador</button></section>` : ''}</section>`;
}

function renderListado() {
  app.innerHTML = `<section class="card list-print-card" aria-label="Listado de beneficiarios"><div class="table-wrap" id="beneficiaryTable" tabindex="0" aria-label="Tabla de beneficiarios">
  <div class="list-controls" role="region" aria-label="Herramientas del listado">
    <div class="list-workspace-heading"><div><h2>Beneficiarios</h2><p class="list-intro">Familias agrupadas · edición directa en la tabla</p></div><div class="list-workspace-actions"><button class="secondary" data-action="exportExcel">${icon("excel")} Generar Excel</button><button class="secondary" data-action="printListado">Imprimir</button><button class="secondary" data-action="sortMembers" aria-pressed="${ordenListado.personas.columna === 'miembros'}">Miembros ↕</button></div></div>
    <div class="summary list-summary"><div class="stat"><strong data-total-familias>${resumen(familias).familias}</strong>Familias</div><div class="stat"><strong data-total-beneficiarios>${resumen(familias).personas}</strong>Beneficiarios</div><div class="stat"><strong>${familias.filter(f => (f.personas.find(p => p.titular) ?? f.personas[0])?.proximaCita).length}</strong>Con próxima cita</div></div>
    <div class="toolbar list-filters"><label class="family-search" for="familyNumber">N.º de familia<input id="familyNumber" value="${esc(numeroFamilia)}" inputmode="numeric" placeholder="Todos" data-family-search></label><label class="text-search" for="search">Nombre o documento<input value="${esc(busqueda)}" id="search" class="search" placeholder="Buscar en el listado" data-search></label><button class="primary list-add-family" data-action="newFamily" title="Se asignará el primer número libre: ${numeroLibre(familias)}">${icon("add")} Añadir familia</button>${familiasEliminadas.length ? `<button class="secondary list-undo-family" data-action="undoDeleteFamily" title="Deshacer el último borrado en la familia ${familiasEliminadas.at(-1).familia.numero}">${icon("restore")} Deshacer borrado</button>` : ''}<button class="secondary table-nav-button" data-action="tableStart" title="Ir al inicio de la tabla">↑ Inicio</button><button class="secondary table-nav-button" data-action="tableEnd" title="Ir al final de la tabla">↓ Final</button></div>
    <section class="pending-workspace" aria-label="Pendientes"><div class="pending-toolbar"><strong class="pending-title">Pendientes</strong><div class="quick-filters" role="group" aria-label="Filtrar familias pendientes">${filtrosRapidos.map(([id]) => `<button type="button" class="secondary" data-action="quickFilter" data-quick-filter="${id}"></button>`).join('')}</div><div data-pending-overview></div></div><details class="pending-actions" id="pendingActions"><summary>Ver detalles <span class="pending-count">0</span></summary><div data-pending-list></div></details></section>
    <div id="activeListFilters" class="active-list-filters" role="status" hidden></div>
    <p class="filter-help">La búsqueda conserva juntos a los miembros de cada familia.</p><p class="list-edit-help">Los cambios se guardan al salir de la casilla; derivación y vigencia son comunes a la familia.</p><p id="listEditNotice" class="notice" role="status" hidden></p>
    <details class="status-legend"><summary>Significado de los estados</summary><ul><li><span class="badge incomplete">Datos pendientes</span><span>Faltan datos importantes. La fila ya está guardada.</span></li><li><span class="badge ok">Correcta</span><span>Vigencias al día, sin vencer en 60 días.</span></li><li><span class="badge warn">Próxima</span><span>Alguna vigencia vence en los próximos 60 días.</span></li><li><span class="badge expired">Caducada</span><span>Hay una vigencia vencida.</span></li><li><span class="badge appointment">Cita pendiente</span><span>Hay una vigencia vencida con cita anotada.</span></li></ul></details>
  </div>
  <table><thead id="listHead"><tr><th>N.º</th><th>Nombre</th><th>Apellidos</th><th>Documento</th><th>Nacimiento</th><th>Edad</th><th>Derivación</th><th>Vigencia</th><th>Próxima cita</th><th>Estado</th><th>Acciones</th></tr></thead><tbody id="rows"></tbody></table>
  </div><div class="list-bottom-bar"><p id="counter" class="list-counter"></p><div class="list-zoom-controls" role="group" aria-label="Zoom del listado"><button type="button" class="secondary" data-action="resetListZoom" title="Restablecer tamaño al 100 %" aria-label="Restablecer zoom al 100 %"><output id="listZoomValue">${zoomListado}%</output></button><button type="button" class="secondary" data-action="changeListZoom" data-zoom-step="-10" aria-label="Reducir zoom">−</button><input type="range" min="70" max="150" step="10" value="${zoomListado}" data-list-zoom aria-label="Zoom del listado" aria-describedby="listZoomValue"><button type="button" class="secondary" data-action="changeListZoom" data-zoom-step="10" aria-label="Aumentar zoom">+</button></div></div></section>`;
  aplicarZoomListado(zoomListado);
  filterTable();
  renderPendingActions();
  renderExcelNotice();
  sincronizarEncabezadoTabla();
  renderDuplicateAlert();
}

function estadoListado(f) {
  const actual = estado(f);
  return actual[0] === 'ok' && datosPendientesFamilia(f).length ? ['incomplete', 'Datos pendientes'] : actual;
}
function coincideEstado(f) {
  return coincideFiltro(f, filtroEstado);
}
function filterTable() {
  actualizarFiltrosRapidos();
  const memberSort = app.querySelector('[data-action="sortMembers"]');
  if (memberSort) {
    const orden = ordenListado.personas;
    memberSort.setAttribute('aria-pressed', String(orden.columna === 'miembros'));
    memberSort.textContent = orden.columna === 'miembros' ? (orden.direccion === 1 ? 'Miembros ↑' : 'Miembros ↓') : 'Miembros ↕';
    memberSort.title = orden.columna === 'miembros' && orden.direccion === 1 ? 'Ordenar de más a menos miembros' : 'Ordenar de menos a más miembros';
  }
  const q = (document.getElementById("search")?.value || "").toLowerCase().trim();
  busqueda = q;
  numeroFamilia = document.getElementById("familyNumber")?.value.trim() || "";
  const filtrosActivos = app.querySelector('#activeListFilters');
  const estadoElegido = filtrosRapidos.find(([id]) => id === filtroEstado)?.[1] ?? filtroEstado;
  const etiquetas = [familiasCoincidencia && 'Familias seleccionadas', numeroFamilia && `Familia n.º ${numeroFamilia}`, busqueda && `Búsqueda: ${busqueda}`, filtroEstado && `Estado: ${estadoElegido}`].filter(Boolean);
  app.querySelector('.family-search')?.classList.toggle('filter-active', Boolean(numeroFamilia));
  app.querySelector('.text-search')?.classList.toggle('filter-active', Boolean(busqueda));
  if (filtrosActivos) {
    filtrosActivos.hidden = etiquetas.length === 0;
    filtrosActivos.innerHTML = `<span><strong>Listado filtrado:</strong> ${etiquetas.map(esc).join(' · ')}</span><button type="button" class="primary show-all-families" data-action="clearListFilters" title="Quitar todos los filtros y búsquedas">Ver todas las familias</button>`;
  }

  if (modoListado === 'personas') {
    const all = familias.flatMap(f => f.personas.map(p => ({ f, p })));
    const grupos = ordenarListado(familias.filter(f => (!familiasCoincidencia || familiasCoincidencia.has(f.id)) && coincideEstado(f) && coincideNumeroFamilia(f.numero, numeroFamilia) && (!q || f.personas.some(p => (p.nombre + ' ' + p.apellidos + ' ' + p.documento).toLowerCase().includes(q)))), (f, col) => {
      const titular = f.personas.find(p => p.titular) ?? f.personas[0];
      if (col === 'numero') return f.numero;
      if (col === 'miembros') return miembrosContabilizados(f);
      if (col === 'edad') return edad(titular?.nacimiento);
      if (col === 'estado') return estadoListado(f)[1];
      return titular?.[col];
    });
    const list = grupos.flatMap((f, grupo) => [...f.personas].sort((a, b) => Number(Boolean(b.titular)) - Number(Boolean(a.titular))).map(p => ({ f, p, grupo })));
    document.getElementById('listHead').innerHTML = encabezadosListado([['numero', 'Familia'], ['nombre', 'Nombre'], ['apellidos', 'Apellidos'], ['documento', 'Documento'], ['nacimiento', 'Nacimiento'], ['edad', 'Edad'], ['derivacion', 'Derivación'], ['vigencia', 'Vigencia'], ['proximaCita', 'Próxima cita'], ['estado', 'Estado']]);
    document.getElementById('rows').innerHTML = list.map(({ f, p, grupo }, index) => {
      const primero = index === 0 || list[index - 1].f.id !== f.id;
      const ultimo = index === list.length - 1 || list[index + 1].f.id !== f.id;
      const pendientes = datosPendientesFamilia(f).find(item => item.persona.id === p.id)?.campos ?? [];
      const celda = campo => listCell(f, p, campo, pendientes);
      const errorMiembro = !p.titular && pendientes.length > 0;
      const [cl, tx] = p.titular ? estadoListado(f) : errorMiembro ? ['incomplete', 'Datos pendientes'] : ['', ''];
      const match = q && (p.nombre + ' ' + p.apellidos + ' ' + p.documento).toLowerCase().includes(q);
      return `<tr data-row-family="${esc(f.id)}" data-row-person="${esc(p.id)}" class="family-group ${grupo % 2 ? 'group-tinted' : ''} ${primero ? 'family-start' : ''} ${ultimo ? 'family-end' : ''} ${p.titular ? 'titular-row' : ''} ${match ? 'search-match' : ''}">${primero ? `<td class="family-group-number ${f.personas.length === 1 ? 'family-single' : ''}" rowspan="${f.personas.length}"><div class="family-cell-layout"><div class="family-cell-info"><small class="family-label">Familia</small><span class="family-number">${f.numero}</span><small data-family-member-count="${esc(f.id)}">${miembrosContabilizados(f)} ${miembrosContabilizados(f) === 1 ? 'miembro' : 'miembros'}</small></div><div class="family-cell-actions" role="group" aria-label="Acciones de la familia ${f.numero}"><button type="button" class="secondary family-add-member" data-action="addFamilyPerson" data-id="${esc(f.id)}" aria-label="Añadir miembro a la familia ${f.numero}" title="Añadir miembro a la familia ${f.numero}">${icon('personAdd')}</button><button type="button" class="secondary family-delete-cross" data-action="deleteFamily" data-id="${esc(f.id)}" title="Borrar familia ${f.numero}" aria-label="Borrar familia ${f.numero}">${icon('trash')}</button></div></div></td>` : ''}${celda('nombre')}${celda('apellidos')}${celda('documento')}${celda('nacimiento')}<td class="age-cell">${edad(p.nacimiento) === '' ? '—' : edad(p.nacimiento)}</td>${celda('derivacion')}${celda('vigencia')}${celda('proximaCita')}<td data-person-status>${tx ? `<span class="badge ${cl}">${tx}</span>` : ''}</td><td class="list-actions-column">${!p.titular ? `<button class="danger" data-action="deleteMember" data-id="${esc(f.id)}" data-person-id="${esc(p.id)}" aria-label="Borrar miembro de la familia ${f.numero}" title="Borrar esta persona">${icon("trash")}</button>` : ''}</td></tr>`;
    }).join('') || '<tr><td colspan="11" class="empty">No se encontraron familias. Prueba con otros filtros.</td></tr>';
    actualizarMarcasDuplicadas();
    document.getElementById('counter').textContent = `Mostrando ${grupos.length} de ${familias.length} familias · ${list.length} de ${all.length} personas`;
    return;
  }

}
async function iniciarAlta(familiaId = null, cantidadMiembros = 1) {
  if (guardandoAlta) return;
  const tablaAnterior = document.getElementById('beneficiaryTable');
  const botonAnterior = familiaId ? [...app.querySelectorAll('[data-action="addFamilyPerson"]')].find(button => button.dataset.id === familiaId) : null;
  const filaAnterior = botonAnterior?.closest('[data-row-family]');
  const posicion = botonAnterior ? { top: filaAnterior?.getBoundingClientRect().top ?? botonAnterior.getBoundingClientRect().top, scrollTop: tablaAnterior.scrollTop, scrollLeft: tablaAnterior.scrollLeft, page: window.scrollY, pendientes: app.querySelector('#pendingActions')?.open, leyenda: app.querySelector('.status-legend')?.open } : null;
  guardandoAlta = true;
  app.querySelectorAll('[data-action="newFamily"], [data-action="addFamilyPerson"]').forEach(button => button.disabled = true);
  app.querySelectorAll('[data-list-field]').forEach(input => input.disabled = true);
  try {
    const f = familiaId ? familias.find(f => f.id === familiaId) : familia(numeroLibre(familias));
    if (!f) throw new Error('No se encontró la familia.');
    const nueva = familiaId ? persona() : f.personas[0];
    let next = incorporarAlta(familias, { id: f.id, familiaId, persona: nueva }, new Date(), { permitirIncompletos: true });
    if (!familiaId) {
      for (let i = 1; i < cantidadMiembros; i++) {
        next = incorporarAlta(next, { familiaId: f.id, persona: persona() }, new Date(), { permitirIncompletos: true });
      }
    }
    setSaveState('Creando la fila…', 'saving');
    await saveDB(next);
    familias = next;
    if (!familiaId) { familiasCoincidencia = null; busqueda = ''; numeroFamilia = ''; filtroEstado = ''; }
    else if (!coincideEstado(next.find(family => family.id === familiaId))) filtroEstado = '';
    modoListado = 'personas'; vista = 'listado';
    setSaveState('Fila creada y guardada. Completa sus datos directamente en la tabla.', 'saved');
    render();
    if (posicion) {
      app.querySelector('#pendingActions').open = posicion.pendientes;
      app.querySelector('.status-legend').open = posicion.leyenda;
    }
    listNotice('Las filas vacías no cuentan. Se eliminan al salir del listado o al generar el Excel; mientras editas puedes añadir varios miembros.');
    const mantenerPosicion = () => {
      if (!posicion) return;
      const tabla = document.getElementById('beneficiaryTable');
      const fila = app.querySelector(`[data-row-family="${CSS.escape(familiaId)}"]`);
      if (!tabla || !fila) return;
      tabla.scrollTop = posicion.scrollTop;
      tabla.scrollLeft = posicion.scrollLeft;
      window.scrollTo({ top: posicion.page, behavior: 'instant' });
      tabla.scrollTop += fila.getBoundingClientRect().top - posicion.top;
    };
    mantenerPosicion();
    requestAnimationFrame(() => {
      mantenerPosicion();
      const input = [...app.querySelectorAll('[data-list-field="nombre"]')].find(field => field.dataset.personId === nueva.id);
      if (posicion) {
        return;
      }
      input?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      input?.focus({ preventScroll: true });
    });
  } catch (error) {
    listNotice(`No se pudo crear la fila: ${error.message}`);
    setSaveState('No se pudo guardar la fila nueva. Vuelve a intentarlo.', 'error');
  } finally {
    guardandoAlta = false;
    app.querySelectorAll('[data-action="newFamily"], [data-action="addFamilyPerson"]').forEach(button => button.disabled = false);
    app.querySelectorAll('[data-list-field]').forEach(input => input.disabled = false);
  }
}
async function newFamily() {
  const respuesta = prompt('¿Cuántas personas tiene la familia, incluido el titular?', '1');
  if (respuesta === null) return;
  const cantidad = Number(respuesta.trim());
  if (!/^\d+$/.test(respuesta.trim()) || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 995) {
    alert('Introduce un número entero de personas entre 1 y 995, incluido el titular.');
    return;
  }
  await iniciarAlta(null, cantidad);
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
  const titular = eliminada.personas.find(p => p.titular) ?? eliminada.personas[0];
  const nombreTitular = [titular?.nombre, titular?.apellidos].filter(Boolean).join(' ').trim() || 'Titular sin nombre';
  if (!confirm(`¿Quieres borrar la familia nº ${eliminada.numero} — ${nombreTitular}? Se eliminarán todas sus filas (${eliminada.personas.length}). Podrás recuperarla con «Deshacer borrado».`)) return;
  const table = document.getElementById('beneficiaryTable');
  const tableTop = table?.scrollTop ?? 0;
  const pageTop = window.scrollY;
  const next = familias.filter(f => f.id !== id);
  setSaveState('Guardando el listado…', 'saving');
  await saveDB(next);
  familias = next;
  familiasEliminadas.push({ tipo: 'familia', familia: structuredClone(eliminada) });
  if (filtroEstado === 'incomplete' && cuentaFiltro('incomplete') === 0) filtroEstado = '';
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
  // Mantener el filtro mientras haya familias que todavía necesiten revisión.
  if (filtroEstado && !familias.some(family => coincideEstado(family))) filtroEstado = '';
  setSaveState('Persona borrada. Puedes recuperarla con Deshacer borrado.', 'saved');
  render();
  const nuevaTabla = document.getElementById('beneficiaryTable');
  if (nuevaTabla) { nuevaTabla.scrollTop = top; nuevaTabla.scrollLeft = left; }
}
async function recuperarFamilia() {
  const ultima = familiasEliminadas.at(-1);
  if (!ultima) return;
  const recuperada = structuredClone(ultima.familia);
  if (ultima.tipo !== 'persona') recuperada.numero = numeroParaRestaurar(familias, recuperada.numero);
  const next = ultima.tipo === 'persona'
    ? familias.map(f => f.id === ultima.familia.id ? restaurarMiembro(f, ultima.persona, ultima.indice) : f)
    : [...familias, recuperada].sort((a, b) => a.numero - b.numero);
  setSaveState('Recuperando la familia…', 'saving');
  await saveDB(next);
  familias = next;
  familiasEliminadas.pop();
  const renumerada = ultima.tipo !== 'persona' && Number(recuperada.numero) !== Number(ultima.familia.numero);
  const mensaje = renumerada ? `Familia recuperada con el número ${recuperada.numero}, porque el ${ultima.familia.numero} ya está ocupado.` : `Familia ${recuperada.numero} recuperada.`;
  setSaveState(ultima.tipo === 'persona' ? `Persona recuperada en la familia ${ultima.familia.numero}.` : mensaje, 'saved');
  renderListado();
  if (renumerada) listNotice(mensaje);
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
      editando.personas[i].menor = !editando.personas[i].titular && (v ? typeof edad(v) === "number" && edad(v) < 18 : Boolean(editando.personas[i].menor));
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
 ${!p.titular ? `<label class="titular-toggle"><input type="checkbox" data-menor data-index="${i}" ${p.menor ? "checked" : ""}> Menor de edad (nombre, documento y nacimiento opcionales)</label><p data-adult-note ${p.menor ? 'hidden' : ''}>Nombre y apellidos del adulto son obligatorios. El documento es opcional; se recomienda completarlo.</p>` : '<p>Nombre, apellidos y documento del titular son obligatorios.</p>'}
 <div class="grid">
 <div><label>Nombre</label><input value="${esc(p.nombre)}" data-field="nombre" data-index="${i}" ${(p.titular || !p.menor) ? 'required pattern=".*\\S.*"' : ""}></div>
 <div><label>Apellidos</label><input value="${esc(p.apellidos)}" data-field="apellidos" data-index="${i}" ${(p.titular || !p.menor) ? 'required pattern=".*\\S.*"' : ""}></div>
 <div><label>Documento${p.titular ? ' (obligatorio)' : ' (opcional)'}</label><input value="${esc(p.documento)}" data-field="documento" data-index="${i}" ${p.titular ? 'required pattern=".*\\S.*"' : ""}></div>
 ${dateField(p, i, "nacimiento", "Fecha de nacimiento", `<small>Edad: <b data-age>${edad(p.nacimiento) === "" ? "—" : edad(p.nacimiento)}</b></small>`)}
 ${p.titular ? dateField(p, i, "derivacion", "Fecha derivación") : sharedDateField(p, "derivacion", "Fecha derivación")}
 ${p.titular ? dateField(p, i, "vigencia", "Vigencia", `<small data-vigencia-status class="date-status ${p.vigencia ? (caducada(p.vigencia) ? "is-expired" : "is-current") : ""}" ${p.vigencia ? "" : "hidden"}>${p.vigencia ? (caducada(p.vigencia) ? "VIGENCIA CADUCADA" : "Vigencia vigente") : ""}</small>`) : sharedDateField(p, "vigencia", "Vigencia")}
 ${p.titular ? dateField(p, i, "proximaCita", "Próxima cita", `<small>Rellénela si la vigencia está caducada y ya tiene cita de renovación.</small>`) : ""}
 <div><label>N.º de miembros</label><input value="${f.personas.length}" disabled></div>
 </div></div>`).join("")}
 <div class="actions"><button class="secondary" data-action="addPerson">${icon("add")} Añadir persona</button><button class="primary" data-action="saveFamily">Guardar y volver</button><button class="secondary" data-action="cancelFamily">Descartar cambios pendientes</button></div></div>`;
  const error = errorFormulario();
  if (error) mostrarPendiente(error);
}

async function importExcelFile(event) {
  const file = event.target.files[0];
  try { await importarArchivoExcel(file); }
  finally { event.target.value = ""; }
}
async function importarArchivoExcel(file) {
  if (!file || importandoExcel) return;
  importandoExcel = true;
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
    familiasCoincidencia = null;
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
    importandoExcel = false;
  }
}

function reportError(error) {
  console.error(error);
  setSaveState("Error: no se pudieron guardar los cambios.", "error");
  alert("No se pudieron guardar los cambios. Realice una copia de seguridad antes de cerrar.");
}

const app = document.getElementById("app");
function moverCasilla(input, direccion) {
  const campos = [...app.querySelectorAll('[data-list-field]')].filter(field => !field.disabled);
  let destino;
  if (direccion === 'up' || direccion === 'down') {
    const columna = campos.filter(field => field.dataset.listField === input.dataset.listField);
    destino = columna[columna.indexOf(input) + (direccion === 'down' ? 1 : -1)];
  } else {
    destino = campos[campos.indexOf(input) + (direccion === 'next' ? 1 : -1)];
  }
  if (!destino) return false;
  destino.focus({ preventScroll: true });
  destino.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  return true;
}
app.addEventListener('keydown', event => {
  const input = event.target;
  if (!input.hasAttribute('data-list-field') || input.disabled || event.isComposing) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    recuperarCelda(input);
    return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    if (!moverCasilla(input, event.shiftKey ? 'up' : 'down')) input.blur();
    return;
  }
  if (event.key === 'Tab') {
    if (moverCasilla(input, event.shiftKey ? 'previous' : 'next')) event.preventDefault();
    return;
  }
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (!event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
    event.preventDefault();
    moverCasilla(input, event.key === 'ArrowDown' ? 'down' : 'up');
  }
});
// En el navegador se reciben archivos; Windows entrega rutas a través de Tauri.
function resaltarZonaExcel(activa) {
  app.querySelector('[data-excel-drop]')?.classList.toggle('drag-over', activa);
}
async function recibirExcelSoltado(files) {
  if (files.length !== 1 || !/\.xlsx$/i.test(files[0]?.name ?? '')) {
    alert('Arrastra un solo archivo de Excel .xlsx.');
    return;
  }
  if (!await listoParaSalirListado()) return;
  await importarArchivoExcel(files[0]);
}
if (!isTauri()) {
  document.addEventListener('dragover', event => {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    const dentro = vista === 'importar' && Boolean(event.target.closest('[data-excel-drop]'));
    event.dataTransfer.dropEffect = dentro && !importandoExcel ? 'copy' : 'none';
    resaltarZonaExcel(dentro);
  });
  document.addEventListener('dragleave', event => {
    if (!event.relatedTarget || !event.relatedTarget.closest?.('[data-excel-drop]')) resaltarZonaExcel(false);
  });
  document.addEventListener('drop', event => {
    event.preventDefault();
    resaltarZonaExcel(false);
    if (vista !== 'importar' || !event.target.closest('[data-excel-drop]') || importandoExcel) return;
    recibirExcelSoltado([...event.dataTransfer.files]).catch(reportError);
  });
} else {
  getCurrentWebview().onDragDropEvent(async event => {
    const payload = event.payload;
    if (vista !== 'importar' || importandoExcel) { resaltarZonaExcel(false); return; }
    resaltarZonaExcel(payload.type === 'enter' || payload.type === 'over');
    if (payload.type !== 'drop') return;
    const paths = payload.paths;
    if (paths.length !== 1 || !/\.xlsx$/i.test(paths[0])) {
      alert('Arrastra un solo archivo de Excel .xlsx.');
      return;
    }
    try {
      const bytes = await readFile(paths[0]);
      const name = paths[0].split(/[\\/]/).pop();
      await recibirExcelSoltado([new File([bytes], name)]);
    } catch (error) { alert(`No se pudo leer el Excel arrastrado. ${error.message}`); }
  }).catch(error => console.error('No se pudo activar arrastrar y soltar Excel.', error));
}

const versionLabel = document.getElementById("appVersion");
if (versionLabel) versionLabel.textContent = `v${appVersion}`;
const headerLogo = document.querySelector("header .company-logo");
if (headerLogo) headerLogo.title = `Gestor de beneficiarios · versión ${appVersion}`;
const actions = {
  changeListZoom: target => aplicarZoomListado(zoomListado + Number(target.dataset.zoomStep)),
  resetListZoom: () => aplicarZoomListado(100),
  discardListChanges: async () => { await listSaving; for (const input of listDrafts.values()) recuperarCelda(input); },
  newFamily, back, addPerson,
  saveFamily: () => back(),
  cancelFamily: () => { editando = null; dateDrafts.clear(); vista = "listado"; setSaveState("Cambios pendientes descartados.", "saved"); render(); },
  quickFilter: target => {
    const value = target.dataset.quickFilter;
    filtroEstado = filtroEstado === value ? '' : value;
    filterTable();
    document.getElementById('beneficiaryTable').scrollTop = 0;
  },
  clearListFilters: () => {
    familiasCoincidencia = null;
    busqueda = ''; numeroFamilia = ''; filtroEstado = '';
    app.querySelector('#search').value = '';
    app.querySelector('#familyNumber').value = '';
    filterTable();
  },
  resetAllData: async () => {
    if (!isTauri()) return;
    const confirmation = prompt('Esto borrará todos los datos y las copias de recuperación de este ordenador. Escribe BORRAR para continuar:');
    if (confirmation !== 'BORRAR') return;
    try {
      setSaveState('Borrando todos los datos…', 'saving');
      await resetDB();
      await resetReparto();
      await saveImportReport(null);
      familias = [];
      familiasCoincidencia = null;
      familiasEliminadas = [];
      reparto = prepararReparto(null);
      ultimoInforme = null;
      editando = null;
      dateDrafts.clear();
      listDrafts.clear();
      busqueda = ''; numeroFamilia = ''; filtroEstado = '';
      vista = 'listado';
      render();
      setSaveState('Todos los datos de este ordenador se han eliminado.', 'saved');
    } catch (error) {
      console.error(error);
      setSaveState('No se pudieron eliminar todos los datos.', 'error');
      alert(`No se pudieron eliminar todos los datos. ${error.message}`);
    }
  },
  reload: () => location.reload(),
  section: async target => {
    const siguiente = target.dataset.view;
    if (siguiente === vista) return;
    if (vista === 'listado') {
      const table = document.getElementById('beneficiaryTable');
      posicionListado = { top: table?.scrollTop ?? 0, left: table?.scrollLeft ?? 0, page: window.scrollY, pendientes: app.querySelector('#pendingActions')?.open ?? false, leyenda: app.querySelector('.status-legend')?.open ?? false };
      await limpiarFilasVacias();
    }
    vista = siguiente;
    render();
    if (vista === 'listado' && posicionListado) {
      const posicion = posicionListado;
      app.querySelector('#pendingActions').open = posicion.pendientes;
      app.querySelector('.status-legend').open = posicion.leyenda;
      requestAnimationFrame(() => {
        const table = document.getElementById('beneficiaryTable');
        if (!table || vista !== 'listado') return;
        table.scrollTop = posicion.top;
        table.scrollLeft = posicion.left;
        window.scrollTo({ top: posicion.page, behavior: 'instant' });
      });
    } else window.scrollTo({ top: 0, behavior: 'instant' });
  },
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
    if (await limpiarFilasVacias()) {
      const tabla = document.getElementById('beneficiaryTable');
      const top = tabla?.scrollTop ?? 0, left = tabla?.scrollLeft ?? 0;
      render();
      const nuevaTabla = document.getElementById('beneficiaryTable');
      if (nuevaTabla) { nuevaTabla.scrollTop = top; nuevaTabla.scrollLeft = left; }
      target = app.querySelector('[data-action="exportExcel"]') ?? target;
    }
    const listadoExportar = familiasParaExportar(familias);
    if (avisarExportacionBloqueada(listadoExportar)) return;
    target.disabled = true;
    target.textContent = "Generando Excel…";
    avisoExcel = "";
    renderExcelNotice();
    try {
      const generated = await exportExcel(listadoExportar, reparto);
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
async function handleActionClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target || !event.currentTarget.contains(target)) return;
  try {
    if (guardandoAlta) return;
    if (target.dataset.action !== 'discardListChanges') {
      if (!await listoParaSalirListado()) return;
    }
    await actions[target.dataset.action]?.(target);
  } catch (error) { reportError(error); }
}
app.addEventListener("click", handleActionClick);
document.getElementById("sectionNavigation").addEventListener("click", handleActionClick);
document.getElementById("duplicateAlert").addEventListener("click", event => {
  if (guardandoAlta) return;
  const target = event.target.closest('[data-duplicate-group]');
  if (!target) return;
  const group = findDuplicateGroups()[Number(target.dataset.duplicateGroup)];
  if (!group) return;
  const ids = new Set(group.people.map(item => item.family.id));
  listoParaSalirListado().then(listo => {
    if (!listo) return;
    familiasCoincidencia = ids;
    vista = 'listado'; modoListado = 'personas';
    numeroFamilia = ''; busqueda = ''; filtroEstado = '';
    render();
    document.getElementById('beneficiaryTable').scrollTop = 0;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }).catch(reportError);
});
app.addEventListener('click', event => {
  const target = event.target.closest('[data-pending-families]');
  if (!target || guardandoAlta) return;
  const ids = new Set(target.dataset.pendingFamilies.split(',').filter(Boolean));
  listoParaSalirListado().then(listo => {
    if (!listo) return;
    familiasCoincidencia = ids;
    filtroEstado = '';
    numeroFamilia = '';
    busqueda = '';
    vista = 'listado';
    modoListado = 'personas';
    render();
    document.getElementById('beneficiaryTable').scrollTop = 0;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }).catch(reportError);
});
document.getElementById('pageUp').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
document.getElementById('pageDown').addEventListener('click', () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }));
window.addEventListener('scroll', updatePageNav, { passive: true });
window.addEventListener('resize', updatePageNav);
window.addEventListener('beforeunload', event => {
  if (!guardandoAlta && !listDrafts.size) return;
  event.preventDefault();
  event.returnValue = '';
});
window.addEventListener("beforeprint", () => {
  if (vista !== "listado") return;
  document.getElementById("listPrintTitle").textContent = `Listado de ${modoListado} · ${fmt(todayISO())}`;
  const estadoSeleccionado = filtrosRapidos.find(([id]) => id === filtroEstado)?.[1] ?? filtroEstado;
  document.getElementById("listPrintFilters").textContent = [numeroFamilia && `Familia: ${numeroFamilia}`, busqueda && `Búsqueda: ${busqueda}`, filtroEstado && `Estado: ${estadoSeleccionado}`].filter(Boolean).join(" · ");
});
app.addEventListener("input", async event => {
  const target = event.target;
  if (target.hasAttribute('data-list-zoom')) {
    aplicarZoomListado(target.value);
    return;
  }
  if (target.hasAttribute("data-list-field")) {
    listDrafts.set(listKey(target), target);
    if (['nombre', 'apellidos', 'documento'].includes(target.dataset.listField)) renderDuplicateAlert();
    if (target.getAttribute('aria-invalid') === 'true' || (listDates.has(target.dataset.listField) && target.value.trim() && target.value.trim().length >= 8)) validarFechaLista(target, true);
    else { target.removeAttribute('aria-invalid'); target.setCustomValidity(''); }
    setSaveState(target.getAttribute('aria-invalid') === 'true' ? 'Corrige esta fecha.' : 'El dato se guardará al salir de la casilla.', 'pending');
    return;
  }
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
  if (target.hasAttribute('data-list-minor')) {
    const checked = target.checked;
    target.disabled = true;
    try {
      if (!await listoParaSalirListado()) { target.checked = !checked; return; }
      const original = familias.find(f => f.id === target.dataset.familyId);
      const copia = editarPersona(original, target.dataset.personId, 'menor', checked);
      const next = familias.map(f => f.id === copia.id ? copia : f);
      setSaveState('Guardando la condición de menor…', 'saving');
      await saveDB(next);
      familias = next;
      const tabla = document.getElementById('beneficiaryTable');
      const top = tabla.scrollTop, left = tabla.scrollLeft;
      renderListado();
      document.getElementById('beneficiaryTable').scrollTop = top;
      document.getElementById('beneficiaryTable').scrollLeft = left;
      setSaveState('Condición de menor guardada.', 'saved');
    } catch (error) {
      target.checked = !checked;
      setSaveState(error.message, 'pending');
      alert(error.message);
    } finally { target.disabled = false; }
    return;
  }
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
  if (target.hasAttribute('data-list-field') && listDates.has(target.dataset.listField)) {
    validarFechaLista(target, true);
    return;
  }
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
    await limpiarFilasVacias();
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
