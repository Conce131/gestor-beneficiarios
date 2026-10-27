import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";
import { MAX_REPARTO_FILAS, AVISO_RECUENTO_REPARTO } from "./reparto.mjs";
import { finMes, mesesTrimestre } from './actividad.mjs';
import { vigenciaAplicada } from './vigencia.mjs';

const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
// Mantiene el límite de las plantillas anteriores, compatibles con este exportador.
export const MAX_BENEFICIARIOS = 995;

function parse(bytes) {
  const doc = new DOMParser().parseFromString(strFromU8(bytes), "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("La plantilla Excel no es válida.");
  return doc;
}

function excelDate(value) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Hay una fecha inválida en los datos.");
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (y < 1900 || date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    throw new Error("Las fechas deben ser válidas y del año 1900 o posterior.");
  }
  const serial = (date.getTime() - Date.UTC(1899, 11, 30)) / 86400000;
  return serial < 61 ? serial - 1 : serial;
}

const nameParticles = new Set(["a", "da", "das", "de", "del", "do", "dos", "e", "la", "las", "los", "van", "von", "y"]);

function excelName(value) {
  let firstWord = true;
  return String(value ?? "").trim().toLocaleLowerCase("es-ES").split(/([\s'-]+)/u).map(part => {
    if (/^[\s'-]+$/u.test(part)) return part;
    const initial = firstWord;
    firstWord = false;
    if (!initial && nameParticles.has(part)) return part;
    return part.replace(/^\p{L}/u, letter => letter.toLocaleUpperCase("es-ES"));
  }).join("");
}

export function buildWorkbook(templateBytes, familias, reparto, opciones = {}) {
  const total = familias.reduce((sum, family) => sum + family.personas.length, 0);
  if (total > MAX_BENEFICIARIOS) {
    throw new Error(`La plantilla actual admite exportar hasta ${MAX_BENEFICIARIOS} beneficiarios. Hay ${total}.`);
  }
  const files = unzipSync(new Uint8Array(templateBytes));
  const sheet = parse(files["xl/worksheets/sheet1.xml"]);
  const cells = new Map(Array.from(sheet.getElementsByTagNameNS(NS, "c"), cell => [cell.getAttribute("r"), cell]));
  const sharedStrings = files['xl/sharedStrings.xml']
    ? Array.from(parse(files['xl/sharedStrings.xml']).getElementsByTagNameNS(NS, 'si'), si => si.textContent)
    : [];
  const originHeader = cells.get('M1');
  const originLabel = originHeader?.getAttribute('t') === 's'
    ? sharedStrings[Number(originHeader.textContent)] : originHeader?.textContent;
  const tieneOrigen = originLabel?.toLocaleLowerCase('es').startsWith('servicios sociales');

  function write(ref, value, text = false) {
    let cell = cells.get(ref);
    if (!cell) {
      const rowNumber = ref.match(/\d+$/)[0];
      const row = Array.from(sheet.getElementsByTagNameNS(NS, 'row')).find(r => r.getAttribute('r') === rowNumber);
      if (!row) throw new Error(`Falta la fila ${rowNumber} en la plantilla.`);
      cell = sheet.createElementNS(NS, 'c');
      cell.setAttribute('r', ref);
      const letters = ref.replace(/\d+$/, '');
      const column = [...letters].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
      const style = Array.from(sheet.getElementsByTagNameNS(NS, 'col')).find(c => Number(c.getAttribute('min')) <= column && Number(c.getAttribute('max')) >= column)?.getAttribute('style');
      if (style) cell.setAttribute('s', style);
      const next = Array.from(row.childNodes).find(c => c.nodeType === 1 &&
        (c.getAttribute('r').replace(/\d+$/, '').length > letters.length ||
        (c.getAttribute('r').replace(/\d+$/, '').length === letters.length && c.getAttribute('r').replace(/\d+$/, '') > letters)));
      row.insertBefore(cell, next ?? null);
      cells.set(ref, cell);
    }
    // Conserva los atributos de estilo; modifica únicamente el contenido.
    while (cell.firstChild) cell.removeChild(cell.firstChild);
    cell.removeAttribute("t");
    if (value === null || value === "") return;
    const element = sheet.createElementNS(NS, text ? "is" : "v");
    if (text) {
      cell.setAttribute("t", "inlineStr");
      const node = sheet.createElementNS(NS, "t");
      node.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
      node.textContent = String(value);
      element.appendChild(node);
    } else {
      element.textContent = String(value);
    }
    cell.appendChild(element);
  }

  let row = 2, beneficiary = 1;
  for (const family of [...familias].sort((a, b) => a.numero - b.numero)) {
    for (const [index, person] of family.personas.entries()) {
      write(`A${row}`, index === 0 ? family.numero : null);
      write(`B${row}`, beneficiary++);
      write(`C${row}`, person.menor && !String(person.nombre ?? "").trim() ? "MENOR" : excelName(person.nombre), true);
      write(`D${row}`, excelName(person.apellidos), true);
      write(`E${row}`, String(person.documento ?? "").trim().toLocaleUpperCase("es-ES"), true);
      for (const [column, field] of [["F", "nacimiento"], ["H", "derivacion"], ["I", "vigencia"], ["L", "proximaCita"]]) {
        const value = field === 'vigencia' && !tieneOrigen ? vigenciaAplicada(person) : person[field];
        write(`${column}${row}`, excelDate(value));
      }
      if (tieneOrigen) {
        write(`M${row}`, index === 0 ? (person.serviciosSociales === false ? 'No' : 'Sí') : '', true);
        write(`P${row}`, index > 0 && person.menor ? 'Sí' : '', true);
      }
      // G, J y K mantienen las fórmulas oficiales, también en filas vacías.
      row++;
    }
  }
  const workbook = parse(files["xl/workbook.xml"]);
  // La plantilla trae un nodo workbookProtection vacío. Excel puede interpretarlo
  // como un libro marcado como protegido aunque no defina ninguna protección.
  for (const protection of Array.from(workbook.getElementsByTagNameNS(NS, "workbookProtection"))) {
    protection.parentNode.removeChild(protection);
  }
  const calc = workbook.getElementsByTagNameNS(NS, "calcPr")[0];
  calc.setAttribute("calcMode", "auto");
  calc.setAttribute("fullCalcOnLoad", "1");
  calc.setAttribute("forceFullCalc", "1");
  const serializer = new XMLSerializer();
  files["xl/worksheets/sheet1.xml"] = strToU8(serializer.serializeToString(sheet));
  if (files['xl/worksheets/sheet2.xml'] && (reparto || tieneOrigen)) {
    const repartoSheet = parse(files['xl/worksheets/sheet2.xml']);
    const repartoCells = new Map(Array.from(repartoSheet.getElementsByTagNameNS(NS,'c'), c=>[c.getAttribute('r'),c]));
    for (let i = 0; reparto && i < MAX_REPARTO_FILAS; i++) {
      const alimento = reparto[i] ?? { nombre: "", cantidad: "" };
      for (const [column, value] of [['B',alimento.nombre],['C',alimento.cantidad]]) {
        const ref = `${column}${15+i}`;
        const cell = repartoCells.get(ref);
        if (!cell) throw new Error(`Falta la celda ${ref} en Reparto.`);
        while (cell.firstChild) cell.removeChild(cell.firstChild);
        cell.removeAttribute('t');
        if (value === '') continue;
        if (column === 'B') {
          cell.setAttribute('t','inlineStr');
          const inline=repartoSheet.createElementNS(NS,'is'), text=repartoSheet.createElementNS(NS,'t');
          text.textContent=value; inline.appendChild(text); cell.appendChild(inline);
        } else {
          const node=repartoSheet.createElementNS(NS,'v'); node.textContent=String(value); cell.appendChild(node);
        }
      }
    }
    if (tieneOrigen) {
      // Reparto y Resumen comparten los miembros incluidos, también tras editar el Excel.
      for (const [index, col] of [...'DEFGHIJKLM'].entries()) {
        const cell = repartoCells.get(`${col}13`);
        const f = cell.getElementsByTagNameNS(NS, 'f')[0];
        f.textContent = `COUNTIFS(Resumen!$S$2:$S$2999,"<>",Resumen!$R$2:$R$2999,${index + 1})`;
        for (const v of Array.from(cell.getElementsByTagNameNS(NS, 'v'))) v.textContent = '';
      }
      // La fila 11 está libre en la plantilla 2.0, entre el título y los totales.
      const notice = repartoCells.get('B11');
      while (notice.firstChild) notice.removeChild(notice.firstChild);
      notice.setAttribute('t', 'inlineStr');
      const inline = repartoSheet.createElementNS(NS, 'is');
      const text = repartoSheet.createElementNS(NS, 't');
      text.textContent = AVISO_RECUENTO_REPARTO;
      inline.appendChild(text);
      notice.appendChild(inline);
      const noticeRow = notice.parentNode;
      noticeRow.setAttribute('ht', '60');
      noticeRow.setAttribute('customHeight', '1');
      const merges = repartoSheet.getElementsByTagNameNS(NS, 'mergeCells')[0];
      if (!Array.from(merges.getElementsByTagNameNS(NS, 'mergeCell')).some(c => c.getAttribute('ref') === 'B11:M11')) {
        const merge = repartoSheet.createElementNS(NS, 'mergeCell');
        merge.setAttribute('ref', 'B11:M11');
        merges.appendChild(merge);
      }
      merges.setAttribute('count', String(merges.getElementsByTagNameNS(NS, 'mergeCell').length));
      const styles = parse(files['xl/styles.xml']);
      const xfs = styles.getElementsByTagNameNS(NS, 'cellXfs')[0];
      const xf = xfs.getElementsByTagNameNS(NS, 'xf')[Number(notice.getAttribute('s'))].cloneNode(true);
      const alignment = xf.getElementsByTagNameNS(NS, 'alignment')[0] ?? styles.createElementNS(NS, 'alignment');
      alignment.setAttribute('wrapText', '1');
      alignment.setAttribute('vertical', 'center');
      if (!alignment.parentNode) xf.appendChild(alignment);
      xf.setAttribute('applyAlignment', '1');
      notice.setAttribute('s', String(xfs.getElementsByTagNameNS(NS, 'xf').length));
      xfs.appendChild(xf);
      xfs.setAttribute('count', String(xfs.getElementsByTagNameNS(NS, 'xf').length));
      files['xl/styles.xml'] = strToU8(serializer.serializeToString(styles));
    }
    files['xl/worksheets/sheet2.xml']=strToU8(serializer.serializeToString(repartoSheet));
  }
  files["xl/workbook.xml"] = strToU8(serializer.serializeToString(workbook));
  if (tieneOrigen) {
    // Evita mostrar resultados guardados de otra sesión antes del recálculo.
    for (const path of ['xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml', 'xl/worksheets/sheet3.xml']) {
      if (!files[path]) continue;
      const doc = parse(files[path]);
      for (const cell of Array.from(doc.getElementsByTagNameNS(NS, 'c'))) {
        if (!cell.getElementsByTagNameNS(NS, 'f').length) continue;
        for (const value of Array.from(cell.getElementsByTagNameNS(NS, 'v'))) value.textContent = '';
      }
      files[path] = strToU8(serializer.serializeToString(doc));
    }
    delete files['xl/calcChain.xml'];
    for (const [path, tag, attr] of [['xl/_rels/workbook.xml.rels', 'Relationship', 'Target'], ['[Content_Types].xml', 'Override', 'PartName']]) {
      if (!files[path]) continue;
      const doc = parse(files[path]);
      for (const entry of Array.from(doc.getElementsByTagName(tag))) {
        if (entry.getAttribute(attr).includes('calcChain')) entry.parentNode.removeChild(entry);
      }
      files[path] = strToU8(serializer.serializeToString(doc));
    }
  }
  if (opciones.trimestre) {
    const fecha = finMes(mesesTrimestre(opciones.trimestre)[2]);
    const fechaExcel = excelDate(fecha);
    // Es una fotografía trimestral: las bajas o la fecha de apertura del Excel
    // no deben excluir familias que participaron antes dentro del trimestre.
    for (const path of ['xl/worksheets/sheet1.xml', 'xl/worksheets/sheet3.xml']) {
      if (!files[path]) continue;
      const doc = parse(files[path]);
      for (const cell of Array.from(doc.getElementsByTagNameNS(NS, 'c'))) {
        for (const formula of Array.from(cell.getElementsByTagNameNS(NS, 'f'))) {
          formula.textContent = formula.textContent.replace(/TODAY\(\)/g, String(fechaExcel));
          if (path.endsWith('sheet3.xml') && /^Q\d+$/.test(cell.getAttribute('r'))) {
            const fila = cell.getAttribute('r').slice(1);
            for (const attr of ['t', 'ref', 'si']) formula.removeAttribute(attr);
            formula.textContent = `IF(N${fila}="",0,1)`;
          }
        }
      }
      for (const tag of ['formula', 'formula1', 'formula2']) {
        for (const formula of Array.from(doc.getElementsByTagNameNS(NS, tag))) formula.textContent = formula.textContent.replace(/TODAY\(\)/g, String(fechaExcel));
      }
      files[path] = strToU8(serializer.serializeToString(doc));
    }
  }
  return zipSync(files);
}
