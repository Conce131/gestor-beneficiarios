# Revisión de aplicación, web y Excel — 22/10/2026

Se han corregido los fallos reproducidos en el código y en las dos plantillas
actuales. Las modificaciones previas del proyecto se han conservado.

## Fallos corregidos

| Área | Fallo reproducido y efecto | Corrección |
| --- | --- | --- |
| Importación de Excel · alta | Si se omitía un titular inválido, el siguiente miembro podía convertirse en titular y aportar fechas y origen distintos. | Se omite el grupo que carece de titular válido y se informa de las filas afectadas. Las familias siguientes se siguen importando. |
| Importación de Excel · alta | Una fila con solo número de familia se ignoraba; sus miembros podían incorporarse a la familia anterior. | La fila corta la agrupación anterior y se informa de que faltan los datos del titular. |
| Guardado web · alta | Un error síncrono al escribir una fila no abortaba la transacción; podía confirmarse el borrado del listado y solo parte de sus filas. | Se aborta la transacción completa. Una prueba simula el fallo y comprueba que se conserva el listado anterior. |
| Guardado de escritorio · alta | Tras fallar la escritura en disco, la caché contenía datos sin guardar; una escritura posterior podía copiarlos a recuperación. | Se restaura la caché anterior al fallar el guardado. Se prueba la recuperación y el reintento mediante el transporte de Tauri simulado. |
| Guardado web | El listado se copiaba después de esperar a abrir la base; una modificación durante esa espera cambiaba el contenido solicitado. | La instantánea se toma al llamar al guardado, igual que en escritorio. |
| Guardado web | El acceso denegado a localStorage podía bloquear el inicio aunque IndexedDB funcionara. Fallar al retirar la copia antigua también podía marcar como fallida una escritura ya confirmada. | Se tolera la denegación de acceso al almacén antiguo; los fallos de IndexedDB y los JSON antiguos dañados se siguen notificando. |
| Importación de Excel | Se perdían partes de nombres guardados como texto con varios formatos. | Se concatenan todos los fragmentos de texto de la celda. |
| Importación de Excel | Se rechazaban rutas internas absolutas válidas del paquete XLSX. | Se resuelven rutas relativas y absolutas internas; se rechazan relaciones externas y rutas que salen del paquete. |
| Importación de Excel | Los libros con calendario 1904 se interpretaban con calendario 1900. | Se utiliza la configuración del libro, incluido el día cero de 1904. Se rechaza el inexistente 29/02/1900. |
| Reparto de app y Excel mensual | Una cantidad vacía se convertía en cero unidades, aunque estuviera pendiente de introducir. | El vacío queda pendiente y el cero explícito calcula cero, también al recalcular las fórmulas del Excel. |
| Plantilla mensual | El archivo abierto directamente conservaba fórmulas con `#REF!` y un control de edades antiguo; la exportación era la que las reparaba. | La propia plantilla contiene ahora las fórmulas corregidas para los cuatro grupos, manteniendo sus entradas, estilos y protecciones. |
| Plantilla trimestral | K contaba huecos y mantenía referencias a la fila 996, incluso en filas posteriores. | Cuenta personas detectadas de cada familia mediante los auxiliares N y V de Resumen, hasta la fila 2999. |
| Plantilla trimestral | M7 no tenía el desplegable de origen. | La validación cubre M2:M2999. |
| Plantilla trimestral | Había avisos de vigencia que consultaban derivación; se resaltaban origen vacío y vigencia manual vacía aunque se usara la automática. | Se retiran las reglas incorrectas y se ajustan los avisos al origen seleccionado. |
| Selector de mes | El panel se anclaba al borde derecho y podía empezar fuera del lateral izquierdo; el año y la marca seleccionada podían quedar desactualizados al reabrirlo. | Se ancla al inicio del campo y se sincronizan año y selección al abrirlo. La marca también cambia al explorar otro año. |
| Mensajes de la app | Algunas descripciones del listado seguían atribuyendo al reparto mensual las exclusiones del trimestral. | Se identifican como reglas del resumen trimestral. |

## Comprobaciones realizadas

- `npm test`: pasan los 18 archivos de pruebas, incluidos los nuevos casos de
  importación y guardado y las comprobaciones de las plantillas corregidas.
- `npm run build`: compilación local correcta.
- `GITHUB_ACTIONS=true npm run build -- --outDir /tmp/gestor-web-review-20261022`:
  compilación correcta con el prefijo de GitHub Pages. Se comprueba la existencia
  de los recursos referenciados por ambos HTML generados.
- Exportación y reimportación trimestral con titular, menor sin nacimiento y
  origen No: se conservan número de familia, miembros, nombre y origen, sin filas
  omitidas.
- Exportación mensual con cantidades vacía, cero y positiva; las pruebas verifican
  los resultados guardados y las fórmulas que mantienen esa distinción.
- `tools/verificar-plantilla.py`: ZIP, XML, prefijos de compatibilidad, relaciones
  y fórmulas compartidas correctos en ambas plantillas y ambas exportaciones de
  prueba. Comprobación adicional: sin `#REF!` en fórmulas ni celdas duplicadas.
- `git diff --check`: correcto.

## Alcance y límites pendientes

- No hay navegador, Microsoft Excel ni LibreOffice instalados en este entorno.
  La revisión de la interfaz se limita al código y a la compilación; las fórmulas
  se comprueban en XML y sus resultados preparados por el exportador. Queda la
  comprobación visual y de recálculo con las aplicaciones reales.
- El transporte de escritorio se prueba simulado; no se ha ejecutado el instalador
  de Windows ni se han generado instaladores nuevos. Los `.exe` y `.zip` existentes
  mantienen su versión anterior. La web pública tampoco se ha desplegado.
- El exportador trimestral conserva el límite de 995 beneficiarios por
  compatibilidad con plantillas anteriores. Corregir K no aumenta ese límite.
- El mensual sigue admitiendo familias de 1 a 10 miembros y no se puede importar
  de nuevo como histórico. Son límites existentes del modelo y del producto.
- Los Excel exportados anteriormente conservan sus fórmulas antiguas; las
  correcciones se aplican a las plantillas actuales y a las nuevas exportaciones.

## Copias y mantenimiento

Antes de modificar las plantillas se guardaron copias en:

- `/tmp/gestor-plantilla-antes-revision-20261022.xlsx`
- `/tmp/gestor-mensual-antes-revision-20261022.xlsx`

Las correcciones se pueden reproducir con `tools/actualizar-plantilla-cita.mjs`
y `tools/reparar-plantilla-mensual.mjs`, indicando la plantilla y una ruta nueva
para su copia de seguridad. Se han actualizado las guías de Excel trimestral y
resumen mensual para reflejar el funcionamiento actual.
