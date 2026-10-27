const campos = ['nombre', 'apellidos', 'documento', 'nacimiento', 'derivacion', 'vigencia', 'proximaCita', 'menor', 'serviciosSociales', 'serviciosSocialesConfigurado'];
const igual = (a, b) => Object.is(a, b);

// Guarda solo los datos afectados: no sustituye el historial mensual ni otras familias.
export class HistorialCeldas {
  constructor(limite = 100) {
    this.limite = limite;
    this.limpiar();
  }
  limpiar() { this.atras = []; this.adelante = []; }
  registrar(antes, despues, contexto) {
    const cambios = [];
    for (const persona of antes.personas) {
      const nueva = despues.personas.find(p => p.id === persona.id);
      if (!nueva) throw new Error('La estructura de la familia ha cambiado.');
      for (const campo of campos) {
        if (!igual(persona[campo], nueva[campo])) cambios.push({ personaId: persona.id, campo, antes: persona[campo], despues: nueva[campo] });
      }
    }
    if (!cambios.length) return false;
    if (this.atras.at(-1)?.mes !== contexto.mes) this.limpiar();
    this.atras.push({ ...contexto, familiaId: antes.id, numero: antes.numero, cambios });
    if (this.atras.length > this.limite) this.atras.shift();
    this.adelante = [];
    return true;
  }
  preparar(familias, mes, rehacer = false) {
    const pila = rehacer ? this.adelante : this.atras;
    const cambio = pila.at(-1);
    if (!cambio) return null;
    if (cambio.mes !== mes) { this.limpiar(); return null; }
    const actual = familias.find(f => f.id === cambio.familiaId);
    if (!actual) throw new Error('La familia ya no existe.');
    const copia = structuredClone(actual);
    for (const dato of cambio.cambios) {
      const persona = copia.personas.find(p => p.id === dato.personaId);
      if (!persona || !igual(persona[dato.campo], rehacer ? dato.antes : dato.despues)) {
        throw new Error('Los datos han cambiado desde esta edición. No se puede recuperar ese cambio.');
      }
      const valor = rehacer ? dato.despues : dato.antes;
      if (valor === undefined) delete persona[dato.campo];
      else persona[dato.campo] = valor;
    }
    return { cambio, familias: familias.map(f => f.id === copia.id ? copia : f), rehacer };
  }
  confirmar(operacion) {
    const origen = operacion.rehacer ? this.adelante : this.atras;
    const destino = operacion.rehacer ? this.atras : this.adelante;
    if (origen.at(-1) !== operacion.cambio) throw new Error('El historial de edición ha cambiado.');
    destino.push(origen.pop());
  }
}

export function mismaEstructura(antes, despues) {
  return antes.length === despues.length && antes.every(f => {
    const nueva = despues.find(n => n.id === f.id);
    return nueva && f.personas.length === nueva.personas.length
      && f.personas.every((p, i) => p.id === nueva.personas[i].id);
  });
}
