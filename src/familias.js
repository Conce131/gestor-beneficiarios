
export function persona(){return{id:crypto.randomUUID(),menor:false,nombre:"",apellidos:"",documento:"",nacimiento:"",derivacion:"",vigencia:"",proximaCita:""}}
export function familia(numero){const titular=persona();titular.titular=true;return{id:crypto.randomUUID(),numero,personas:[titular]}}

export { estado } from './estado-familia.mjs';
