import { diaFecha, motivoExclusion, vigenciaAplicada } from './vigencia.mjs';
import { tieneDatosBeneficiario, resumen } from './reparto.mjs';
import { recuentoAtenciones, validarAtenciones } from './atenciones.mjs';

const mesValido = m => typeof m === 'string' && /^(?:19|[2-9]\d)\d{2}-(?:0[1-9]|1[0-2])$/.test(m);
export function finMes(mes) {
  if (!mesValido(mes)) throw new Error('Selecciona un mes válido.');
  const [a, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}
export function mesesTrimestre(mes) {
  finMes(mes);
  const inicio = Math.floor((Number(mes.slice(5)) - 1) / 3) * 3 + 1;
  return [0, 1, 2].map(i => `${mes.slice(0, 4)}-${String(inicio + i).padStart(2, '0')}`);
}
const ultima = (filas, mes) => filas.filter(f => f.mes <= mes).sort((a, b) => a.mes.localeCompare(b.mes)).at(-1);
const datos = f => ({ numero: f.numero, personas: structuredClone(f.personas) });
export function iniciarSeguimiento(familia, mes, origen = 'alta') {
  finMes(mes);
  if (familia.seguimiento) return familia;
  return { ...familia, seguimiento: { inicio: mes, origen, estados: [{ mes, alta: true }], versiones: [{ mes, ...datos(familia) }], participaciones: [{ mes, ...datos(familia) }] } };
}
export function validarSeguimiento(s) {
  if (!s || !mesValido(s.inicio) || !Array.isArray(s.estados) || !s.estados.length || !Array.isArray(s.versiones) || !s.versiones.length) throw new Error('El historial de altas y bajas no es válido.');
  for (const filas of [s.estados, s.versiones]) {
    if (new Set(filas.map(f => f.mes)).size !== filas.length || filas.some(f => !mesValido(f.mes))) throw new Error('Hay meses inválidos o repetidos en el historial familiar.');
  }
  if (s.participaciones !== undefined && (!Array.isArray(s.participaciones) || s.participaciones.some(p => !mesValido(p.mes) || !Number.isSafeInteger(p.numero) || !Array.isArray(p.personas) || !p.personas.length))) throw new Error('Las participaciones trimestrales guardadas no son válidas.');
  if (s.estados.some(e => typeof e.alta !== 'boolean') || s.versiones.some(v => !Number.isSafeInteger(v.numero) || v.numero < 1 || !Array.isArray(v.personas) || !v.personas.length)) throw new Error('Los datos del historial familiar no son válidos.');
  return s;
}
export function familiaEnMes(familia, mes) {
  const s = familia.seguimiento;
  if (!s) return { ...familia, deAlta: true };
  validarSeguimiento(s);
  const version = ultima(s.versiones, mes);
  const estado = ultima(s.estados, mes);
  if (!version || !estado) return null;
  return { ...familia, numero: version.numero, personas: structuredClone(version.personas), deAlta: estado.alta };
}
export function cambiarAlta(familia, mes, alta) {
  finMes(mes);
  if (typeof alta !== 'boolean') throw new Error('Selecciona alta o baja.');
  const copia = structuredClone(iniciarSeguimiento(familia, mes));
  if (mes < copia.seguimiento.inicio) throw new Error('Ese mes es anterior al comienzo del historial de esta familia.');
  if (!alta && familiaEnMes(copia, mes)?.deAlta && !(copia.seguimiento.participaciones ?? []).some(p => p.mes === mes)) {
    copia.seguimiento.participaciones = [...(copia.seguimiento.participaciones ?? []), { mes, ...datos(familiaEnMes(copia, mes)) }];
  }
  copia.seguimiento.estados = [...copia.seguimiento.estados.filter(e => e.mes !== mes), { mes, alta }].sort((a, b) => a.mes.localeCompare(b.mes));
  return copia;
}
// Captura los datos por mes, sin reescribir los meses anteriores.
export function guardarVersiones(anteriores, siguientes, mes) {
  return siguientes.map(f => {
    const anterior = anteriores.find(a => a.id === f.id);
    let copia = iniciarSeguimiento(f, mes);
    if (!anterior || JSON.stringify(datos(anterior)) !== JSON.stringify(datos(f)) || JSON.stringify(datos(familiaEnMes(copia, mes) ?? f)) !== JSON.stringify(datos(f))) {
      copia = structuredClone(copia);
      copia.seguimiento.versiones = [...copia.seguimiento.versiones.filter(v => v.mes !== mes), { mes, ...datos(f) }].sort((a, b) => a.mes.localeCompare(b.mes));
    }
    if (familiaEnMes(copia, mes)?.deAlta) {
      copia = structuredClone(copia);
      copia.seguimiento.participaciones = [...(copia.seguimiento.participaciones ?? []).filter(v => v.mes !== mes), { mes, ...datos(f) }];
    }
    return copia;
  });
}
export function visibleEnTrimestre(familia, mes) {
  const meses = mesesTrimestre(mes), ultimoMes = meses[2];
  if (!familia.seguimiento) return true;
  return meses.some(m => familiaEnMes(familia, m)?.deAlta)
    || familia.seguimiento.estados.some(e => !e.alta && e.mes >= meses[0] && e.mes <= ultimoMes);
}
export function filasAltas(familias, mes) {
  const fecha = finMes(mes), referencia = new Date(`${fecha}T12:00:00`);
  return familias.map(f => {
    const version = familiaEnMes(f, mes);
    if (!version) return { familia: f, incluida: false, motivo: 'Sin historial para este mes', desconocida: true };
    const motivo = !version.deAlta ? 'De baja' : motivoExclusion(version, referencia);
    return { familia: version, incluida: !motivo && version.personas.some(tieneDatosBeneficiario), motivo: motivo || (version.personas.some(tieneDatosBeneficiario) ? '' : 'Sin miembros completos') };
  });
}
export function historialIncompleto(familias, mes) {
  return familias.some(f => f.seguimiento && f.seguimiento.inicio > mes && f.seguimiento.origen !== 'alta');
}
export function actualizarAltas(datosMes, familias) {
  if (!datosMes.recuentoDesdeAltas) return datosMes;
  const fecha = finMes(datosMes.mes);
  const altas = filasAltas(familias, datosMes.mes).filter(f => f.incluida).map(({ familia: f }) => {
    const titular = f.personas.find(p => p.titular) ?? f.personas[0];
    return { familiaId: f.id, numero: f.numero, titular: [titular?.nombre, titular?.apellidos].filter(Boolean).join(' ').trim() || 'Titular sin nombre', fecha,
      personas: f.personas.filter(tieneDatosBeneficiario).map(p => ({ nombre: [p.nombre, p.apellidos].filter(Boolean).join(' ').trim() || 'Menor sin nombre', nacimiento: String(p.nacimiento ?? ''), menor: Boolean(p.menor && !p.titular) })) };
  });
  const contadas = validarAtenciones(datosMes.mes, altas);
  const { tamanos, edades } = recuentoAtenciones({ atenciones: contadas });
  return { ...datosMes, altas: contadas, tamanos, edades, historialIncompleto: historialIncompleto(familias, datosMes.mes) };
}
export function activarAltas(datosMes, familias) {
  const recuentoAnterior = datosMes.recuentoAnterior ?? { tamanos: [...datosMes.tamanos], edades: [...datosMes.edades], desdeAtenciones: Boolean(datosMes.recuentoDesdeAtenciones) };
  return actualizarAltas({ ...datosMes, recuentoAnterior, recuentoDesdeAtenciones: false, atenciones: datosMes.atenciones ?? [], recuentoDesdeAltas: true }, familias);
}
// Familias vigentes en algún momento del trimestre, una sola vez. Las bajas
// posteriores no anulan su participación anterior.
export function familiasRecuentoTrimestral(familias, mes) {
  const meses = mesesTrimestre(mes), resultado = [];
  for (const f of familias.filter(f => visibleEnTrimestre(f, mes))) {
    let elegida;
    for (const m of meses) {
      const v = familiaEnMes(f, m);
      if (!v?.deAlta) continue;
      const titular = v.personas.find(p => p.titular) ?? v.personas[0];
      const vence = diaFecha(vigenciaAplicada(titular));
      if (Number.isFinite(vence) && diaFecha(`${m}-01`) <= vence + 90) elegida = { ...v, mes: m };
    }
    for (const v of f.seguimiento?.participaciones ?? []) {
      if (v.mes < meses[0] || v.mes > meses[2]) continue;
      const titular = v.personas.find(p => p.titular) ?? v.personas[0];
      const vence = diaFecha(vigenciaAplicada(titular));
      if (Number.isFinite(vence) && diaFecha(`${v.mes}-01`) <= vence + 90 && (!elegida || v.mes >= (elegida.mes ?? meses[0]))) elegida = { ...f, ...v };
    }
    if (elegida) resultado.push(elegida);
  }
  return resultado;
}
export function resumenTrimestral(familias, mes) {
  return resumen(familiasRecuentoTrimestral(familias, mes), new Date(`${finMes(mesesTrimestre(mes)[2])}T12:00:00`), { filtrarVigencia: false });
}

export function incorporarImportacion(anteriores, importadas, mes) {
  const usadas = new Set();
  const identidad = f => {
    const t = f.personas.find(p => p.titular) ?? f.personas[0];
    const documento = String(t?.documento ?? '').trim().toLocaleUpperCase('es');
    return documento ? `doc:${documento}` : `nombre:${[t?.nombre, t?.apellidos].filter(Boolean).join(' ').trim().toLocaleLowerCase('es')}`;
  };
  const resultado = importadas.map(f => {
    const anterior = anteriores.find(a => a.id === f.id || (a.numero === f.numero && identidad(a) === identidad(f)));
    if (!anterior) {
      // Los números de expediente archivados siguen reservados para no mezclar familias.
      if (anteriores.some(a => a.numero === f.numero)) throw new Error(`El número ${f.numero} pertenece a otro expediente guardado. Revisa la numeración antes de importar.`);
      return iniciarSeguimiento(f, mes, 'importacion');
    }
    usadas.add(anterior.id);
    return { ...f, id: anterior.id, seguimiento: structuredClone(iniciarSeguimiento(anterior, mes).seguimiento) };
  });
  for (const anterior of anteriores) {
    if (usadas.has(anterior.id)) continue;
    resultado.push(familiaEnMes(anterior, mes)?.deAlta ? cambiarAlta(anterior, mes, false) : anterior);
  }
  return resultado.sort((a, b) => a.numero - b.numero);
}
