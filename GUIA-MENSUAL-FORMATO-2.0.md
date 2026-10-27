# Mensual con la tabla del modelo 2.0 (referencia histórica)

La plantilla actual se llama `MODELO RESUMEN MENSUAL.xlsx` y ya está integrada
en la app. Incluye cuatro grupos de edad, con menores sin edad conocida en E4.
Consultar [GUIA-RESUMEN-MENSUAL.md](GUIA-RESUMEN-MENSUAL.md) para su mapa de celdas
y el guardado por mes. El resto de este documento describe la copia anterior.

Archivo nuevo: `MODELO RESUMEN MENSUAL BENEFICIARIOS-formato-2.0.xlsx`.

La hoja **Resumen mensual** reproduce la distribución de la tabla Resumen del modelo 2.0: tamaños de familia a la izquierda, edades en el centro y totales a la derecha. La hoja **Reparto** toma sus datos de este nuevo resumen. Los archivos anteriores se conservan.

## Qué rellenar

| Zona | Entrada |
| --- | --- |
| C1:E1 | Entidad, celda combinada |
| G1 | Mes/año de las atenciones |
| C4:C13 | Número de familias de 1 a 10 miembros; la columna B indica el tamaño |
| E4 | Lactantes: 0–2 años, ambos incluidos |
| E5 | Menores: 3–17 años, ambos incluidos |
| E6 | Adultos: 18 años o más, incluidos los 18 |
| Reparto!C15:C30 | Envases asignados de cada alimento |

Las casillas pendientes aparecen en amarillo y pierden ese color al rellenarlas. En los recuentos, escribir **0** si no hay personas o familias de un grupo. Se permiten únicamente cantidades enteras no negativas. Las fórmulas están protegidas para evitar sustituirlas al introducir cifras.

## Fórmulas del resumen

| Celda | Fórmula guardada en el XLSX | Qué cuenta |
| --- | --- | --- |
| F4 | `SUM(C4:C13)` | Familias atendidas |
| G4 | `SUMPRODUCT(B4:B13,C4:C13)` | Personas según el tamaño de las familias |
| E8 | `SUM(E4:E6)` | Personas según los grupos de edad |
| D10:G12 | Comprueba las 13 casillas de recuento y compara G4 con E8 | Pendiente, recuento correcto o diferencia que revisar |

Ejemplo: una familia de dos miembros y otra de tres suman 2 familias y 5 personas. Se introduce C5 = 1 y C6 = 1; el resto de tamaños, 0. Los tres grupos de edad deben sumar 5. El control detecta diferencias entre estos dos totales, pero no comprueba que las personas sean distintas ni que realmente hayan sido atendidas: las entradas deben corresponder a ese mes y no duplicar personas.

La tabla admite familias de **1 a 10 miembros**. Si existen familias mayores, el modelo necesita ampliarse antes de incluirlas; no deben anotarse como familias de 10.

## Cómo utiliza el mensual la hoja Reparto

- D13:M13 enlaza con Resumen mensual!C4:C13.
- D12:M12 multiplica familias por miembros; N12 suma sus beneficiarios y N13 suma sus familias.
- N15:N30 calcula cuota por persona únicamente si las 13 casillas de recuento están completas y el total de edades coincide con el total de personas según las familias. Con total cero no se calcula reparto.
- D15:M30 multiplica la cuota por el tamaño de familia y redondea a envases enteros. El redondeo puede producir un total distinto de la cantidad asignada.

## Diferencias respecto a las fórmulas del trimestral

El modelo trimestral cuenta personas elegibles según su vigencia y el margen de 90 días. No registra quién fue atendido durante el mes. Sus grupos de edad actuales son 0–2, 3–18 y 19–100.

Esta copia mensual utiliza datos agregados introducidos manualmente y los grupos 0–2, 3–17 y 18 o más. No aplica reglas de vigencia, cita u origen. Copiar los totales del trimestral sin revisar el periodo y las edades no garantiza un resumen mensual correcto. La app todavía no rellena este archivo automáticamente.

## Comprobación realizada

Se revisan las fórmulas de familias y personas, las referencias entre las dos hojas, los estilos y las relaciones internas del XLSX. Se solicita recálculo automático al abrir. No se ha comprobado su visualización ni su recálculo en Microsoft Excel o LibreOffice.

El script `tools/crear-mensual-formato-20.py` crea esta copia sin modificar los originales y rechaza sobrescribir una salida existente.
