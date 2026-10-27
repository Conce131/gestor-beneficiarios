export function detalleErrorExcel(error) {
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (typeof error?.message === 'string' && error.message.trim()) return error.message.trim();
  return 'No se recibió información adicional del error.';
}

export async function pasoExcel(contexto, ejecutar) {
  try {
    return await ejecutar();
  } catch (error) {
    throw new Error(`${contexto}: ${detalleErrorExcel(error)}`, { cause: error });
  }
}
