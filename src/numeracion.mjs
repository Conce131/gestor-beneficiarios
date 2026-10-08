// Los números son referencias a expedientes físicos, no posiciones del listado.
export function numeroLibre(familias) {
  const usados = new Set(familias.map(familia => Number(familia.numero)));
  let numero = 1;
  while (usados.has(numero)) numero++;
  return numero;
}
