import "./styles.css";
import { loadDB, saveDB } from "./database.js";
import { persona, familia, estado } from "./familias.js";
import { edad, caducada, esc, fmt } from "./utils.js";
import { backup, readBackup } from "./backups.js";
import { exportExcel } from "./excel.js";
import { readExcel } from "./excel-import.js";
import { icon } from "./icons.js";
import { isTauri } from "@tauri-apps/api/core";
import { loadTransfer, saveTransfer } from "./transfer.js";

import { alimentos, resumen, envases } from "./reparto.mjs";
import { loadReparto, saveReparto } from "./reparto-storage.js";

let reparto = [], modoListado = "familias", busqueda = "";
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
    indicator.textContent = message;
    indicator.dataset.status = status;
  }
}
async function changed() {
  const where = isTauri() ? "este ordenador" : "este navegador";
  setSaveState(`Guardando en ${where}…`, "saving");
  try {
    await saveDB(familias);
    setSaveState(`Guardado en ${where}.`, "saved");
  } catch (error) {
    setSaveState("Error: no se guardaron los últimos cambios.", "error");
    throw error;
  }
}
function navegacion() {
  return `<nav class="card toolbar" aria-label="Secciones">${[['listado','Listado'],['reparto','Reparto'],['resumen','Resumen']].map(([id, texto])=>`<button data-action="section" data-view="${id}" class="${vista===id?'primary':'secondary'}" aria-current="${vista===id?'page':'false'}">${texto}</button>`).join('')}</nav>`;
}
function render(){
  if (vista === 'formulario') return renderFormulario();
  if (vista === 'resumen') return renderResumen();
  if (vista === 'reparto') return renderReparto();
  renderListado();
}
function renderResumen() {
  const r = resumen(familias);
  app.innerHTML = navegacion() + `<div class="card"><h2>Resumen de beneficiarios</h2><div class="summary"><div class="stat"><strong>${r.familias}</strong>Familias</div><div class="stat"><strong>${r.personas}</strong>Beneficiarios</div></div></div>
  <div class="report-grid"><div class="card"><h2>Familias por número de miembros</h2><table><thead><tr><th>Miembros</th><th>Familias</th></tr></thead><tbody>${r.tamanos.map((n,i)=>`<tr><td>${i+1}</td><td>${n}</td></tr>`).join('')}${r.fuera?`<tr><td>Más de 10</td><td>${r.fuera}</td></tr>`:''}</tbody></table></div>
  <div class="card"><h2>Personas por rango de edad</h2><table><thead><tr><th>Rango de la plantilla</th><th>Personas</th></tr></thead><tbody>${['0–2 años','3–18 años','19–100 años'].map((label,i)=>`<tr><td>${label}</td><td>${r.edades[i]}</td></tr>`).join('')}<tr><td>Sin fecha o fuera de los rangos</td><td>${r.sinRango}</td></tr></tbody></table><p>Se utilizan los límites de fechas de la plantilla: desde hace 3 años hasta antes de hoy; desde hace 18 hasta antes de hace 3 años; y desde hace 100 hasta antes de hace 18 años. Estos límites no coinciden exactamente con las etiquetas del Excel.</p></div></div>`;
}
function renderReparto() {
  const r = resumen(familias), total = r.tamanos.reduce((n,c,i)=>n+c*(i+1),0);
  app.innerHTML = navegacion() + `<div class="card"><h2>Reparto de alimentos</h2><p>Introduce la cantidad asignada de cada alimento en envases. La tabla calcula los envases por familia según su número de miembros, como en Excel.</p><p>${r.tamanos.reduce((a,b)=>a+b,0)} familias · ${total} beneficiarios para el reparto</p>${r.fuera?`<div class="notice">${r.fuera} familias de más de 10 miembros quedan fuera del cálculo de Reparto, igual que en la plantilla.</div>`:''}${!total?'<p class="notice">Añade familias de 1 a 10 miembros para calcular el reparto.</p>':''}<div class="table-wrap"><table class="reparto-table"><thead><tr><th>Alimento</th><th>Cantidad asignada</th>${r.tamanos.map((_,i)=>`<th>${i+1} miembros</th>`).join('')}</tr><tr><th>Familias</th><th></th>${r.tamanos.map(n=>`<th>${n}</th>`).join('')}</tr><tr><th>Beneficiarios</th><th></th>${r.tamanos.map((n,i)=>`<th>${n*(i+1)}</th>`).join('')}</tr></thead><tbody>${reparto.map((a,i)=>`<tr><td><input aria-label="Nombre del alimento ${i+1}" maxlength="100" data-food-name="${i}" value="${esc(a.nombre)}"></td><td><input aria-label="Cantidad de ${esc(a.nombre)}" type="number" min="0" step="any" data-food-amount="${i}" value="${a.cantidad}"></td>${r.tamanos.map((n,j)=>`<td data-result="${i}:${j}">${envases(a.cantidad,j+1,n,total)??'—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p>Se divide la cantidad entre los beneficiarios de esta tabla, se multiplica por los miembros y se redondea al entero más próximo. El redondeo puede producir un total distinto de la cantidad asignada.</p><button class="primary" data-action="exportExcel">Generar Excel</button></div>`;
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
function renderListado(){
 document.getElementById("app").innerHTML=navegacion()+`
 <div class="card"><div class="toolbar">
 <button data-action="listMode" data-mode="familias" aria-pressed="${modoListado==='familias'}" class="${modoListado==='familias'?'primary':'secondary'}">Familias</button>
 <button data-action="listMode" data-mode="personas" aria-pressed="${modoListado==='personas'}" class="${modoListado==='personas'?'primary':'secondary'}">Personas</button>
 <input value="${esc(busqueda)}" id="search" class="search" placeholder="Buscar familia, nombre, apellidos o documento..." data-search>
 <button class="primary" data-action="newFamily">${icon("add")} Nueva familia</button>
 </div></div>
 <div class="summary">
 <div class="stat"><strong>${familias.length}</strong>Familias</div>
 <div class="stat"><strong>${familias.reduce((n,f)=>n+f.personas.length,0)}</strong>Beneficiarios</div>
 <div class="stat"><strong>${familias.filter(f=>f.personas.some(p=>caducada(p.vigencia))).length}</strong>Caducadas</div>
 <div class="stat"><strong>${familias.filter(f=>f.personas.some(p=>p.proximaCita)).length}</strong>Con próxima cita</div>
 </div>
 <div class="card status-legend" aria-label="Leyenda de estados de las familias">
 <h2>Qué significa cada estado</h2>
 <ul>
 <li><span class="badge ok">Correcta</span><span>Las vigencias están al día y no vencen en los próximos 60 días.</span></li>
 <li><span class="badge warn">Próxima</span><span>Alguna vigencia vencerá en los próximos 60 días.</span></li>
 <li><span class="badge expired">Caducada</span><span>Alguna vigencia ya venció y no hay una próxima cita anotada.</span></li>
 <li><span class="badge appointment">Cita pendiente</span><span>Hay una vigencia vencida y una próxima cita anotada.</span></li>
 </ul>
 <small>El estado de la familia depende de las vigencias y citas de sus miembros.</small>
 </div>
 <div class="card"><div class="table-wrap"><table><thead id="listHead"><tr><th>N.º</th><th>Familia</th><th>Miembros</th><th>Vigencia más próxima</th><th>Próxima cita</th><th>Estado</th><th></th></tr></thead><tbody id="rows"></tbody></table></div><p id="counter" style="font-size:13px;color:#666"></p></div>
 <div class="card">
 <h2 style="margin-top:0">Datos y copias de seguridad</h2>
 <div class="actions">
 <button class="success" data-action="backup">${icon("download")} Llevar datos a otro ordenador</button>
 <button class="secondary" data-action="restore">${icon("restore")} Cargar datos en este ordenador</button>
 <input id="restore" class="hidden" type="file" accept=".json" data-restore>
 <button class="secondary" data-action="importExcel">${icon("excel")} Cargar familias desde Excel</button>
 <input id="importExcel" class="hidden" type="file" accept=".xlsx" data-import-excel>
 <button class="primary" data-action="exportExcel">${icon("excel")} Generar Excel</button>
 </div>
 <p class="save">El estado del guardado aparece en la parte superior de la aplicación.</p>
 <p id="backupState" class="save"></p>
 <div class="notice">Los cambios se guardan automáticamente en este ordenador. Para continuar en otro equipo, prepara un archivo de traslado y llévalo, por ejemplo, en un USB; después carga ese archivo en la otra instalación. Mantén una sola copia activa del listado para evitar ediciones distintas en cada equipo.</div>
 <div class="notice">Al cargar un Excel, las familias actuales se sustituirán por las de la hoja Listado. Usa un archivo generado con la plantilla oficial. Los Excel no se modifican.</div>
 <div class="notice">El Excel conserva las hojas Listado, Reparto y Resumen. Sus cálculos se actualizan al abrirlo en Excel o LibreOffice. La plantilla admite hasta 995 beneficiarios; Reparto y el resumen por tamaño contemplan familias de 1 a 10 miembros.</div>
 </div>`;
 filterTable();
}
function filterTable(){
 const q=(document.getElementById("search")?.value||"").toLowerCase().trim();
 busqueda=q;
 if (modoListado === 'personas') {
   const all = familias.flatMap(f=>f.personas.map(p=>({f,p})));
   const list = all.filter(({f,p})=>!q||String(f.numero).includes(q)||(p.nombre+' '+p.apellidos+' '+p.documento).toLowerCase().includes(q));
   document.getElementById('listHead').innerHTML='<tr><th>Familia</th><th>Nombre</th><th>Apellidos</th><th>Documento</th><th>Titular</th><th>Nacimiento</th><th>Edad</th><th>Derivación</th><th>Vigencia</th><th>Próxima cita</th><th></th></tr>';
   document.getElementById('rows').innerHTML=list.map(({f,p})=>`<tr class="click" data-action="openFamily" data-id="${esc(f.id)}"><td>${f.numero}</td><td>${esc(p.nombre)}</td><td>${esc(p.apellidos)}</td><td>${esc(p.documento)}</td><td>${p.titular?'Sí':'—'}</td><td>${fmt(p.nacimiento)}</td><td>${edad(p.nacimiento)|| (edad(p.nacimiento)===0?0:'—')}</td><td>${fmt(p.derivacion)}</td><td>${fmt(p.vigencia)}</td><td>${fmt(p.proximaCita)}</td><td><button class="secondary" data-action="openFamily" data-id="${esc(f.id)}">Editar familia</button></td></tr>`).join('')||'<tr><td colspan="11" class="empty">No se encontraron personas.</td></tr>';
   document.getElementById('counter').textContent=`Mostrando ${list.length} de ${all.length} personas`;
   return;
 }
 const list=familias.filter(f=>!q||String(f.numero).includes(q)||f.personas.some(p=>(p.nombre+" "+p.apellidos+" "+p.documento).toLowerCase().includes(q)));
 document.getElementById("listHead").innerHTML='<tr><th>N.º</th><th>Titular</th><th>Documento</th><th>Miembros</th><th>Vigencia más próxima</th><th>Próxima cita</th><th>Estado</th><th></th></tr>';
 document.getElementById("rows").innerHTML=list.length?list.map(f=>{
  const titular = f.personas.find(p => p.titular) ?? f.personas[0];
  const names = (esc(titular.nombre) + " " + esc(titular.apellidos)).trim() || "Sin datos";
  const vig=f.personas.map(p=>p.vigencia).filter(Boolean).sort()[0], cita=f.personas.map(p=>p.proximaCita).filter(Boolean).sort()[0], [cl,tx]=estado(f);
  return `<tr class="click" data-action="openFamily" data-id="${esc(f.id)}"><td><b>${f.numero}</b></td><td>${names}</td><td>${esc(titular.documento)||"—"}</td><td>${f.personas.length}</td><td>${fmt(vig)}</td><td>${fmt(cita)}</td><td><span class="badge ${cl}">${tx}</span></td><td><button class="secondary" data-action="openFamily" data-id="${esc(f.id)}">${icon("edit")} Editar</button></td></tr>`
 }).join(""):`<tr><td colspan="8" class="empty">No se encontraron familias.</td></tr>`;
 document.getElementById("counter").textContent=`Mostrando ${list.length} de ${familias.length} familias`;
}
async function newFamily(){const f=familia(siguienteFamilia++);familias.push(f);editando=f;vista="formulario";await changed();render()}
function openFamily(id){editando=familias.find(f=>f.id===id);vista="formulario";render()}
async function back(){dateDrafts.clear();editando=null;vista="listado";await changed();render()}
async function removeFamily(){if(!confirm("¿Eliminar esta familia y todas sus personas?"))return;familias=familias.filter(f=>f.id!==editando.id);renumerar();await changed();editando=null;vista="listado";render()}
async function addPerson(){
  const titular = editando.personas.find(person => person.titular) ?? editando.personas[0];
  const nueva = persona();
  nueva.derivacion = titular.derivacion;
  nueva.vigencia = titular.vigencia;
  editando.personas.push(nueva);
  await changed();
  render();
}
async function removePerson(i){if(editando.personas.length===1){alert("Una familia debe tener al menos una persona.");return}const eraTitular=editando.personas[i].titular;editando.personas.splice(i,1);if(eraTitular)editando.personas[0].titular=true;await changed();render()}
async function updateTitular(index, checked) {
  if (!checked) {
    app.querySelector(`[data-titular][data-index="${index}"]`).checked = true;
    return;
  }
  editando.personas.forEach((person, personIndex) => person.titular = personIndex === index);
  await changed();
  renderFormulario();
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
  }
  // Actualizar solo los avisos conserva el foco y la selección del año.
  const card = app.querySelector(`[data-person="${i}"]`);
  if (k === "nacimiento") card.querySelector("[data-age]").textContent = edad(v) === "" ? "—" : edad(v);
  if (k === "vigencia") {
    app.querySelectorAll("[data-vigencia-status]").forEach(status => {
      status.hidden = !v;
      status.textContent = v ? (caducada(v) ? "VIGENCIA CADUCADA" : "Vigencia vigente") : "";
      status.classList.toggle("is-expired", Boolean(v && caducada(v)));
      status.classList.toggle("is-current", Boolean(v && !caducada(v)));
    });
  }
  await changed();
}
function renderFormulario(){
 const f=editando;
 document.getElementById("app").innerHTML=`
 <div class="card"><div class="form-head"><div><button class="secondary" data-action="back">${icon("back")} Volver al listado</button><h2>Familia ${f.numero}</h2></div><button class="danger" data-action="removeFamily">${icon("trash")} Eliminar familia</button></div>
 <p style="color:#666">Rellene únicamente los datos de las personas. La edad y el número de miembros se calculan automáticamente. Escriba las fechas como día/mes/año (por ejemplo, 15/06/1967) o use el botón de calendario. Las fechas de derivación y vigencia son comunes a la familia: edítelas en la persona titular. En los demás miembros se muestran como referencia.</p></div>
 <div class="card">${f.personas.map((p,i)=>`
 <div class="person" data-person="${i}"><div class="person-head"><div><h3>${p.titular ? "Titular" : `Miembro ${i + 1}`}</h3><label class="titular-toggle"><input type="checkbox" data-titular data-index="${i}" ${p.titular ? "checked" : ""}> Es titular</label></div><button class="danger" data-action="removePerson" data-index="${i}">${icon("trash")} Eliminar persona</button></div>
 <div class="grid">
 <div><label>Nombre</label><input value="${esc(p.nombre)}" data-field="nombre" data-index="${i}"></div>
 <div><label>Apellidos</label><input value="${esc(p.apellidos)}" data-field="apellidos" data-index="${i}"></div>
 <div><label>Documento</label><input value="${esc(p.documento)}" data-field="documento" data-index="${i}"></div>
 ${dateField(p, i, "nacimiento", "Fecha de nacimiento", `<small>Edad: <b data-age>${edad(p.nacimiento) === "" ? "—" : edad(p.nacimiento)}</b></small>`)}
 ${p.titular ? dateField(p, i, "derivacion", "Fecha derivación") : sharedDateField(p, "derivacion", "Fecha derivación")}
 ${p.titular ? dateField(p, i, "vigencia", "Vigencia", `<small data-vigencia-status class="date-status ${p.vigencia ? (caducada(p.vigencia) ? "is-expired" : "is-current") : ""}" ${p.vigencia ? "" : "hidden"}>${p.vigencia ? (caducada(p.vigencia) ? "VIGENCIA CADUCADA" : "Vigencia vigente") : ""}</small>`) : sharedDateField(p, "vigencia", "Vigencia")}
 ${dateField(p, i, "proximaCita", "Próxima cita", `<small>Rellénela si la vigencia está caducada y ya tiene cita de renovación.</small>`)}
 <div><label>N.º de miembros</label><input value="${f.personas.length}" disabled></div>
 </div></div>`).join("")}
 <div class="actions"><button class="secondary" data-action="addPerson">${icon("add")} Añadir persona</button><button class="primary" data-action="back">Guardar y volver</button></div></div>`;
}

async function applyTransferredFamilies(data) {
  const restored = data.familias;
  const count = restored.reduce((sum, family) => sum + family.personas.length, 0);
  if (!confirm(`Se cargarán ${restored.length} familias y ${count} beneficiarios, sustituyendo los datos actuales de este ordenador. ¿Continuar?`)) return;
  normalizeTitulares(restored);
  setSaveState("Cargando datos y guardando…", "saving");
  await saveDB(restored);
  await saveReparto(data.reparto);
  reparto = alimentos.map((nombre,i)=>data.reparto[i] ?? {nombre,cantidad:""});
  familias = restored;
  siguienteFamilia = Math.max(0, ...familias.map(f => f.numero)) + 1;
  editando = null;
  vista = "listado";
  render();
  setSaveState(`Datos cargados: ${familias.length} familias.`, "saved");
}

async function restoreFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    await applyTransferredFamilies(await readBackup(file));
  } catch (error) {
    console.error(error);
    alert(`No se pudo cargar el archivo. ${error.message}`);
  } finally {
    event.target.value = "";
  }
}

async function transferOut() {
  const saved = await saveTransfer(familias, siguienteFamilia, reparto);
  if (!saved && !isTauri()) backup(familias, siguienteFamilia, reparto);
  else if (saved) alert("Archivo de traslado guardado. Llévelo al otro ordenador y use «Cargar datos en este ordenador».");
}
async function transferIn() {
  if (!isTauri()) return document.getElementById("restore").click();
  const imported = await loadTransfer();
  if (imported) await applyTransferredFamilies(imported);
}

async function importExcelFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const imported = await readExcel(file);
    const count = imported.reduce((sum, family) => sum + family.personas.length, 0);
    if (!confirm(`Se han encontrado ${imported.length} familias y ${count} beneficiarios. Se sustituirán los datos actuales de la aplicación. ¿Continuar?`)) return;
    normalizeTitulares(imported);
    setSaveState("Importando Excel y guardando…", "saving");
    await saveDB(imported);
    familias = imported;
    siguienteFamilia = Math.max(0, ...familias.map(f => f.numero)) + 1;
    editando = null;
    vista = "listado";
    render();
    setSaveState(`Importación completada: ${familias.length} familias guardadas.`, "saved");
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
const actions = {
  newFamily, back, removeFamily, addPerson,
  reload: () => location.reload(),
  section: target => {vista = target.dataset.view; render();},
  listMode: target => {modoListado=target.dataset.mode; renderListado();},
  openFamily: target => openFamily(target.dataset.id),
  removePerson: target => removePerson(Number(target.dataset.index)),
  backup: transferOut,
  exportExcel: async target => {
    target.disabled = true;
    target.textContent = "Generando Excel…";
    try {
      const generated = await exportExcel(familias, reparto);
      if (generated && isTauri()) alert("El Excel se guardó en la ubicación seleccionada y se abrió con el programa asociado a los archivos .xlsx.");
    }
    catch (error) {
      console.error(error);
      alert(`No se pudo generar el Excel. ${error.message}`);
    } finally {
      target.disabled = false;
      target.textContent = "Generar Excel";
    }
  },
  restore: transferIn,
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
app.addEventListener("input", async event => {
  const target = event.target;
  if (target.hasAttribute('data-food-name') || target.hasAttribute('data-food-amount')) {
    const index = Number(target.dataset.foodName ?? target.dataset.foodAmount);
    if (target.hasAttribute('data-food-name')) reparto[index].nombre=target.value;
    else {
      if (!target.validity.valid || (target.value !== '' && !Number.isFinite(Number(target.value)))) return;
      reparto[index].cantidad=target.value===''?'':Number(target.value);
      const r=resumen(familias), total=r.tamanos.reduce((n,c,i)=>n+c*(i+1),0);
      r.tamanos.forEach((n,j)=>app.querySelector(`[data-result="${index}:${j}"]`).textContent=envases(reparto[index].cantidad,j+1,n,total)??'—');
    }
    setSaveState('Guardando reparto…','saving');
    try {await saveReparto(reparto); setSaveState('Reparto guardado.');} catch(error) {reportError(error);}
    return;
  }
  if (target.hasAttribute("data-search")) return filterTable();
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
  try { await updatePerson(Number(target.dataset.index), target.dataset.field, target.value); }
  catch (error) { reportError(error); }
});
app.addEventListener("change", async event => {
  const target = event.target;
  if (target.hasAttribute("data-titular")) {
    try { await updateTitular(Number(target.dataset.index), target.checked); }
    catch (error) { reportError(error); }
    return;
  }
  if (target.hasAttribute("data-restore")) return restoreFile(event);
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
    const savedReparto = await loadReparto();
    reparto = alimentos.map((nombre,i)=>savedReparto[i] ?? {nombre,cantidad:""});
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
        : "Datos guardados en este navegador. Descarga copias JSON periódicamente.";
    }
  } catch (error) {
    console.error(error);
    const storageStatus = document.getElementById("storageState");
    const mode = isTauri() ? "aplicación de escritorio" : "navegador";
    if (storageStatus) storageStatus.textContent = `Falló la carga del almacenamiento (${mode}).`;
    const detail = error instanceof Error ? error.message : String(error);
    app.innerHTML = `<div class="card"><h2>No se pudieron cargar los datos</h2><p>La aplicación se está ejecutando en modo ${mode} y no ha podido abrir el almacenamiento local. Los datos existentes no se han borrado.</p><p class="notice">Detalle: ${esc(detail)}</p><p>${isTauri()
      ? "Cierra y vuelve a abrir la aplicación. Si sigue ocurriendo, copia aquí el detalle anterior para que podamos corregir la causa."
      : "Si querías abrir la aplicación de escritorio, cierra esta pestaña y ejecuta npm run tauri dev desde la carpeta del proyecto. Si querías usar el navegador, comprueba que lo abriste con npm run dev y que el almacenamiento del sitio está permitido."}</p><button class="secondary" data-action="reload">Reintentar</button></div>`;
  }
}
init();
