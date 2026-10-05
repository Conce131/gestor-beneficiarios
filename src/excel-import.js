import { importWorkbook } from "./excel-import.mjs";

export async function readExcel(file) {
  if (!file || !file.name.toLowerCase().endsWith(".xlsx")) {
    throw new Error("Selecciona un archivo de Excel .xlsx.");
  }
  return importWorkbook(await file.arrayBuffer());
}
