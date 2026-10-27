import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { crearMensual } from '../src/mensual.mjs';

test('imagen y correo comparten las cifras del mes, escapan texto y codifican el borrador', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } });
  try {
    const { resumenParaEnviar, imagenResumenMensual, enlaceBorrador } = await server.ssrLoadModule('/src/mensual-envio.js');
    const datos = crearMensual('2026-10', 'Asociación <Ejemplo> & familias');
    datos.tamanos = [2, 3, 0, 0, 0, 0, 0, 0, 0, 0];
    datos.edades = [0, 1, 2, 5];
    const resumen = resumenParaEnviar(datos);
    assert.equal(resumen.totalFamilias, 5);
    assert.equal(resumen.totalPersonas, 8);
    assert.equal(resumen.archivo, 'Resumen-mensual-2026-10.png');
    assert.match(resumen.asunto, /octubre de 2026/);
    assert.match(resumen.cuerpo, /Familias: 5\nBeneficiarios: 8/);
    assert.match(resumen.cuerpo, /2 miembros: 3/);
    assert.match(resumen.cuerpo, /3–17 años: 2/);
    const html = imagenResumenMensual(resumen, '/logo.png');
    assert.match(html, /Asociación &lt;Ejemplo&gt; &amp; familias/);
    assert.doesNotMatch(html, /<Ejemplo>|<input|<button/);
    const uri = new URL(enlaceBorrador({ ...resumen, asunto: 'Asunto & prueba ? #', cuerpo: 'Línea 1\nLínea 2 & más' }));
    assert.equal(uri.protocol, 'mailto:');
    assert.equal(decodeURIComponent(uri.pathname), resumen.para);
    assert.equal(uri.searchParams.get('subject'), 'Asunto & prueba ? #');
    assert.equal(uri.searchParams.get('body'), 'Línea 1\r\nLínea 2 & más');
    assert.throws(() => enlaceBorrador({ ...resumen, para: 'persona@ejemplo.org?bcc=otro@ejemplo.org' }), /destinatario/);
    assert.throws(() => resumenParaEnviar({ ...datos, entidad: '' }), /entidad/);
    assert.throws(() => resumenParaEnviar({ ...datos, edades: [0, 0, 0, 1] }), /coincidir/);
    assert.throws(() => resumenParaEnviar({ ...datos, recuentoDesdeAltas: true, recuentoDesdeAtenciones: false, atenciones: [], altas: [], historialIncompleto: true }), /historial/);
  } finally { await server.close(); }
});
