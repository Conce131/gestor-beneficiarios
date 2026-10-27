import { prepararReparto, validarReparto } from './reparto.mjs';
import { validarAtenciones, aplicarRecuentoAtenciones, recuentoAtenciones } from './atenciones.mjs';

export const GRUPOS_MENSUALES = ['Menores sin edad conocida', '0–2 años', '3–17 años', '18 años o más'];
export const mesValido = mes => typeof mes === 'string' && /^(?:19|[2-9]\d)\d{2}-(?:0[1-9]|1[0-2])$/.test(mes);
export const recuentoValido = valor => valor === '' || (Number.isSafeInteger(valor) && valor >= 0);

export function crearMensual(mes, entidad = '', alimentos = null) {
  if (!mesValido(mes)) throw new Error('Selecciona un mes válido.');
  return { mes, entidad, tamanos: Array(10).fill(''), edades: Array(4).fill(''),
    reparto: prepararReparto(alimentos).map(a => ({ nombre: a.nombre, cantidad: '' })) };
}

export function validarMensual(datos) {
  if (!datos || !mesValido(datos.mes) || typeof datos.entidad !== 'string' || datos.entidad.length > 200
    || !Array.isArray(datos.tamanos) || datos.tamanos.length !== 10 || !datos.tamanos.every(recuentoValido)
    || !Array.isArray(datos.edades) || datos.edades.length !== 4 || !datos.edades.every(recuentoValido)
    || !Array.isArray(datos.reparto)) throw new Error('El resumen mensual guardado no es válido.');
  const mensual = { mes: datos.mes, entidad: datos.entidad, tamanos: [...datos.tamanos], edades: [...datos.edades], reparto: validarReparto(datos.reparto) };
  if (datos.atenciones !== undefined || datos.recuentoDesdeAtenciones !== undefined) {
    if (typeof datos.recuentoDesdeAtenciones !== 'boolean') throw new Error('El origen del recuento mensual no es válido.');
    mensual.atenciones = validarAtenciones(datos.mes, datos.atenciones);
    mensual.recuentoDesdeAtenciones = datos.recuentoDesdeAtenciones;
  }
  if (datos.recuentoDesdeAltas !== undefined) {
    if (typeof datos.recuentoDesdeAltas !== 'boolean' || (datos.recuentoDesdeAltas && mensual.recuentoDesdeAtenciones)) throw new Error('El origen del recuento mensual no es válido.');
    mensual.recuentoDesdeAltas = datos.recuentoDesdeAltas;
    if (datos.historialIncompleto !== undefined && typeof datos.historialIncompleto !== 'boolean') throw new Error('El estado del historial mensual no es válido.');
    mensual.historialIncompleto = Boolean(datos.historialIncompleto);
    mensual.altas = validarAtenciones(datos.mes, datos.altas ?? []);
    if (mensual.recuentoDesdeAltas) {
      const { tamanos, edades } = recuentoAtenciones({ atenciones: mensual.altas });
      mensual.tamanos = tamanos; mensual.edades = edades;
    }
  }
  if (datos.recuentoAnterior !== undefined) {
    const a = datos.recuentoAnterior;
    if (!a || typeof a.desdeAtenciones !== 'boolean' || !Array.isArray(a.tamanos) || a.tamanos.length !== 10 || !a.tamanos.every(recuentoValido)
      || !Array.isArray(a.edades) || a.edades.length !== 4 || !a.edades.every(recuentoValido)) throw new Error('La copia del recuento anterior no es válida.');
    mensual.recuentoAnterior = { tamanos: [...a.tamanos], edades: [...a.edades], desdeAtenciones: a.desdeAtenciones };
  }
  return aplicarRecuentoAtenciones(mensual);
}

export function validarMensuales(datos) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) throw new Error('No se pudieron leer los meses guardados.');
  return Object.fromEntries(Object.entries(datos).map(([mes, dato]) => {
    const mensual = validarMensual(dato);
    if (mes !== mensual.mes) throw new Error('El mes guardado no coincide con su resumen.');
    return [mes, mensual];
  }));
}

export function resumenMensual(datos) {
  const familias = datos.tamanos.reduce((s, n) => s + Number(n), 0);
  const personas = datos.tamanos.reduce((s, n, i) => s + Number(n) * (i + 1), 0);
  const porEdad = datos.edades.reduce((s, n) => s + Number(n), 0);
  const diferencia = porEdad - personas;
  const coincide = diferencia === 0;
  const atenciones = datos.recuentoDesdeAltas ? recuentoAtenciones({ atenciones: datos.altas }) : datos.recuentoDesdeAtenciones ? recuentoAtenciones(datos) : null;
  const atencionesValidas = !atenciones || (!atenciones.pendientes.length && !atenciones.fueraDeModelo.length);
  return { familias, personas, porEdad, diferencia, coincide,
    puedeRepartir: coincide && personas > 0 && atencionesValidas && !(datos.recuentoDesdeAltas && datos.historialIncompleto) };
}

export function estadoMensual(datos) {
  const r = resumenMensual(datos);
  if (!r.coincide) return { tipo: 'error', texto: `Los totales no coinciden: hay una diferencia de ${Math.abs(r.diferencia)} beneficiarios.` };
  if (!r.personas) return { tipo: 'empty', texto: 'Mes sin beneficiarios. Ya puedes generar el Excel.' };
  return { tipo: 'ok', texto: 'Los totales coinciden. Ya puedes generar el Excel.' };
}

export function erroresExportacionMensual(datos) {
  datos = validarMensual(datos);
  const r = resumenMensual(datos), errores = [];
  if (datos.recuentoDesdeAltas && datos.historialIncompleto) errores.push('No hay historial suficiente para reconstruir las altas de este mes. Conserva el recuento anterior o introduce las cifras manualmente.');
  if (!datos.entidad.trim()) errores.push('Escribe el nombre de la entidad.');
  if (!r.coincide) errores.push('El total de beneficiarios por familias debe coincidir con el total por edades.');
  if (datos.recuentoDesdeAtenciones || datos.recuentoDesdeAltas) {
    const atenciones = recuentoAtenciones(datos.recuentoDesdeAltas ? { atenciones: datos.altas } : datos);
    if (atenciones.pendientes.length) errores.push(`Falta una fecha de nacimiento válida en ${atenciones.pendientes.length} personas del recuento. Revisa los nacimientos en el listado.`);
    if (atenciones.fueraDeModelo.length) errores.push('Hay familias del recuento con más de 10 miembros; el modelo mensual actual no admite esos tamaños.');
  }
  return errores;
}

export function nombreMes(mes) {
  if (!mesValido(mes)) return '';
  return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${mes}-01T12:00:00Z`));
}
