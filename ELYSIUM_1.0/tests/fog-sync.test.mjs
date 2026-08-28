import assert from 'node:assert/strict';
import { mergeFogSnapshots } from '../public/js/fog-geometry.js';
const local={global:{revealed:[{x:1}],explored:[]},user:{revealed:[],explored:[{type:'local'}]}};
const server={global:{revealed:[{x:9}],explored:[]},user:{revealed:[],explored:[{type:'server'}]}};
const rs=[];function t(name,fn){try{fn();rs.push({name,ok:true})}catch(e){rs.push({name,ok:false,error:e.message})}}
t('Sem escrita pendente, polling adota estado do servidor',()=>assert.deepEqual(mergeFogSnapshots(local,server,{globalGenerationAtStart:2,currentGlobalGeneration:2,explorerGenerationAtStart:4,currentExplorerGeneration:4}),server));
t('Escrita global pendente preserva Fog global local',()=>{const r=mergeFogSnapshots(local,server,{globalPending:true,globalGenerationAtStart:2,currentGlobalGeneration:2,explorerGenerationAtStart:4,currentExplorerGeneration:4});assert.deepEqual(r.global,local.global);assert.deepEqual(r.user,server.user)});
t('Polling iniciado antes de edição global não sobrescreve edição',()=>{const r=mergeFogSnapshots(local,server,{globalGenerationAtStart:1,currentGlobalGeneration:2,explorerGenerationAtStart:4,currentExplorerGeneration:4});assert.deepEqual(r.global,local.global)});
t('Polling novo após edição global volta a aceitar servidor',()=>{const r=mergeFogSnapshots(local,server,{globalGenerationAtStart:3,currentGlobalGeneration:3,explorerGenerationAtStart:4,currentExplorerGeneration:4});assert.deepEqual(r.global,server.global)});
t('Escrita Explorer pendente preserva histórico local',()=>{const r=mergeFogSnapshots(local,server,{globalGenerationAtStart:2,currentGlobalGeneration:2,explorerPending:true,explorerGenerationAtStart:4,currentExplorerGeneration:4});assert.deepEqual(r.user,local.user);assert.deepEqual(r.global,server.global)});
t('Polling iniciado antes de Explorer novo não apaga exploração recente',()=>{const r=mergeFogSnapshots(local,server,{globalGenerationAtStart:2,currentGlobalGeneration:2,explorerGenerationAtStart:3,currentExplorerGeneration:4});assert.deepEqual(r.user,local.user)});
t('Global e Explorer podem ser protegidos ao mesmo tempo',()=>{const r=mergeFogSnapshots(local,server,{globalPending:true,globalGenerationAtStart:1,currentGlobalGeneration:2,explorerPending:true,explorerGenerationAtStart:3,currentExplorerGeneration:4});assert.deepEqual(r,local)});
const bad=rs.filter(x=>!x.ok);console.log(JSON.stringify({passed:rs.length-bad.length,total:rs.length,results:rs},null,2));if(bad.length)process.exit(1);
