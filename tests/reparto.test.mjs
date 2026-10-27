import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resumen, envases, validarReparto, prepararReparto, alimentos} from '../src/reparto.mjs';

test('Reparto usa familias de 1 a 10, divide por personas y redondea por tamaño',()=>{
 const r=resumen([1,2,2,11].map(n=>({personas:Array.from({length:n},()=>({nombre:'Persona de prueba',vigencia:'2027-01-01'}))})), new Date(2026,9,5));
 assert.equal(r.personas,16);
 assert.deepEqual(r.tamanos.slice(0,3),[1,2,0]);
 assert.equal(r.fuera,1);
 assert.equal(envases(12,1,1,5),2);
 assert.equal(envases(12,2,2,5),5);
 assert.equal(envases(0,2,2,5),0);
 assert.equal(envases('',2,2,5),null, 'una cantidad pendiente no equivale a cero');
 assert.equal(envases(12,3,0,5),null);
 assert.equal(envases(12,1,0,0),null);
});

test('Resumen agrupa por años cumplidos como la plantilla 2.0, incluidos los cumpleaños',()=>{
 const nacimientos=['2026-10-05','2023-10-05','2008-10-05','1926-10-05','1926-10-04',''];
 const r=resumen([{personas:nacimientos.map(nacimiento=>({nombre:'Persona de prueba',nacimiento,vigencia:'2027-01-01'}))}],new Date(2026,9,5));
 assert.deepEqual(r.edades,[1,2,2]);
 assert.equal(r.sinRango,1);
});

test('Reparto admite cero y cantidades decimales y rechaza datos inválidos',()=>{
 assert.deepEqual(validarReparto(undefined),[]);
 assert.equal(validarReparto([{nombre:'Arroz',cantidad:2.5}])[0].cantidad,2.5);
 assert.throws(()=>validarReparto([{nombre:'Arroz',cantidad:-1}]));
 assert.throws(()=>validarReparto([{nombre:'Arroz',cantidad:'mucho'}]));
});

test('Al volver a abrir Reparto conserva las filas eliminadas, incluso si se quitaron todas',()=>{
 assert.equal(prepararReparto(null).length, alimentos.length);
 assert.deepEqual(prepararReparto([]), []);
 const guardado = [{nombre:'Producto personalizado',cantidad:12}];
 assert.deepEqual(prepararReparto(guardado), guardado);
 assert.notEqual(prepararReparto(guardado), guardado);
});

test('La migración retira los huecos antiguos sin borrar alimentos personalizados',()=>{
 const antiguo = [...alimentos.map(nombre=>({nombre,cantidad:''})), ...Array.from({length:7},()=>({nombre:'VARIOS',cantidad:''}))];
 assert.equal(prepararReparto(antiguo).length, alimentos.length);
 antiguo[15].cantidad = 20;
 assert.deepEqual(prepararReparto(antiguo), antiguo);
 assert.equal(antiguo.length, 16);
});

test('Los menores sin nacimiento cuentan en el total pero no en un rango de edad', () => {
 const r = resumen([{ personas: [{ titular: true, nombre: 'Adulto', vigencia: '2027-01-01' }, { menor: true }, { menor: true, nacimiento: '2016-01-01' }] }], new Date(2026, 9, 5));
 assert.equal(r.personas, 3);
 assert.equal(r.menoresSinNacimiento, 1);
 assert.deepEqual(r.edades, [0, 1, 0]);
 assert.equal(r.sinRango - r.menoresSinNacimiento, 1);
});
