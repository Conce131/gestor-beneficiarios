import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";
import { MAX_REPARTO_FILAS } from "./reparto.mjs";

const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
// La primera fórmula de miembros con referencias invertidas está en K997.
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

export function buildWorkbook(templateBytes, familias, reparto) {
  const total = familias.reduce((sum, family) => sum + family.personas.length, 0);
  if (total > MAX_BENEFICIARIOS) {
    throw new Error(`La plantilla actual admite exportar hasta ${MAX_BENEFICIARIOS} beneficiarios. Hay ${total}.`);
  }
  const files = unzipSync(new Uint8Array(templateBytes));
  const sheet = parse(files["xl/worksheets/sheet1.xml"]);
  const cells = new Map(Array.from(sheet.getElementsByTagNameNS(NS, "c"), cell => [cell.getAttribute("r"), cell]));

  function write(ref, value, text = false) {
    const cell = cells.get(ref);
    if (!cell) throw new Error(`Falta la celda ${ref} en la plantilla.`);
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
      for (const [column, field] of [["F", "nacimiento"], ["H", "derivacion"], ["I", "vigencia"], ...(person.titular ? [["L", "proximaCita"]] : [])]) {
        write(`${column}${row}`, excelDate(person[field]));
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
  if (reparto) {
    const repartoSheet = parse(files['xl/worksheets/sheet2.xml']);
    const repartoCells = new Map(Array.from(repartoSheet.getElementsByTagNameNS(NS,'c'), c=>[c.getAttribute('r'),c]));
    for (let i = 0; i < MAX_REPARTO_FILAS; i++) {
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
    files['xl/worksheets/sheet2.xml']=strToU8(serializer.serializeToString(repartoSheet));
  }
  files["xl/workbook.xml"] = strToU8(serializer.serializeToString(workbook));
  return zipSync(files);
}
