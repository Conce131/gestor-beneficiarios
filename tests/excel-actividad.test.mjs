import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { unzipSync, strFromU8 } from 'fflate';
import { buildWorkbook } from '../src/excel-workbook.mjs';
import { buildMonthlyWorkbook } from '../src/excel-mensual.mjs';
import { crearMensual } from '../src/mensual.mjs';
import { iniciarSeguimiento, cambiarAlta, familiasRecuentoTrimestral, activarAltas } from '../src/actividad.mjs';
globalThis.DOMParser = DOMParser;
globalThis.XMLSerializer = XMLSerializer;
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const parse = bytes => new DOMParser().parseFromString(strFromU8(bytes), 'application/xml');
const celda = (doc, ref) => [...doc.getElementsByTagNameNS(NS, 'c')].find(c => c.getAttribute('r') === ref);

test('el trimestral exportado conserva la familia que causó baja, con una referencia temporal fija', async () => {
  const plantilla = await readFile(new URL('../Modelo  listado v(2.0).xlsx', import.meta.url));
  const f = iniciarSeguimiento({ id: 'f-1', numero: 1, personas: [{ titular: true, nombre: 'Ana', apellidos: 'Prueba', documento: 'PRUEBA', nacimiento: '1980-01-01', derivacion: '2026-01-01', vigencia: '2026-06-01' }] }, '2026-07');
  const baja = cambiarAlta(f, '2026-08', false);
  const listado = familiasRecuentoTrimestral([baja], '2026-09');
  assert.equal(listado.length, 1);
  const files = unzipSync(buildWorkbook(plantilla, listado, undefined, { trimestre: '2026-09' }));
  const resumen = parse(files['xl/worksheets/sheet3.xml']);
  assert.equal(celda(resumen, 'Q2').getElementsByTagNameNS(NS, 'f')[0].textContent, 'IF(N2="",0,1)');
  assert.doesNotMatch(strFromU8(files['xl/worksheets/sheet1.xml']), /TODAY\(\)/);
  assert.doesNotMatch(strFromU8(files['xl/worksheets/sheet3.xml']), /TODAY\(\)/);
  const lista = parse(files['xl/worksheets/sheet1.xml']);
  assert.equal(celda(lista, 'A2').textContent, '1');
  assert.match(celda(lista, 'C2').textContent, /Ana/);
  assert.equal(activarAltas(crearMensual('2026-08'), [baja]).altas.length, 0);
});

test('el Excel mensual usa la misma fotografía de altas que el recuento mostrado', async () => {
  const plantilla = await readFile(new URL('../MODELO RESUMEN MENSUAL.xlsx', import.meta.url));
  const f = iniciarSeguimiento({ id: 'f-1', numero: 1, personas: [{ titular: true, nombre: 'Ana', nacimiento: '1980-01-01', vigencia: '2027-01-01' }] }, '2026-07');
  const datos = activarAltas(crearMensual('2026-08', 'Entidad'), [f]);
  const files = unzipSync(buildMonthlyWorkbook(plantilla, datos));
  const hoja = parse(files['xl/worksheets/sheet1.xml']);
  assert.equal(celda(hoja, 'C4').textContent, '1');
  assert.equal(celda(hoja, 'E7').textContent, '1');
});
