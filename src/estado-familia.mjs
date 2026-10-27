import { erroresFamilia } from './validacion.mjs';
import { vigenciaAplicada, diaFecha, diaHoy, DIAS_PRORROGA, errorProximaCita } from './vigencia.mjs';

export function estado(f, hoy = new Date()) {
  const errores = erroresFamilia(f, hoy);
  if (errores.some(error => error.campo !== 'proximaCita')) return ['incomplete', 'Sin completar'];
  const titular = f.personas.find(p => p.titular);
  const vigencia = vigenciaAplicada(titular);
  if (diaHoy(hoy) > diaFecha(vigencia) + DIAS_PRORROGA) return ['expired', 'Fuera de recuento'];
  if (f.personas.some(p => errorProximaCita(titular, p.proximaCita, hoy))) return ['expired', 'Fuera de plazo'];
  if (diaFecha(vigencia) < diaHoy(hoy)) return ['expired', 'Caducada'];
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const limite = new Date(inicioHoy);
  limite.setDate(limite.getDate() + 60);
  if (new Date(`${vigencia}T00:00:00`) <= limite) return ['warn', 'Próxima'];
  return ['ok', 'Correcta'];
}

export function descripcionEstado(f, hoy = new Date()) {
  const [, etiqueta] = estado(f, hoy);
  if (etiqueta === 'Sin completar') return 'Completa los datos resaltados para poder revisar la situación de la familia.';
  const titular = f.personas.find(p => p.titular);
  if (etiqueta === 'Fuera de recuento') {
    return 'Han pasado más de 90 días desde el vencimiento de la vigencia. Esta familia queda fuera del mensual si mantiene esa vigencia al cierre del mes. Su participación anterior en el trimestre se conserva. Revisa y actualiza la vigencia; una cita no amplía este plazo.';
  }
  if (etiqueta === 'Fuera de plazo') {
    const persona = f.personas.find(p => errorProximaCita(titular, p.proximaCita, hoy));
    return `${errorProximaCita(titular, persona?.proximaCita, hoy)} Corrige la cita o revisa la vigencia. La cita es un aviso para la renovación; el recuento depende de la vigencia y su plazo de 90 días.`;
  }
  if (etiqueta === 'Caducada') {
    return 'La vigencia ha vencido y si continúa de alta, la familia puede contar en el mensual durante los primeros 90 días, incluido el día 90, aunque no tenga cita. Revisa la próxima cita y la renovación de la vigencia.';
  }
  if (etiqueta === 'Próxima') return 'La vigencia vence en los próximos 60 días. Revisa cuándo corresponde renovarla.';
  return 'Los datos están completos y la vigencia no vence en los próximos 60 días.';
}
