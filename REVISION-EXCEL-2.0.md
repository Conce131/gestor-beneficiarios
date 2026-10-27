> Revisión histórica: algunas reglas y observaciones de este documento ya se han modificado. Para conocer el funcionamiento actual, consultar [GUIA-EXCEL-2.0.md](GUIA-EXCEL-2.0.md), revisada el 20/10/2026.

# Revisión del Excel 2.0

Archivo: `Modelo  listado v(2.0).xlsx`. Revisión del archivo guardado, no de posibles cambios sin guardar en Excel. No se ha modificado el libro durante esta revisión.

## Fallos confirmados

1. **Recuento de miembros en K.** Sigue utilizando referencias a la fila 996 aunque existen fórmulas hasta la 2999. Cuenta la distancia entre titulares, por lo que un hueco dentro de una familia aumenta su tamaño. En el último grupo cuenta celdas de B: puede omitir personas con nombre pero sin número de beneficiario. Reparto utiliza actualmente los auxiliares de Resumen y no K, por lo que el error afecta al tamaño mostrado en Listado.

2. **Formatos condicionales de I que consultan H.** Hay reglas específicas de I2, I5, I6 e I8 con fórmulas como `AND($A2<>"",$H2="")`. Colorean Vigencia según falte Derivación. Son independientes de la validación de entrada y no bloquean la escritura.

3. **Falta de aviso de próxima cita pendiente.** La regla de L solo colorea citas escritas que sean inválidas. No existe en el archivo guardado una regla para marcar la cita vacía del titular cuando su vigencia está caducada, aunque esa falta de cita ya excluye al grupo familiar.

4. **Servicios Sociales vacío marcado como pendiente.** La regla `AND($A2<>"",$M2="")` resalta el origen vacío, aunque las fórmulas y la importación aceptan ese vacío como Servicios Sociales.

5. **Vigencia manual vacía marcada cuando no se utiliza.** La regla `AND($A2<>"",$I2="")` marca I vacía en todos los titulares, incluso con M="No" y una vigencia automática válida en N. La familia puede estar correctamente calculada y seguir recibiendo ese aviso visual.

## Alerta: dependencia que requiere comprobar el caso concreto

J consulta el nombre `VigenciasFamilia`, que apunta a Resumen!O:O. Este obtiene la vigencia del titular identificado en Resumen!N, a partir de las filas con A y de la existencia de datos en B:F.

- Si no se identifica la persona o su titular, J queda vacía.
- Cambiar I en un miembro no titular no cambia la vigencia familiar: se utiliza I del titular.
- Con M="No" en el titular se utiliza N, calculada desde H, y cambiar I no altera Alerta.
- SI.ERROR oculta los errores internos devolviendo una cadena vacía.
- El símbolo @ ante INDICE no demuestra por sí solo un error: INDICE con una fila concreta ya devuelve un solo valor.

No se ha encontrado en el archivo una referencia rota que permita atribuir con certeza a esa fórmula el fallo observado al cambiar I del titular con M="Sí". Hace falta comprobar ese caso en Excel con los datos afectados. La fórmula directa por fila propuesta en el chat sirve para un titular, pero copiarla sin adaptar a miembros podría dejar Alerta y Resumen usando vigencias distintas.

## Reglas revisadas que están presentes

- Vigencia I: vacío o fecha numérica entera entre hoy menos 12 meses y hoy más 48 meses. No tiene actualmente la restricción de fecha anterior a hoy que se detectó en la fórmula compartida en el chat.
- Derivación H: vacío o fecha numérica entera entre hoy menos 36 meses y hoy.
- Servicios Sociales: No activa derivación más tres meses naturales; Sí o vacío utiliza la vigencia manual del titular.
- Resumen Q: requiere vigencia válida y no vencida hace más de 90 días; si ya venció, exige próxima cita del titular. Excluye al grupo si alguna cita es inválida.
- Próxima cita: de hoy o futura, posterior a la vigencia y como máximo 90 días después de ella.
- Reparto D13:M13: utiliza los miembros incluidos según Resumen, para familias de 1 a 10 miembros.
- Los tamaños superiores a 10 cuentan en el total de Resumen pero no en el reparto por tamaños; es una limitación existente, no un fallo nuevo.

## Integridad y límites de la revisión

El ZIP y los XML son legibles. No se han encontrado referencias #REF!, relaciones internas con destino inexistente, celdas con referencias duplicadas, estilos inexistentes, fórmulas compartidas sin un único maestro ni enlaces externos. El recálculo está configurado como automático y completo al abrir.

Las comprobaciones estructurales y las pruebas de la aplicación no sustituyen a recalcular el libro en Excel. No hay un motor de Excel/LibreOffice disponible en este entorno; no se garantiza que no existan otros fallos de cálculo o de presentación.

## Corrección propuesta

Preparar una copia corregida, preservando el archivo revisado; unificar la fuente de vigencia para Alerta y Resumen, corregir K y los avisos anteriores, y contrastar en Excel casos de vigencia vigente, vencida sin cita, vencida con cita válida, día 90, día 91 y origen No. La corrección debe mantener todos los miembros de una familia bajo la vigencia del titular.
