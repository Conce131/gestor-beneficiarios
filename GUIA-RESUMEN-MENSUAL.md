# Resumen mensual y listado trimestral

El mensual refleja las familias que continúan de alta al cierre del mes para
prever los alimentos del siguiente. No cuenta entregas ni firmas.

## Flujo de trabajo

1. En **Trimestral → Listado**, selecciona el mes en «Situación al cierre del mes».
2. En la columna **Situación**, indica **De alta** o **De baja** para cada familia.
   El cambio se aplica desde ese mes y se mantiene hasta otra modificación.
3. En **Mensual → Familias de alta**, revisa las incluidas y las excluidas, con su
   motivo. Se cuenta una familia una sola vez si continúa de alta y tiene
   vigencia válida al último día del mes, con el margen de 90 días incluido.
   Una cita no amplía ese margen.
4. En **Resumen mensual**, revisa entidad, totales y edades y genera el Excel.
   Los grupos son menores sin edad conocida, 0–2, 3–17 y 18 años o más. Las edades
   se calculan al último día del mes. El reparto usa estas mismas cantidades.

No hace falta volver a marcar las familias cada mes. Un mes nuevo calcula la
continuidad de altas y bajas y copia entidad y nombres de alimentos; deja vacías
las cantidades de reparto. Las correcciones de miembros se guardan por mes:
una edición actual no reescribe los datos de meses anteriores.
Los datos personales de otro mes se consultan en modo de solo lectura.

## Bajas e histórico trimestral

Si una familia causa baja en agosto, no cuenta en el mensual de agosto ni en
septiembre. Sigue visible en julio–septiembre y conserva su participación en el
resumen trimestral. Desde octubre deja de aparecer en el listado por defecto.
No se borra: el selector de mes permite consultar su trimestre anterior y
**Ver familias archivadas** permite localizarla y reactivarla desde otro mes.
Los números de los expedientes archivados permanecen reservados.

El trimestral cuenta una sola vez las familias que estuvieron de alta y con
vigencia válida en algún momento del trimestre. Conserva la última composición
válida registrada; una baja posterior no la elimina. La exportación fija la
referencia de edades al cierre del trimestre y conserva la inclusión histórica,
para que abrir el Excel más adelante no cambie ese recuento.

## Datos anteriores e importación

Al iniciar esta versión, las familias existentes se consideran de alta desde el
mes de la carga y requieren revisar su situación inicial. No se inventan altas,
bajas ni composiciones para meses anteriores al comienzo del historial.
Los meses ya guardados conservan su criterio y cifras. **Contar familias de alta**
permite cambiar un mes expresamente y guarda una copia del recuento anterior;
**Restaurar criterio anterior** recupera esas cifras y sus marcas guardadas.
Si falta historial para reconstruir un mes, se impide exportarlo como si fuera
un cero confirmado. Se pueden conservar las cifras anteriores o introducirlas
manualmente.

Importar otro Excel actualiza las familias coincidentes por número y documento
(o nombre del titular cuando falta documento), conserva su historial y no reactiva
bajas existentes. Las familias ausentes pasan a baja desde el mes actual. Un número
que corresponde a otro expediente provoca un aviso antes de guardar. Los datos
importados que son anteriores al inicio del seguimiento no reconstruyen por sí
solos las situaciones de los meses anteriores.

La situación de alta/baja y las versiones por mes se conservan en esta instalación,
en los datos de familias. El Excel oficial no contiene ese historial: trasladar
solo el Excel a otra instalación no transfiere las altas y bajas guardadas.

## Introducción manual y reparto

Se mantiene la edición manual de cifras y la conservación de los recuentos
anteriores basados en atenciones. Las cifras por tamaños y edades deben coincidir
para exportar. Los nacimientos incompletos de adultos y los tamaños de más de diez
miembros requieren revisión antes de generar el Excel automático.

El reparto es opcional. Utiliza los beneficiarios que continúan según el mensual,
no los totales acumulados del trimestre. La entidad envía el documento al almacén.

## Celdas de la plantilla actual

| Entrada o resultado | Celda |
| --- | --- |
| Entidad | C2:E2, combinada |
| Mes/año | G2 |
| Familias de 1 a 10 miembros | C4:C13 |
| Menores sin edad conocida | E4 |
| Personas de 0–2, 3–17 y 18 o más | E5, E6 y E7 |
| Total de familias | F4: `SUM(C4:C13)` |
| Beneficiarios por tamaño de familia | G4: `SUMPRODUCT(B4:B13,C4:C13)` |
| Beneficiarios por grupos de edad | E8: `SUM(E4:E7)` |
| Control de recuentos | D9:G13, combinado |
| Alimentos y cantidades | Reparto!B15:C30 |

La plantilla revisada el 22/10/2026 ya contiene las referencias del reparto
corregidas y fórmulas para los cuatro grupos de edad. La exportación también
reconstruye esas fórmulas en cada copia generada.
Reparto!D13:M13 enlaza con C4:C13 del resumen mensual; N12 suma beneficiarios y
N13 familias. N15:N30 obtiene la cuota por persona cuando hay una cantidad
introducida, los totales coinciden y hay personas. Una cantidad vacía queda
pendiente; un cero introducido produce cero unidades. D15:M30 multiplica la cuota por tamaño y
redondea al entero más próximo; los tamaños sin familias quedan vacíos.
El redondeo puede hacer que la cantidad total entregada difiera de la asignada.

El XLSX generado conserva los estilos, las protecciones y las demás partes del
modelo, incluye resultados calculados y solicita recálculo automático. Las pruebas
comprueban entradas, resultados, referencias y estilos; no sustituyen la revisión
visual y de recálculo en Microsoft Excel o LibreOffice.

## Guardado

En escritorio se guardan los meses en `mensuales.json`; en navegador, en IndexedDB.
Los datos antiguos de localStorage se migran al confirmar su escritura en IndexedDB.
El reparto anterior de la app se conserva una vez en el mes actual al migrar, sin
convertir el listado en atenciones. Cargar otro listado no sustituye los mensuales.
Eliminar todos los datos de este ordenador también los elimina.
El Excel mensual se genera para enviar y conservar; todavía no se importa de nuevo
en la app. Los borradores, atenciones e históricos permanecen en esta instalación, tanto en escritorio como en navegador.

---

## Referencia histórica de la copia anterior

Lo que sigue describe el archivo previo y sus celdas, no la plantilla actual ni
el funcionamiento actual de la aplicación.

Archivo preparado: `MODELO RESUMEN MENSUAL BENEFICIARIOS-con-reparto.xlsx`.
Se conserva sin modificar el original `MODELO RESUMEN MENSUAL BENEFICIARIOS.xlsx`.

## Qué recoge

El mensual cuenta personas y familias atendidas durante el mes, no todas las registradas en el trimestral. Una persona se cuenta una vez dentro de ese resumen mensual. No hay aquí datos individuales de asistencia ni una conexión automática con la app: las cifras se introducen manualmente.

El trimestral queda en `Modelo  listado v(2.0).xlsx` con Listado y Resumen, sin Reparto. La app conserva de momento su pantalla de reparto anterior; conectar su cálculo al mensual queda pendiente. El resumen actual del trimestral sigue filtrando por vigencia: quitar Reparto no convierte el listado en un registro de atenciones de los últimos tres meses.

## Qué rellenar en RESUMEN_MENSUAL_BENEFICIARIOS

| Celda | Dato |
| --- | --- |
| E4 (combinada hasta G4) | Nombre de la entidad, como en el modelo recibido |
| E5 (combinada hasta G5) | Fecha o mes de referencia |
| C7 | Lactantes de 0 a 2 años, ambos incluidos |
| D7 | Menores de 3 a 17 años, ambos incluidos |
| E7 | Adultos de 18 años o más; incluye los 18 |
| C13:C22 | Número de familias atendidas por tamaño: 1 miembro en C13, 2 en C14, hasta 10 en C22 |

Introducir cantidades enteras mayores o iguales a cero. Esos campos permiten quedar vacíos mientras se completa el resumen. Las familias de más de 10 miembros necesitan revisión: el reparto conservado del modelo solo tiene columnas de 1 a 10 miembros.

## Qué calcula automáticamente

| Celda | Fórmula guardada en el XLSX | Resultado |
| --- | --- | --- |
| F7 | `SUM(C7:E7)` | Total de beneficiarios por edades |
| G7 | `C23` | Total de familias |
| D13:D22 | `B13*C13`, cambiando la fila | Beneficiarios por tamaño de familia |
| C23 | `SUM(C13:C22)` | Familias totales |
| D23 | `SUM(D13:D22)` | Beneficiarios totales según familias |
| B27 | Compara F7 con D23 | Avisa si el total por edades no coincide con el total por tamaños de familia |

Para que se calcule Reparto, F7 y D23 deben coincidir y debe haber beneficiarios. No escribir cifras encima de las fórmulas. Ejemplo: una familia de dos y otra de tres son 2 familias y 5 beneficiarios; C14 = 1, C15 = 1 y C7 + D7 + E7 debe ser 5.

## Hoja Reparto

| Zona | Uso |
| --- | --- |
| D13:M13 | Familias por tamaño; enlaza con C13:C22 del resumen mensual |
| D12:M12 | Beneficiarios: familias multiplicadas por 1, 2…10 |
| N13 | `SUM(D13:M13)`: familias del reparto |
| N12 | `SUM(D12:M12)`: beneficiarios del reparto |
| B15:B30 | Nombres de alimentos |
| C15:C30 | Cantidades asignadas en envases; rellenar aquí |
| N15:N30 | Cuota por persona; solo calcula si el total por edades coincide con N12 |
| D15:M30 | Envases por familia, según su tamaño; redondea al entero más próximo |

Ejemplo de fórmula en N15:

```excel
=IFERROR(IF('RESUMEN_MENSUAL_BENEFICIARIOS'!$F$7=$N$12,$C15/$N$12,""),"")
```

Las columnas de familias multiplican esa cuota por el tamaño correspondiente. Si los totales mensuales no coinciden, el reparto queda vacío para revisarlos. El redondeo puede hacer que la suma final entregada difiera de la cantidad asignada.

Este libro no aplica filtros por vigencia, cita ni origen de Servicios sociales: los datos ya deben corresponder a las atenciones del mes. Tampoco se recalcula el mensual desde el trimestral.

## Verificación y mantenimiento

Se han comprobado las relaciones internas del XLSX, los índices de estilos y los enlaces entre resumen y reparto. Se solicita recálculo automático al abrir. No se ha verificado visualmente ni recalculado en Microsoft Excel o LibreOffice.

El script `tools/separar-excel-mensual-trimestral.py` conserva una copia previa del trimestral en `/tmp/gestor-trimestral-antes-separar-reparto.xlsx`. Está pensado para ejecutar la separación una vez; rechaza repetirse si el trimestral ya no contiene Reparto o si existe la salida. La copia de `/tmp` es temporal.
