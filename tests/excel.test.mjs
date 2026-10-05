import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { unzipSync, strFromU8 } from "fflate";
import { buildWorkbook, MAX_BENEFICIARIOS } from "../src/excel-workbook.mjs";

globalThis.DOMParser = DOMParser;
globalThis.XMLSerializer = XMLSerializer;
const template = await readFile(new URL("../Modelo  listado v(1.4).xlsx", import.meta.url));
const original = unzipSync(template);
const person = { nombre: '=Texto ficticio & <prueba>', apellidos: 'Prueba', documento: '00123-FICTICIO', nacimiento: '2000-01-01', derivacion: '2026-10-05', vigencia: '2027-04-05', proximaCita: '' };
const families = [{ numero: 2, personas: [person] }, { numero: 1, personas: [person, person] }];
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
function cells(bytes) {
  const doc = new DOMParser().parseFromString(strFromU8(bytes), 'application/xml');
  return new Map(Array.from(doc.getElementsByTagNameNS(NS, 'c'), c => [c.getAttribute('r'), c]));
}

test('conserva todas las partes excepto Listado y propiedades de recálculo', () => {
  const output = unzipSync(buildWorkbook(template, families));
  assert.deepEqual(Object.keys(output).sort(), Object.keys(original).sort());
  for (const path of Object.keys(original)) {
    if (['xl/worksheets/sheet1.xml', 'xl/workbook.xml'].includes(path)) continue;
    assert.deepEqual(output[path], original[path], path);
  }
  const before = cells(original['xl/worksheets/sheet1.xml']);
  const after = cells(output['xl/worksheets/sheet1.xml']);
  for (const [ref, cell] of before) {
    assert.equal(after.get(ref).getAttribute('s'), cell.getAttribute('s'), `Estilo ${ref}`);
    const formula = cell.getElementsByTagNameNS(NS, 'f')[0];
    if (formula) assert.equal(new XMLSerializer().serializeToString(after.get(ref).getElementsByTagNameNS(NS, 'f')[0]), new XMLSerializer().serializeToString(formula), ref);
  }
  assert.equal(after.get('A2').textContent, '1');
  assert.equal(after.get('A3').textContent, '');
  assert.equal(after.get('A4').textContent, '2');
  assert.equal(after.get('B4').textContent, '3');
  assert.equal(after.get('C2').getAttribute('t'), 'inlineStr');
  assert.equal(after.get('C2').textContent, person.nombre);
  assert.equal(after.get('E2').textContent, '00123-FICTICIO');
  assert.equal(after.get('F2').textContent, '36526');
  assert.equal(after.get('L2').textContent, '');
  assert.match(strFromU8(output['xl/workbook.xml']), /fullCalcOnLoad="1"/);
});

test('exporta un listado vacío y admite el límite sin truncar', () => {
  assert.ok(buildWorkbook(template, []).length);
  const bytes = buildWorkbook(template, [{numero:1, personas:Array(MAX_BENEFICIARIOS).fill(person)}]);
  const data = cells(unzipSync(bytes)['xl/worksheets/sheet1.xml']);
  assert.equal(data.get('B996').textContent, String(MAX_BENEFICIARIOS));
  assert.equal(data.get('B997').textContent, '');
  assert.throws(() => buildWorkbook(template, [{numero:1, personas:Array(MAX_BENEFICIARIOS + 1).fill(person)}]), /995/);
});

test('rechaza fechas imposibles y conserva fechas sin desfase horario', () => {
  assert.throws(() => buildWorkbook(template, [{numero:1, personas:[{...person, nacimiento:'2025-02-30'}]}]), /fechas/);
  const data = cells(unzipSync(buildWorkbook(template, [{numero:1, personas:[{...person, nacimiento:'1900-01-01'}]}]))['xl/worksheets/sheet1.xml']);
  assert.equal(data.get('F2').textContent, '1');
});

test('exporta nombres y cantidades de Reparto conservando las fórmulas oficiales', () => {
  const output = unzipSync(buildWorkbook(template, families, [{nombre:'Producto de prueba',cantidad:12.5}]));
  const before = cells(original['xl/worksheets/sheet2.xml']);
  const after = cells(output['xl/worksheets/sheet2.xml']);
  assert.equal(after.get('B15').textContent,'Producto de prueba');
  assert.equal(after.get('C15').textContent,'12.5');
  assert.equal(after.get('B15').getAttribute('s'),before.get('B15').getAttribute('s'));
  for (const [ref,cell] of before) {
    const formula=cell.getElementsByTagNameNS(NS,'f')[0];
    if (formula) assert.equal(new XMLSerializer().serializeToString(after.get(ref).getElementsByTagNameNS(NS,'f')[0]),new XMLSerializer().serializeToString(formula),ref);
  }
  assert.deepEqual(output['xl/worksheets/sheet3.xml'],original['xl/worksheets/sheet3.xml']);
});
