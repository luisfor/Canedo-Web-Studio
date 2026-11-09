'use strict';
const {normalize}=require('./catalog');
// Provider boundary: only semantic data, never shell commands, source code or paths.
// Network/paid providers must be supplied by trusted caller code, explicitly enabled.
function local(text,catalog){
 const normalized=normalize(text),clauses=normalized.split(/[,;.\n]|\bpero\b|\by tambien\b/),selected=new Set(),excluded=new Set();
 for(const c of catalog.capabilities)for(const clause of clauses){
  for(const alias of c.aliases){const word=normalize(alias),regex=new RegExp('\\b'+word+'\\b','g');let m;
   while((m=regex.exec(clause))){const before=clause.slice(0,m.index);const negative=/(?:\bsin\b|\bno (?:quiero|incluir|necesito|usar)\b|\bexcluir\b)[^]*$/.test(before)&&!/(?:\bcon\b|\bsi quiero\b)[^]*$/.test(before.slice(Math.max(before.lastIndexOf('sin'),before.lastIndexOf('no '))));(negative?excluded:selected).add(c.id);}
  }
 }
 const languages=[];
 const tokens={php:['php','laravel'],typescript:['typescript','nextjs','next.js'],javascript:['javascript','node','nodejs'],python:['python','django','fastapi'],java:['java','spring'],go:['go','golang'],csharp:['c#','.net','dotnet'],rust:['rust']};
 for(const entry of [...catalog.archetypes,...catalog.projects])for(const language of entry.languages)if(!Object.hasOwn(tokens,language))tokens[language]=[language];
 const databaseNames=[...new Set(['mysql','mariadb','postgresql','sqlite','oracle','sqlserver','mongodb','redis',...catalog.projects.flatMap(p=>p.databases),...catalog.archetypes.flatMap(a=>a.databases||[])])];
 const frameworkNames=[...new Set(['laravel','nextjs','django','fastapi','spring','react','vue','angular',...catalog.projects.flatMap(p=>p.frameworks),...catalog.archetypes.flatMap(a=>a.frameworks||[])])];
 const databaseAliases={postgresql:['postgresql','postgres','postgre'],sqlserver:['sqlserver','sql server'],mongodb:['mongodb','mongo']},frameworkAliases={nextjs:['nextjs','next.js']};
 for(const [id,words]of Object.entries(tokens))if(words.some(w=>new RegExp('(?:^|[^a-z0-9])'+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=$|[^a-z0-9])').test(normalized)))languages.push(id);
 let remainder=normalized;
 const known=[...catalog.capabilities.flatMap(c=>c.aliases),...Object.values(tokens).flat(),'microservicios','servicios independientes','despliegues independientes','monolito modular','monolito',...databaseNames,...frameworkNames,...Object.values(databaseAliases).flat(),...Object.values(frameworkAliases).flat(),'docker'];
 for(const word of known.sort((a,b)=>b.length-a.length))remainder=remainder.replace(new RegExp('\\b'+normalize(word).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','g'),' ');
 const stop=new Set('crear crea quiero necesito desarrollar genera generar construye construir hacer haz implementar implementa una un el la los las de del con y e o para por en que se al mi mis su sus sin no incluir usar excluir tambien sistema aplicacion proyecto gestion administrar gestionar modulo modulos integrado integrada integrar comercial completo completa basico basica backend api rest independiente independientes servicios servicio nuevo nueva ejemplo favor porfavor me puedes permita permitir funcional'.split(' '));
 const unrecognized=[...new Set((remainder.match(/[a-z0-9#+.-]+/g)||[]).filter(w=>!stop.has(w)&&w!=='.'))];
 const mentions=word=>new RegExp('(?:^|[^a-z0-9])'+word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=$|[^a-z0-9])').test(normalized);
 return {selected:[...selected].sort(),excluded:[...excluded].sort(),languages:languages.sort(),unrecognized,independent:/\bmicroservicios\b|\bservicios independientes\b|\bdespliegues independientes\b/.test(normalized)&&! /\bsin microservicios\b|\bno microservicios\b/.test(normalized),modular:/\bmonolito\b/.test(normalized)&&!/\bsin monolito\b/.test(normalized),databases:databaseNames.filter(d=>(databaseAliases[d]||[d]).some(mentions)),frameworks:frameworkNames.filter(f=>(frameworkAliases[f]||[f]).some(mentions))};
}
function interpret(text,catalog,options={}){
 if(typeof text!=='string'||text.trim().length<3||text.length>4000||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text))throw Error('Solicitud inválida (3–4000 caracteres).');
 const provider=options.provider||{id:'spanish-rules-v1',interpret:local};
 if(provider.id!=='spanish-rules-v1'&&!options.allowProvider)throw Error('Proveedor externo no autorizado.');
 const result=provider.interpret(text,catalog);return validateSemantic({...result,provider:provider.id},catalog);
}
function validateSemantic(result,catalog){
 if(!result||typeof result.then==='function'||Object.keys(result).some(k=>!['selected','excluded','languages','independent','modular','databases','frameworks','unrecognized','provider'].includes(k)))throw Error('Respuesta semántica del proveedor inválida.');
 for(const k of ['selected','excluded','languages','databases','frameworks','unrecognized'])if(!Array.isArray(result[k])||result[k].length>100||result[k].some(v=>typeof v!=='string'||v.length>200))throw Error('Respuesta semántica inválida.');
 if(typeof result.provider!=='string'||!/^[a-z][a-z0-9-]{0,63}$/.test(result.provider))throw Error('Proveedor inválido.');
 if(typeof result.independent!=='boolean'||typeof result.modular!=='boolean')throw Error('Arquitectura semántica inválida.');
 if([...result.selected,...result.excluded].some(id=>!catalog.capabilities.some(c=>c.id===id)))throw Error('Capacidad de proveedor no registrada.');
 return result;
}
module.exports={local,interpret,validateSemantic};
