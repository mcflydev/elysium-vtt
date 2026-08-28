import assert from 'node:assert/strict';
import { subtractRect, rectOverlap, raySegment, visionBlockingWalls, computeVisionPolygon, normalizeFogShape } from '../public/js/fog-geometry.js';

const results=[];
function test(name, fn){
  try { fn(); results.push({name,ok:true}); }
  catch(error){ results.push({name,ok:false,error:error.message}); }
}
function area(rs){return rs.reduce((n,r)=>n+r.w*r.h,0)}
function near(a,b,eps=1e-4){return Math.abs(a-b)<=eps}
function eastHit(poly,cy){ return poly.reduce((best,p)=>Math.abs(p.y-cy)<Math.abs(best.y-cy)?p:best,poly[0]); }

// Recorte manual Revelar/Ocultar.
test('Retângulos sem interseção não se alteram',()=>assert.equal(rectOverlap({x:0,y:0,w:10,h:10},{x:20,y:20,w:5,h:5}),false));
test('Ocultar fora da área preserva revelação',()=>assert.deepEqual(subtractRect({x:0,y:0,w:100,h:100},{x:150,y:150,w:20,h:20}),[{x:0,y:0,w:100,h:100}]));
test('Ocultar área inteira remove revelação',()=>assert.deepEqual(subtractRect({x:0,y:0,w:100,h:100},{x:-5,y:-5,w:200,h:200}),[]));
test('Ocultar centro cria quatro fragmentos',()=>{const p=subtractRect({x:0,y:0,w:100,h:100},{x:25,y:25,w:50,h:50});assert.equal(p.length,4);assert.equal(area(p),7500)});
test('Ocultar faixa superior preserva o restante',()=>{const p=subtractRect({x:0,y:0,w:100,h:100},{x:0,y:0,w:100,h:20});assert.equal(p.length,1);assert.deepEqual(p[0],{x:0,y:20,w:100,h:80})});
test('Recortes repetidos nunca geram área negativa',()=>{let r=[{x:0,y:0,w:300,h:300}];for(const c of [{x:50,y:50,w:50,h:50},{x:100,y:100,w:50,h:50},{x:150,y:150,w:50,h:50},{x:75,y:125,w:150,h:20}])r=r.flatMap(x=>subtractRect(x,c));assert.ok(r.every(x=>x.w>0&&x.h>0));assert.ok(area(r)<90000)});

// Shapes persistidos.
test('Shape legado retangular continua aceito',()=>assert.deepEqual(normalizeFogShape({x:1,y:2,w:3,h:4}),{type:'rect',x:1,y:2,w:3,h:4}));
test('Shape poligonal do Explorer é aceito',()=>assert.deepEqual(normalizeFogShape({type:'polygon',points:[{x:0,y:0},{x:10,y:0},{x:0,y:10}]}).type,'polygon'));
test('Shape inválido é ignorado',()=>assert.equal(normalizeFogShape({x:0,y:0,w:-1,h:2}),null));

// Visão.
const token={x:50,y:75,width:50,height:50,vision_enabled:true,vision_range:300};
const center={x:75,y:100};
test('Token sem visão não gera polígono',()=>assert.deepEqual(computeVisionPolygon({...token,vision_enabled:false},[]),[]));
test('Token com alcance zero não gera polígono',()=>assert.deepEqual(computeVisionPolygon({...token,vision_range:0},[]),[]));
test('Sem paredes, visão alcança aproximadamente o raio configurado',()=>{const p=computeVisionPolygon(token,[]);assert.ok(p.length>=128);const d=Math.max(...p.map(q=>Math.hypot(q.x-center.x,q.y-center.y)));assert.ok(near(d,300,.01))});
const wall={x1:250,y1:-500,x2:250,y2:1000,wall_type:'wall',door_state:'closed',blocks_vision:1};
test('Parede fechada corta visão',()=>{const p=computeVisionPolygon(token,[wall]);const e=eastHit(p,center.y);assert.ok(e.x<=250.01,`x=${e.x}`)});
test('Parede que não bloqueia visão é ignorada',()=>{const p=computeVisionPolygon(token,[{...wall,blocks_vision:0}]);const e=eastHit(p,center.y);assert.ok(e.x>360,`x=${e.x}`)});
test('Porta fechada corta visão',()=>{const p=computeVisionPolygon(token,[{...wall,wall_type:'door'}]);assert.ok(eastHit(p,center.y).x<=250.01)});
test('Porta aberta libera visão',()=>{const p=computeVisionPolygon(token,[{...wall,wall_type:'door',door_state:'open'}]);assert.ok(eastHit(p,center.y).x>360)});
test('Bloqueador secreto mascarado fechado corta visão',()=>{const p=computeVisionPolygon(token,[{...wall,wall_type:'masked',secret_masked:true}]);assert.ok(eastHit(p,center.y).x<=250.01)});
test('Bloqueador secreto mascarado aberto libera visão',()=>{const p=computeVisionPolygon(token,[{...wall,wall_type:'masked',secret_masked:true,door_state:'open'}]);assert.ok(eastHit(p,center.y).x>360)});
test('visionBlockingWalls respeita porta aberta e blocks_vision',()=>assert.equal(visionBlockingWalls([wall,{...wall,wall_type:'door',door_state:'open'},{...wall,blocks_vision:0}]).length,1));
test('raySegment detecta colisão frontal',()=>{const h=raySegment(center,{x:1,y:0},wall);assert.ok(h);assert.ok(near(h.x,250,.001))});
test('raySegment ignora raio na direção oposta',()=>assert.equal(raySegment(center,{x:-1,y:0},wall),null));

const failed=results.filter(r=>!r.ok);
console.log(JSON.stringify({passed:results.length-failed.length,total:results.length,results},null,2));
if(failed.length)process.exit(1);
