export const alimentos = ['Leche', 'Harinas y gofio', 'Arroz', 'Pasta', 'Legumbres', 'Salsas variadas', 'Aceites', 'Pescado en conserva', 'Carne en conserva'];
export const MAX_REPARTO_FILAS = 16;
export function resumen(familias, hoy = new Date()) {
  const personas = familias.flatMap(f => f.personas);
  const tamanos = Array.from({length:10}, (_, i) => familias.filter(f => f.personas.length === i + 1).length);
  const fecha = anos => new Date(hoy.getFullYear() - anos, hoy.getMonth(), hoy.getDate());
  // Límites exactos de las fórmulas DATE/COUNTIFS de Resumen (incluido el extremo inferior).
  const edades = [[3, 0], [18, 3], [100, 18]].map(([desde, hasta]) => personas.filter(p => {
    if (!p.nacimiento) return false;
    const n = new Date(p.nacimiento + 'T00:00:00');
    return n >= fecha(desde) && n < fecha(hasta);
  }).length);
  return {personas:personas.length, familias:familias.length, tamanos, edades,
    fuera:familias.filter(f => f.personas.length > 10).length,
    sinRango:personas.length - edades.reduce((a,b)=>a+b,0)};
}
export function envases(cantidad, miembros, familias, total) {
  if (!familias || !total) return null;
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
