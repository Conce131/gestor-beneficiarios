# Revisión de uso: registro y renovación de derivaciones

Fecha: 27/10/2026. Actualizada con las aclaraciones del usuario.

## Criterios confirmados

- Las entidades reciben una derivación y registran o renuevan la familia.
- Renovar consiste en editar las fechas de derivación y vigencia en el listado.
  Se mantiene este recorrido; no se propone una ficha adicional de renovación.
- La documentación de menores no es obligatoria. La validación existente ya
  admite menores sin documento. La de las personas adultas sigue siendo obligatoria.

## Simplificaciones incorporadas

- Los números de familia se distinguen con # en el listado trimestral, el mensual
  de altas y la tabla de atenciones. El número almacenado y el del Excel siguen
  siendo numéricos. La búsqueda por número admite 12 y #12 en el trimestral y
  en Familias de alta.
- El listado dispone de Deshacer y Rehacer para las ediciones guardadas de texto,
  fechas, condición de menor y origen de la derivación. Incluye las fechas
  compartidas por los miembros y la condición de menor calculada por nacimiento.
- Ctrl+Z deshace; Ctrl+Mayús+Z o Ctrl+Y rehacen. Mientras se escribe una casilla,
  se conserva la edición normal de texto del navegador. Escape recupera el valor
  guardado de una casilla que aún se está editando.
- Cada recuperación se guarda y actualiza los recuentos automáticos con las
  reglas actuales. No sustituye familias enteras ni versiones de meses anteriores.
- Se conservan hasta 100 ediciones durante la sesión. El historial se limpia al
  recargar, importar, añadir o borrar familias o miembros, o borrar todos los datos.
  No se aplica a la consulta de meses anteriores. Los borrados mantienen su propio
  botón Deshacer borrado.
- Las etiquetas de documentación del formulario coinciden con la validación:
  opcional para menores no titulares y obligatoria para personas adultas.

## Mejoras pendientes de considerar

| Situación actual | Propuesta |
| --- | --- |
| Cargar Excel actualiza el listado completo y da de baja a las familias ausentes. | Identificarlo como Actualizar listado completo y mostrar antes un resumen de altas, cambios y bajas. |
| El guardado automático puede conservar fichas incompletas. | Distinguir Cambios guardados de Listado listo para entregar. |
| Los pendientes se reparten entre datos, vigencias y citas. | Mostrar el motivo y un acceso directo a la casilla que necesita revisión. |
| El resumen mensual ofrece varias formas de compartir. | Explicar los pasos: revisar, generar y adjuntar o copiar al correo. |
| El Excel trimestral no incluye todos los meses y repartos. | Ofrecer Guardar copia completa y Recuperar copia para trasladar el trabajo. |
| La ayuda de algunos fallos muestra comandos de desarrollo. | Sustituirlos en la entrega por instrucciones de reapertura y contacto de soporte. |

## Verificación

Se han revisado el código de navegación, altas, edición, pendientes, importación,
exportación y almacenamiento. La revisión inicial pasó los 24 archivos de pruebas
existentes y la compilación. Las nuevas pruebas de historial comprueban las
recuperaciones de fechas compartidas, nacimiento, condición de menor, origen y
conservación de meses anteriores, otras familias y cambios ajenos.

Queda pendiente una sesión interactiva con personal de una entidad para observar
el registro de familias, la renovación por fechas, la corrección de errores y
la preparación de la entrega sin instrucciones verbales.
