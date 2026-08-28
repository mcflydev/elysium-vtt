import fs from 'node:fs';
import assert from 'node:assert/strict';
const src=fs.readFileSync(new URL('../public/js/vtt.js',import.meta.url),'utf8');
const routes=fs.readFileSync(new URL('../server/vtt-routes.js',import.meta.url),'utf8');
const geometry=fs.readFileSync(new URL('../public/js/fog-geometry.js',import.meta.url),'utf8');
const results=[];
function t(name,fn){try{fn();results.push({name,ok:true})}catch(e){results.push({name,ok:false,error:e.message})}}
function has(x,s=src){assert.ok(s.includes(x),`faltando: ${x}`)}
function not(x,s=src){assert.ok(!s.includes(x),`não deveria conter: ${x}`)}

t('Fog é ferramenta restrita à narração',()=>has('["token","tile","wall","light","sound","note","region","fog","fx"]'));
t('Modo inicia em Revelar',()=>has('fogMode: "reveal"'));
t('Select reflete state.fogMode ao renderizar',()=>{has('${state.fogMode==="reveal"?"selected":""}');has('${state.fogMode==="hide"?"selected":""}')});
t('Mudança do select persiste em state.fogMode',()=>has('state.fogMode=fogMode.value==="hide"?"hide":"reveal"'));
t('Finalização da ferramenta usa state.fogMode e não o select recriado',()=>has('mode=state.fogMode||"reveal"'));
t('Ocultar usa subtração geométrica parcial',()=>has('flatMap(r=>subtractRect(r,area))'));
t('Polling não reconstrói opções da ferramenta',()=>{const body=src.match(/async function poll\(\)\{[\s\S]*?\}\nasync function refreshBootstrapLight/)?.[0]||'';assert.ok(body);assert.ok(!body.includes('renderToolOptions('))});
t('refreshScene não reconstrói opções da ferramenta',()=>{const body=src.match(/async function refreshScene\(\)\{[^\n]+/)?.[0]||'';assert.ok(body);assert.ok(!body.includes('renderToolOptions('))});
t('Sincronização protege Fog local durante escrita',()=>{has('fogWritePending');has('fogGeneration');has('mergeIncomingFog')});
t('Sincronização protege Explorer local durante escrita',()=>{has('explorerWritePending');has('explorerGeneration')});
t('Explorer usa tokenId e cálculo do servidor',()=>has('scope:"user",tokenId:token.id'));
t('Explorer não roda para token sem visão',()=>has('||!token.vision_enabled)return'));
t('Renderização aceita Explorer poligonal e retângulo legado',()=>{has('normalizeFogShape');has('shape.type==="polygon"')});
t('Visão atual usa apenas tokens com vision_enabled',()=>has('ownedTokens().filter(t=>t.vision_enabled)'));
t('Fog combina visão de múltiplos tokens controlados',()=>has('for(const t of visionTokens())carvePolygon(ctx,visionPolygon(t))'));
t('Iluminação combina visão de múltiplos tokens controlados',()=>has('for(const token of visionTokens())carvePolygon(ctx,visionPolygon(token))'));
t('Parede enviada ao jogador só cria handle se não for wall',()=>has('w.wall_type!=="wall"'));
t('Servidor mascara porta secreta como parede comum',()=>{has('wall_type: "wall", door_state: "closed"',routes);has('blocks_vision: open ? 0 : row.blocks_vision',routes);assert.ok(!routes.includes('secret_masked: true'))});
t('Servidor calcula Explorer usando todas as paredes reais',()=>has('SELECT * FROM vtt_walls WHERE scene_id=?',routes));
t('Jogador não grava Fog global',()=>has('Somente o Mestre altera o Fog global.',routes));
t('Explorer arbitrário do cliente não é aceito',()=>{has('appendServerExploration(scene,user,b.tokenId)',routes);not('Array.isArray(b.explored)?b.explored',routes)});
t('Servidor limita Explorer a 100 snapshots',()=>has('.slice(-99)',routes));
t('Servidor limita Fog global a 500 fragmentos',()=>has('shapes.slice(-500)',routes));
t('Reset manual tem nome explícito',()=>has('Resetar revelado'));
t('Limpeza de Explorer aparece quando Explorer está ativo',()=>has('fog-explorer-reset'));
t('Limpeza de Explorer exige Mestre no servidor',()=>{has('/fog\\/explorer',routes);has('if(!master(scene.chronicle_id,user,response))return true;',routes)});
t('Tutorial explica Revelar/Ocultar/Explorer',()=>{has('Na ferramenta Fog, use Revelar');has('Limpar Explorer');has('visão real do token alcançou')});
t('Módulo geométrico bloqueia token sem visão',()=>has('if(!token||!token.vision_enabled)return[];',geometry));

const bad=results.filter(x=>!x.ok);console.log(JSON.stringify({passed:results.length-bad.length,total:results.length,results},null,2));if(bad.length)process.exit(1);
