import { erroresFamilia } from './validacion.mjs';
import { numeroLibre } from './numeracion.mjs';

// Construye la siguiente base sin modificar los registros guardados.
export function incorporarAlta(familias, alta, hoy = new Date(), numerosReservados = []) {
  const nueva = structuredClone(alta.persona);
  if (nueva.nacimiento) {
    const fecha = new Date(`${nueva.nacimiento}T00:00:00`);
    let edad = hoy.getFullYear() - fecha.getFullYear();
    if (hoy.getMonth() < fecha.getMonth() || (hoy.getMonth() === fecha.getMonth() && hoy.getDate() < fecha.getDate())) edad--;
    nueva.menor = !nueva.titular && edad < 18;
  }
  const original = alta.familiaId ? familias.find(f => f.id === alta.familiaId) : null;
  if (alta.familiaId && !original) throw new Error('La familia ya no existe.');
  const copia = original ? structuredClone(original) : { id: alta.id, numero: numeroLibre([...familias, ...numerosReservados.map(numero => ({ numero }))]), personas: [] };
  if (copia.personas.some(p => p.id === nueva.id)) throw new Error('Esta persona ya se ha añadido.');
  // Las fechas compartidas se toman del titular actual, sin sobrescribir otras ediciones.
  if (original) {
    const titular = copia.personas.find(p => p.titular) ?? copia.personas[0];
    nueva.titular = false;
    nueva.derivacion = titular.derivacion;
    nueva.vigencia = titular.vigencia;
  } else nueva.titular = true;
  copia.personas.push(nueva);
  const errores = erroresFamilia(copia, hoy);
  if (errores.length) {
    const error = new Error(errores.map(e => e.mensaje).join(' '));
    error.campos = errores.filter(e => e.indice === copia.personas.length - 1).map(e => e.campo);
    throw error;
  }
  return original ? familias.map(f => f.id === copia.id ? copia : f) : [...familias, copia].sort((a, b) => a.numero - b.numero);
}
