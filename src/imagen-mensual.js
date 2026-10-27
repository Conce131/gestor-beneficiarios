import { toPng } from 'html-to-image';
import { imagenResumenMensual } from './mensual-envio.js';
import { pngBytes } from './png.mjs';

export async function generarImagenMensual(resumen, logo) {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:900px;pointer-events:none';
  host.setAttribute('aria-hidden', 'true');
  try {
    host.innerHTML = imagenResumenMensual(resumen, logo);
    document.body.append(host);
    await host.querySelector('img').decode();
    const dataUrl = await toPng(host.firstElementChild, { pixelRatio: 2, backgroundColor: '#fff', skipFonts: true });
    return { dataUrl, bytes: pngBytes(dataUrl) };
  } finally { host.remove(); }
}

export function copiarImagenMensual(resumen, logo) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined'
    || ClipboardItem.supports?.('image/png') === false) {
    return Promise.reject(new Error('Este navegador no permite copiar imágenes. Utiliza «Descargar imagen» para adjuntarla al correo.'));
  }
  // Entrega la promesa al portapapeles durante el clic. La imagen se genera
  // después, conservando el gesto necesario en los navegadores más restrictivos.
  const png = generarImagenMensual(resumen, logo)
    .then(({ bytes }) => new Blob([bytes], { type: 'image/png' }));
  // También consume los errores de generación si se deniega antes la escritura.
  png.catch(() => {});
  return navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
}
