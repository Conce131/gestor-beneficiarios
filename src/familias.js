import { caducada } from "./utils.js";

export function persona(){return{id:crypto.randomUUID(),nombre:"",apellidos:"",documento:"",nacimiento:"",derivacion:"",vigencia:"",proximaCita:""}}
export function familia(numero){const titular=persona();titular.titular=true;return{id:crypto.randomUUID(),numero,personas:[titular]}}

export function estado(f){
 const ps=f.personas, cad=ps.some(p=>caducada(p.vigencia)), cita=ps.some(p=>p.proximaCita);
 if(cad&&cita)return["appointment","Cita pendiente"];
 if(cad)return["expired","Caducada"];
 if(ps.some(p=>p.vigencia&&(new Date(p.vigencia)-new Date())<1000*60*60*24*60))return["warn","Próxima"];
 return["ok","Correcta"]
}
