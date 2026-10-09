import { erroresFamilia } from './validacion.mjs';

export function editarPersona(familia, personaId, campo, valor, hoy = new Date()) {
  if (!['nombre', 'apellidos', 'documento', 'nacimiento', 'derivacion', 'vigencia', 'proximaCita', 'menor'].includes(campo)) {
    throw new Error('Este dato no se puede editar en el listado.');
  }
  const copia = structuredClone(familia);
  const persona = copia.personas.find(p => p.id === personaId);
  if (!persona) throw new Error('No se encontró la persona.');
  if (campo === 'menor' && persona.titular) throw new Error('El titular no puede marcarse como menor.');
  persona[campo] = valor;
  if (campo === 'derivacion' || campo === 'vigencia') copia.personas.forEach(p => p[campo] = valor);
  if (campo === 'nacimiento') {
    const fecha = new Date(`${valor}T00:00:00`);
    let edad = hoy.getFullYear() - fecha.getFullYear();
    if (hoy.getMonth() < fecha.getMonth() || (hoy.getMonth() === fecha.getMonth() && hoy.getDate() < fecha.getDate())) edad--;
    persona.menor = !persona.titular && (valor ? edad < 18 : Boolean(persona.menor));
  }
  const errores = erroresFamilia(copia, hoy, { permitirIncompletos: true });
  if (errores.length) throw new Error(errores[0].mensaje);
  return copia;
}

export function eliminarMiembro(familia, personaId) {
  const indice = familia.personas.findIndex(p => p.id === personaId);
  const persona = familia.personas[indice];
  if (!persona) throw new Error('No se encontró la persona.');
  if (familia.personas.filter(p => p.id === personaId).length !== 1) throw new Error('La persona tiene un identificador duplicado. No se ha borrado ningún dato.');
  if (persona.titular) throw new Error('No se puede borrar al titular desde su fila.');
  const copia = structuredClone(familia);
  copia.personas.splice(indice, 1);
  return copia;
}

export function restaurarMiembro(familia, persona, indice) {
  if (familia.personas.some(p => p.id === persona.id)) throw new Error('Esta persona ya está en la familia.');
  if (persona.titular) throw new Error('No se puede restaurar otro titular como miembro.');
  const copia = structuredClone(familia);
  const titular = copia.personas.find(p => p.titular);
  if (!titular) throw new Error('La familia no tiene titular.');
  const restaurada = structuredClone(persona);
  for (const campo of ['derivacion', 'vigencia']) {
    if (titular[campo] !== undefined) restaurada[campo] = titular[campo];
  }
  copia.personas.splice(Math.max(1, Math.min(indice, copia.personas.length)), 0, restaurada);
  return copia;
}
