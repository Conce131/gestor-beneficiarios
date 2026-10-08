export function erroresFamilia(familia, hoy = new Date(), { permitirIncompletos = false } = {}) {
  const errores = [];
  const personas = familia.personas ?? [];
  if (!personas.length || personas.filter(p => p.titular).length !== 1) {
    return [{ indice: 0, campo: 'nombre', mensaje: 'La familia debe tener una persona titular.' }];
  }
  for (const [indice, persona] of personas.entries()) {
    const error = (campo, mensaje) => errores.push({ indice, campo, mensaje });
    const menor = persona.menor && !persona.titular;
    if (!permitirIncompletos && !menor) {
      for (const [campo, etiqueta] of [['nombre', 'nombre'], ['apellidos', 'apellidos'], ['documento', 'documento']]) {
        if (campo === 'documento' && !persona.titular) continue;
        if (!String(persona[campo] ?? '').trim()) error(campo, `Completa ${etiqueta} de ${persona.titular ? 'la persona titular' : `la persona ${indice + 1}`}.`);
      }
    } else if (!permitirIncompletos && menor && !persona.nacimiento) {
      error('nacimiento', `Indica la fecha de nacimiento del menor ${indice + 1}.`);
    }
    if (!permitirIncompletos && persona.titular && !String(persona.nacimiento ?? '').trim()) {
      error('nacimiento', 'Completa la fecha de nacimiento de la persona titular.');
    }
    for (const campo of ['nacimiento', 'derivacion', 'vigencia', 'proximaCita']) {
      const valor = persona[campo];
      if (!valor) continue;
      const fecha = new Date(`${valor}T00:00:00`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || !Number.isFinite(fecha.getTime()) || fecha.getFullYear() < 1900
        || fecha.getFullYear() !== Number(valor.slice(0, 4)) || fecha.getMonth() + 1 !== Number(valor.slice(5, 7)) || fecha.getDate() !== Number(valor.slice(8, 10))) {
        error(campo, 'Indica una fecha válida.');
        continue;
      }
      if (campo === 'nacimiento') {
        if (fecha > hoy) error(campo, 'La fecha de nacimiento no puede ser futura.');
        let edad = hoy.getFullYear() - fecha.getFullYear();
        if (hoy.getMonth() < fecha.getMonth() || (hoy.getMonth() === fecha.getMonth() && hoy.getDate() < fecha.getDate())) edad--;
        if (menor && edad >= 18) error(campo, 'Esta persona es mayor de edad. Completa sus datos como adulto.');
      }
    }
  }
  return errores;
}

export function errorFamilia(familia, hoy = new Date()) {
  return erroresFamilia(familia, hoy)[0] ?? null;
}

export function datosPendientesFamilia(familia, hoy = new Date()) {
  const grupos = new Map();
  for (const error of erroresFamilia(familia, hoy)) {
    const persona = familia.personas[error.indice];
    if (!persona) continue;
    if (!grupos.has(persona.id)) grupos.set(persona.id, { persona, campos: [], mensajes: [] });
    const grupo = grupos.get(persona.id);
    if (!grupo.campos.includes(error.campo)) grupo.campos.push(error.campo);
    grupo.mensajes.push(error.mensaje);
  }
  return [...grupos.values()];
}
