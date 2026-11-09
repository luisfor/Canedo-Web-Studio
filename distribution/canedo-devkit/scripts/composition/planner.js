'use strict';
const catalogApi=require('./catalog'),{interpret}=require('./intents');
const {digest}=require('../planner/plan');
function normalize(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['text','name','architecture','docker','nodeVersion','runtimeVersions','catalogExtension','interpretation'].includes(k)))throw Error('Solicitud de composición no admitida.');
 const name=input.name||'composed-shop';if(!/^[a-z][a-z0-9-]{0,40}$/.test(name))throw Error('Nombre inválido.');
 const architecture=input.architecture||'auto';if(!['auto','modular-monolith','independent-services'].includes(architecture))throw Error('Arquitectura inválida.');
 if(input.docker!==undefined&&typeof input.docker!=='boolean')throw Error('docker debe ser booleano.');
 if(input.nodeVersion!==undefined&&typeof input.nodeVersion!=='string')throw Error('Versión Node inválida.');
 if(input.nodeVersion&&input.runtimeVersions?.node&&input.nodeVersion!==input.runtimeVersions.node)throw Error('Versiones Node contradictorias.');
 const nodeVersion=input.nodeVersion||input.runtimeVersions?.node||'24.22.2';if(!/^\d+\.\d+\.\d+$/.test(nodeVersion))throw Error('Versión Node inválida.');
 if(input.runtimeVersions!==undefined&&(!input.runtimeVersions||typeof input.runtimeVersions!=='object'||Array.isArray(input.runtimeVersions)||Object.entries(input.runtimeVersions).some(([id,v])=>! /^[a-z][a-z0-9-]{0,63}$/.test(id)||typeof v!=='string'||!/^\d+\.\d+\.\d+$/.test(v))))throw Error('Versiones por runtime inválidas.');
 return {text:input.text,name,architecture,docker:input.docker===true,nodeVersion,catalogExtension:input.catalogExtension||null,interpretation:input.interpretation||null,...(input.runtimeVersions?{runtimeVersions:input.runtimeVersions}:{})};
}
function design(input,{catalog,provider,allowProvider=false,adapters={'node-sqlite':require('./generate')}}={}){
 const request=normalize(input),registry=catalog||catalogApi.read(request.catalogExtension),report=catalogApi.validate(registry);if(!report.ok)throw Error('Catálogo inválido: '+report.errors.join('; '));
 const localIntent=interpret(request.text,registry,{provider,allowProvider});
 const intent=request.interpretation?require('./intents').validateSemantic(request.interpretation,registry):localIntent,conflicts=[],selected=new Set(),reasons={};
 if(intent.unrecognized.length)conflicts.push({code:'unrecognized-requirement',detail:'Clarify unsupported/ambiguous requirements: '+intent.unrecognized.join(', ')});
 function include(id,reason){if(selected.has(id))return;if(intent.excluded.includes(id)){conflicts.push({code:'excluded-dependency',requirement:id,detail:reason});return;}selected.add(id);reasons[id]=reason;for(const dep of registry.capabilities.find(c=>c.id===id).requires)include(dep,'Required by '+id);}
 for(const id of intent.selected)include(id,'Detected in Spanish request');
 if(!selected.size)conflicts.push({code:'unknown-intent',detail:'No registered business capability recognized; clarify the request.'});
 if(intent.independent&&intent.modular)conflicts.push({code:'architecture-conflict',detail:'Both monolith and independent services requested.'});
 let architecture=request.architecture==='auto'?(intent.independent||intent.languages.length>1?'independent-services':'modular-monolith'):request.architecture;
 if(intent.independent&&architecture==='modular-monolith'||intent.modular&&architecture==='independent-services')conflicts.push({code:'architecture-conflict',detail:'Explicit architecture contradicts request.'});
 const capabilities=[...selected].sort(),domains=[...new Set(capabilities.map(id=>registry.capabilities.find(c=>c.id===id).domain))].sort();
 const candidates=registry.archetypes.map(a=>({id:a.id,adapter:a.adapter,architecture:a.architecture,covered:capabilities.filter(c=>a.capabilities.includes(c)),missing:capabilities.filter(c=>!a.capabilities.includes(c)),available:Object.hasOwn(adapters,a.adapter)}));
 const archetype=registry.archetypes.find(a=>{
  const generator=Object.hasOwn(adapters,a.adapter)?adapters[a.adapter]:null;return a.architecture===architecture&&generator&&capabilities.every(c=>a.capabilities.includes(c)&&generator.capabilities.includes(c))&&domains.every(d=>generator.domains.includes(d))&&intent.languages.every(l=>a.languages.includes(l)&&generator.languages.includes(l))&&intent.frameworks.every(f=>(!a.frameworks||a.frameworks.includes(f))&&generator.frameworks.includes(f))&&intent.databases.every(db=>(!a.databases||a.databases.includes(db))&&generator.databases.includes(db));
 });
 // No automatic language/database migration. The bundled executable adapter is
 // Node/SQLite. Other catalog technologies remain visible and yield blockers.
 if(!archetype)conflicts.push({code:'generator-not-registered',detail:'Register a trusted generator for the requested languages/capabilities; no language migration performed.'});
 if(intent.frameworks.some(f=>!Object.values(adapters).some(a=>a.frameworks.includes(f))))conflicts.push({code:'framework-generator-missing',detail:'No installed generator for: '+intent.frameworks.join(', ')});
 if(intent.databases.some(db=>!Object.values(adapters).some(a=>a.databases.includes(db))))conflicts.push({code:'database-generator-missing',detail:'Requested persistence must be preserved; no registered compatible database generator.'});
 if(architecture==='modular-monolith'&&intent.languages.length>1)conflicts.push({code:'mixed-runtime-boundary',detail:'Different runtimes require explicit service/API boundaries.'});
 const references=registry.projects.map(p=>({...p,matchedCapabilities:p.capabilities.filter(c=>selected.has(c)),codeImported:false}));
 const generator=archetype?adapters[archetype.adapter]:null;
 const justification=generator?.architectureDecision?generator.architectureDecision({request,intent,capabilities,domains,architecture}):architecture==='modular-monolith'?'One runtime, one deployment and a small initial scope: modules avoid unnecessary distributed operations. Commerce transactions and CRM ownership stay separate.':intent.languages.length>1?'Requested runtimes are preserved across HTTP/event contracts; no language migration is proposed.':'Independent deployment was explicitly requested; use separate commerce and communications processes with durable outbox/inbox.';
 return {request,registry,catalogDigest:digest(registry),intent,capabilities,domains,reasons,candidates,archetype:archetype?.id||null,adapter:archetype?.adapter||null,architecture,justification,references,conflicts,status:conflicts.length?'blocked':'ready',steps:[
  {id:'review',check:'Review requirements, conflicts, provenance and generated contracts.'},
  {id:'generate',check:'Write only into a new destination; verify all recorded hashes.'},
  {id:'test',check:generator?.testInstruction||'Run generated contract/domain/HTTP tests using isolated temporary SQLite databases.'},
  {id:'configure',check:'Create tenant-scoped credentials outside source control; WhatsApp/AI remain disabled.'},
  {id:'migrate',check:'Review and explicitly run additive schema migration on the intended project data directory.'},
  {id:'run',check:'Manually start selected local services. Docker builds/pulls/up require a separate user decision.'}
 ]};
}
module.exports={normalize,design};
