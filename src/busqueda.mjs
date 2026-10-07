export function coincideNumeroFamilia(numero, consulta) {
  const texto = String(consulta ?? "").trim();
  return !texto || (/^\d+$/.test(texto) && Number(texto) === Number(numero));
}
