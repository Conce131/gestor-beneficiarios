// Actualiza el recuento y las reglas de cita sin alterar los datos del listado.
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { buildWorkbook } from '../src/excel-workbook.mjs';

globalThis.DOMParser = DOMParser;
globalThis.XMLSerializer = XMLSerializer;
const ruta = process.argv[2];
const copia = process.argv[3];
if (!ruta || !copia) throw new Error('Indica la ruta de la plantilla y la ruta de su copia de seguridad.');
const bytes = await readFile(ruta);
const files = unzipSync(bytes);
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const doc = new DOMParser().parseFromString(strFromU8(files['xl/worksheets/sheet3.xml']), 'application/xml');
let actualizadas = 0;
for (const cell of Array.from(doc.getElementsByTagNameNS(NS, 'c'))) {
  const match = /^Q(\d+)$/.exec(cell.getAttribute('r'));
  if (!match || Number(match[1]) < 2 || Number(match[1]) > 2999) continue;
  const i = match[1];
  while (cell.firstChild) cell.removeChild(cell.firstChild);
  cell.removeAttribute('t');
  const formula = doc.createElementNS(NS, 'f');
  // La cita permite seguir la renovación; no condiciona el recuento.
  formula.textContent = `IFERROR(IF(AND(N${i}<>"",ISNUMBER(O${i}),O${i}>0,O${i}>=TODAY()-90),1,0),0)`;
  cell.appendChild(formula);
  cell.appendChild(doc.createElementNS(NS, 'v'));
  actualizadas++;
}
if (actualizadas !== 2998) throw new Error(`Se esperaban 2998 filas auxiliares; se encontraron ${actualizadas}.`);
// P conserva los avisos de citas inválidas, admitiendo citas previas al vencimiento.
for (const formula of Array.from(doc.getElementsByTagNameNS(NS, 'f'))) {
  formula.textContent = formula.textContent.replace(/,W(\d+)>O\1/g, '');
}
const listado = new DOMParser().parseFromString(strFromU8(files['xl/worksheets/sheet1.xml']), 'application/xml');
// Cuenta personas reales del grupo, sin sumar huecos ni depender de la fila 996.
for (const cell of Array.from(listado.getElementsByTagNameNS(NS, 'c'))) {
  const match = /^K(\d+)$/.exec(cell.getAttribute('r'));
  if (!match || Number(match[1]) < 2 || Number(match[1]) > 2999) continue;
  while (cell.firstChild) cell.removeChild(cell.firstChild);
  cell.removeAttribute('t');
  const formula = listado.createElementNS(NS, 'f');
  formula.textContent = `IF(A${match[1]}="","",COUNTIFS(Resumen!$N$2:$N$2999,ROW(),Resumen!$V$2:$V$2999,1))`;
  cell.appendChild(formula);
  cell.appendChild(listado.createElementNS(NS, 'v'));
}
for (const validation of Array.from(listado.getElementsByTagNameNS(NS, 'dataValidation'))) {
  const formula = validation.getElementsByTagNameNS(NS, 'formula1')[0];
  if (validation.getAttribute('type') === 'list' && formula?.textContent === '"Sí,No"') {
    validation.setAttribute('sqref', 'M2:M2999');
    validation.setAttribute('error', 'Selecciona Sí o No. El vacío equivale a Sí.');
  }
}
for (const formatting of Array.from(listado.getElementsByTagNameNS(NS, 'conditionalFormatting'))) {
  const range = formatting.getAttribute('sqref');
  for (const rule of Array.from(formatting.getElementsByTagNameNS(NS, 'cfRule'))) {
    const formula = rule.getElementsByTagNameNS(NS, 'formula')[0];
    if (!formula) continue;
    // Retira avisos de origen vacío (equivale a Sí) y reglas de I que miraban H.
    if ((range === 'M2:M2999' && formula.textContent === 'AND($A2<>"",$M2="")')
      || (/^I\d/.test(range) && /^AND\(\$A\d+<>"",\$H\d+=""\)$/.test(formula.textContent))) {
      rule.parentNode.removeChild(rule);
    } else if (range === 'I2:I2999' && formula.textContent === 'AND($A2<>"",$I2="")') {
      formula.textContent = 'AND($A2<>"",$M2<>"No",$I2="")';
    }
  }
  if (!formatting.getElementsByTagNameNS(NS, 'cfRule').length) formatting.parentNode.removeChild(formatting);
}
// Origen No: tres meses es un tope, nunca una ampliación de la vigencia indicada.
let vigenciasActualizadas = 0;
for (const cell of Array.from(listado.getElementsByTagNameNS(NS, 'c'))) {
  const match = /^N(\d+)$/.exec(cell.getAttribute('r'));
  if (!match || Number(match[1]) < 2 || Number(match[1]) > 2999) continue;
  const titular = `INDEX(Resumen!$N:$N,ROW())`;
  const origen = `INDEX($M:$M,${titular})`;
  const derivacion = `INDEX($H:$H,${titular})`;
  const manual = `INDEX($I:$I,${titular})`;
  const limite = `EDATE(${derivacion},3)`;
  const formula = `IFERROR(IF(OR(${titular}="",${origen}<>"No"),"",IF(AND(ISNUMBER(${derivacion}),${derivacion}>0),IF(${manual}=0,${limite},IF(AND(ISNUMBER(${manual}),${manual}>0),MIN(${manual},${limite}),"")),"")),"")`;
  while (cell.firstChild) cell.removeChild(cell.firstChild);
  cell.removeAttribute('t');
  const f = listado.createElementNS(NS, 'f');
  f.textContent = formula;
  cell.appendChild(f);
  cell.appendChild(listado.createElementNS(NS, 'v'));
  vigenciasActualizadas++;
}
if (vigenciasActualizadas !== 2998) throw new Error('No se han actualizado todas las vigencias aplicadas.');
for (const formula of Array.from(listado.getElementsByTagNameNS(NS, 'formula1'))) {
  if (!formula.textContent.includes('L2>INDEX(VigenciasFamilia,ROW())')) continue;
  formula.textContent = formula.textContent.replace(',L2>INDEX(VigenciasFamilia,ROW())', '');
  formula.parentNode.setAttribute('error', 'La cita debe ser de hoy o futura. Puede ser anterior al vencimiento y como máximo 90 días después de la vigencia.');
}
// Las fórmulas de resaltado también deben admitir citas antes de vencer.
for (const formula of Array.from(listado.getElementsByTagNameNS(NS, 'formula'))) {
  formula.textContent = formula.textContent.replace(',L2>INDEX(VigenciasFamilia,ROW())', '');
}
files['xl/worksheets/sheet1.xml'] = strToU8(new XMLSerializer().serializeToString(listado));
// Totales de control debajo del resumen: V identifica personas y Q las incluidas.
const summaryRows = new Map(Array.from(doc.getElementsByTagNameNS(NS, 'row'), row => [row.getAttribute('r'), row]));
function resumenCell(ref, style, value, formula = false) {
  const row = summaryRows.get(ref.match(/\d+$/)[0]);
  let cell = Array.from(row.getElementsByTagNameNS(NS, 'c')).find(c => c.getAttribute('r') === ref);
  if (!cell) {
    cell = doc.createElementNS(NS, 'c');
    cell.setAttribute('r', ref);
    // Las columnas nuevas B:G preceden a los auxiliares ocultos N:X.
    const next = Array.from(row.getElementsByTagNameNS(NS, 'c')).find(c => c.getAttribute('r').replace(/\d+$/, '') > ref.replace(/\d+$/, ''));
    row.insertBefore(cell, next ?? null);
  }
  while (cell.firstChild) cell.removeChild(cell.firstChild);
  cell.setAttribute('s', style);
  cell.removeAttribute('t');
  if (formula) {
    const f = doc.createElementNS(NS, 'f');
    f.textContent = value;
    cell.appendChild(f);
    cell.appendChild(doc.createElementNS(NS, 'v'));
  } else if (value) {
    cell.setAttribute('t', 'inlineStr');
    const inline = doc.createElementNS(NS, 'is');
    const text = doc.createElementNS(NS, 't');
    text.textContent = value;
    inline.appendChild(text);
    cell.appendChild(inline);
  }
}
for (const [row, height] of [['19', '30'], ['20', '24']]) {
  summaryRows.get(row).setAttribute('ht', height);
  summaryRows.get(row).setAttribute('customHeight', '1');
  summaryRows.get(row).setAttribute('spans', '2:24');
  for (const col of 'BCDEFG') resumenCell(`${col}${row}`, row === '19' ? '87' : '72', '');
}
resumenCell('B19', '87', 'Total de personas excluidas');
resumenCell('E19', '87', 'Total de personas incluidas y excluidas');
// X hereda el origen del titular. Sí o vacío equivale a Servicios sociales.
for (let i = 2; i <= 2999; i++) {
  resumenCell(`X${i}`, '17', `IF(N${i}="","",IF(INDEX(Listado!$M:$M,N${i})="No","No","Sí"))`, true);
  summaryRows.get(String(i)).setAttribute('spans', '2:24');
}
const cols = doc.getElementsByTagNameNS(NS, 'cols')[0];
if (!Array.from(cols.getElementsByTagNameNS(NS, 'col')).some(c => Number(c.getAttribute('min')) <= 24 && Number(c.getAttribute('max')) >= 24)) {
  const col = doc.createElementNS(NS, 'col');
  for (const [name, value] of Object.entries({ min: '24', max: '24', width: '12', hidden: '1', customWidth: '1' })) col.setAttribute(name, value);
  cols.appendChild(col);
}
doc.getElementsByTagNameNS(NS, 'dimension')[0].setAttribute('ref', 'A1:X2999');
resumenCell('B20', '72', 'SUM($V$2:$V$2999)-SUM($Q$2:$Q$2999)', true);
resumenCell('E20', '72', 'SUM($V$2:$V$2999)', true);
// Tabla independiente: cuenta todas las personas por origen, sin filtrar por vigencia.
for (const [row, height] of [['23', '24'], ['24', '30'], ['25', '24']]) {
  summaryRows.get(row).setAttribute('ht', height);
  summaryRows.get(row).setAttribute('customHeight', '1');
  summaryRows.get(row).setAttribute('spans', '2:24');
  for (const col of 'BCDEFG') resumenCell(`${col}${row}`, row === '25' ? '72' : '87', '');
}
resumenCell('B23', '86', 'PERSONAS POR ORIGEN — INCLUIDAS Y EXCLUIDAS');
resumenCell('B24', '87', 'Sí vienen de Servicios sociales');
resumenCell('E24', '87', 'No vienen de Servicios sociales');
resumenCell('B25', '72', 'SUMIF($X$2:$X$2999,"<>No",$V$2:$V$2999)', true);
resumenCell('E25', '72', 'SUMIF($X$2:$X$2999,"No",$V$2:$V$2999)', true);
const merges = doc.getElementsByTagNameNS(NS, 'mergeCells')[0];
for (const ref of ['B19:D19', 'E19:G19', 'B20:D20', 'E20:G20', 'B23:G23', 'B24:D24', 'E24:G24', 'B25:D25', 'E25:G25']) {
  if (Array.from(merges.getElementsByTagNameNS(NS, 'mergeCell')).some(c => c.getAttribute('ref') === ref)) continue;
  const merge = doc.createElementNS(NS, 'mergeCell');
  merge.setAttribute('ref', ref);
  merges.appendChild(merge);
}
merges.setAttribute('count', String(merges.getElementsByTagNameNS(NS, 'mergeCell').length));
files['xl/worksheets/sheet3.xml'] = strToU8(new XMLSerializer().serializeToString(doc));
// Usa el mismo aviso y los mismos filtros de Reparto que la exportación de la app.
const output = buildWorkbook(zipSync(files), []);
await copyFile(ruta, copia, 1); // No sobrescribir una copia de seguridad anterior.
await writeFile(ruta, output);
process.stdout.write(`Actualizadas ${actualizadas} filas y las tablas de Resumen.\n`);
