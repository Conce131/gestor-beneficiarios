import { unzipSync, strFromU8 } from "fflate";

const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PKG_NS = "http://schemas.openxmlformats.org/package/2006/relationships";

function parse(bytes) {
  const doc = new DOMParser().parseFromString(strFromU8(bytes), "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("El Excel está dañado o no tiene un formato compatible.");
  return doc;
}

function columnIndex(reference) {
  const letters = /^([A-Z]+)/.exec(reference)?.[1];
  if (!letters) return -1;
  return [...letters].reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

export function parseExcelDate(value, date1904 = false) {
  const text = String(value ?? '').trim().replace(/^['’]\s*/, '').trim().replace(/\/{2,}/g, '/');
  if (!text) return '';
  const written = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (written) {
    const [, dayText, monthText, yearText] = written;
    const day = Number(dayText), month = Number(monthText), year = Number(yearText);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (year < 1900 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return `${yearText}-${monthText.padStart(2, '0')}-${dayText.padStart(2, '0')}`;
  }
  if (!/^\d+(?:\.\d+)?$/.test(text)) return null;
  const serial = Number(text);
  if (!Number.isFinite(serial) || serial < 0 || serial > (date1904 ? 2957003 : 2958465)) return null;
  if (!date1904 && serial === 0) return '';
  // Excel incluye el inexistente 29/02/1900 en su calendario histórico.
  if (!date1904 && Math.floor(serial) === 60) return null;
  const epoch = date1904 ? Date.UTC(1904, 0, 1)
    : serial >= 60 ? Date.UTC(1899, 11, 30) : Date.UTC(1899, 11, 31);
  const date = new Date(epoch + Math.floor(serial) * 86400000);
  return date.toISOString().slice(0, 10);
}

function cellValue(cell, sharedStrings) {
  const type = cell.getAttribute("t");
  if (type === "inlineStr") return Array.from(cell.getElementsByTagNameNS(NS, "t"), t => t.textContent).join('');
  const raw = cell.getElementsByTagNameNS(NS, "v").item(0)?.textContent ?? "";
  if (type === "s") return sharedStrings[Number(raw)] ?? "";
  if (type === "str" || type === "e") return raw;
  return raw;
}

export function importWorkbook(bytes) {
  let files;
  try { files = unzipSync(new Uint8Array(bytes)); }
  catch { throw new Error("No se pudo abrir el Excel. Selecciona un archivo .xlsx válido."); }
  const workbookBytes = files["xl/workbook.xml"];
  const relBytes = files["xl/_rels/workbook.xml.rels"];
  if (!workbookBytes || !relBytes) throw new Error("Selecciona un Excel compatible con la plantilla oficial.");
  const workbook = parse(workbookBytes);
  const date1904 = ['1', 'true'].includes(workbook.getElementsByTagNameNS(NS, 'workbookPr')[0]?.getAttribute('date1904'));
  const relationships = parse(relBytes);
  const sheet = Array.from(workbook.getElementsByTagNameNS(NS, "sheet"))
    .find(item => item.getAttribute("name") === "Listado");
  if (!sheet) throw new Error("El Excel no contiene una hoja llamada Listado.");
  const relId = sheet.getAttributeNS(REL_NS, "id");
  const relation = Array.from(relationships.getElementsByTagNameNS(PKG_NS, "Relationship"))
    .find(item => item.getAttribute("Id") === relId);
  if (!relation || relation.getAttribute('TargetMode') === 'External') throw new Error("La hoja Listado no tiene una ruta válida.");
  const target = relation.getAttribute("Target");
  const parts = [];
  for (const part of (target.startsWith('/') || target.startsWith('xl/') ? target : `xl/${target}`).split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!parts.length) throw new Error('La hoja Listado no tiene una ruta válida.');
      parts.pop();
    } else parts.push(part);
  }
  const sheetPath = parts.join('/');
  if (!files[sheetPath]) throw new Error("No se pudo leer la hoja Listado.");
  const sharedDoc = files["xl/sharedStrings.xml"] ? parse(files["xl/sharedStrings.xml"]) : null;
  const sharedStrings = sharedDoc
    ? Array.from(sharedDoc.getElementsByTagNameNS(NS, "si"), item => Array.from(item.getElementsByTagNameNS(NS, "t"), t => t.textContent).join(""))
    : [];
  const doc = parse(files[sheetPath]);
  const rows = Array.from(doc.getElementsByTagNameNS(NS, "row"));
  const header = rows.find(row => row.getAttribute("r") === "1");
  const headerCells = new Map(Array.from(header?.getElementsByTagNameNS(NS, "c") ?? [], cell => [cell.getAttribute("r").replace(/\d+$/, ""), cellValue(cell, sharedStrings).trim().toLowerCase()]));
  const expected = { A: "n.º de familias", B: "n.º de beneficiarios/as", C: "nombre", D: "apellidos", E: "documento" };
  if (Object.entries(expected).some(([column, label]) => headerCells.get(column) !== label)) {
    throw new Error("Las columnas no coinciden con la plantilla oficial. No se ha importado ningún dato.");
  }

  const families = [];
  const issues = [];
  const warnings = [];
  let current = null;
  let familiaOmitida = '';
  const seenNumbers = new Set();
  for (const row of rows) {
    const rowNumber = Number(row.getAttribute("r"));
    if (rowNumber < 2) continue;
    const values = new Map(Array.from(row.getElementsByTagNameNS(NS, "c"), cell => [columnIndex(cell.getAttribute("r")), cellValue(cell, sharedStrings)]));
    const numberValue = values.get(0)?.trim();
    const referencia = { familia: numberValue || current?.numero || familiaOmitida, nombre: values.get(2)?.trim() ?? '', apellidos: values.get(3)?.trim() ?? '' };
    const hasData = [1, 2, 3, 4, 5, 7, 8, 11].some(index => values.get(index)?.trim())
      || ['sí', 'si'].includes(values.get(15)?.trim().toLocaleLowerCase('es'));
    if (!hasData && !numberValue) continue;
    if (numberValue) {
      current = null;
      familiaOmitida = numberValue;
      const number = Number(numberValue);
      if (!Number.isSafeInteger(number) || number < 1 || seenNumbers.has(number)) {
        issues.push({ ...referencia, row: rowNumber, reason: `número de familia «${numberValue}» no válido o repetido` });
        continue;
      }
      seenNumbers.add(number);
      if (!hasData) {
        issues.push({ ...referencia, row: rowNumber, reason: 'faltan los datos de la persona titular' });
        continue;
      }
      current = { id: crypto.randomUUID(), numero: number, personas: [] };
      families.push(current);
      familiaOmitida = '';
    } else if (!current) {
      issues.push({ ...referencia, row: rowNumber, reason: familiaOmitida ? 'no se puede importar el miembro porque su titular no es válido' : 'falta el número de familia' });
      continue;
    }
    const birth = values.get(5)?.trim() ?? "";
    const referral = values.get(7)?.trim() ?? "";
    const expiry = values.get(8)?.trim() ?? "";
    let appointment = values.get(11)?.trim() ?? "";
    if (appointment.toLocaleUpperCase('es') === 'REVISAR') {
      warnings.push({ ...referencia, row: rowNumber, reason: 'la celda Próxima Cita contiene «REVISAR»; se dejó vacía' });
      appointment = '';
    }
    const parsedDates = [birth, referral, expiry, appointment].map(value => parseExcelDate(value, date1904));
    const invalidDate = parsedDates.some((value, index) => [birth, referral, expiry, appointment][index] && value === null);
    const nombre = values.get(2)?.trim() ?? "";
    const apellidos = values.get(3)?.trim() ?? "";
    const documento = values.get(4)?.trim() ?? "";
    if (invalidDate) {
      issues.push({ ...referencia, row: rowNumber, reason: "contiene una fecha no válida" });
      if (!current.personas.length) { familiaOmitida = current.numero; current = null; }
      continue;
    }
    const birthDate = parsedDates[0] || '';
    const minor = Boolean(current.personas.length) && (esMenor(birthDate)
      || (!birthDate && nombre.toLocaleUpperCase('es') === 'MENOR')
      || ['sí', 'si'].includes(values.get(15)?.trim().toLocaleLowerCase('es')));
    const nombreGuardado = minor && nombre.toLocaleUpperCase('es') === 'MENOR' ? '' : nombre;
    const missing = [!nombre && !minor && "nombre", !apellidos && !minor && "apellidos", !documento && !current.personas.length && "documento"].filter(Boolean);
    if (missing.length) {
      issues.push({ ...referencia, row: rowNumber, reason: `falta ${missing.join(", ")}` });
      if (!current.personas.length) { familiaOmitida = current.numero; current = null; }
      continue;
    }
    const person = {
      id: crypto.randomUUID(),
      titular: current.personas.length === 0,
      menor: minor,
      nombre: nombreGuardado,
      apellidos,
      documento,
      nacimiento: birthDate,
      derivacion: parsedDates[1] || "",
      vigencia: parsedDates[2] || "",
      proximaCita: parsedDates[3] || "",
    };
    const servicesHeader = headerCells.get('M') ?? '';
    if (servicesHeader.startsWith('no procede de servicios sociales')) {
      // Libros 1.8/1.9 guardaban «Sí» para indicar que NO procedía.
      person.serviciosSociales = person.titular
        ? !['sí', 'si'].includes(values.get(12)?.trim().toLocaleLowerCase('es'))
        : Boolean(current.personas[0]?.serviciosSociales);
    } else if (servicesHeader.startsWith('servicios sociales')) {
      person.serviciosSociales = person.titular
        ? values.get(12)?.trim().toLocaleLowerCase('es') !== 'no'
        : Boolean(current.personas[0]?.serviciosSociales);
    } else {
      person.serviciosSociales = true;
    }
    person.serviciosSocialesConfigurado = true;
    current.personas.push(person);
  }
  const validFamilies = families.filter(family => family.personas.length);
  if (!validFamilies.length) {
    const detail = issues.length ? ` Filas revisadas: ${issues.map(issue => `${issue.row} (${issue.reason})`).join("; ")}.` : "";
    throw new Error(`No se encontraron beneficiarios válidos en la hoja Listado.${detail}`);
  }
  Object.defineProperty(validFamilies, "issues", { value: issues });
  Object.defineProperty(validFamilies, "warnings", { value: warnings });
  return validFamilies;
}

function esMenor(value, hoy = new Date()) {
  if (!value) return false;
  const nacimiento = new Date(`${value}T00:00:00`);
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  if (hoy.getMonth() < nacimiento.getMonth() || (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate())) edad--;
  return edad >= 0 && edad < 18;
}
