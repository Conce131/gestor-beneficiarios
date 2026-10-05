import { validarReparto } from "./reparto.mjs";
export function serializeBackup(familias, siguienteFamilia, reparto = []) {
  return JSON.stringify({ version: 1, fecha: new Date().toISOString(), siguienteFamilia, familias, reparto }, null, 2);
}

export function backup(familias, siguienteFamilia, reparto = []) {
  const json = serializeBackup(familias, siguienteFamilia, reparto);
  download(new Blob([json], { type: "application/json" }), "copia_seguridad_reparto.json");
  return new Date().toISOString();
}

export function parseBackup(json) {
  const data = JSON.parse(json);
  if (!data || data.version !== 1 || !Array.isArray(data.familias)) throw new Error('El archivo no es una copia válida de la aplicación.');
  const ids = new Set(), personIds = new Set(), numeros = new Set();
  const familias = data.familias.map(f => {
    if (!f || typeof f.id !== 'string' || ids.has(f.id) || !Number.isInteger(f.numero) || f.numero < 1 || numeros.has(f.numero) || !Array.isArray(f.personas) || !f.personas.length) throw new Error('Hay una familia inválida o duplicada en el archivo.');
    ids.add(f.id); numeros.add(f.numero);
    const personas = f.personas.map(p => {
      if (!p || typeof p.id !== 'string' || personIds.has(p.id)) throw new Error('Hay una persona inválida o duplicada en el archivo.');
      personIds.add(p.id);
      const persona = {id:p.id, titular:p.titular === true};
      for (const key of ['nombre','apellidos','documento','nacimiento','derivacion','vigencia','proximaCita']) {
        if (typeof p[key] !== 'string') throw new Error('Faltan datos de una persona en el archivo.');
        if (['nacimiento','derivacion','vigencia','proximaCita'].includes(key) && p[key]) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(p[key]) || Number(p[key].slice(0,4)) < 1900 || !Number.isFinite(Date.parse(p[key])) || new Date(p[key]).toISOString().slice(0,10) !== p[key]) throw new Error('El archivo contiene una fecha inválida.');
        }
        persona[key] = p[key];
      }
      return persona;
    });
    return {id:f.id, numero:f.numero, personas};
  });
  return {familias, reparto:validarReparto(data.reparto)};
}

export async function readBackup(file) {
  return parseBackup(await file.text());
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
