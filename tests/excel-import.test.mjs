import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { importWorkbook } from "../src/excel-import.mjs";
import { buildWorkbook } from "../src/excel-workbook.mjs";

globalThis.DOMParser = DOMParser;
globalThis.XMLSerializer = XMLSerializer;
const template = await readFile(new URL("../Modelo  listado v(1.4).xlsx", import.meta.url));
const families = [
  { numero: 2, personas: [{ nombre: "Ana", apellidos: "Prueba", documento: "001234", nacimiento: "2000-01-01", derivacion: "2026-10-05", vigencia: "2027-04-05", proximaCita: "" }] },
  { numero: 5, personas: [{ nombre: "Luis", apellidos: "Ficticio", documento: "DOC-2", nacimiento: "1900-01-01", derivacion: "", vigencia: "", proximaCita: "2026-11-01" }, { nombre: "Eva", apellidos: "Ficticia", documento: "DOC-3", nacimiento: "", derivacion: "", vigencia: "", proximaCita: "" }] },
];

test("importa familias y miembros desde la hoja Listado de la plantilla", () => {
  const excel = buildWorkbook(template, families);
  const imported = importWorkbook(excel);
  assert.deepEqual(imported.map(f => f.numero), [2, 5]);
  assert.deepEqual(imported.map(f => f.personas.length), [1, 2]);
  assert.equal(imported[0].personas[0].documento, "001234");
  assert.equal(imported[0].personas[0].nacimiento, "2000-01-01");
  assert.equal(imported[0].personas[0].derivacion, "2026-10-05");
  assert.equal(imported[1].personas[0].nacimiento, "1900-01-01");
  assert.equal(imported[1].personas[0].proximaCita, "2026-11-01");
  assert.notEqual(imported[0].id, families[0].id);
});

test("rechaza un archivo sin la estructura de la plantilla", () => {
  assert.throws(() => importWorkbook(new Uint8Array([1, 2, 3])), /Excel/);
});
