import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { unzipSync, strFromU8 } from 'fflate';
import { buildMonthlyWorkbook } from '../src/excel-mensual.mjs';
import { crearMensual } from '../src/mensual.mjs';
import { registrarAtencion, cambiarOrigenRecuento } from '../src/atenciones.mjs';

globalThis.DOMParser = DOMParser;
globalThis.XMLSerializer = XMLSerializer;
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const parse = bytes => new DOMParser().parseFromString(strFromU8(bytes), 'application/xml');
const template = await readFile(new URL('../MODELO RESUMEN MENSUAL.xlsx', import.meta.url));
const original = unzipSync(template);
const cells = bytes => new Map(Array.from(parse(bytes).getElementsByTagNameNS(NS, 'c'), c => [c.getAttribute('r'), c]));
const formula = (map, ref) => map.get(ref).getElementsByTagNameNS(NS, 'f')[0]?.textContent;
const valor = (map, ref) => map.get(ref).getElementsByTagNameNS(NS, 'v')[0]?.textContent;
function ejemplo() {
  const datos = crearMensual('2026-10', '=Entidad & <prueba>');
  datos.tamanos.fill(0);
  datos.tamanos[1] = 1; datos.tamanos[2] = 1;
  datos.edades = [1, 1, 1, 2];
  datos.reparto = [{ nombre: '=Leche & <arroz>', cantidad: 10 }];
  return datos;
}

test('la propia plantilla mensual tiene fórmulas válidas antes de exportar desde la app', () => {
  for (const path of ['xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']) {
    for (const f of Array.from(parse(original[path]).getElementsByTagNameNS(NS, 'f'))) {
      assert.doesNotMatch(f.textContent, /#REF!|Listado!|TotalBeneficiarios/);
    }
  }
  const reparto = cells(original['xl/worksheets/sheet2.xml']);
  assert.ok(formula(reparto, 'N15').includes("'Resumen mensual'!$E$8=$N$12"));
  assert.ok(formula(reparto, 'N15').includes('$C15=""'));
});

test('escribe entidad, periodo, familias, cuatro edades y alimentos con sus totales calculados', () => {
  const datos = ejemplo(), snapshot = structuredClone(datos);
  const output = unzipSync(buildMonthlyWorkbook(template, datos));
  const resumen = cells(output['xl/worksheets/sheet1.xml']), reparto = cells(output['xl/worksheets/sheet2.xml']);
  assert.deepEqual(datos, snapshot);
  assert.equal(resumen.get('C2').textContent, '=Entidad & <prueba>');
  assert.equal(resumen.get('C2').getAttribute('t'), 'inlineStr');
  assert.equal(valor(resumen, 'G2'), '46296', 'Fecha Excel del primer día del mes');
  assert.deepEqual([4, 5, 6].map(i => valor(resumen, `C${i}`)), ['0', '1', '1']);
  assert.deepEqual([4, 5, 6, 7].map(i => valor(resumen, `E${i}`)), ['1', '1', '1', '2']);
  assert.equal(valor(resumen, 'F4'), '2');
  assert.equal(valor(resumen, 'G4'), '5');
  assert.equal(valor(resumen, 'E8'), '5');
  assert.equal(reparto.get('B15').textContent, '=Leche & <arroz>');
  assert.equal(reparto.get('B15').getAttribute('t'), 'inlineStr');
  assert.equal(valor(reparto, 'C15'), '10');
  assert.equal(reparto.get('B16').textContent, '');
  assert.equal(reparto.get('C16').textContent, '');
  assert.equal(valor(reparto, 'N12'), '5');
  assert.equal(valor(reparto, 'N13'), '2');
  assert.equal(valor(reparto, 'N15'), '2');
  assert.equal(valor(reparto, 'D15'), '');
  assert.equal(valor(reparto, 'E15'), '4');
  assert.equal(valor(reparto, 'F15'), '6');
  assert.equal(valor(cells(original['xl/worksheets/sheet1.xml']), 'C5'), undefined);
});

test('repara referencias rotas y fórmulas compartidas en todas las filas del reparto', () => {
  const output = unzipSync(buildMonthlyWorkbook(template, ejemplo()));
  const resumen = cells(output['xl/worksheets/sheet1.xml']), reparto = cells(output['xl/worksheets/sheet2.xml']);
  assert.equal(formula(resumen, 'F4'), 'SUM(C4:C13)');
  assert.equal(formula(resumen, 'G4'), 'SUMPRODUCT(B4:B13,C4:C13)');
  assert.equal(formula(resumen, 'E8'), 'SUM(E4:E7)');
  assert.ok(formula(resumen, 'D9').includes('G4=E8'));
  assert.doesNotMatch(formula(resumen, 'D9'), /COUNT\(/);
  for (const [i, col] of [...'DEFGHIJKLM'].entries()) {
    assert.equal(formula(reparto, `${col}13`), `'Resumen mensual'!$C$${4 + i}`);
    for (let fila = 15; fila <= 30; fila++) {
      const f = formula(reparto, `${col}${fila}`);
      assert.ok(f.includes(`ROUND($N${fila}*${i + 1},0)`));
      assert.ok(f.includes(`$N${fila}=""`));
      assert.equal(reparto.get(`${col}${fila}`).getElementsByTagNameNS(NS, 'f')[0].hasAttribute('si'), false);
    }
  }
  for (let fila = 15; fila <= 30; fila++) {
    const f = formula(reparto, `N${fila}`);
    assert.ok(f.includes("'Resumen mensual'!$E$8=$N$12"));
    assert.ok(f.includes('$N$12>0'));
  }
  for (const path of ['xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']) {
    for (const f of Array.from(parse(output[path]).getElementsByTagNameNS(NS, 'f'))) assert.doesNotMatch(f.textContent, /#REF!|Listado!|TotalBeneficiarios/);
  }
});

test('conserva estilos, protecciones y partes del libro y solicita recálculo sin cadena antigua', () => {
  const output = unzipSync(buildMonthlyWorkbook(template, ejemplo()));
  const cambiados = ['xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml', 'xl/workbook.xml', 'xl/calcChain.xml', 'xl/_rels/workbook.xml.rels', '[Content_Types].xml'];
  for (const path of Object.keys(original)) {
    if (!cambiados.includes(path)) assert.deepEqual(output[path], original[path], path);
  }
  for (const path of ['xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']) {
    const before = cells(original[path]), after = cells(output[path]);
    for (const [ref, c] of before) assert.equal(after.get(ref).getAttribute('s'), c.getAttribute('s'), ref);
    assert.equal(parse(output[path]).getElementsByTagNameNS(NS, 'sheetProtection').length, parse(original[path]).getElementsByTagNameNS(NS, 'sheetProtection').length);
  }
  const workbook = parse(output['xl/workbook.xml']);
  assert.deepEqual(Array.from(workbook.getElementsByTagNameNS(NS, 'sheet'), s => s.getAttribute('name')), ['Resumen mensual', 'Reparto']);
  const calc = workbook.getElementsByTagNameNS(NS, 'calcPr')[0];
  for (const [attr, value] of [['calcMode', 'auto'], ['fullCalcOnLoad', '1'], ['forceFullCalc', '1']]) assert.equal(calc.getAttribute(attr), value);
  assert.equal(output['xl/calcChain.xml'], undefined);
  assert.doesNotMatch(strFromU8(output['xl/_rels/workbook.xml.rels']), /calcChain/);
});

test('impide exportar borradores, totales distintos y entidades vacías; acepta un mes sin usuarios', () => {
  const datos = ejemplo();
  datos.edades[0] = '';
  assert.throws(() => buildMonthlyWorkbook(template, datos), /coincidir/);
  datos.edades[0] = 0;
  assert.throws(() => buildMonthlyWorkbook(template, datos), /coincidir/);
  datos.edades[0] = 1; datos.entidad = '   ';
  assert.throws(() => buildMonthlyWorkbook(template, datos), /entidad/);
  datos.entidad = 'Entidad'; datos.tamanos.fill(0); datos.edades.fill(0);
  const output = unzipSync(buildMonthlyWorkbook(template, datos));
  assert.equal(valor(cells(output['xl/worksheets/sheet2.xml']), 'N15'), '');
});

test('distingue una cantidad pendiente de un cero explícito en reparto y en sus fórmulas', () => {
  const datos = ejemplo();
  datos.reparto = [{ nombre: 'Pendiente', cantidad: '' }, { nombre: 'Sin unidades', cantidad: 0 }];
  const output = unzipSync(buildMonthlyWorkbook(template, datos));
  const reparto = cells(output['xl/worksheets/sheet2.xml']);
  assert.equal(valor(reparto, 'N15'), '');
  assert.equal(valor(reparto, 'E15'), '');
  assert.equal(valor(reparto, 'N16'), '0');
  assert.equal(valor(reparto, 'E16'), '0');
  assert.ok(formula(reparto, 'N15').includes('$C15=""'), 'sigue distinguiendo vacío tras recalcular en Excel');
});

test('exporta el recuento de las familias atendidas, sin duplicarlas en el mes', () => {
  const familia = { id: 'f-1', numero: 1, personas: [
    { titular: true, nombre: 'Titular', nacimiento: '1980-01-01' },
    { nombre: 'Bebé', nacimiento: '2025-01-01' },
    { nombre: 'Menor', nacimiento: '2015-01-01' },
    { menor: true, nombre: '', nacimiento: '' },
  ] };
  let datos = registrarAtencion(cambiarOrigenRecuento(crearMensual('2026-10', 'Entidad'), true), familia, '2026-10-05');
  datos = registrarAtencion(datos, familia, '2026-10-20');
  const output = unzipSync(buildMonthlyWorkbook(template, datos));
  const resumen = cells(output['xl/worksheets/sheet1.xml']);
  assert.equal(valor(resumen, 'C7'), '1');
  assert.equal(valor(resumen, 'F4'), '1');
  assert.equal(valor(resumen, 'G4'), '4');
  assert.deepEqual([4, 5, 6, 7].map(i => valor(resumen, `E${i}`)), ['1', '1', '1', '1']);
});
