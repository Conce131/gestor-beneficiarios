# Gestor de Beneficiarios para Entidades

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

- Exportar los datos a JSON.
- Restaurar posteriormente ese JSON.

Esta funcionalidad debe mantenerse o mejorarse.

El usuario debe poder mover sus datos a otro ordenador mediante una copia de seguridad.

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
- Copias JSON.
- Restauración de copias.
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
- `src/backups.js`: copias JSON y validación de restauraciones.
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
las fórmulas oficiales. Reparto, Resumen y el resto de las partes se conservan.
El archivo solicita recalcular sus fórmulas al abrirlo en Excel o LibreOffice.

La exportación admite hasta 995 beneficiarios: a partir de K997 las fórmulas
originales de miembros contienen referencias invertidas. Superar ese límite
muestra un error y no descarga un listado incompleto. Reparto y la distribución
de familias por tamaño en Resumen contemplan únicamente tamaños de 1 a 10.
Las fechas exportadas deben ser válidas y del año 1900 o posterior.
La ampliación de rangos y la revisión de fórmulas quedan para un paso posterior.

`npm test` comprueba la exportación con datos ficticios, la conservación de
fórmulas y estilos, fechas y límites. Para comprobar el recálculo y el aspecto
visual, generar un Excel desde la interfaz y abrirlo en Excel o LibreOffice.

La compilación de escritorio se abre como una aplicación local y funciona offline.

IndexedDB pertenece al navegador y al origen (protocolo, dirección y puerto).
Para trasladar los datos desde el HTML original o desde otra dirección, utilizar
una copia JSON. Las restauraciones sustituyen los datos existentes y piden
confirmación antes de hacerlo.

Cuando se ejecuta en el navegador, los cambios se guardan en IndexedDB y la aplicación
solicita almacenamiento persistente cuando el navegador lo ofrece. La opción de
traslado guarda una copia JSON manual fuera del almacenamiento principal.

La opción `Cargar familias desde Excel` admite archivos `.xlsx` que conserven las
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
mediante un archivo JSON con ventanas nativas. El instalador NSIS de Windows de 64 bits
está habilitado, con pantallas en español e instalación para la cuenta actual.
Si WebView2 no está instalado, el instalador lo descarga: ese caso requiere Internet
durante la instalación. La aplicación funciona sin conexión una vez instalada.

El paquete de prueba `GestorBeneficiarios-instalador-Windows.zip` contiene el instalador,
el Excel de 100 personas ficticias y las instrucciones. La instalación y ejecución
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

Los botones de traslado abren selectores nativos: `Llevar datos a otro ordenador`
guarda un archivo JSON elegido por el usuario; `Cargar datos en este ordenador` lo
lee y pide confirmación antes de sustituir los datos locales. Se puede transportar
el archivo en un USB. Conviene mantener una sola copia activa del listado y trasladarla
antes de empezar a trabajar en el otro equipo; no existe sincronización ni mezcla
automática de cambios.

Al generar el Excel desde Tauri, la aplicación pide dónde guardarlo y luego lo abre
con el programa asociado a los archivos `.xlsx` del ordenador (por ejemplo, Excel o
LibreOffice). En el navegador, el archivo se descarga con el nombre
`Listado_Reparto_Entidad.xlsx` en la carpeta de descargas configurada.

## Vistas de Listado, Resumen y Reparto

Listado permite alternar entre Familias y Personas, conservando la búsqueda.
En Personas se muestran los datos individuales y se puede abrir la familia para editarla.
Resumen es de consulta y muestra los totales, familias por tamaño y rangos de edad.
Los límites por fecha de nacimiento reproducen las fórmulas COUNTIFS de la plantilla,
que no coinciden exactamente con las etiquetas de edad del Excel; la pantalla lo explica.

Reparto permite editar los 16 alimentos y sus cantidades asignadas en envases.
Se divide cada cantidad entre los beneficiarios de familias de 1 a 10 miembros,
se multiplica por el tamaño y se redondea por familia como en la plantilla.
Las familias mayores de 10 se muestran en Resumen, pero quedan fuera de Reparto.
Las cantidades vacías cuentan como cero en el cálculo, igual que Excel.
Los nombres y cantidades se guardan en `reparto.json` en Tauri (en localStorage
cuando se abre en navegador), se incluyen en el JSON de traslado y se escriben
solo en las celdas editables B15:C30 al generar Excel. Las fórmulas se conservan.
Las copias JSON antiguas se aceptan con Reparto vacío; la importación de Excel
continúa cargando exclusivamente las familias de Listado.
