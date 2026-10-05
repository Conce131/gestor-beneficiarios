import { isTauri } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { parseBackup, serializeBackup } from "./backups.js";

export async function saveTransfer(familias, siguienteFamilia, reparto) {
  if (!isTauri()) return false;
  const path = await save({
    title: "Guardar datos para trasladarlos",
    defaultPath: "listado-beneficiarios.json",
    filters: [{ name: "Copia de traslado", extensions: ["json"] }],
  });
  if (!path) return false;
  await writeTextFile(path, serializeBackup(familias, siguienteFamilia, reparto));
  return true;
}

export async function loadTransfer() {
  if (!isTauri()) return null;
  const path = await open({
    title: "Seleccionar archivo de traslado",
    multiple: false,
    directory: false,
    filters: [{ name: "Copia de traslado", extensions: ["json"] }],
  });
  if (!path || Array.isArray(path)) return null;
  return parseBackup(await readTextFile(path));
}
