import { familiasParaExportar } from "./reparto.mjs";
import templateUrl from "../Modelo  listado v(1.4).xlsx?url";
import { buildWorkbook } from "./excel-workbook.mjs";
import { isTauri } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { openPath } from "@tauri-apps/plugin-opener";
import { documentDir, join } from "@tauri-apps/api/path";
import { load } from "@tauri-apps/plugin-store";

let destinoExcel;
let preferenciasExcel;
async function rutaPredeterminadaExcel() {
  if (destinoExcel) return destinoExcel;
  try {
    preferenciasExcel ??= await load('preferencias-excel.json', { autoSave: false });
    const guardada = await preferenciasExcel.get('ultimaRuta');
    if (typeof guardada === 'string' && guardada) return destinoExcel = guardada;
  } catch (error) { console.error('No se pudo recuperar la ruta del Excel.', error); }
  try { return await join(await documentDir(), 'Listado_Reparto_Entidad.xlsx'); }
  catch { return 'Listado_Reparto_Entidad.xlsx'; }
}

export async function exportExcel(familias, reparto) {
  const response = await fetch(templateUrl);
  if (!response.ok) throw new Error("No se pudo cargar la plantilla local de Excel.");
  const bytes = buildWorkbook(await response.arrayBuffer(), familiasParaExportar(familias), reparto);
  if (isTauri()) {
    const path = await save({
      title: "Guardar Excel generado",
      defaultPath: await rutaPredeterminadaExcel(),
      filters: [{ name: "Libro de Excel", extensions: ["xlsx"] }],
    });
    if (!path) return false;
    await writeFile(path, bytes);
    destinoExcel = path;
    try {
      preferenciasExcel ??= await load('preferencias-excel.json', { autoSave: false });
      await preferenciasExcel.set('ultimaRuta', path);
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
  anchor.download = "Listado_Reparto_Entidad.xlsx";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
