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

export function parseExcelDate(value) {
  const text = String(value ?? '').trim().replace(/^['’]\s*/, '').trim();
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
  if (!Number.isFinite(serial) || serial <= 0 || serial > 2958465) return null;
  // Excel incluye el inexistente 29/02/1900 en su calendario histórico.
  const epoch = serial >= 60 ? Date.UTC(1899, 11, 30) : Date.UTC(1899, 11, 31);
  const date = new Date(epoch + Math.floor(serial) * 86400000);
  return date.toISOString().slice(0, 10);
}

function cellValue(cell, sharedStrings) {
  const type = cell.getAttribute("t");
  if (type === "inlineStr") return cell.getElementsByTagNameNS(NS, "t").item(0)?.textContent ?? "";
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
  const relationships = parse(relBytes);
  const sheet = Array.from(workbook.getElementsByTagNameNS(NS, "sheet"))
    .find(item => item.getAttribute("name") === "Listado");
  if (!sheet) throw new Error("El Excel no contiene una hoja llamada Listado.");
  const relId = sheet.getAttributeNS(REL_NS, "id");
  const relation = Array.from(relationships.getElementsByTagNameNS(PKG_NS, "Relationship"))
    .find(item => item.getAttribute("Id") === relId);
  if (!relation || relation.getAttribute("Target").startsWith("/")) throw new Error("La hoja Listado no tiene una ruta válida.");
  const target = relation.getAttribute("Target");
  const sheetPath = target.startsWith("xl/") ? target : `xl/${target.replace(/^\.\//, "")}`;
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
  let current = null;
  const seenNumbers = new Set();
  for (const row of rows) {
    const rowNumber = Number(row.getAttribute("r"));
    if (rowNumber < 2) continue;
    const values = new Map(Array.from(row.getElementsByTagNameNS(NS, "c"), cell => [columnIndex(cell.getAttribute("r")), cellValue(cell, sharedStrings)]));
    const numberValue = values.get(0)?.trim();
    const referencia = { familia: numberValue || current?.numero || '', nombre: values.get(2)?.trim() ?? '', apellidos: values.get(3)?.trim() ?? '' };
    const hasData = [1, 2, 3, 4, 5, 7, 8, 11].some(index => values.get(index)?.trim());
    if (!hasData) continue;
    if (numberValue) {
      const number = Number(numberValue);
      if (!Number.isSafeInteger(number) || number < 1 || seenNumbers.has(number)) {
        issues.push({ ...referencia, row: rowNumber, reason: `número de familia «${numberValue}» no válido o repetido` });
        current = null;
        continue;
      }
      current = { id: crypto.randomUUID(), numero: number, personas: [] };
      families.push(current);
      seenNumbers.add(number);
    } else if (!current) {
      issues.push({ ...referencia, row: rowNumber, reason: "falta el número de familia" });
      continue;
    }
    const birth = values.get(5)?.trim() ?? "";
    const referral = values.get(7)?.trim() ?? "";
    const expiry = values.get(8)?.trim() ?? "";
    const appointment = values.get(11)?.trim() ?? "";
    const parsedDates = [birth, referral, expiry, appointment].map(parseExcelDate);
    const invalidDate = parsedDates.some((value, index) => [birth, referral, expiry, appointment][index] && value === null);
    const nombre = values.get(2)?.trim() ?? "";
    const apellidos = values.get(3)?.trim() ?? "";
    const documento = values.get(4)?.trim() ?? "";
    if (invalidDate) {
      issues.push({ ...referencia, row: rowNumber, reason: "contiene una fecha no válida" });
      continue;
    }
    const missing = [!nombre && "nombre", !apellidos && "apellidos", !documento && "documento"].filter(Boolean);
    if (missing.length) {
      issues.push({ ...referencia, row: rowNumber, reason: `falta ${missing.join(", ")}` });
      continue;
    }
    const person = {
      id: crypto.randomUUID(),
      titular: current.personas.length === 0,
      nombre,
      apellidos,
      documento,
      nacimiento: parsedDates[0] || "",
      derivacion: parsedDates[1] || "",
      vigencia: parsedDates[2] || "",
      proximaCita: parsedDates[3] || "",
    };
    current.personas.push(person);
  }
  const validFamilies = families.filter(family => family.personas.length);
  if (!validFamilies.length) {
    const detail = issues.length ? ` Filas revisadas: ${issues.map(issue => `${issue.row} (${issue.reason})`).join("; ")}.` : "";
    throw new Error(`No se encontraron beneficiarios válidos en la hoja Listado.${detail}`);
  }
  Object.defineProperty(validFamilies, "issues", { value: issues });
  return validFamilies;
}
