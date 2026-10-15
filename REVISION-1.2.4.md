# Revisión de escritorio — versión 1.2.4

Fecha: 14/10/2026.

## Fallos corregidos

1. **Guardar la imagen del resumen:** se generaba el PNG pero se convertía con
   `fetch(dataUrl)`. La CSP permite imágenes `data:` pero no conexiones `data:`,
   por lo que esa petición podía bloquear el guardado. Ahora se decodifica el PNG
   directamente, se valida su cabecera y se escribe con el permiso existente.
   Referencia: [MDN, connect-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/connect-src).
2. **Cancelar la importación o quitar un alimento:** el plugin instalado redefine
   `window.confirm` como función asíncrona. El código evaluaba la promesa como
   verdadera y continuaba antes de recibir la respuesta. Ahora espera el diálogo
   y respeta Cancelar. Comprobado también con una prueba del puente nativo simulado.
3. **Pulsaciones repetidas al guardar el resumen:** el botón queda deshabilitado
   hasta terminar, cancelar o fallar. Los errores nativos que llegan como texto
   se muestran correctamente en esta operación.

## Ajustes de escritorio

La solicitud del número de miembros y la confirmación escrita BORRAR utilizan
formularios internos, conservando la validación y la opción de cancelar. Es una
mejora de compatibilidad; no se ha reproducido un fallo de prompt en Windows.
Los avisos y confirmaciones usan explícitamente el plugin de diálogos.

## Validación y alcance

Se revisaron el flujo del resumen, diálogos, permisos, almacenamiento y configuración
de empaquetado, y se ejecutaron las pruebas de altas, edición, búsqueda, numeración,
validación, reparto, importación y exportación de Excel. Las pruebas nuevas comprueban
la conversión del PNG sin fetch, el rechazo de imágenes inválidas y las respuestas
asíncronas de confirmación.

Resultado: las diez suites de pruebas pasan, la compilación de producción y el
instalador NSIS x64 se generaron correctamente. Se comprobó la integridad del ZIP
y que contiene el mismo instalador generado.

El instalador incluye los cambios que ya estaban en la carpeta de trabajo, incluida
la plantilla Excel. Se mantiene el identificador de la aplicación para conservar
la ubicación habitual de los datos al actualizar.

Pendiente de comprobar en Windows: instalación/actualización, descarga efectiva del
PNG con WebView2, cancelación del guardado y uso de los formularios. No se ha realizado
una prueba interactiva en Windows y el instalador no está firmado.
