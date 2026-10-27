import { motivoExclusion, diaFecha, diaHoy } from './vigencia.mjs';
export const alimentos = ['Leche', 'Harinas y gofio', 'Arroz', 'Pasta', 'Legumbres', 'Salsas variadas', 'Aceites', 'Pescado en conserva', 'Carne en conserva'];
export const MAX_REPARTO_FILAS = 16;
export const AVISO_RECUENTO_REPARTO = 'Las familias cuentan en Resumen y Reparto durante los primeros 90 días desde el vencimiento, incluido el día 90, con o sin cita. Desde el día 91 quedan excluidas aunque tengan cita. También se excluyen si falta una vigencia válida. La próxima cita sirve para seguir la renovación y puede ser anterior al vencimiento.';
// Las fechas compartidas y las citas no identifican a un beneficiario.
// Un menor declarado cuenta aunque falten su nombre y su fecha de nacimiento.
export function tieneDatosBeneficiario(persona) {
  return Boolean(persona.menor && !persona.titular) || ['nombre', 'apellidos', 'documento', 'nacimiento'].some(campo => String(persona[campo] ?? '').trim());
}
export function miembrosContabilizados(familia) {
  return familia.personas.filter(tieneDatosBeneficiario).length;
}
export function familiasParaExportar(familias) {
  return familias.filter(f => f.personas.some(tieneDatosBeneficiario)).map(f => ({
    ...f,
    // Conservar un titular incompleto para que la validación bloquee su exportación.
    personas: f.personas.filter(p => p.titular || tieneDatosBeneficiario(p)),
  }));
}
export function prepararReparto(datos) {
  if (datos == null) return alimentos.map(nombre => ({ nombre, cantidad: "" }));
  const filas = validarReparto(datos);
  // Retira únicamente los siete huecos originales sin usar de la versión antigua.
  const antiguo = filas.length === 16 && alimentos.every((nombre, i) => filas[i].nombre === nombre)
    && filas.slice(alimentos.length).every(fila => fila.nombre === "VARIOS" && fila.cantidad === "");
  return antiguo ? filas.slice(0, alimentos.length) : filas;
}
export function resumen(familias, hoy = new Date(), { filtrarVigencia = true } = {}) {
  if (filtrarVigencia) familias = familias.filter(f => !motivoExclusion(f, hoy));
  familias = familias.map(f => ({ ...f, personas: f.personas.filter(tieneDatosBeneficiario) })).filter(f => f.personas.length);
  const personas = familias.flatMap(f => f.personas);
  const tamanos = Array.from({length:10}, (_, i) => familias.filter(f => f.personas.length === i + 1).length);
  // La plantilla 2.0 agrupa por años cumplidos (DATEDIF), con ambos extremos incluidos.
  const edades = [0, 0, 0];
  const mesDiaHoy = `${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  for (const persona of personas) {
    const nacimiento = diaFecha(persona.nacimiento);
    if (!Number.isFinite(nacimiento) || nacimiento > diaHoy(hoy)) continue;
    const edad = hoy.getFullYear() - Number(persona.nacimiento.slice(0, 4))
      - Number(persona.nacimiento.slice(5) > mesDiaHoy);
    if (edad <= 2) edades[0]++;
    else if (edad <= 18) edades[1]++;
    else if (edad <= 100) edades[2]++;
  }
  const menoresSinNacimiento = personas.filter(p => p.menor && !p.titular && !String(p.nacimiento ?? '').trim()).length;
  return {personas:personas.length, familias:familias.length, tamanos, edades, menoresSinNacimiento,
    fuera:familias.filter(f => f.personas.length > 10).length,
    sinRango:personas.length - edades.reduce((a,b)=>a+b,0)};
}
export function envases(cantidad, miembros, familias, total) {
  if (cantidad === '' || !familias || !total) return null;
  return Math.round(Number(cantidad) / total * miembros);
}
export function validarReparto(datos) {
  if (datos == null) return [];
  if (!Array.isArray(datos) || datos.length > MAX_REPARTO_FILAS) throw new Error('El reparto del archivo no es válido.');
  return datos.map(d => {
    if (!d || typeof d.nombre !== 'string' || d.nombre.length > 100 || !(d.cantidad === '' || (typeof d.cantidad === 'number' && Number.isFinite(d.cantidad) && d.cantidad >= 0))) throw new Error('Hay una cantidad o un alimento inválido en el reparto.');
    return {nombre:d.nombre, cantidad:d.cantidad};
  });
}
