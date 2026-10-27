import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from '@xmldom/xmldom';
import { zipSync, strToU8 } from 'fflate';
import { importWorkbook, parseExcelDate } from '../src/excel-import.mjs';

globalThis.DOMParser = DOMParser;
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const text = (ref, value) => `<c r="${ref}" t="inlineStr"><is><t>${value}</t></is></c>`;
const row = (n, cells) => `<row r="${n}">${cells.join('')}</row>`;
const titular = (n, numero) => row(n, [text(`A${n}`, numero), text(`C${n}`, 'Ana'), text(`D${n}`, 'Prueba'), text(`E${n}`, `DOC-${numero}`)]);
function libro(rows, { target = 'worksheets/sheet1.xml', date1904 = false } = {}) {
  const headers = ['N.º de familias', 'N.º de beneficiarios/as', 'Nombre', 'Apellidos', 'Documento'];
  return zipSync(Object.fromEntries(Object.entries({
    'xl/workbook.xml': `<workbook xmlns="${NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr date1904="${date1904 ? '1' : '0'}"/><sheets><sheet name="Listado" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="${target}"/></Relationships>`,
    'xl/worksheets/sheet1.xml': `<worksheet xmlns="${NS}"><sheetData>${row(1, headers.map((h, i) => text(`${'ABCDE'[i]}1`, h)))}${rows.join('')}</sheetData></worksheet>`,
  }).map(([path, xml]) => [path, strToU8(xml)])));
}

test('acepta rutas absolutas internas de XLSX y rechaza salir del paquete', () => {
  assert.equal(importWorkbook(libro([titular(2, 1)], { target: '/xl/worksheets/sheet1.xml' }))[0].numero, 1);
  assert.throws(() => importWorkbook(libro([titular(2, 1)], { target: '../../../sheet1.xml' })), /ruta|leer/);
});

test('conserva todas las partes de un nombre con varios formatos de texto', () => {
  const rich = '<c r="C2" t="inlineStr"><is><r><t>Ana </t></r><r><t>María</t></r></is></c>';
  const bytes = libro([titular(2, 1).replace(text('C2', 'Ana'), rich)]);
  assert.equal(importWorkbook(bytes)[0].personas[0].nombre, 'Ana María');
});

test('interpreta las fechas con el calendario 1904 del propio libro', () => {
  const dated = titular(2, 1).replace('</row>', '<c r="F2"><v>0</v></c><c r="H2"><v>44840</v></c></row>');
  const persona = importWorkbook(libro([dated], { date1904: true }))[0].personas[0];
  assert.equal(persona.nacimiento, '1904-01-01');
  assert.equal(persona.derivacion, '2026-10-07');
  assert.equal(parseExcelDate('60'), null, '29/02/1900 no es una fecha real');
});

test('un titular inválido no convierte a su miembro en titular ni mezcla familias', () => {
  const invalid = titular(2, 10).replace(text('E2', 'DOC-10'), '');
  const member = row(3, [text('C3', 'Luis'), text('D3', 'Prueba'), text('E3', 'MIEMBRO')]);
  const imported = importWorkbook(libro([invalid, member, titular(4, 20)]));
  assert.deepEqual(imported.map(f => f.numero), [20]);
  assert.deepEqual(imported.issues.map(i => i.row), [2, 3]);
});

test('una fila con solo número de familia corta la agrupación anterior', () => {
  const member = row(4, [text('C4', 'Luis'), text('D4', 'Prueba'), text('E4', 'MIEMBRO')]);
  const imported = importWorkbook(libro([titular(2, 10), row(3, [text('A3', 20)]), member]));
  assert.equal(imported.length, 1);
  assert.equal(imported[0].personas.length, 1);
  assert.deepEqual(imported.issues.map(i => i.row), [3, 4]);
});
