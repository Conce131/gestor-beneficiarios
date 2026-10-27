# Funcionamiento del Excel 2.0

Archivo revisado: `Modelo  listado v(2.0).xlsx`.
Revisión: 22/10/2026. Esta guía describe las fórmulas guardadas en ese archivo y su relación con el código de la aplicación. El anexo reproduce las fórmulas del archivo actual, no solo las del generador. La plantilla incluye a las familias durante los primeros 90 días de caducidad, incluido el día 90, aunque no tengan cita. El reparto del Excel está ahora en el libro mensual independiente; la pantalla Reparto de la app utiliza ahora los datos del resumen mensual seleccionado. Revisión del XML; no se ha recalculado en Excel o LibreOffice.

## Reglas que conviene recordar

Esta tabla describe el resumen trimestral y el cálculo anterior del reparto de la app. El reparto actual pertenece a Mensual y usa los recuentos guardados de las atenciones del mes, sin filtros de vigencia.

| Situación | Resumen trimestral | Reparto anterior de la app (histórico) |
| --- | --- | --- |
| Vigencia vigente | Cuenta | Cuenta si la familia tiene de 1 a 10 miembros |
| Caducidad de 1 a 90 días, incluido el día 90 | Cuenta con o sin cita | Cuenta si la familia tiene de 1 a 10 miembros |
| Caducidad desde el día 91 | Se excluye toda la familia | Se excluye toda la familia |
| Falta una vigencia válida | Se excluye toda la familia | Se excluye toda la familia |
| Cita vacía, pasada o incorrecta | No excluye; requiere revisión | No excluye; requiere revisión |
| Origen No Servicios sociales | No excluye por origen; usa la menor entre la vigencia indicada y derivación + 3 meses | Misma regla, con límite de 10 miembros |
| Documentos duplicados u otros campos pendientes | No excluyen por sí solos | No excluyen por sí solos |

La tabla por origen **B23:G25 incluye a todas las personas registradas**, también las excluidas del resumen principal. El origen no decide la exclusión, pero sí qué vigencia se utiliza: con No se aplica el límite de derivación + 3 meses, conservando una vigencia indicada más corta.

Ejemplo: si la vigencia vence el 01/01/2026, el 01/04/2026 es el día 90 y todavía cuenta. El 02/04/2026 es el día 91 y ya no cuenta. No se borra a la familia. Una cita no alarga este plazo.

## Mapa rápido de cálculos

| Qué quieres revisar | Dónde está |
| --- | --- |
| Edad de una persona | Listado!G2:G2999 |
| Vigencia manual | Listado!I, dato introducido |
| Vigencia automática para origen No | Listado!N2:N2999 |
| Días hasta el vencimiento | Listado!J2:J2999 |
| Vigencia utilizada en el recuento | Resumen!O2:O2999 |
| Si una persona entra en el resumen principal | Resumen!Q2:Q2999 |
| Personas detectadas, antes de excluir | Resumen!V2:V2999 |
| Familias y personas incluidas | Resumen!F4 y G4 |
| Familias por tamaño y personas por edades | Resumen!C4:C13 y E4:E6 |
| Personas excluidas y total general | Resumen!B20 y E20 |
| Personas de Servicios sociales y de otros orígenes | Resumen!B25 y E25; auxiliar X2:X2999 |
| Familias y beneficiarios usados para repartir | Libro mensual: Reparto!D13:M13 y D12:M12; totales N13 y N12 |
| Cuota por persona y envases por familia | Libro mensual: Reparto!N15:N30 y D15:M30 |
| Reglas al introducir fechas | Listado → Datos → Validación de datos |
| Avisos de color | Listado → Inicio → Formato condicional → Administrar reglas |

Para ver una fórmula, selecciona la celda y mira la barra de fórmulas. Las celdas combinadas guardan la fórmula en la esquina superior izquierda: B20, E20, B25 o E25. Las columnas auxiliares se muestran como se explica más abajo.

## Cómo rellenar Listado

Cada persona ocupa una fila. La persona titular lleva el número de familia en A. Los miembros se colocan inmediatamente debajo, con A vacía, hasta la siguiente fila que tenga número de familia. No repetir A en todos los miembros ni ordenar personas sueltas: cambiaría la agrupación.

| Columna | Contenido y uso |
| --- | --- |
| A | Número de familia, solo en el titular. Inicia un grupo familiar. |
| B | Número de beneficiario. También permite identificar una fila como persona. |
| C–F | Nombre, apellidos, documento y fecha de nacimiento. |
| G | Edad calculada desde F hasta hoy, en años cumplidos. |
| H | Fecha de derivación; para el cálculo familiar se usa la del titular. |
| I | Vigencia manual del titular. Se conserva aunque se utilice la automática. |
| J | Alerta: días entre hoy y la vigencia utilizada por la familia. |
| K | Número de miembros calculado para el titular. Tiene limitaciones descritas más abajo. |
| L | Próxima cita. Sirve para seguir la renovación; no afecta al recuento familiar. |
| M | Servicios Sociales: desplegable con Sí y No. Rellenar en el titular. |
| N | Vigencia aplicada con máximo de tres meses desde la derivación, únicamente cuando M del titular es No. No escribir encima. |
| O | Comentario del encabezado y espacio para comentarios. |

La primera fila está inmovilizada para seguir viéndola al bajar. También está configurada para repetirse al imprimir Listado.

## Servicios Sociales y vigencia

| M del titular | Fecha que se utiliza para Alerta, Resumen y validación de citas |
| --- | --- |
| Sí | La vigencia manual de I del titular. N queda vacía. |
| No | La menor fecha entre I del titular y su derivación H más tres meses naturales. Si I está vacía, usa H + 3 meses. El resultado aparece en N. |
| Vacía | Las fórmulas usan I, igual que con Sí; además se resalta M vacía en el titular. |

Tres meses naturales no son necesariamente 90 días: por ejemplo, 12/10/2025 produce 12/01/2026. Si el mes de destino no tiene ese día, se ajusta al último día del mes.

Los tres meses son un máximo: con derivación 01/01/2026 y vigencia indicada 01/02/2026 se aplica 01/02/2026; si la indicada es 01/06/2026 se aplica 01/04/2026. Si coincide con el límite, se conserva. Una vigencia indicada no vacía e inválida no se sustituye por un plazo mayor: se debe corregir.

Al cambiar M de No a Sí se vuelve a utilizar I: la fórmula no borra la fecha manual. Con No, si falta una derivación numérica positiva, no se obtiene fecha aplicada y la familia queda fuera del Resumen.

El comentario de O1 indica Sí o vacío para Servicios Sociales y **No** para otro origen, de acuerdo con las fórmulas. El mensaje de error del desplegable todavía dice «Desmarca» para otro origen: hay que elegir **No**, porque dejar vacío utiliza la vigencia manual. Este Excel usa un desplegable de texto; en la aplicación se marca la casilla «No» de la columna «Servicios sociales».

## Alerta y regla de los 90 días

J calcula: `vigencia utilizada − fecha de hoy`.

- Valor positivo: días que faltan para vencer.
- Cero: vence hoy.
- Valor negativo: días desde el vencimiento.
- Vacío: no se ha obtenido una fecha numérica para calcularlo.

La familia sigue contando durante los primeros 90 días desde el vencimiento, incluido el día 90, con o sin cita. La próxima cita sigue pendiente para seguir la renovación; desde el día 91 deja de contar aunque tenga cita. Esto no amplía la vigencia ni borra los registros: solo determina su inclusión en Resumen.

## Próxima cita

Una cita escrita en L es válida únicamente si cumple todo lo siguiente:

1. Es una fecha numérica de Excel, sin componente de hora.
2. Existe una vigencia utilizada numérica y positiva.
3. La cita es de hoy o futura.
4. Puede ser anterior, igual o posterior al vencimiento de la vigencia utilizada.
5. Es como máximo la vigencia utilizada más 90 días; ese último día sí vale.

Las citas pendientes, pasadas o inválidas generan avisos para seguir la renovación, pero no excluyen a la familia del recuento. Para el Resumen trimestral se comprueba la vigencia, con 90 días de margen completos. El reparto mensual utiliza sus propios recuentos de atenciones.

Ejemplo: con vigencia utilizada 01/01/2026, se permite concertar una cita antes de esa fecha, ese mismo día o hasta el 01/04/2026, siempre que la cita sea de hoy o futura.


## Cómo hace el recuento de Resumen

El cálculo examina las filas 2 a 2999:

1. Considera que existe una persona si alguna celda de B:F tiene contenido. Una fila con solo A, H o I no basta.
2. Busca hacia arriba la última fila con A no vacía y la toma como titular. Se agrupa por la posición del titular, no por comparar números de familia.
3. Obtiene la fecha utilizada según M del titular: I con Sí o vacío; N con No.
4. Comprueba que esa fecha sea numérica, positiva y no anterior a hoy menos 90 días.
5. Las citas no condicionan el recuento: el día 90 sigue incluido aunque falte la cita o necesite corregirse.
6. Si pasa esas condiciones, cada persona identificada aporta 1 al total; si no, aporta 0.

Los campos pendientes o los documentos duplicados **no excluyen automáticamente** del recuento. Son avisos visuales independientes. La próxima cita del titular sirve para seguir la renovación y no determina si la familia cuenta.

Resultados visibles:

- **Resumen!F4:** familias con al menos una persona contabilizada.
- **Resumen!G4:** suma de personas contabilizadas.
- **Resumen!C4:C13:** familias contabilizadas agrupadas por tamaño, de 1 a 10 personas. Las familias mayores pueden entrar en F4 y G4 sin aparecer en esos grupos.
- **Resumen!E4:E6:** personas contabilizadas de 0–2, 3–18 y 19–100 años. Exige fecha de nacimiento positiva y edad en el intervalo. Una persona sin nacimiento puede contar en G4 y faltar en el desglose por edades; también ocurre con mayores de 100 años.

Debajo del resumen, en las filas 19–20, hay dos totales adicionales:

- **Personas excluidas (B20):** total de personas registradas en V menos las incluidas en Q. Incluye exclusiones por vigencia ausente o inválida y por superar 90 días de caducidad.
- **Personas incluidas y excluidas (E20):** todas las personas registradas, sin aplicar el filtro de vigencia. Equivale a Resumen!G4 más las personas excluidas.

Las casillas B20 y E20 conservan sus totales numéricos. Una tabla independiente en B23:G25 cuenta todas las personas por origen: B25 para quienes sí vienen de Servicios sociales y E25 para quienes no. Incluye personas contabilizadas y excluidas; la suma de B25 y E25 coincide con E20. El origen no es motivo de exclusión.

El origen se hereda del titular mediante la columna oculta X; Sí o vacío en Listado!M se considera Servicios sociales. Las personas sin titular identificado se incluyen en Servicios sociales para mantener el total general.

Los totales se actualizan al recalcular el libro y también aparecen en el Excel generado por la app. No modifican los cálculos de Resumen ni Reparto.

## Reparto ahora pertenece al mensual

El trimestral `Modelo  listado v(2.0).xlsx` contiene **Listado** y **Resumen**. Ya no contiene Reparto. La app genera ese trimestral sin introducir las cantidades del reparto.

El archivo **MODELO RESUMEN MENSUAL.xlsx** contiene las hojas Resumen mensual y Reparto, con cuatro grupos de edad, incluido menores sin edad conocida. Consultar [GUIA-RESUMEN-MENSUAL.md](GUIA-RESUMEN-MENSUAL.md) para las entradas, fórmulas y límites. El original mensual recibido se conserva sin modificar.

El mensual se rellena con personas y familias atendidas en el mes. No hereda el filtro de vigencia del trimestral. La app permite introducir y guardar sus recuentos por mes y generar el XLSX con ellos. Sus grupos son menores sin edad conocida, 0–2, 3–17 y 18 o más.

La pantalla Reparto utiliza el resumen mensual seleccionado. Solo calcula cuando sus 14 recuentos están completos, los beneficiarios por familias coinciden con los cuatro grupos de edad y hay personas. Las cantidades y alimentos se conservan por mes.

Listado!K cuenta las personas detectadas de cada familia mediante los auxiliares N y V de Resumen, sin contar huecos y hasta la fila 2999. La exportación conserva el límite de 995 beneficiarios por compatibilidad con las plantillas anteriores.

## Avisos y validaciones

- **Documento E:** detecta duplicados únicamente dentro de E2:E2999. Ignora celdas vacías y no distingue mayúsculas. No elimina duplicados ni descuenta personas.
- **Documento y nacimiento pendientes:** se resaltan para titulares y otros miembros con datos, salvo la excepción manual de menor indicada con Sí en la columna oculta P de Listado. Para titulares sigue siendo obligatorio aunque P diga Sí. Hay además una regla de documento vacío para edad mayor de 18.
- **Derivación H y vigencia I:** se resaltan vacías en titulares. El aviso de I vacía sigue existiendo aunque M sea No y se utilice N; no equivale a exclusión si N proporciona una fecha válida.
- **Nacimiento F:** validación entre 01/01/1900 y hoy, sin hora.
- **Derivación H:** validación entre hoy menos 36 meses y hoy, sin hora.
- **Vigencia I:** validación entre hoy menos 12 meses y hoy más 48 meses, sin hora.
- **Cita L:** validación y resaltado según las reglas de cita anteriores.
- **Origen M:** desplegable Sí/No. Hay una regla que señala Sí escrito fuera de una fila titular; los miembros deben heredar el origen del titular mediante las fórmulas.

Las validaciones permiten dejar vacío. Pegar contenido puede sustituir fórmulas, formatos o validaciones: conviene pegar solo valores en las columnas de entrada y mantener las fórmulas G, J, K y N.

## Dónde están las fórmulas ocultas

En **Resumen**, mostrar las columnas **N:X** para inspeccionar los auxiliares. Se puede seleccionar M:Y y usar Mostrar columnas.

| Columna de Resumen | Función |
| --- | --- |
| N | Fila del titular al que pertenece la persona. |
| O | Vigencia realmente utilizada, manual o automática. |
| P | Cita inválida: 1 sí, 0 no. |
| Q | Persona contabilizada: 1 sí, 0 no. |
| R | Personas contabilizadas de la familia, en la fila del titular. |
| S | Número de familia de Listado!A. |
| T | Edad de Listado!G. |
| U | Nacimiento de Listado!F. |
| V | Existencia de persona según contenido de B:F. |
| W | Próxima cita de Listado!L. |
| X | Origen del titular: No para otro origen; Sí para Servicios sociales. |

Nombres definidos, visibles desde el administrador de nombres:

- `VigenciasFamilia`: Resumen!O:O.
- `CitasInvalidas`: Resumen!P:P.
- El nombre antiguo `TotalBeneficiarios` se ha retirado del trimestral; el mensual usa directamente Reparto!N12.

Listado también tiene ocultas P:Y. P se utiliza como marca manual de menor en los avisos de campos pendientes; no es el mismo P de Resumen.

Para cambiar el margen de 90 días habría que revisar conjuntamente las fórmulas auxiliares P y Q de Resumen y la validación de L en Listado, además de los mensajes. El plazo de tres meses se calcula en N de Listado mediante EDATE/FECHA.MES con el argumento 3. No modificar estos plazos solo en el comentario: el texto no controla el cálculo.

## Excel generado por la aplicación con esta plantilla

El resumen trimestral conserva actualmente el filtro de vigencia y los 90 días de margen. Esto no es un registro de asistencia durante el trimestre: la selección por atenciones reales necesitaría esos datos. Al generar una copia, la aplicación:

- Escribe el origen en M del titular y conserva I como vigencia manual. N mantiene su fórmula automática. Importar Sí o vacío en M equivale a Servicios Sociales; No limita la vigencia a un máximo de tres meses sin ampliar una fecha indicada anterior.
- Conserva las citas de todos los miembros en L y la marca manual de menor en P de Listado, incluso si tiene nombre pero no nacimiento.
- Exporta únicamente Listado y Resumen; Reparto está en el archivo mensual independiente.
- Solicita recálculo al abrir y elimina resultados de fórmulas guardados previamente y la cadena de cálculo antigua.

Los primeros 90 días de caducidad cuentan con o sin cita, incluido el día 90; desde el día 91 se excluye a toda la familia. Las citas escritas fuera de plazo se avisan sin excluir. Una cita no amplía el límite de 90 días.

La plantilla revisada corrige la columna K para contar personas reales, sin el límite heredado de fila 996. La aplicación conserva por compatibilidad el límite de exportación de 995 beneficiarios; esta revisión no aumenta ese límite. En la app, marcar No muestra únicamente la vigencia calculada y conserva la original internamente. Desmarcar No recupera la original. Para editarla, desmarcar No, cambiar la fecha y volver a marcarlo. La importación del listado sigue sin importar cantidades o alimentos de Reparto.

La actualización de la plantilla se puede repetir con `tools/actualizar-plantilla-cita.mjs`, indicando el archivo y una ruta nueva para su copia de seguridad. Se actualiza la validación de Próxima cita L para permitir citas previas al vencimiento y se conservan las demás validaciones de entrada.


## Dónde están las reglas en la aplicación

| Archivo y función | Responsabilidad |
| --- | --- |
| [src/vigencia.mjs](src/vigencia.mjs), `DIAS_PRORROGA` | Margen de 90 días |
| `vigenciaAplicada()` en ese mismo archivo | Con Sí, vigencia manual; con No, la menor entre manual y derivación + 3 meses (si manual vacía, usa el límite) |
| `motivoExclusion()` en ese mismo archivo | Excluye solo por vigencia no válida o por más de 90 días de caducidad |
| `errorProximaCita()` en ese mismo archivo | Fecha real, hoy o futura, como máximo vigencia + 90 días; admite citas antes del vencimiento |
| [src/reparto.mjs](src/reparto.mjs), `tieneDatosBeneficiario()` | Identifica personas para el recuento; un menor declarado no titular cuenta incluso sin nombre ni nacimiento |
| `resumen()` en ese mismo archivo | Aplica exclusiones, suma personas y familias, agrupa por tamaño y edad |
| `envases()` en ese mismo archivo | Redondea cantidad / beneficiarios de Reparto × miembros de una familia |
| `AVISO_RECUENTO_REPARTO` en ese mismo archivo | Texto conservado para exportaciones de plantillas trimestrales anteriores |
| [src/validacion.mjs](src/validacion.mjs), `erroresFamilia()` | Campos pendientes y fechas incorrectas; mantiene el aviso de cita pendiente con vigencia caducada |
| [src/estado-familia.mjs](src/estado-familia.mjs), `estado()` y `descripcionEstado()` | Etiquetas y explicaciones: Sin completar, Fuera de recuento, Fuera de plazo, Caducada, Próxima y Correcta |
| [src/app.js](src/app.js), `renderReparto()` | Usa los recuentos del resumen mensual seleccionado para distribuir envases |
| [src/excel.js](src/excel.js), `exportExcel()` | Genera el trimestral (Listado y Resumen), sin Reparto |
| [src/mensual.mjs](src/mensual.mjs), `resumenMensual()` | Totales y comprobación de recuentos del mes |
| [src/mensual-storage.js](src/mensual-storage.js) | Guarda borradores y repartos independientes por mes |
| [src/excel-mensual.mjs](src/excel-mensual.mjs), `buildMonthlyWorkbook()` | Rellena el mensual y repara las fórmulas de su reparto |
| [src/excel-workbook.mjs](src/excel-workbook.mjs), `buildWorkbook()` | Escribe datos, conserva las fórmulas y solicita recálculo; admite el trimestral sin hoja Reparto |
| [tools/actualizar-plantilla-cita.mjs](tools/actualizar-plantilla-cita.mjs) | Actualiza la plantilla actual: recuento, citas, totales y tabla por origen; exige una ruta de copia de seguridad nueva |

**Una etiqueta de aviso no equivale a una exclusión.** Por ejemplo, «Fuera de plazo» indica que hay que corregir una cita; la persona puede seguir contando si su vigencia está dentro del margen. La etiqueta «Sin completar» tiene prioridad visual sobre otros estados, pero el recuento se decide por separado.

«Próxima» avisa cuando la vigencia vence dentro de los próximos 60 días, incluido hoy. «Caducada» indica que la vigencia venció, aunque la familia todavía pueda contar durante el margen de renovación.

## Comprobaciones y diferencias que hay que tener presentes

- **Identificación de personas:** Excel usa contenido en Listado!B:F. La app usa nombre, apellidos, documento o nacimiento, o la marca de menor no titular. Una fila de Excel con solo número de beneficiario puede contar allí aunque no equivalga a una persona con datos en la app. Una fila con solo fechas de derivación, vigencia o cita no basta.
- **Familias:** Excel agrupa por la última fila con A rellena; la app usa la familia guardada y su titular. Filas sin titular previo quedan fuera del resumen principal aunque V detecte una persona. Se incluyen en el total general y, por el criterio actual de X vacío, en el grupo de Servicios sociales. Esto es un criterio por defecto, no una confirmación del origen: conviene corregir esas filas.
- **Origen:** Sí y vacío equivalen a Servicios sociales. Solo No activa el tope automático de tres meses; se conserva una fecha indicada anterior. Elegir No no excluye, aunque puede cambiar el resultado al cambiar la fecha usada.
- **Edades:** una persona sin nacimiento válido puede contar en el total y no en los rangos 0–2, 3–18 y 19–100. Tampoco se incluyen mayores de 100 en esos rangos.
- **Validaciones distintas:** Excel limita derivación a los últimos 36 meses y vigencia manual a entre hoy menos 12 meses y hoy más 48 meses. La app valida fechas reales y derivaciones no futuras, pero no impone esos mismos márgenes de meses. El desplegable de origen cubre M2:M2999, incluida M7.
- **Colores:** Excel resalta una próxima cita vacía con J negativo. Los colores por sí solos no cambian Q ni los totales. El aviso de vigencia manual vacía solo se aplica si el origen no es No. El origen vacío equivale a Sí y no se resalta como pendiente; la vigencia ya no se colorea por faltar derivación.
- **Redondeo:** los envases se redondean por tamaño de familia. La suma entregada puede diferir de la cantidad asignada.
- **Recálculo:** los resultados dependen de HOY y cambian con la fecha. Abrir con cálculo automático o recalcular en Excel. La exportación limpia resultados de fórmulas guardados anteriormente y fuerza recálculo; otros visores pueden mostrar cifras vacías hasta calcular.
- **Alcance de los cambios:** la plantilla afecta a los archivos nuevos. Un Excel exportado antes conserva sus propias fórmulas y no se actualiza por modificar la app.

Comprobaciones de totales:

```text
Resumen!G4 + Resumen!B20 = Resumen!E20
Resumen!B25 + Resumen!E25 = Resumen!E20
El total de Reparto se consulta ahora en el libro mensual, no en el trimestral.
```

B25 y E25 no tienen por qué sumar G4, porque incluyen también personas excluidas. Los totales de libros mensual y trimestral corresponden a periodos y entradas distintos; no hay que esperar que coincidan.

## Mantenimiento de las reglas

Cambiar solo los textos no modifica los cálculos. Para cambiar el margen de renovación hay que coordinar `DIAS_PRORROGA`, la fórmula Q de Resumen, las validaciones de citas, el auxiliar P y los mensajes. Para cambiar los tres meses, revisar `vigenciaAplicada()` y Listado!N, manteniendo el mínimo con la vigencia indicada. Para cambiar el origen, revisar Listado!M, Resumen!X, la importación y la exportación.

Los scripts antiguos `crear-plantilla-15-*`, `crear-plantilla-v16.py` y otros de `tools/` reflejan versiones anteriores; algunos contienen reglas de 99 días o requisitos antiguos de cita. No representan las reglas actuales. [REVISION-EXCEL-2.0.md](REVISION-EXCEL-2.0.md) es una revisión histórica y puede describir situaciones ya corregidas.

Se contrastaron las ubicaciones y fórmulas con el XML del libro y el código actual. Esta documentación no supone una comprobación de recálculo en Microsoft Excel o LibreOffice.

## Anexo: fórmulas exactas de la plantilla actual

Se reproducen en inglés, tal como se guardan dentro del archivo XLSX, con `=` delante para identificarlas como fórmulas. Excel en español las muestra traducidas y suele utilizar `;` en lugar de `,`. Por ejemplo: SUM → SUMA, SUMIF → SUMAR.SI, COUNTIFS → CONTAR.SI.CONJUNTO, IF → SI, IFERROR → SI.ERROR, TODAY → HOY y EDATE → FECHA.MES.

Las fórmulas de la fila 2 son ejemplos de las columnas calculadas hasta la fila 2999; las referencias relativas cambian en cada fila. Las referencias con `$` quedan fijas. Algunas fórmulas del libro se almacenan como fórmulas compartidas entre varias filas.

### Listado

**Listado!G2 — Edad en años cumplidos**

```excel
=IF(F2="", "", DATEDIF(F2, TODAY(), "Y"))
```

**Listado!J2 — Días hasta el vencimiento**

```excel
=IFERROR(IF(ISNUMBER(INDEX(VigenciasFamilia,ROW())),INDEX(VigenciasFamilia,ROW())-TODAY(),""),"")
```

**Listado!N2 — Vigencia automática**

```excel
=IFERROR(IF(OR(INDEX(Resumen!$N:$N,ROW())="",INDEX($M:$M,INDEX(Resumen!$N:$N,ROW()))<>"No"),"",IF(AND(ISNUMBER(INDEX($H:$H,INDEX(Resumen!$N:$N,ROW()))),INDEX($H:$H,INDEX(Resumen!$N:$N,ROW()))>0),IF(INDEX($I:$I,INDEX(Resumen!$N:$N,ROW()))=0,EDATE(INDEX($H:$H,INDEX(Resumen!$N:$N,ROW())),3),IF(AND(ISNUMBER(INDEX($I:$I,INDEX(Resumen!$N:$N,ROW()))),INDEX($I:$I,INDEX(Resumen!$N:$N,ROW()))>0),MIN(INDEX($I:$I,INDEX(Resumen!$N:$N,ROW())),EDATE(INDEX($H:$H,INDEX(Resumen!$N:$N,ROW())),3)),"")),"")),"")
```

**Listado!K2 — Miembros detectados de la familia, sin contar filas vacías**

```excel
=IF(A2="","",COUNTIFS(Resumen!$N$2:$N$2999,ROW(),Resumen!$V$2:$V$2999,1))
```

### Resumen: auxiliares ocultos

**Resumen!N2 — Fila del titular**

```excel
=IF(V2=0,"",IFERROR(LOOKUP(2,1/(INDEX(Listado!A:A,2):INDEX(Listado!A:A,ROW())<>""),ROW(INDEX(Listado!A:A,2):INDEX(Listado!A:A,ROW()))),""))
```

**Resumen!O2 — Vigencia utilizada**

```excel
=IFERROR(IF(N2="","",IF(INDEX(Listado!M:M,N2)="No",IF(INDEX(Listado!N:N,N2)=0,"",INDEX(Listado!N:N,N2)),IF(INDEX(Listado!I:I,N2)=0,"",INDEX(Listado!I:I,N2)))),"")
```

**Resumen!P2 — Aviso de cita inválida; no excluye**

```excel
=IF(W2="",0,IFERROR(IF(AND(ISNUMBER(W2),W2=INT(W2),ISNUMBER(O2),O2>0,W2>=TODAY(),W2<=O2+90),0,1),1))
```

**Resumen!Q2 — Inclusión en el resumen principal**

```excel
=IFERROR(IF(AND(N2<>"",ISNUMBER(O2),O2>0,O2>=TODAY()-90),1,0),0)
```

**Resumen!R2 — Personas incluidas de la familia**

```excel
=IF(S2="","",COUNTIFS($N$2:$N$2999,ROW(),$Q$2:$Q$2999,1))
```

**Resumen!S2 — Número de familia**

```excel
=IF(INDEX(Listado!A:A,ROW())="","",INDEX(Listado!A:A,ROW()))
```

**Resumen!T2 — Edad**

```excel
=IF(INDEX(Listado!G:G,ROW())="","",INDEX(Listado!G:G,ROW()))
```

**Resumen!U2 — Nacimiento**

```excel
=IF(INDEX(Listado!F:F,ROW())="","",INDEX(Listado!F:F,ROW()))
```

**Resumen!V2 — Persona detectada antes de excluir**

```excel
=IF(COUNTA(INDEX(Listado!B:B,ROW()):INDEX(Listado!F:F,ROW()))>0,1,0)
```

**Resumen!W2 — Próxima cita**

```excel
=IF(INDEX(Listado!L:L,ROW())="","",INDEX(Listado!L:L,ROW()))
```

**Resumen!X2 — Origen del titular**

```excel
=IF(N2="","",IF(INDEX(Listado!$M:$M,N2)="No","No","Sí"))
```

### Resumen: resultados visibles

**Resumen!C4 — Familias de un miembro; C5:C13 usa los demás tamaños**

```excel
=COUNTIFS($S$2:$S$2999,"<>",$R$2:$R$2999,B4)
```

**Resumen!E4 — Personas de 0 a 2 años**

```excel
=COUNTIFS($Q$2:$Q$2999,1,$T$2:$T$2999,">=0",$T$2:$T$2999,"<=2",$U$2:$U$2999,">0")
```

**Resumen!E5 — Personas de 3 a 18 años**

```excel
=COUNTIFS($Q$2:$Q$2999,1,$T$2:$T$2999,">=3",$T$2:$T$2999,"<=18",$U$2:$U$2999,">0")
```

**Resumen!E6 — Personas de 19 a 100 años**

```excel
=COUNTIFS($Q$2:$Q$2999,1,$T$2:$T$2999,">=19",$T$2:$T$2999,"<=100",$U$2:$U$2999,">0")
```

**Resumen!F4 — Familias incluidas**

```excel
=COUNTIFS($S$2:$S$2999,"<>",$R$2:$R$2999,">0")
```

**Resumen!G4 — Personas incluidas**

```excel
=SUM($Q$2:$Q$2999)
```

**Resumen!B20 — Personas excluidas**

```excel
=SUM($V$2:$V$2999)-SUM($Q$2:$Q$2999)
```

**Resumen!E20 — Todas las personas: incluidas y excluidas**

```excel
=SUM($V$2:$V$2999)
```

**Resumen!B25 — Todas las personas de Servicios sociales**

```excel
=SUMIF($X$2:$X$2999,"<>No",$V$2:$V$2999)
```

**Resumen!E25 — Todas las personas de otros orígenes**

```excel
=SUMIF($X$2:$X$2999,"No",$V$2:$V$2999)
```

### Reparto mensual (referencia histórica de la copia anterior)

Estas fórmulas pertenecen a la copia mensual anterior. El archivo actual es `MODELO RESUMEN MENSUAL.xlsx`; su mapa de celdas y las fórmulas reparadas por la exportación están en [GUIA-RESUMEN-MENSUAL.md](GUIA-RESUMEN-MENSUAL.md). No pertenecen al trimestral.

**Reparto!D13 — Familias de un miembro; hasta M13 para 10 miembros**

```excel
='RESUMEN_MENSUAL_BENEFICIARIOS'!$C$13
```

**Reparto!D12 — Beneficiarios de familias de un miembro; hasta M12 para 10**

```excel
=IF(ISBLANK($D$13), " ",$D$13*1)
```

**Reparto!N13 — Total de familias del reparto**

```excel
=SUM(D13:M13)
```

**Reparto!N12 — Total de beneficiarios del reparto**

```excel
=SUM(D12:M12)
```

**Reparto!N15 — Cuota por persona del primer alimento**

```excel
=IFERROR(IF('RESUMEN_MENSUAL_BENEFICIARIOS'!$F$7=$N$12,$C15/$N$12,""),"")
```

**Reparto!D15 — Envases por familia de un miembro**

```excel
=IFERROR(   IF(D$13=0,"",ROUND($N15,0)), " ")
```

**Reparto!E15 — Envases por familia de dos miembros**

```excel
=IFERROR(   IF(E$13=0,"",ROUND($N15*2,0))," ")
```

**Reparto!M15 — Envases por familia de diez miembros**

```excel
=IFERROR(   IF(M$13=0,"",ROUND($N15*10,0))," ")
```

Las fórmulas de alimentos se aplican a las filas 15–30. B contiene el nombre y C la cantidad asignada; esas dos columnas son datos introducidos.

### Validaciones de entrada de Listado

Estas reglas están en Datos → Validación de datos, no en la barra de fórmulas de una celda. Se muestran los rangos exactos guardados actualmente.

**Listado!F2:F2999**

```excel
=OR(F2="",IFERROR(AND(ISNUMBER(F2),F2=INT(F2),F2>=DATE(1900,1,1),F2<=TODAY()),FALSE))
```

**Listado!H2:H2999**

```excel
=OR(H2="",IFERROR(AND(ISNUMBER(H2),H2=INT(H2),H2>=EDATE(TODAY(),-36),H2<=TODAY()),FALSE))
```

**Listado!L2:L2999**

```excel
=OR(L2="",IFERROR(AND(ISNUMBER(L2),L2=INT(L2),ISNUMBER(INDEX(VigenciasFamilia,ROW())),INDEX(VigenciasFamilia,ROW())>0,L2>=TODAY(),L2<=INDEX(VigenciasFamilia,ROW())+90),FALSE))
```

**Listado!I3 I6:I17 I19:I2999**

```excel
=OR(I3="",IFERROR(AND(ISNUMBER(I3),I3=INT(I3),I3>=EDATE(TODAY(),-12),I3<=EDATE(TODAY(),48)),FALSE))
```

**Listado!I2 I4:I5 I18**

```excel
=OR(I2="",IFERROR(AND(ISNUMBER(I2),I2=INT(I2),I2>=EDATE(TODAY(),-12),I2<=EDATE(TODAY(),48)),FALSE))
```

**Listado!M2:M6 M8:M2999**

```excel
="Sí,No"
```
