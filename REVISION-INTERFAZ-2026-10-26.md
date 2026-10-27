# Revisión de interfaz · 26 de octubre de 2026

Se han revisado Listado, Resumen del listado, Cargar Excel, Familias de alta,
Resumen mensual, Reparto y los textos del formulario de familia.

## Cambios

- Navegación común con una guía «Cómo trabajar» que explica el recorrido desde
  el registro de familias hasta el envío mensual.
- Mes de referencia compartido entre el listado y el resumen trimestral,
  con el trimestre escrito en lenguaje natural.
- Listado con título visible, búsqueda y alta de familias juntas, filtros
  pendientes agrupados y navegación Inicio/Final junto al contador y al zoom.
  Las reglas de edición y la leyenda se reúnen en «Ayuda del listado».
- Origen automático o manual del recuento más explícito. La edición manual y
  la restauración del criterio anterior pasan a «Opciones del recuento».
- Meses guardados en un desplegable que aparece cuando existen meses guardados.
- Carga de Excel con una advertencia breve y los detalles en un desplegable.
  Se distingue qué incluye cada Excel y cuál puede importarse.
- Pantallas vacías con una explicación y una acción para continuar.
- Avisos de Excel que se pueden cerrar y que distinguen las revisiones pendientes
  de las descargas completadas. El botón trimestral conserva su texto al terminar.
- Ayudas que se cierran al pulsar fuera o con Escape, devolviendo el foco al control.
- Ajustes de anchura, desplazamiento y tablas para ventanas estrechas o bajas.
  Se conserva el borde interior de un píxel del selector de alta/baja.
- Encabezado de impresión del listado con trimestre, fecha y filtros. La impresión
  buscaba elementos que ya no estaban en la página y provocaba un error.
- «Ver en el listado» limpia también una selección anterior de familias, para
  que la familia que se quiere revisar no quede oculta por ese filtro.

La presentación común está en `src/interface.css`. Se conservan los cálculos,
las reglas de vigencia y los formatos de almacenamiento y Excel existentes.

## Verificación

- `npm test`: pasan los 23 archivos de pruebas.
- `npm run build`: compilación correcta.
- Navegador Chromium con un perfil nuevo y datos ficticios: revisión visual de
  las seis pantallas principales a 1366 y 390 píxeles de ancho.
- Comprobación de búsqueda y recuperación del listado, zoom, edición, cambios
  de alta/baja y persistencia tras recargar.
- Cambio de mes desde Listado y Resumen, consulta histórica y bloqueo de la
  edición de datos personales en otro mes.
- Apertura y cierre de las ayudas, aviso de exportación y su cierre.
- Descarga real de Excel mensual, Excel trimestral e imagen del resumen.
- Selección del Excel generado y comprobación de la confirmación de importación,
  cancelándola antes de modificar los datos.
- Cantidad de reparto, resultado calculado e impresión de reparto y listado.
- Ningún error JavaScript en esos recorridos y sin desbordamiento lateral de
  la página a 390 píxeles; las tablas conservan su propio desplazamiento.
- Otras 18 comprobaciones de pantalla a 320, 768 y 1024 píxeles de ancho,
  incluidas ventanas de 600 píxeles de alto: sin desbordamiento de la página
  y con la guía desplegable dentro de la ventana.

Las pruebas de navegador usan almacenamiento aislado. No se han utilizado datos
reales ni se han generado instaladores nuevos de Windows o publicado la web.
Los diálogos nativos de Windows y la impresión en papel requieren comprobarse
en ese sistema; la impresión se ha comprobado generando PDF con Chromium.

## Ampliación: compartir el resumen mensual

Resumen mensual permite descargar un PNG con entidad, mes, totales y desgloses
por miembros y edades, sin generar un Excel. La imagen se compone como informe
independiente de los botones y del tamaño de la ventana.

«Preparar correo» muestra un borrador con destinatario, asunto y mensaje
editables. Permite copiar el texto o solicitar su apertura en el correo habitual
mediante `mailto:`. El envío lo realiza el usuario desde su correo; la imagen se
puede copiar para pegarla dentro del mensaje o descargar para adjuntarla.
En escritorio se habilita únicamente la apertura de URLs
`mailto:` mediante el complemento ya instalado.

Se aplican las comprobaciones del resumen antes de compartirlo. Las 24 pruebas
pasan, incluida la nueva prueba de cifras, validación, escape y codificación del
borrador. Se ha descargado un PNG real de 1800 píxeles de ancho y comprobado en
Chromium el borrador, sus cambios, ambas rutas de copia, Escape, foco y ventana
de 390 píxeles. La llamada al correo de escritorio se ha probado con el transporte
simulado; no se han enviado mensajes ni abierto una cuenta de correo real.

«Copiar imagen» está disponible tanto en el resumen como en el borrador. Utiliza
un PNG real en el portapapeles y solicita la escritura durante el clic, entregando
la generación de imagen como promesa para conservar el gesto del usuario.
Se ha comprobado el tipo `image/png`, el ancho de 1800 píxeles y el pegado real
con Ctrl+V en un mensaje editable local. La prueba también cubre el permiso
denegado, la API no disponible y la retirada del informe temporal. La copia
no descarga archivos ni crea Excel. Las 24 pruebas y la compilación pasan.

## Altas y bajas desde el listado mensual

Cada fila de «Familias de alta» permite «Dar de baja» o «Dar de alta» directamente.
El cambio se aplica con un clic, sin confirmación, al mes seleccionado. Se reutiliza el historial
existente; el mensual automático se recalcula y las cifras manuales se conservan.
La búsqueda, el filtro y el desplazamiento de la tabla se mantienen. No se ofrece
el cambio si ese mes es anterior al historial de la familia.

Se han comprobado en navegador la cancelación, la baja, la reactivación y la
persistencia tras recargar; también los totales, la conservación de los meses
anteriores y del resumen trimestral, los filtros y el recuento manual. Pasan las
24 pruebas, con casos añadidos para los botones de alta/baja y el mes sin historial.
