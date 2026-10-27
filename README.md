# Gestor de Beneficiarios para Entidades

Versión actual: **0.9.0-beta.1**, en fase de pruebas y anterior a la primera versión estable.

## Edición del listado

En **Mensual → Familias de alta**, los botones **Lista / Cuadrícula** permiten
elegir la presentación. La cuadrícula muestra tarjetas compactas con titular,
documento, miembros, situación e inclusión en el recuento. Desde cada tarjeta se
puede dar de alta/baja o abrir la familia en el listado trimestral. La vista
elegida se recuerda en este navegador u ordenador cuando está disponible el
almacenamiento de preferencias.

Las tarjetas se organizan en páginas de 60 familias, ordenadas por número.
La búsqueda y los filtros se aplican a todas las familias del periodo. Los
totales mensuales conservan el recuento completo, con independencia de la página.

Las familias se identifican como `#12` en pantalla; sus números siguen siendo
numéricos en los datos y en Excel. La búsqueda del trimestral y de Familias de
alta acepta tanto `12` como `#12`.

La renovación se realiza cambiando las fechas de derivación y vigencia del
titular. La documentación de menores no es obligatoria; la de adultos sí.

`Ctrl+Z` y el botón **Deshacer** recuperan ediciones guardadas en las celdas del
trimestral. `Ctrl+Mayús+Z`, `Ctrl+Y` y **Rehacer** vuelven a aplicarlas. En Mac se
puede utilizar `⌘Z` y `⌘Mayús+Z`. Mientras escribes una casilla, se mantiene el
deshacer de texto del navegador; `Escape` recupera su dato guardado.

Se conservan hasta 100 ediciones durante la sesión, incluidas fechas compartidas,
origen y condición de menor. El historial se reinicia al recargar, importar o
añadir/borrar familias o miembros. Los borrados tienen su propio botón
**Deshacer borrado**. Cada recuperación se guarda y actualiza el recuento
automático, conservando las versiones de meses anteriores.

## Reglas de vigencia y recuento

La [guía de fórmulas y reglas del Excel y la app](GUIA-EXCEL-2.0.md) recoge las celdas, las fórmulas exactas, los motivos de exclusión, los avisos y las diferencias que conviene conocer.

- La casilla «No» de la columna «Servicios sociales» se marca cuando la derivación no
  procede de allí, y se aplica a la familia. En ese caso la vigencia utilizada es
  la menor entre la vigencia indicada y la derivación más tres meses naturales.
  Los tres meses son un máximo y nunca amplían una vigencia indicada anterior.
  Si no se indica vigencia se usa ese máximo; se ajusta el último día de los meses cortos.
- La vigencia manual se conserva: desmarcar recupera esa fecha, incluso después
  de cerrar y abrir la aplicación. Marcar No muestra solo la fecha calculada y desmarcarlo recupera la original.
  Cambiar la derivación recalcula el límite automático y la fecha aplicada.
- El mensual cuenta las familias que continúan de alta y con vigencia válida al
  cierre del mes, con margen de 90 días. El trimestral conserva la participación
  anterior aunque después haya baja. Las bajas se archivan al cambiar de trimestre.
- La próxima cita sirve para seguir la renovación y no condiciona el recuento.
  Debe ser una fecha real, de hoy o futura, y puede ser anterior o igual al vencimiento.
  Se mantiene el máximo de vigencia más 90 días y el aviso de cita pendiente o inválida.
- La exportación utiliza `Modelo  listado v(2.0).xlsx` con las columnas de origen y vigencia
  aplicada; contiene Listado y Resumen, sin Reparto, y conserva la vigencia manual al importar de nuevo. Se siguen aceptando los Excel de la plantilla anterior.
- En el Excel, Servicios Sociales con Sí o vacío usa la vigencia manual; No activa
  el máximo de tres meses sin ampliar una vigencia más corta. Se conservan las citas de todos los miembros y la marca de menor.
  El reparto mensual está en un [Excel independiente](GUIA-RESUMEN-MENSUAL.md).
  La pantalla Reparto usa las cifras del resumen mensual seleccionado.
- En el trimestral, los rangos de edad usan años cumplidos: 0–2, 3–18 y 19–100, como la plantilla 2.0.
- «Caducada» indica que venció la vigencia y aún no han pasado más de 90 días.
  «Fuera de plazo» indica una cita no válida; «Fuera de recuento», más de 90 días desde
  el vencimiento. La leyenda y el texto al pasar el ratón explican qué revisar. Las etiquetas
  mantienen el mismo tamaño para que los cambios de estado no desplacen la tabla.

## Versión 1.2.3

- Detecta menores automáticamente por fecha de nacimiento y los marca en el formulario.
- Exporta «MENOR» como nombre cuando el menor no tiene nombre registrado.
- En el listado, añadir una familia o un miembro crea y guarda inmediatamente una fila.
  Cada casilla se guarda al salir, aunque queden datos por completar. Las filas incompletas
  se conservan al volver a abrir la aplicación y cuentan en el total de beneficiarios.
- Los campos importantes pendientes aparecen resaltados y en «Acciones pendientes»,
  con acceso directo a la casilla. El titular necesita nombre, apellidos y documento;
  los adultos no titulares, nombre y apellidos. Los menores se identifican por su nacimiento.
- Las fechas inválidas siguen requiriendo corrección. Antes de generar Excel se avisa
  si hay familias con datos pendientes; el usuario puede revisarlas o exportar el estado actual.

## Versión 1.2.2

- Corrige la importación de fechas con separadores repetidos y ceros de fórmula.
- Permite omitir el documento en miembros no titulares, conserva las filas y registra
  «REVISAR» en Próxima Cita como aviso informativo.

## Versión 1.2.1

- La importación acepta fechas de Excel como fecha numérica o como texto `DD/MM/AAAA`,
  incluso con apóstrofo inicial o espacios. Rechaza fechas imposibles y años que no
  tengan cuatro cifras.

## Versión 1.2.0

- Interfaz del listado más despejada, botones con mayor contraste y controles homogéneos.
- Búsqueda exacta por número de familia, separada de nombres y documentos.
- Filtro de vigencias caducadas al pulsar el cuadro «Caducadas»; otra pulsación lo desactiva.
- Validación de todos los miembros antes de guardar, con una lista de campos pendientes.
  El titular necesita nombre, apellidos y documento. Los otros adultos necesitan nombre
  y apellidos; su documento es opcional. Los menores pueden omitir su identidad,
  pero necesitan una fecha de nacimiento válida que confirme que son menores.
- Los miembros incompletos quedan pendientes y no aumentan el recuento guardado.
- Aviso de Excel generado con su ubicación e informe persistente de la última importación,
  incluyendo las filas omitidas y sus motivos.
- Columnas de miembros centradas en Reparto y edición de familias pulsando la fila.

La selección de una carpeta habitual y la importación arrastrando archivos siguen pendientes.
El instalador de esta versión se genera para Windows de 64 bits.

Aplicación web local y offline para facilitar la gestión de familias y beneficiarios por parte de entidades colaboradoras de un banco de alimentos.

## 1. Objetivo del proyecto

Actualmente las entidades registran las personas beneficiarias directamente en una plantilla Excel.

El objetivo de esta aplicación es proporcionar una interfaz mucho más sencilla y accesible para personas que pueden tener dificultades trabajando directamente con hojas de cálculo.

La aplicación debe permitir:

1. Registrar familias.
2. Registrar los miembros pertenecientes a cada familia.
3. Consultar y modificar familias existentes.
4. Calcular automáticamente estadísticas sobre familias y beneficiarios.
5. Ayudar opcionalmente con el reparto de alimentos.
6. Generar finalmente un archivo Excel compatible con la plantilla utilizada actualmente.

La aplicación debe poder utilizarse **sin conexión a Internet**.

---

# 2. Contexto del proceso actual

Las entidades reciben personas/familias derivadas para recibir ayuda.

Según van llegando las derivaciones, la entidad introduce los beneficiarios en un Excel.

Posteriormente, las entidades envían sus Excel a una trabajadora social.

Uno de los objetivos principales de esos listados es poder comparar beneficiarios de distintas entidades y localizar posibles duplicados.

Por este motivo es especialmente importante mantener correctamente datos identificativos como la documentación.

La aplicación NO tiene inicialmente como objetivo comparar datos entre diferentes entidades.

Su función es facilitar que cada entidad genere correctamente su listado.

La detección global de duplicados entre diferentes entidades podrá desarrollarse posteriormente como otra herramienta o módulo.

---

# 3. Plantilla Excel

Existe una plantilla oficial:

`Modelo listado v(1.4)(1).xlsx`

Esta plantilla debe considerarse la referencia para la exportación.

Contiene tres hojas principales:

- Listado
- Reparto
- Resumen

La aplicación debería generar un Excel compatible con esta estructura.

Idealmente, la exportación debe utilizar la plantilla existente en lugar de crear un Excel completamente diferente desde cero.

Esto permitirá conservar:

- estructura
- fórmulas
- formato
- hoja de reparto
- hoja de resumen

---

# 4. Familias

La unidad principal de organización de la aplicación es la **familia**.

Cada familia tiene:

- Un titular.
- Uno o varios miembros.

Ejemplo conceptual:

```text
Familia 15

Titular
María Pérez García

Miembro 2
Juan Pérez García

Miembro 3
Ana Pérez García
```

La aplicación debe calcular automáticamente:

- Número de miembros de la familia.
- Número total de familias.
- Número total de beneficiarios.

También debe permitir conocer cuántas familias existen según su número de miembros.

Por ejemplo:

```text
Familias de 1 miembro: 10
Familias de 2 miembros: 15
Familias de 3 miembros: 8
Familias de 4 miembros: 6
...
```

El usuario no debe introducir manualmente estos cálculos.

---

# 5. Datos de beneficiarios

Los datos principales proceden de la hoja `Listado` de la plantilla Excel.

Los campos básicos son:

- Nombre
- Apellidos
- Documentación
- Fecha de nacimiento
- Fecha de derivación
- Vigencia

La aplicación puede calcular automáticamente la edad a partir de la fecha de nacimiento.

---

# 6. Titular de la familia

Cada familia debe tener un titular.

La primera persona es titular por defecto; el formulario permite cambiarlo con una
casilla. La fecha de derivación y la fecha de vigencia se comparten entre las personas
de una familia y se editan en la ficha de su titular. En las fichas de los demás
miembros se muestran en modo de solo lectura. Si se elimina al titular, la primera
persona restante pasa a serlo.

La fecha de derivación está principalmente asociada al titular de la familia.

Al crear una nueva familia, el primer beneficiario debería considerarse inicialmente el titular.

Después se podrán añadir otros miembros mediante una acción como:

`+ Añadir miembro`

Debe quedar claro visualmente quién es el titular.

---

# 7. Vigencia

Las derivaciones tienen una determinada duración.

Puede ser, por ejemplo:

- 6 meses
- 1 año
- otra duración

La aplicación debería facilitar la introducción de esta información.

Se puede estudiar una interfaz que permita seleccionar una duración y calcular automáticamente la fecha de finalización.

También debe ser posible introducir directamente una fecha de vigencia cuando sea necesario.

La implementación exacta debe confirmarse antes de modificar esta lógica.

---

# 8. Listado principal

La pantalla principal debe mostrar las familias registradas.

Debe existir como mínimo:

- Buscador.
- Botón `Nueva familia`.
- Listado de familias.
- Posibilidad de abrir/editar una familia.
- Número de miembros.
- Información de vigencia.
- Estado de la familia.

El buscador debería permitir buscar al menos por:

- Número de familia.
- Nombre.
- Apellidos.
- Documentación.

---

# 9. Detección de duplicados dentro de la entidad

La documentación es especialmente importante porque posteriormente los Excel de diferentes entidades pueden utilizarse para localizar beneficiarios duplicados.

La aplicación debería detectar cuando se intenta introducir una documentación que ya existe en el listado local.

Ejemplo:

```text
⚠️ Esta documentación ya aparece en la Familia 18.
```

Inicialmente puede tratarse como una advertencia en lugar de bloquear obligatoriamente el registro.

---

# 10. Resumen

La aplicación debe tener una sección de resumen.

Debe calcular automáticamente al menos:

- Número total de familias.
- Número total de beneficiarios.
- Familias agrupadas por número de miembros.

También puede incorporar otros datos existentes en la hoja `Resumen` de la plantilla cuando se implemente completamente su lógica.

Los cálculos deben realizarse automáticamente a partir de los beneficiarios registrados.

---

# 11. Reparto

La plantilla Excel contiene una hoja `Reparto`.

Esta hoja ayuda a algunas entidades a calcular cómo distribuir alimentos dependiendo del tamaño de las familias.

No todas las entidades utilizan esta funcionalidad.

Por tanto, en la aplicación debe existir como una sección independiente y opcional.

Una posible navegación sería:

```text
LISTADO | REPARTO | RESUMEN
```

La sección `Reparto` debe basarse en la lógica de la hoja `Reparto` de la plantilla oficial.

No modificar o reinterpretar sus cálculos sin comprobar primero cómo funciona la plantilla.

---

# 12. Funcionamiento offline

REQUISITO IMPORTANTE:

La aplicación debe funcionar sin conexión a Internet.

No debe depender de:

- APIs externas.
- CDNs.
- servidores externos.
- bases de datos remotas.

Todas las librerías necesarias para ejecutar la aplicación deben estar disponibles localmente.

Por ejemplo, si se utiliza SheetJS para generar archivos XLSX, la librería debe incluirse dentro del proyecto y NO cargarse desde un CDN.

---

# 13. Almacenamiento

Los datos deben permanecer guardados en el equipo aunque se cierre la aplicación.

El prototipo actual utiliza:

`IndexedDB`

Esta solución puede mantenerse salvo que exista una razón técnica importante para sustituirla.

La aplicación debe guardar automáticamente los cambios.

---

# 14. Copias de seguridad

Debe existir una forma sencilla de realizar copias de seguridad.

El prototipo actual permite:

- Exportar los datos a Excel.
- Cargar posteriormente ese Excel en otra instalación.

Esta funcionalidad debe mantenerse o mejorarse.

El usuario debe poder mover sus datos a otro ordenador mediante el Excel generado por la aplicación.

---

# 15. Exportación a Excel

Esta es una de las funcionalidades más importantes.

El usuario debe poder pulsar:

`Generar Excel`

y obtener un archivo `.xlsx`.

El archivo generado debe intentar conservar la estructura de:

`Modelo listado v(1.4)(1).xlsx`

Especialmente sus hojas:

```text
Listado
Reparto
Resumen
```

No crear una estructura Excel diferente sin comprobar primero la plantilla.

La aplicación debe rellenar los datos de `Listado` y conservar, en la medida técnicamente posible, las fórmulas y funcionamiento de `Reparto` y `Resumen`.

---

# 16. Privacidad y datos reales

La aplicación gestionará datos personales.

IMPORTANTE:

Nunca subir datos reales de beneficiarios al repositorio Git.

No incluir:

- nombres reales
- DNI/NIE reales
- fechas de nacimiento reales
- derivaciones reales
- copias de seguridad reales
- Excel reales rellenados por entidades

Para desarrollo y pruebas utilizar exclusivamente datos ficticios.

El repositorio puede contener la plantilla vacía si se determina que puede formar parte del proyecto.

---

# 17. Prototipo existente

Existe un archivo:

`gestor_beneficiarios_prototipo_v2.html`

Este archivo contiene un primer prototipo funcional.

Actualmente incluye, entre otras cosas:

- IndexedDB.
- Creación de familias.
- Creación de miembros.
- Edición.
- Eliminación.
- Buscador.
- Cálculo de edad.
- Control básico de vigencias.
- Exportación y carga de Excel.
- Exportación XLSX experimental.

El prototipo debe utilizarse como **referencia**, no necesariamente como arquitectura definitiva.

Actualmente todo está concentrado principalmente en un único HTML y debe reorganizarse progresivamente.

---

# 18. Problema conocido del prototipo

La exportación Excel del prototipo carga SheetJS desde:

`cdn.jsdelivr.net`

Esto requiere conexión a Internet y contradice uno de los requisitos principales.

Debe sustituirse por una dependencia disponible localmente.

Además, actualmente el prototipo genera hojas nuevas mediante JavaScript.

La versión definitiva debería estudiar la posibilidad de cargar la plantilla oficial y escribir los datos sobre ella para conservar su estructura.

---

# 19. Arquitectura inicial propuesta

No es obligatorio mantener exactamente esta estructura, pero se propone como punto de partida:

```text
gestor-beneficiarios/
│
├── index.html
│
├── css/
│   └── styles.css
│
├── js/
│   ├── app.js
│   ├── database.js
│   ├── familias.js
│   ├── excel.js
│   └── utils.js
│
├── assets/
│   └── plantilla.xlsx
│
├── lib/
│   └── xlsx.full.min.js
│
├── README.md
└── .gitignore
```

La estructura puede evolucionar según las necesidades reales del proyecto.

Evitar introducir frameworks o dependencias innecesarias.

---

# 20. Prioridades de diseño

La aplicación está dirigida en parte a personas con poca experiencia informática.

Por tanto debe priorizar:

1. Simplicidad.
2. Botones y acciones claras.
3. Formularios fáciles de entender.
4. Evitar términos técnicos.
5. Evitar introducir el mismo dato varias veces.
6. Automatizar cálculos siempre que sea posible.
7. Mostrar errores de forma comprensible.
8. Evitar que un error del usuario destruya datos.
9. Funcionar completamente offline.

La interfaz debe ser más sencilla que trabajar directamente sobre Excel.

---

# 21. Forma de desarrollar el proyecto

IMPORTANTE PARA CODEX:

Este proyecto se quiere desarrollar **progresivamente**.

No reescribir toda la aplicación de golpe salvo que se solicite expresamente.

Antes de realizar cambios grandes:

1. Explicar qué se pretende modificar.
2. Identificar los archivos afectados.
3. Realizar cambios pequeños y comprobables.
4. Permitir probar el resultado.
5. Continuar con la siguiente funcionalidad.

El desarrollador quiere entender cómo funciona el proyecto mientras se construye.

Evitar generar grandes cantidades de código innecesariamente.

---

# 22. Primera versión objetivo

La primera versión funcional debe centrarse en:

```text
Abrir aplicación
        ↓
Ver listado de familias
        ↓
Crear nueva familia
        ↓
Introducir titular
        ↓
Añadir miembros
        ↓
Guardar automáticamente
        ↓
Consultar / editar familias
        ↓
Ver resumen
        ↓
Generar Excel
```

Una vez esta funcionalidad sea estable se desarrollará con mayor profundidad:

- Reparto.
- Alertas de vigencia.
- Detección de duplicados.
- Mejoras de interfaz.
- Posible importación de Excel existentes.
- Herramientas adicionales para la trabajadora social.

---

# Estado actual

La base de la aplicación está organizada con Vite y JavaScript vanilla:

- `index.html`: entrada de la aplicación.
- `src/styles.css`: estilos del prototipo.
- `src/app.js`: vistas, estado de la aplicación y eventos.
- `src/database.js`: almacenamiento local en Tauri o IndexedDB en navegador.
- `src/familias.js`: creación de familias, personas y cálculo de estado.
- `src/excel-import.mjs`: lectura de familias desde la hoja Listado.
- `src/utils.js`: cálculo de edad, fechas y escape de texto.
- `src/excel.js`: carga de la plantilla local y descarga del Excel.
- `src/excel-workbook.mjs`: escritura de datos en la plantilla conservando sus partes.

Para probarla durante el desarrollo, ejecutar `npm run dev` y abrir la dirección
local que muestra Vite. `npm run build` genera la compilación en `dist` y
`npm run preview` permite revisarla con un servidor local.

El prototipo original y la plantilla Excel se conservan como referencias.
El botón `Generar Excel` utiliza la plantilla incluida en el proyecto. La dependencia
`fflate` se incluye en la compilación y no se descarga desde un CDN al exportar.
Se rellenan las columnas A, B, C, D, E, F, H, I y L de Listado; G, J y K mantienen
las fórmulas oficiales. Resumen y el resto de las partes se conservan. El mensual se genera por separado.
El archivo solicita recalcular sus fórmulas al abrirlo en Excel o LibreOffice.

La exportación admite hasta 995 beneficiarios: a partir de K997 las fórmulas
originales de miembros contienen referencias invertidas. Superar ese límite
muestra un error y no descarga un listado incompleto. La distribución por tamaño
y el modelo mensual contemplan únicamente familias de 1 a 10 miembros.
Las fechas exportadas deben ser válidas y del año 1900 o posterior.
La ampliación de rangos y la revisión de fórmulas quedan para un paso posterior.

`npm test` comprueba la exportación con datos ficticios, la conservación de
fórmulas y estilos, fechas y límites. Para comprobar el recálculo y el aspecto
visual, generar un Excel desde la interfaz y abrirlo en Excel o LibreOffice.

La compilación de escritorio se abre como una aplicación local y funciona offline.

IndexedDB pertenece al navegador y al origen (protocolo, dirección y puerto).
Para trasladar los datos entre instalaciones, generar el Excel desde la aplicación
y cargarlo en el otro equipo. La carga sustituye los datos existentes y pide
confirmación antes de hacerlo.

Cuando se ejecuta en el navegador, los cambios se guardan en IndexedDB y la aplicación
solicita almacenamiento persistente cuando el navegador lo ofrece. Para trasladar
datos entre equipos, genera un Excel y cárgalo desde la otra instalación.

La opción `Cargar Excel en este ordenador` admite archivos `.xlsx` que conserven las
columnas de la hoja `Listado` de la plantilla oficial. Muestra el número de familias
y beneficiarios que detectó y pide confirmación, porque sustituye los datos actuales.
La hoja de Excel no se modifica; la importación se realiza primero en memoria y se
guarda únicamente al confirmar.


## Inicio de la migración a Tauri 2

Tauri abre la interfaz actual en una ventana de escritorio. Vite continúa preparando
el HTML, CSS, JavaScript y la plantilla Excel. `src-tauri/` contiene la configuración
nativa y el código mínimo de Rust; `vite.config.mjs` fija el puerto de desarrollo.

Comandos:

- `npm run dev`: probar la interfaz en el navegador.
- `npm run tauri dev`: compilar y abrir la ventana de escritorio.
- `npm run tauri build -- --no-bundle`: compilar el ejecutable de escritorio.

La ventana de escritorio guarda los datos localmente y permite trasladar el listado
mediante el Excel generado por la aplicación. El instalador NSIS de Windows de 64 bits
está habilitado, con pantallas en español e instalación para la cuenta actual.
Si WebView2 no está instalado, el instalador lo descarga: ese caso requiere Internet
durante la instalación. La aplicación funciona sin conexión una vez instalada.

El paquete de prueba `GestorBeneficiarios-instalador-Windows.zip` contiene el instalador,
el Excel de 20 personas ficticias y las instrucciones. La instalación y ejecución
deben comprobarse en Windows; el instalador de prueba todavía no está firmado.

Para desarrollar en Debian/Ubuntu, instalar desde una terminal con permisos de
administración:

```sh
sudo apt-get update
sudo apt-get install -y build-essential pkg-config libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev patchelf
```

Instalar Rust mediante rustup, en lugar de utilizar el compilador de Debian, porque
las dependencias actuales requieren Rust 1.90 o posterior. El proyecto fija Rust
1.90.0 en `rust-toolchain.toml` para que rustup seleccione una versión compatible.

```sh
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs -o /tmp/gestor-beneficiarios-rustup.sh
sh /tmp/gestor-beneficiarios-rustup.sh -y --profile minimal --default-toolchain 1.90.0
source "$HOME/.cargo/env"
rustc --version
npm run tauri dev
```

Si sigue apareciendo 1.85.1, cerrar y abrir la terminal y comprobar de nuevo la
versión. Quienes ya tengan rustup pueden ejecutar `rustup toolchain install 1.90.0`.

También se necesita una sesión gráfica para abrir la ventana. En Windows se requieren
Rust, las herramientas de compilación C++ de Microsoft y WebView2; consultar
https://v2.tauri.app/start/prerequisites/ . El personal de las entidades no necesita
las herramientas de desarrollo: recibirá la aplicación compilada.


## Guardado y traslado en la aplicación de escritorio

En Tauri, las familias se guardan automáticamente en el archivo local de datos de
la aplicación, con una copia del guardado anterior para recuperación. En el navegador
se conserva IndexedDB. Al abrir Tauri, si existe información previa de IndexedDB, se
migra al archivo local automáticamente.

Para trasladar datos entre equipos, genera el Excel con `Generar Excel` y carga
ese archivo desde `Cargar Excel en este ordenador`. La carga pide confirmación
antes de sustituir los datos locales. Se puede transportar el archivo en un USB.
Conviene mantener una sola copia activa del listado y trasladarla antes de empezar
a trabajar en el otro equipo; no existe sincronización ni mezcla automática de cambios.

Al generar el Excel desde Tauri, la aplicación pide dónde guardarlo y luego lo abre
con el programa asociado a los archivos `.xlsx` del ordenador (por ejemplo, Excel o
LibreOffice). En el navegador, el archivo se descarga con el nombre
`Listado_Trimestral_Entidad.xlsx` en la carpeta de descargas configurada.

## Trimestral y Mensual

La navegación se organiza en dos secciones con sus subpáginas:

- **Trimestral → Listado y Resumen del listado.** La columna Situación permite
  indicar el alta o baja desde el mes seleccionado. Las familias de baja siguen
  visibles durante su trimestre y pasan al histórico al comenzar el siguiente.
  «Ver familias archivadas» permite recuperarlas. Los números siguen reservados.
  El resumen conserva las familias vigentes en algún momento del trimestre.
- **Mensual → Familias de alta, Resumen mensual y Reparto.** El mes representa
  el cierre para prever alimentos del siguiente: se cuentan las familias que
  continúan de alta y cumplen la vigencia, con margen de 90 días incluido.
  Las edades se calculan al último día del mes. Los grupos son menores sin edad,
  0–2, 3–17 y 18 o más; se admiten familias de 1–10 miembros para exportar.

Los meses nuevos calculan automáticamente las altas, copian entidad y nombres de
alimentos y dejan vacías las cantidades de reparto. Los meses anteriores conservan
sus cifras y criterio hasta cambiarlos expresamente, con copia restaurable.
La migración inicia el seguimiento desde el mes actual: no reconstruye situaciones
anteriores desconocidas. Véase [la guía mensual](GUIA-RESUMEN-MENSUAL.md).

El reparto es una herramienta opcional que utiliza las cifras del mes seleccionado.
Se calcula cuando los totales por familias y edades coinciden y hay beneficiarios. Las cantidades se dividen por el total de personas,
se multiplican por el tamaño familiar y se redondean. Se admiten hasta 16 filas.
El redondeo puede producir un total distinto de la cantidad asignada.

**Generar Excel mensual** utiliza `MODELO RESUMEN MENSUAL.xlsx` y genera
`Resumen_Mensual_AAAA-MM.xlsx` con Resumen mensual y Reparto. Requiere el nombre
de la entidad y totales coincidentes. Las casillas sin datos se dejan vacías. La exportación conserva estilos y protecciones, repara las
referencias rotas de reparto del modelo recibido y adapta el control a los
cuatro grupos de edad. Incluye resultados calculados y solicita recálculo al abrir.
No modifica la plantilla original ni envía el documento automáticamente.

Los meses se guardan en `mensuales.json` en escritorio. En el navegador, el
listado, los meses, los repartos y el informe de importación comparten la base
IndexedDB `GestorBeneficiariosDB`. Los datos de localStorage y de la antigua
base auxiliar se trasladan automáticamente antes de retirar la copia antigua. El reparto de la versión anterior se conserva una sola vez en el
mes actual al iniciar la integración; los recuentos anteriores se conservan.
La importación del listado trimestral conserva todos los mensuales.
La opción de eliminar todos los datos también borra los mensuales.

El Excel mensual sirve como documento para enviar y conservar. Actualmente no
se importa de nuevo en la app: el traslado de listados mediante Excel solo
transporta las familias de Listado. Los borradores y el historial mensual
permanecen en el ordenador o navegador donde se introdujeron.


## Versión 1.2.4 — revisión de escritorio (14/10/2026)

- La imagen del Resumen se convierte directamente a bytes PNG, sin `fetch(data:...)`,
  que estaba bloqueado por la política de seguridad de escritorio.
- La importación del Excel y la eliminación de alimentos esperan la confirmación
  nativa: pulsar Cancelar ya no permite continuar la operación.
- La entrada del número de miembros y la confirmación escrita BORRAR utilizan
  un formulario de la aplicación en escritorio. Los avisos usan el diálogo nativo.
- Se valida el PNG generado y se bloquean pulsaciones repetidas mientras se guarda.

Instalador: `GestorBeneficiarios-1.2.4-Windows-setup.exe`. Se genera con
`npm run tauri build -- --runner cargo-xwin --target x86_64-pc-windows-msvc -- --offline`
cuando las herramientas y dependencias de compilación cruzada ya están instaladas.
Las pruebas automatizadas no sustituyen la comprobación de instalación y descarga
en Windows.


## Versión 0.9.0-beta.1 — versión de pruebas (21/10/2026)

La aplicación continúa en desarrollo. Se adopta una numeración anterior a 1.0
para distinguir estas entregas de una versión estable. Las versiones 1.x anteriores
se conservan en el historial como entregas de prueba.

Esta beta integra los resúmenes y repartos mensuales, la plantilla trimestral 2.0,
las mejoras de edición y búsqueda del listado y una sola base IndexedDB para todos
los datos del navegador. En escritorio se mantienen los archivos locales y la
copia de recuperación del listado. La versión de la aplicación y la de sus
plantillas Excel se numeran de forma independiente.

El instalador es `GestorBeneficiarios-0.9.0-beta.1-Windows-setup.exe` y se genera con:

```sh
npm run tauri build -- --runner cargo-xwin --target x86_64-pc-windows-msvc -- --offline
```

El instalador se entrega aparte y no se sube al repositorio. Deben comprobarse su
instalación y ejecución en Windows antes de distribuirlo como versión estable.

### Archivos para el repositorio

Se incluyen código, pruebas, documentación, scripts de herramientas y los archivos
de dependencias bloqueadas. Los Excel necesarios son `Modelo  listado v(2.0).xlsx`,
`MODELO RESUMEN MENSUAL.xlsx` y `Modelo  listado v(1.4).xlsx` (pruebas de compatibilidad).
Los scripts históricos de `tools/` pueden requerir plantillas intermedias locales.

Se excluyen instaladores, paquetes ZIP, compilaciones, dependencias instaladas,
Excel de trabajo o con datos introducidos, archivos temporales de Office y
configuración privada. La carpeta `Ignorar carpeta/` queda fuera de Git.
