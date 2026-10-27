import { diaFecha } from './vigencia.mjs';
import { tieneDatosBeneficiario } from './reparto.mjs';

export function fechaParaAtenciones(mes, hoy) {
  if (hoy.slice(0, 7) === mes) return hoy;
  if (mes > hoy.slice(0, 7)) return `${mes}-01`;
  const [ano, numeroMes] = mes.split('-').map(Number);
  return new Date(Date.UTC(ano, numeroMes, 0)).toISOString().slice(0, 10);
}

export function validarAtenciones(mes, atenciones) {
  if (!Array.isArray(atenciones)) throw new Error('No se pudieron leer las atenciones del mes.');
  const numeros = new Set(), ids = new Set();
  return atenciones.map(a => {
    if (!a || typeof a.familiaId !== 'string' || !a.familiaId || !Number.isSafeInteger(a.numero) || a.numero < 1
      || numeros.has(a.numero) || ids.has(a.familiaId) || typeof a.titular !== 'string'
      || !Number.isFinite(diaFecha(a.fecha)) || a.fecha.slice(0, 7) !== mes
      || !Array.isArray(a.personas) || !a.personas.length) {
      throw new Error('Hay una atención inválida o una familia repetida en este mes.');
    }
    numeros.add(a.numero); ids.add(a.familiaId);
    const personas = a.personas.map(p => {
      if (!p || typeof p.nombre !== 'string' || typeof p.nacimiento !== 'string' || typeof p.menor !== 'boolean') {
        throw new Error('Los miembros de una atención guardada no son válidos.');
      }
      return { nombre: p.nombre, nacimiento: p.nacimiento, menor: p.menor };
    });
    return { familiaId: a.familiaId, numero: a.numero, titular: a.titular, fecha: a.fecha, personas };
  });
}

export function registrarAtencion(datos, familia, fecha, { actualizar = false } = {}) {
  if (!datos.recuentoDesdeAtenciones) throw new Error('Activa primero el recuento desde las familias atendidas.');
  if (!familia || typeof familia.id !== 'string' || !familia.id || !Number.isSafeInteger(familia.numero) || familia.numero < 1) {
    throw new Error('No se encontró la familia del listado.');
  }
  const atenciones = validarAtenciones(datos.mes, datos.atenciones ?? []);
  const indice = atenciones.findIndex(a => a.familiaId === familia.id || a.numero === familia.numero);
  // Repetir una marca conserva tanto los miembros como la fecha de la primera.
  if (indice >= 0 && !actualizar) return { ...datos, atenciones };
  const titular = familia.personas.find(p => p.titular) ?? familia.personas[0];
  const personas = familia.personas.filter(tieneDatosBeneficiario).map(p => ({
    nombre: [p.nombre, p.apellidos].filter(Boolean).join(' ').trim() || (p.menor && !p.titular ? 'Menor sin nombre' : 'Persona sin nombre'),
    nacimiento: String(p.nacimiento ?? ''), menor: Boolean(p.menor && !p.titular),
  }));
  if (!personas.length) throw new Error('Completa los miembros de esta familia antes de marcarla como atendida.');
  const atencion = { familiaId: familia.id, numero: familia.numero,
    titular: [titular?.nombre, titular?.apellidos].filter(Boolean).join(' ').trim() || 'Titular sin nombre',
    fecha: indice >= 0 ? atenciones[indice].fecha : fecha, personas };
  if (indice >= 0) atenciones[indice] = atencion;
  else atenciones.push(atencion);
  return aplicarRecuentoAtenciones({ ...datos, atenciones: validarAtenciones(datos.mes, atenciones) });
}

export function quitarAtencion(datos, numero) {
  return aplicarRecuentoAtenciones({ ...datos, atenciones: (datos.atenciones ?? []).filter(a => a.numero !== numero) });
}

export function recuentoAtenciones(datos) {
  const atenciones = datos.atenciones ?? [];
  const tamanos = Array(10).fill(0), edades = Array(4).fill(0), pendientes = [], fueraDeModelo = [];
  let personas = 0;
  for (const a of atenciones) {
    personas += a.personas.length;
    if (a.personas.length <= 10) tamanos[a.personas.length - 1]++;
    else fueraDeModelo.push(a.numero);
    for (const p of a.personas) {
      if (!p.nacimiento && p.menor) { edades[0]++; continue; }
      if (!Number.isFinite(diaFecha(p.nacimiento)) || p.nacimiento > a.fecha) {
        pendientes.push({ numero: a.numero, nombre: p.nombre });
        continue;
      }
      const edad = Number(a.fecha.slice(0, 4)) - Number(p.nacimiento.slice(0, 4))
        - Number(p.nacimiento.slice(5) > a.fecha.slice(5));
      edades[edad <= 2 ? 1 : edad <= 17 ? 2 : 3]++;
    }
  }
  return { familias: atenciones.length, personas, tamanos, edades, pendientes, fueraDeModelo };
}

export function aplicarRecuentoAtenciones(datos) {
  if (!datos.recuentoDesdeAtenciones) return datos;
  const { tamanos, edades } = recuentoAtenciones(datos);
  return { ...datos, tamanos, edades };
}

export function cambiarOrigenRecuento(datos, automatico) {
  return aplicarRecuentoAtenciones({ ...datos, tamanos: [...datos.tamanos], edades: [...datos.edades],
    atenciones: validarAtenciones(datos.mes, datos.atenciones ?? []), recuentoDesdeAtenciones: automatico });
}

export function filasAtenciones(datos, familias, consulta = '', filtro = '') {
  const guardadas = datos.atenciones ?? [];
  const usadas = new Set();
  const rows = familias.map(f => {
    const atencion = guardadas.find(a => a.familiaId === f.id || a.numero === f.numero);
    if (atencion) usadas.add(atencion.numero);
    const titular = f.personas.find(p => p.titular) ?? f.personas[0];
    return { numero: atencion?.numero ?? f.numero, familia: f, atencion,
      titular: atencion?.titular ?? ([titular?.nombre, titular?.apellidos].filter(Boolean).join(' ').trim() || 'Titular sin nombre'),
      miembros: atencion?.personas.length ?? f.personas.filter(tieneDatosBeneficiario).length,
      documento: String(titular?.documento ?? '') };
  });
  for (const atencion of guardadas) {
    if (!usadas.has(atencion.numero)) rows.push({ numero: atencion.numero, familia: null, atencion,
      titular: atencion.titular, miembros: atencion.personas.length, documento: '' });
  }
  // El número de familia permite conservar las marcas al volver a importar el listado.
  const unique = new Map(rows.map(row => [row.numero, row]));
  const q = consulta.trim().toLocaleLowerCase('es');
  return [...unique.values()].filter(row => (!filtro || Boolean(row.atencion) === (filtro === 'atendidas'))
    && (!q || (/^\d+$/.test(q) ? row.numero === Number(q)
      : `${row.titular} ${row.documento}`.toLocaleLowerCase('es').includes(q))))
    .sort((a, b) => a.numero - b.numero);
}

// Solo sincroniza familias editadas en esta sesión; las importaciones y bajas
// conservan la instantánea anterior de la atención.
export function sincronizarAtenciones(datos, anteriores, siguientes) {
  let resultado = datos;
  for (const atencion of datos.atenciones ?? []) {
    const anterior = anteriores.find(f => f.id === atencion.familiaId);
    const siguiente = siguientes.find(f => f.id === atencion.familiaId);
    if (!anterior || !siguiente || JSON.stringify(anterior) === JSON.stringify(siguiente)
      || !siguiente.personas.some(tieneDatosBeneficiario)) continue;
    const actualizado = registrarAtencion({ ...resultado, recuentoDesdeAtenciones: true }, siguiente, atencion.fecha, { actualizar: true });
    resultado = aplicarRecuentoAtenciones({ ...actualizado, recuentoDesdeAtenciones: datos.recuentoDesdeAtenciones,
      tamanos: datos.tamanos, edades: datos.edades });
  }
  return resultado;
}

export function cambiarFechaAtencion(datos, numero, fecha) {
  if (!datos.recuentoDesdeAtenciones) throw new Error('Activa primero el recuento desde las familias atendidas.');
  const atenciones = validarAtenciones(datos.mes, (datos.atenciones ?? []).map(a => a.numero === numero ? { ...a, fecha } : a));
  return aplicarRecuentoAtenciones({ ...datos, atenciones });
}

export function marcarAtencionRapida(datos, familias, consulta, fecha) {
  const texto = consulta.trim();
  if (!/^\d+$/.test(texto)) throw new Error('Escribe el número exacto de familia para marcar con Enter.');
  const row = filasAtenciones(datos, familias, texto).find(row => row.numero === Number(texto));
  if (!row) throw new Error(`No se encontró la familia ${texto}.`);
  if (!datos.recuentoDesdeAtenciones) throw new Error('Activa primero el recuento desde las familias atendidas.');
  if (row.atencion) return { datos, numero: row.numero, yaAtendida: true };
  return { datos: registrarAtencion(datos, row.familia, fecha), numero: row.numero, yaAtendida: false };
}
