export const DIAS_PRORROGA = 90;
const DIA = 86400000;

// Días de calendario en UTC: los cambios de hora no alteran el plazo.
export function diaFecha(valor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor ?? '')) return NaN;
  const [ano, mes, dia] = valor.split('-').map(Number);
  const fecha = new Date(Date.UTC(ano, mes - 1, dia));
  return ano >= 1900 && fecha.getUTCFullYear() === ano && fecha.getUTCMonth() === mes - 1
    && fecha.getUTCDate() === dia ? fecha.getTime() / DIA : NaN;
}

export function diaHoy(hoy = new Date()) {
  return Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()) / DIA;
}

export function vigenciaAplicada(persona) {
  if (persona?.serviciosSociales !== false) return persona?.vigencia ?? '';
  const dia = diaFecha(persona.derivacion);
  if (!Number.isFinite(dia)) return '';
  const origen = new Date(dia * DIA);
  const ultimo = new Date(Date.UTC(origen.getUTCFullYear(), origen.getUTCMonth() + 4, 0));
  const fecha = new Date(Date.UTC(ultimo.getUTCFullYear(), ultimo.getUTCMonth(),
    Math.min(origen.getUTCDate(), ultimo.getUTCDate())));
  if (fecha.getUTCFullYear() > 9999) return '';
  const manual = diaFecha(persona.vigencia);
  if (String(persona.vigencia ?? '').trim() && !Number.isFinite(manual)) return '';
  return Number.isFinite(manual) && manual < fecha.getTime() / DIA
    ? persona.vigencia : fecha.toISOString().slice(0, 10);
}

export function errorProximaCita(titular, cita, hoy = new Date()) {
  if (!String(cita ?? '').trim()) return '';
  const dia = diaFecha(cita);
  if (!Number.isFinite(dia)) return 'Indica una fecha válida para la próxima cita.';
  const vence = diaFecha(vigenciaAplicada(titular));
  if (!Number.isFinite(vence)) return 'Completa la vigencia antes de indicar la próxima cita.';
  if (dia < diaHoy(hoy)) return 'La cita ya pasó. Anota una próxima cita vigente.';
  if (dia > vence + DIAS_PRORROGA) return 'La próxima cita no puede superar los 90 días desde el vencimiento de la vigencia.';
  return '';
}

export function motivoExclusion(familia, hoy = new Date()) {
  const titular = familia.personas.find(p => p.titular) ?? familia.personas[0];
  const vence = diaFecha(vigenciaAplicada(titular));
  if (!Number.isFinite(vence)) return 'Falta una vigencia válida para el recuento.';
  if (diaHoy(hoy) > vence + DIAS_PRORROGA) return 'Fuera del recuento: han pasado más de 90 días desde el vencimiento.';
  return '';
}
