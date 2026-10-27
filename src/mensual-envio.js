import { GRUPOS_MENSUALES, nombreMes, resumenMensual, erroresExportacionMensual } from './mensual.mjs';
import { esc } from './utils.js';

export const CORREO_ALMACEN = 'almacen@bancoalimentostfe.org';

export function resumenParaEnviar(datos) {
  const errores = erroresExportacionMensual(datos);
  if (errores.length) throw new Error(errores.join(' '));
  const r = resumenMensual(datos);
  const entidad = datos.entidad.trim();
  const periodo = nombreMes(datos.mes);
  const familias = datos.tamanos.map((n, i) => [`${i + 1} ${i === 0 ? 'miembro' : 'miembros'}`, Number(n)]);
  const edades = GRUPOS_MENSUALES.map((grupo, i) => [grupo, Number(datos.edades[i])]);
  return {
    entidad, periodo, familias, edades, totalFamilias: r.familias, totalPersonas: r.personas,
    archivo: `Resumen-mensual-${datos.mes}.png`,
    para: CORREO_ALMACEN,
    asunto: `Resumen mensual · ${entidad} · ${periodo}`,
    cuerpo: [
      'Buenos días,', '',
      `Enviamos el resumen mensual de ${entidad}, correspondiente a ${periodo}, para prever los alimentos del siguiente mes.`, '',
      `Familias: ${r.familias}`, `Beneficiarios: ${r.personas}`, '',
      'FAMILIAS POR NÚMERO DE MIEMBROS',
      ...familias.map(([grupo, cantidad]) => `${grupo}: ${cantidad}`), '',
      'BENEFICIARIOS POR EDAD',
      ...edades.map(([grupo, cantidad]) => `${grupo}: ${cantidad}`), '',
      'Un saludo,', entidad,
    ].join('\n'),
  };
}

export function enlaceBorrador({ para, asunto, cuerpo }) {
  if (!/^[^\s@,;?&#]+@[^\s@,;?&#]+\.[^\s@,;?&#]+$/.test(para)) throw new Error('Escribe un destinatario de correo válido.');
  return `mailto:${encodeURIComponent(para)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo.replace(/\r?\n/g, '\r\n'))}`;
}

// Informe independiente de los controles y del tamaño de la ventana.
export function imagenResumenMensual(resumen, logo) {
  const filas = rows => rows.map(([nombre, cantidad]) => `<tr><td style="white-space:normal;overflow-wrap:anywhere;padding:8px 12px;border-bottom:1px solid #e0e7eb">${esc(nombre)}</td><td style="white-space:normal;overflow-wrap:anywhere;padding:8px 12px;border-bottom:1px solid #e0e7eb;text-align:right;font-weight:bold">${cantidad}</td></tr>`).join('');
  const tabla = (titulo, columna, rows) => `<section style="flex:1;min-width:0"><h2 style="font-size:19px;margin:0 0 12px;color:#193f55">${titulo}</h2><table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:15px"><thead><tr><th style="position:static;white-space:normal;padding:10px 12px;background:#edf3f6;text-align:left;font-size:14px;box-shadow:none">${columna}</th><th style="position:static;white-space:normal;padding:10px 12px;background:#edf3f6;text-align:right;font-size:14px;box-shadow:none">${columna === 'Miembros' ? 'Familias' : 'Beneficiarios'}</th></tr></thead><tbody>${filas(rows)}</tbody></table></section>`;
  return `<article style="box-sizing:border-box;width:900px;padding:36px;background:#fff;color:#202428;font-family:Arial,sans-serif;line-height:1.45">
    <img src="${esc(logo)}" alt="Banco de Alimentos de Tenerife" style="display:block;width:190px;height:auto;margin-bottom:24px">
    <h1 style="margin:0;color:#193f55;font-size:30px">Resumen mensual</h1>
    <p style="margin:4px 0 20px;color:#52616c;font-size:18px">${esc(resumen.periodo.charAt(0).toLocaleUpperCase("es") + resumen.periodo.slice(1))}</p>
    <p style="margin:0 0 22px;font-size:20px;font-weight:bold;overflow-wrap:anywhere">${esc(resumen.entidad)}</p>
    <div style="display:flex;gap:16px;margin-bottom:28px">${[[resumen.totalFamilias, 'Familias'], [resumen.totalPersonas, 'Beneficiarios']].map(([n, label]) => `<div style="flex:1;padding:16px 20px;border:1px solid #dbe3e8;border-radius:8px;background:#f5f8fa"><strong style="display:block;font-size:30px;color:#193f55">${n}</strong><span style="font-size:15px;color:#52616c">${label}</span></div>`).join('')}</div>
    <div style="display:flex;align-items:flex-start;gap:28px">${tabla('Familias por miembros', 'Miembros', resumen.familias)}${tabla('Beneficiarios por edad', 'Rango de edad', resumen.edades)}</div>
    <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #dbe3e8;font-size:13px;color:#52616c">Cifras del mes de cierre para prever los alimentos del siguiente mes.</p>
  </article>`;
}
