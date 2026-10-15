// Convierte el PNG sin fetch: la CSP de escritorio no permite connect-src data:.
export function pngBytes(dataUrl) {
  const prefix = 'data:image/png;base64,';
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith(prefix)) {
    throw new Error('No se pudo generar una imagen PNG válida.');
  }
  const binary = atob(dataUrl.slice(prefix.length));
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((value, index) => bytes[index] === value)) {
    throw new Error('La imagen generada está vacía o no es un PNG válido.');
  }
  return bytes;
}
