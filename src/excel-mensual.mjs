import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { validarMensual, erroresExportacionMensual, resumenMensual, nombreMes } from './mensual.mjs';
import { MAX_REPARTO_FILAS, envases } from './reparto.mjs';

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const parse = bytes => new DOMParser().parseFromString(strFromU8(bytes), 'application/xml');
const columnNumber = letters => [...letters].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
function primerDiaExcel(mes) {
  const [ano, mesNumero] = mes.split('-').map(Number);
  const serial = (Date.UTC(ano, mesNumero - 1, 1) - Date.UTC(1899, 11, 30)) / 86400000;
  return serial < 61 ? serial - 1 : serial;
}

function editorHoja(doc) {
  const cells = new Map(Array.from(doc.getElementsByTagNameNS(NS, 'c'), c => [c.getAttribute('r'), c]));
  return (ref, valor, formula = null) => {
    let cell = cells.get(ref);
    if (!cell) {
      const row = Array.from(doc.getElementsByTagNameNS(NS, 'row')).find(r => r.getAttribute('r') === ref.match(/\d+$/)[0]);
      if (!row) throw new Error(`Falta la fila de ${ref} en la plantilla mensual.`);
      cell = doc.createElementNS(NS, 'c');
      cell.setAttribute('r', ref);
      const column = columnNumber(ref.replace(/\d+$/, ''));
      const next = Array.from(row.getElementsByTagNameNS(NS, 'c')).find(c => columnNumber(c.getAttribute('r').replace(/\d+$/, '')) > column);
      row.insertBefore(cell, next ?? null);
      cells.set(ref, cell);
    }
    while (cell.firstChild) cell.removeChild(cell.firstChild);
    cell.removeAttribute('t');
    if (formula !== null) {
      const f = doc.createElementNS(NS, 'f');
      f.textContent = formula;
      cell.appendChild(f);
      if (typeof valor === 'string') cell.setAttribute('t', 'str');
    }
    if (formula === null && valor === '') return;
    const texto = formula === null && typeof valor === 'string';
    const node = doc.createElementNS(NS, texto ? 'is' : 'v');
    if (texto) {
      cell.setAttribute('t', 'inlineStr');
      const t = doc.createElementNS(NS, 't');
      t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
      t.textContent = valor;
      node.appendChild(t);
    } else node.textContent = String(valor);
    cell.appendChild(node);
  };
}

export function buildMonthlyWorkbook(templateBytes, datos) {
  datos = validarMensual(datos);
  const errores = erroresExportacionMensual(datos);
  if (errores.length) throw new Error(errores.join(' '));
  const files = unzipSync(new Uint8Array(templateBytes));
  const workbook = parse(files['xl/workbook.xml']);
  const sheets = Array.from(workbook.getElementsByTagNameNS(NS, 'sheet'), s => s.getAttribute('name'));
  if (sheets.join('|') !== 'Resumen mensual|Reparto') throw new Error('La plantilla no corresponde al modelo mensual actual.');
  const resumen = parse(files['xl/worksheets/sheet1.xml']);
  const reparto = parse(files['xl/worksheets/sheet2.xml']);
  const write = editorHoja(resumen), food = editorHoja(reparto), r = resumenMensual(datos);
  write('C2', datos.entidad.trim());
  write('G2', primerDiaExcel(datos.mes));
  datos.tamanos.forEach((n, i) => write(`C${4 + i}`, n));
  datos.edades.forEach((n, i) => write(`E${4 + i}`, n));
  write('F4', r.familias, 'SUM(C4:C13)');
  write('G4', r.personas, 'SUMPRODUCT(B4:B13,C4:C13)');
  write('E8', r.porEdad, 'SUM(E4:E7)');
  const formulaControl = 'IF(G4=E8,"Recuento correcto: los totales coinciden.","Revisa los recuentos: los totales no coinciden.")';
  write('D9', 'Recuento correcto: los totales coinciden.', formulaControl);
  food('B10', `Cantd/Familias:  ${r.familias}`, '"Cantd/Familias:  "&SUM(D13:M13)');
  for (const [i, col] of [...'DEFGHIJKLM'].entries()) {
    food(`${col}13`, datos.tamanos[i], `'Resumen mensual'!$C$${4 + i}`);
    food(`${col}12`, datos.tamanos[i] * (i + 1), `${col}13*${i + 1}`);
  }
  food('N12', r.personas, 'SUM(D12:M12)');
  food('N13', r.familias, 'SUM(D13:M13)');
  for (let i = 0; i < MAX_REPARTO_FILAS; i++) {
    const fila = 15 + i, a = datos.reparto[i] ?? { nombre: '', cantidad: '' };
    food(`B${fila}`, a.nombre);
    food(`C${fila}`, a.cantidad);
    // El modelo recibido contiene #REF! y un control de tres edades. Se
    // reconstruyen las fórmulas con los cuatro grupos, incluido menor sin edad.
    const listo = `AND('Resumen mensual'!$E$8=$N$12,$N$12>0)`;
    food(`N${fila}`, r.puedeRepartir && a.cantidad !== '' ? Number(a.cantidad) / r.personas : '', `IFERROR(IF($C${fila}="","",IF(${listo},$C${fila}/$N$12,"")),"")`);
    for (const [j, col] of [...'DEFGHIJKLM'].entries()) {
      const cantidad = r.puedeRepartir ? envases(a.cantidad, j + 1, datos.tamanos[j], r.personas) : null;
      food(`${col}${fila}`, cantidad ?? '', `IFERROR(IF(OR(${col}$13=0,$N${fila}=""),"",ROUND($N${fila}*${j + 1},0)),"")`);
    }
  }
  // Las celdas calculadas conservan valores coherentes para visores sin motor
  // de cálculo. Excel vuelve a calcularlos si se editan las entradas.
  let calc = workbook.getElementsByTagNameNS(NS, 'calcPr')[0];
  if (!calc) { calc = workbook.createElementNS(NS, 'calcPr'); workbook.documentElement.appendChild(calc); }
  for (const [attr, value] of [['calcMode', 'auto'], ['fullCalcOnLoad', '1'], ['forceFullCalc', '1']]) calc.setAttribute(attr, value);
  const serializer = new XMLSerializer();
  for (const [path, doc] of [['xl/workbook.xml', workbook], ['xl/worksheets/sheet1.xml', resumen], ['xl/worksheets/sheet2.xml', reparto]]) {
    files[path] = strToU8(serializer.serializeToString(doc));
  }
  delete files['xl/calcChain.xml'];
  for (const [path, tag, attr] of [['xl/_rels/workbook.xml.rels', 'Relationship', 'Target'], ['[Content_Types].xml', 'Override', 'PartName']]) {
    const doc = parse(files[path]);
    for (const entry of Array.from(doc.getElementsByTagName(tag))) {
      if (entry.getAttribute(attr).includes('calcChain')) entry.parentNode.removeChild(entry);
    }
    files[path] = strToU8(serializer.serializeToString(doc));
  }
  return zipSync(files);
}
