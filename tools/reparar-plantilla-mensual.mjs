// Reutiliza las fórmulas de exportación conservando las entradas de la plantilla.
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { buildMonthlyWorkbook } from '../src/excel-mensual.mjs';
import { crearMensual } from '../src/mensual.mjs';

globalThis.DOMParser = DOMParser;
globalThis.XMLSerializer = XMLSerializer;
const [ruta, copia] = process.argv.slice(2);
if (!ruta || !copia) throw new Error('Indica la plantilla y una ruta nueva de copia de seguridad.');
const bytes = await readFile(ruta), original = unzipSync(bytes);
const output = unzipSync(buildMonthlyWorkbook(bytes, crearMensual('1900-01', 'Plantilla')));
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const parse = bytes => new DOMParser().parseFromString(strFromU8(bytes), 'application/xml');
const inputs = [
  ['C2', 'G2', ...Array.from({ length: 10 }, (_, i) => `C${i + 4}`), ...Array.from({ length: 4 }, (_, i) => `E${i + 4}`)],
  Array.from({ length: 16 }, (_, i) => [`B${i + 15}`, `C${i + 15}`]).flat(),
];
for (let i = 0; i < inputs.length; i++) {
  const path = `xl/worksheets/sheet${i + 1}.xml`;
  const before = new Map(Array.from(parse(original[path]).getElementsByTagNameNS(NS, 'c'), c => [c.getAttribute('r'), c]));
  const doc = parse(output[path]);
  const after = new Map(Array.from(doc.getElementsByTagNameNS(NS, 'c'), c => [c.getAttribute('r'), c]));
  for (const ref of inputs[i]) {
    const cell = after.get(ref);
    if (!cell || !before.has(ref)) throw new Error(`Falta la entrada ${ref} en la plantilla.`);
    cell.parentNode.replaceChild(doc.importNode(before.get(ref), true), cell);
  }
  output[path] = strToU8(new XMLSerializer().serializeToString(doc));
}
await copyFile(ruta, copia, 1);
await writeFile(ruta, zipSync(output));
process.stdout.write('Fórmulas mensuales reparadas; entradas y estilos conservados.\n');
