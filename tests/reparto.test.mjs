import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resumen, envases, validarReparto} from '../src/reparto.mjs';

test('Reparto usa familias de 1 a 10, divide por personas y redondea por tamaño',()=>{
 const r=resumen([1,2,2,11].map(n=>({personas:Array.from({length:n},()=>({}))})));
 assert.equal(r.personas,16);
 assert.deepEqual(r.tamanos.slice(0,3),[1,2,0]);
 assert.equal(r.fuera,1);
 assert.equal(envases(12,1,1,5),2);
 assert.equal(envases(12,2,2,5),5);
 assert.equal(envases(0,2,2,5),0);
 assert.equal(envases(12,3,0,5),null);
 assert.equal(envases(12,1,0,0),null);
});

test('Resumen conserva los extremos inclusivos y exclusivos de COUNTIFS',()=>{
 const nacimientos=['2026-10-05','2023-10-05','2008-10-05','1926-10-05','1926-10-04',''];
 const r=resumen([{personas:nacimientos.map(nacimiento=>({nacimiento}))}],new Date(2026,9,5));
 assert.deepEqual(r.edades,[1,1,1]);
 assert.equal(r.sinRango,3);
});

test('Reparto admite cero y cantidades decimales y rechaza datos inválidos',()=>{
 assert.deepEqual(validarReparto(undefined),[]);
 assert.equal(validarReparto([{nombre:'Arroz',cantidad:2.5}])[0].cantidad,2.5);
 assert.throws(()=>validarReparto([{nombre:'Arroz',cantidad:-1}]));
 assert.throws(()=>validarReparto([{nombre:'Arroz',cantidad:'mucho'}]));
});
