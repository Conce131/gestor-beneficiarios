import templateUrl from "../Modelo  listado v(1.4).xlsx?url";
import { buildWorkbook } from "./excel-workbook.mjs";
import { isTauri } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { openPath } from "@tauri-apps/plugin-opener";

export async function exportExcel(familias, reparto) {
  const response = await fetch(templateUrl);
  if (!response.ok) throw new Error("No se pudo cargar la plantilla local de Excel.");
  const bytes = buildWorkbook(await response.arrayBuffer(), familias, reparto);
  if (isTauri()) {
    const path = await save({
      title: "Guardar Excel generado",
      defaultPath: "Listado_Reparto_Entidad.xlsx",
      filters: [{ name: "Libro de Excel", extensions: ["xlsx"] }],
    });
    if (!path) return false;
    await writeFile(path, bytes);
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
