import { familiasParaExportar } from "./reparto.mjs";
import templateUrl from "../Modelo  listado v(2.0).xlsx?url";
import { buildWorkbook } from "./excel-workbook.mjs";
import monthlyTemplateUrl from '../MODELO RESUMEN MENSUAL.xlsx?url';
import { buildMonthlyWorkbook } from './excel-mensual.mjs';
import { isTauri } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { openPath } from "@tauri-apps/plugin-opener";
import { documentDir, join } from "@tauri-apps/api/path";
import { load } from "@tauri-apps/plugin-store";
import { pasoExcel } from './excel-errors.mjs';

const destinosExcel = new Map();
let preferenciasExcel;
async function rutaPredeterminadaExcel(tipo, nombre) {
  if (destinosExcel.has(tipo)) return destinosExcel.get(tipo);
  try {
    preferenciasExcel ??= await load('preferencias-excel.json', { autoSave: false });
    const guardada = await preferenciasExcel.get(tipo);
    if (typeof guardada === 'string' && guardada) {
      destinosExcel.set(tipo, guardada);
      return guardada;
    }
  } catch (error) { console.error('No se pudo recuperar la ruta del Excel.', error); }
  try { return await join(await documentDir(), nombre); }
  catch { return nombre; }
}

export async function exportExcel(familias, opciones = {}) {
  const template = await pasoExcel('No se pudo cargar la plantilla local de Excel', async () => {
    const response = await fetch(templateUrl);
    if (!response.ok) throw new Error(`Respuesta HTTP ${response.status}.`);
    return await response.arrayBuffer();
  });
  const bytes = await pasoExcel('No se pudo preparar el contenido del Excel', () =>
    buildWorkbook(template, familiasParaExportar(familias), undefined, opciones));
  return guardarExcel(bytes, 'Listado_Trimestral_Entidad.xlsx', 'ultimaRuta');
}

export async function exportMonthlyExcel(datos) {
  const template = await pasoExcel('No se pudo cargar la plantilla mensual', async () => {
    const response = await fetch(monthlyTemplateUrl);
    if (!response.ok) throw new Error(`Respuesta HTTP ${response.status}.`);
    return response.arrayBuffer();
  });
  const bytes = await pasoExcel('No se pudo preparar el resumen mensual', () => buildMonthlyWorkbook(template, datos));
  const periodo = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${datos.mes}-01T12:00:00Z`)).replace(/\s+de\s+/, ' ');
  const periodoCapitalizado = periodo.charAt(0).toLocaleUpperCase('es-ES') + periodo.slice(1);
  return guardarExcel(bytes, `Resumen Mensual ${periodoCapitalizado}.xlsx`, `ultimaRutaMensual-${datos.mes}`);
}

async function guardarExcel(bytes, nombre, tipo) {
  if (isTauri()) {
    const path = await pasoExcel('No se pudo abrir la ventana para guardar el Excel', async () => save({
      title: "Guardar Excel generado",
      defaultPath: await rutaPredeterminadaExcel(tipo, nombre),
      filters: [{ name: "Libro de Excel", extensions: ["xlsx"] }],
    }));
    if (!path) return false;
    await pasoExcel(`No se pudo guardar el Excel en «${path}»`, () => writeFile(path, bytes));
    destinosExcel.set(tipo, path);
    try {
      preferenciasExcel ??= await load('preferencias-excel.json', { autoSave: false });
      await preferenciasExcel.set(tipo, path);
      await preferenciasExcel.save();
    } catch (error) { console.error('El Excel se guardó, pero no se pudo recordar su ruta.', error); }
    let opened = true;
    try { await openPath(path); }
    catch (error) { console.error('El Excel se guardó, pero no pudo abrirse.', error); opened = false; }
    return { path, opened };
  }
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = nombre;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
