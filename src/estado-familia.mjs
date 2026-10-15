import { erroresFamilia } from './validacion.mjs';

export function estado(f, hoy = new Date()) {
  const errores = erroresFamilia(f, hoy);
  if (errores.some(error => error.campo !== 'proximaCita')) return ['incomplete', 'Sin completar'];
  const titular = f.personas.find(p => p.titular);
  const caducada = new Date(`${titular.vigencia}T23:59:59.999`) < hoy;
  if (caducada) {
    return errores.length ? ['expired', 'Caducada'] : ['ok', 'Correcta'];
  }
  if (errores.length) return ['incomplete', 'Sin completar'];
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const limite = new Date(inicioHoy);
  limite.setDate(limite.getDate() + 60);
  if (new Date(`${titular.vigencia}T00:00:00`) <= limite) return ['warn', 'Próxima'];
  return ['ok', 'Correcta'];
}
