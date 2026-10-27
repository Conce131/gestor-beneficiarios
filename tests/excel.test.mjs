import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";
import { buildWorkbook, MAX_BENEFICIARIOS } from "../src/excel-workbook.mjs";
import { importWorkbook } from '../src/excel-import.mjs';
import { editarPersona } from '../src/edicion-listado.mjs';
import { vigenciaAplicada } from '../src/vigencia.mjs';
import { AVISO_RECUENTO_REPARTO, resumen } from '../src/reparto.mjs';

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

// Excel puede guardar una fórmula maestra y referencias compartidas en las demás filas.
const formulasCompartidas = new WeakMap();
function formulaFila(celdas, ref) {
  const f = celdas.get(ref).getElementsByTagNameNS(NS, 'f')[0];
  if (f.textContent) return f.textContent;
  if (!formulasCompartidas.has(celdas)) {
    const maestras = new Map();
    for (const [baseRef, cell] of celdas) {
      const formula = cell.getElementsByTagNameNS(NS, 'f')[0];
      if (formula?.hasAttribute('si') && formula.textContent) maestras.set(formula.getAttribute('si'), [baseRef, cell]);
    }
    formulasCompartidas.set(celdas, maestras);
  }
  const [baseRef, base] = formulasCompartidas.get(celdas).get(f.getAttribute('si'));
  const delta = Number(ref.match(/\d+$/)[0]) - Number(baseRef.match(/\d+$/)[0]);
  return base.getElementsByTagNameNS(NS, 'f')[0].textContent.replace(/(\$?[A-Z]{1,3})(\$?)(\d+)/g,
    (match, col, fijo, row) => fijo ? match : `${col}${Number(row) + delta}`);
}

test('exporta referencias de familia con huecos sin renumerarlas', () => {
  const familias = [{ numero: 42, personas: [person] }, { numero: 12, personas: [person, person] }];
  const output = unzipSync(buildWorkbook(template, familias));
  const listado = cells(output['xl/worksheets/sheet1.xml']);
  const valor = ref => listado.get(ref)?.getElementsByTagNameNS(NS, 'v')[0]?.textContent;
  assert.equal(valor('A2'), '12');
  assert.equal(valor('A4'), '42');
  assert.deepEqual(familias.map(f => f.numero), [42, 12]);
});

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
  assert.equal(after.get('C2').textContent, '=texto Ficticio & <prueba>');
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

test('la plantilla trimestral cuenta miembros sin huecos y valida el origen en todas las filas', async () => {
  const bytes = await readFile(new URL('../Modelo  listado v(2.0).xlsx', import.meta.url));
  const parts = unzipSync(bytes);
  const listado = cells(parts['xl/worksheets/sheet1.xml']);
  for (const ref of ['K2', 'K996', 'K997', 'K2999']) {
    const f = formulaFila(listado, ref);
    assert.ok(f.includes('COUNTIFS(Resumen!$N$2:$N$2999,ROW(),Resumen!$V$2:$V$2999,1)'));
    assert.doesNotMatch(f, /A\$996|B\$996/);
  }
  const doc = new DOMParser().parseFromString(strFromU8(parts['xl/worksheets/sheet1.xml']), 'application/xml');
  const origin = Array.from(doc.getElementsByTagNameNS(NS, 'dataValidation')).find(v => v.getAttribute('type') === 'list');
  assert.equal(origin.getAttribute('sqref'), 'M2:M2999');
  for (const formatting of Array.from(doc.getElementsByTagNameNS(NS, 'conditionalFormatting'))) {
    const formulas = Array.from(formatting.getElementsByTagNameNS(NS, 'formula'), f => f.textContent);
    if (/^I\d/.test(formatting.getAttribute('sqref'))) {
      assert.ok(formulas.every(f => !/\$H\d+=""/.test(f)), 'vigencia no debe colorearse por derivación vacía');
    }
    if (formatting.getAttribute('sqref') === 'I2:I2999') assert.ok(formulas.includes('AND($A2<>"",$M2<>"No",$I2="")'));
    if (formatting.getAttribute('sqref') === 'M2:M2999') assert.ok(!formulas.includes('AND($A2<>"",$M2="")'));
  }
});

test('exporta MENOR como nombre cuando un menor no tiene nombre', () => {
  const data = cells(unzipSync(buildWorkbook(template, [{ numero: 1, personas: [
    { ...person, nombre: '', apellidos: '', documento: '', menor: true, nacimiento: '2015-04-03' },
  ] }]))['xl/worksheets/sheet1.xml']);
  assert.equal(data.get('C2').textContent, 'MENOR');
  assert.equal(data.get('D2').textContent, '');
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

test('el Excel nuevo conserva el origen y la fecha manual al exportar, importar y desmarcar', async () => {
  const nuevaPlantilla = await readFile(new URL('../Modelo  listado v(2.0).xlsx', import.meta.url));
  const titular = { ...person, titular: true, nombre: 'Ana', serviciosSociales: false,
    derivacion: '2026-07-31', vigencia: '2027-04-05' };
  const bytes = buildWorkbook(nuevaPlantilla, [{ numero: 1, personas: [titular, {
    ...titular, titular: false, nombre: 'Luis', documento: 'OTRO',
  }] }], []);
  const output = unzipSync(bytes);
  const listado = cells(output['xl/worksheets/sheet1.xml']);
  assert.equal(listado.get('M2').textContent, 'No');
  assert.equal(listado.get('M3').textContent, '');
  assert.ok(listado.get('N2').getElementsByTagNameNS(NS, 'f')[0]);
  const [importada] = importWorkbook(bytes);
  assert.equal(importada.personas.length, 2);
  assert.ok(importada.personas.every(p => !p.serviciosSociales));
  assert.equal(importada.personas[0].vigencia, '2027-04-05');
  assert.equal(vigenciaAplicada(importada.personas[0]), '2026-10-31');
  const marcada = editarPersona(importada, importada.personas[0].id, 'serviciosSociales', true, new Date(2026, 9, 19));
  assert.equal(vigenciaAplicada(marcada.personas[0]), '2027-04-05');
  assert.equal(output['xl/worksheets/sheet2.xml'], undefined);
  const libroSocial = buildWorkbook(nuevaPlantilla, [{ numero: 1, personas: [{ ...titular, serviciosSociales: true }] }], []);
  const social = cells(unzipSync(libroSocial)['xl/worksheets/sheet1.xml']);
  assert.equal(social.get('M2').textContent, 'Sí');
  assert.equal(importWorkbook(libroSocial)[0].personas[0].serviciosSociales, true);
});

test('la plantilla 2.0 conserva menores, citas de miembros y el recuento tras importar de nuevo', async () => {
  const plantilla = await readFile(new URL('../Modelo  listado v(2.0).xlsx', import.meta.url));
  const hoy = new Date(2026, 9, 19);
  const familia = { numero: 7, personas: [
    { ...person, titular: true, serviciosSociales: true, vigencia: '2026-07-21', proximaCita: '2026-10-19' },
    { nombre: 'Peque', apellidos: '', documento: '', menor: true, nacimiento: '',
      proximaCita: '2026-10-20', serviciosSociales: true },
  ] };
  const bytes = buildWorkbook(plantilla, [familia], []);
  const [importada] = importWorkbook(bytes);
  assert.equal(importada.personas.length, 2);
  assert.equal(importada.personas[1].menor, true);
  assert.equal(importada.personas[1].proximaCita, '2026-10-20');
  assert.equal(resumen([familia], hoy).personas, 2);
  assert.equal(resumen([importada], hoy).personas, 2);
  importada.personas[1].proximaCita = '2026-10-19';
  assert.equal(resumen([importada], hoy).personas, 2);
  const output = unzipSync(bytes);
  assert.equal(output['xl/worksheets/sheet2.xml'], undefined);
  // Cada relación interna conservada debe apuntar a una parte que exista.
  assert.equal(output['xl/calcChain.xml'], undefined);
  for (const path of ['xl/_rels/workbook.xml.rels', '[Content_Types].xml']) {
    assert.doesNotMatch(strFromU8(output[path]), /calcChain/);
  }
});

test('importar Servicios Sociales vacío equivale a Sí y utiliza la vigencia manual', async () => {
  const plantilla = await readFile(new URL('../Modelo  listado v(2.0).xlsx', import.meta.url));
  const parts = unzipSync(buildWorkbook(plantilla, [{ numero: 1, personas: [{
    ...person, titular: true, serviciosSociales: true,
  }] }], []));
  const doc = new DOMParser().parseFromString(strFromU8(parts['xl/worksheets/sheet1.xml']), 'application/xml');
  const celda = Array.from(doc.getElementsByTagNameNS(NS, 'c')).find(c => c.getAttribute('r') === 'M2');
  while (celda.firstChild) celda.removeChild(celda.firstChild);
  celda.removeAttribute('t');
  parts['xl/worksheets/sheet1.xml'] = strToU8(new XMLSerializer().serializeToString(doc));
  const [importada] = importWorkbook(zipSync(parts));
  assert.equal(importada.personas[0].serviciosSociales, true);
  assert.equal(vigenciaAplicada(importada.personas[0]), person.vigencia);
});


test('Resumen de la plantilla y del Excel exportado cuenta los 90 días completos independientemente de las citas', async () => {
  const plantilla = await readFile(new URL('../Modelo  listado v(2.0).xlsx', import.meta.url));
  const exportado = buildWorkbook(plantilla, [{ numero: 1, personas: [{
    ...person, titular: true, vigencia: '2026-07-22', proximaCita: '',
  }] }], []);
  for (const bytes of [plantilla, exportado]) {
    const resumen = cells(unzipSync(bytes)['xl/worksheets/sheet3.xml']);
    for (let i = 2; i <= 2999; i++) {
      assert.equal(formulaFila(resumen, `Q${i}`),
        `IFERROR(IF(AND(N${i}<>"",ISNUMBER(O${i}),O${i}>0,O${i}>=TODAY()-90),1,0),0)`);
    }
  }
});


test('la plantilla permite citas anteriores o iguales al vencimiento y conserva los avisos', async () => {
  const plantilla = unzipSync(await readFile(new URL('../Modelo  listado v(2.0).xlsx', import.meta.url)));
  const listado = new DOMParser().parseFromString(strFromU8(plantilla['xl/worksheets/sheet1.xml']), 'application/xml');
  const validacion = Array.from(listado.getElementsByTagNameNS(NS, 'dataValidation'))
    .find(v => v.getAttribute('sqref') === 'L2:L2999');
  const formula = validacion.getElementsByTagNameNS(NS, 'formula1')[0].textContent;
  assert.ok(formula.includes('L2>=TODAY()'));
  assert.ok(formula.includes('L2<=INDEX(VigenciasFamilia,ROW())+90'));
  assert.ok(!formula.includes('L2>INDEX('));
  const resumen = cells(plantilla['xl/worksheets/sheet3.xml']);
  const aviso = resumen.get('P2').getElementsByTagNameNS(NS, 'f')[0].textContent;
  assert.ok(aviso.includes('W2>=TODAY()'));
  assert.ok(aviso.includes('W2<=O2+90'));
  assert.ok(!aviso.includes('W2>O2'));
});


test('Excel conserva una vigencia corta con origen No y limita las largas a tres meses', async () => {
  const plantilla = await readFile(new URL('../Modelo  listado v(2.0).xlsx', import.meta.url));
  const bytes = buildWorkbook(plantilla, [{ numero: 1, personas: [{
    ...person, titular: true, serviciosSociales: false, derivacion: '2026-07-31', vigencia: '2026-08-10',
  }] }], []);
  const [familia] = importWorkbook(bytes);
  assert.equal(familia.personas[0].vigencia, '2026-08-10');
  assert.equal(vigenciaAplicada(familia.personas[0]), '2026-08-10');
  const editada = structuredClone(familia);
  editada.personas[0].vigencia = '2027-01-01';
  assert.equal(vigenciaAplicada(editada.personas[0]), '2026-10-31');
  for (const libro of [plantilla, bytes]) {
    const listado = cells(unzipSync(libro)['xl/worksheets/sheet1.xml']);
    for (let i = 2; i <= 2999; i++) {
      const formula = formulaFila(listado, `N${i}`);
      assert.ok(formula.includes('MIN(INDEX($I:$I,'));
      assert.ok(formula.includes('EDATE(INDEX($H:$H,'));
    }
  }
});
