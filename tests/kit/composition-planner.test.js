'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const engine=require('../../scripts/composition/engine'),catalog=require('../../scripts/composition/catalog'),contracts=require('../../scripts/composition/contracts');
const full='Crear un sistema comercial con inventario, ventas, compras, proveedores, caja, CRM de WhatsApp y chatbot de IA';
test('1 inventory selects commercial capabilities and consults every project/archetype',()=>{const p=engine.plan({text:'Crear inventario'});assert.equal(p.status,'ready');assert.deepEqual(p.capabilities,['inventory','products']);assert.deepEqual(p.domains,['commerce']);assert.equal(p.references.length,catalog.read().projects.length);assert.equal(p.candidates.length,catalog.read().archetypes.length);assert.equal(p.references.find(p=>p.id==='afpventas').matchedCapabilities.length,2);});
test('2 CRM selects communications without unrequested commerce',()=>{const p=engine.plan({text:'CRM de WhatsApp y chatbot'});assert.equal(p.status,'ready');assert.deepEqual(p.domains,['communications']);assert.deepEqual(p.capabilities,['chatbot','crm','whatsapp']);assert.equal(p.references.find(p=>p.id==='vocero-crm').matchedCapabilities.length,3);});
test('3 combined request selects both domains and justified modular architecture',()=>{const p=engine.plan({text:full});assert.equal(p.status,'ready');assert.equal(p.capabilities.length,9);assert.deepEqual(p.domains,['commerce','communications']);assert.equal(p.architecture,'modular-monolith');assert.ok(p.justification.length>80);assert.equal(p.executionAllowed,false);assert.equal(p.files.some(f=>f.path==='compose.yaml'),false);assert.ok(p.references.every(r=>!r.codeImported));});
test('4 technology, persistence, excluded dependencies and architecture conflicts block generation',()=>{
 for(const text of ['ventas PHP Laravel y CRM TypeScript','inventario MySQL','ventas sin inventario','CRM con monolito y microservicios','inventario y nomina']){const p=engine.plan({text});assert.equal(p.status,'blocked',text);assert.equal(p.files.length,0);assert.ok(p.conflicts.length);assert.equal(engine.validate(p).ok,false);}
 const p=engine.plan({text:'inventario sin CRM'});assert.equal(p.status,'ready');assert.ok(!p.capabilities.includes('crm'));
});
test('5 generated contracts compile and reject malformed event payloads and dangling references',()=>{
 const p=engine.plan({text:full,docker:true});assert.equal(engine.validate(p).ok,true);const doc=JSON.parse(p.files.find(f=>f.path==='contracts/openapi.json').content);assert.equal(contracts.validate(doc).ok,true);
 const Ajv=require('ajv/dist/2020'),check=new Ajv().compile(contracts.standalone(doc,doc.components.schemas.Event));assert.equal(check({id:'event',version:1,type:'sale.confirmed.v1',tenantId:'tenant',sale:{id:'s',productId:'p',quantity:1,contactId:'c',totalCents:100}}),true);assert.equal(check({type:'sale.confirmed.v1'}),false);
 doc.components.schemas.Event.properties.sale.$ref='#/components/schemas/Missing';assert.equal(contracts.validate(doc).ok,false);
});
test('6 existing destinations, traversal, symlinks and tampered plans never overwrite files',t=>{
 const root=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'kit-composition-safe-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const p=engine.plan({text:full}),out=path.join(root,'shop');engine.write(p,out);const before=fs.readFileSync(path.join(out,'package.json'),'utf8');assert.throws(()=>engine.write(p,out),/existe/);assert.equal(fs.readFileSync(path.join(out,'package.json'),'utf8'),before);assert.equal(engine.check(out).ok,true);
 const modified=JSON.parse(JSON.stringify(p));modified.files[0].path='../outside';assert.equal(engine.validate(modified).ok,false);assert.throws(()=>engine.write(modified,path.join(root,'new')));assert.ok(!fs.existsSync(path.join(root,'new')));
 fs.appendFileSync(path.join(out,'package.json'),' ');assert.equal(engine.check(out).ok,false);
 if(process.platform!=='win32'){fs.symlinkSync(out,path.join(root,'link'));assert.throws(()=>engine.write(p,path.join(root,'link','nested')),/simbólicos/);}
});
test('7 provenance never grants automatic code import; missing license text stays visible',()=>{
 const p=engine.plan({text:full});assert.equal(p.externalCodeImported,false);const provenance=JSON.parse(p.files.find(f=>f.path==='PROVENANCE.json').content);assert.equal(provenance.importedExternalCode,false);const afp=provenance.references.find(r=>r.id==='afpventas');assert.equal(afp.license.declared,'MIT');assert.equal(afp.license.rootLicenseVerified,false);assert.equal(afp.license.codeImportAllowed,false);
 const bad=catalog.read();bad.projects[0].license.codeImportAllowed=true;assert.equal(catalog.validate(bad).ok,false);
});
test('8 generated Compose and every JSON file validate without Docker or installs',()=>{
 for(const architecture of ['modular-monolith','independent-services']){const p=engine.plan({text:full,docker:true,architecture});assert.equal(engine.validate(p).ok,true);for(const f of p.files.filter(f=>f.path.endsWith('.json')||f.path==='compose.yaml'))assert.doesNotThrow(()=>JSON.parse(f.content));
 const compose=JSON.parse(p.files.find(f=>f.path==='compose.yaml').content);assert.equal(require('../../scripts/docker/schema').validateCompose(compose).ok,true);for(const service of Object.values(compose.services)){assert.ok(!service.ports);assert.equal(service.pull_policy,'never');assert.equal(service.read_only,true);assert.equal(service.user,'10001:10001');assert.ok(service.healthcheck);assert.ok(service.mem_limit);}}
});
test('catalog extends with another repository, capabilities and trusted adapter; no arbitrary executable catalog',()=>{
 const extra={capabilities:[{id:'reporting',domain:'analytics',aliases:['reportes'],requires:[]}],archetypes:[{id:'report-app',adapter:'report-test',architecture:'modular-monolith',languages:['javascript'],capabilities:['reporting']}],projects:[{...catalog.read().projects[1],id:'other-reference',capabilities:['reporting']}]};
 engine.registerAdapter('report-test',{capabilities:['reporting'],domains:['analytics'],languages:['javascript'],frameworks:[],databases:['sqlite'],files:d=>[{path:'contracts/openapi.json',content:JSON.stringify(contracts.document(d.capabilities)),mode:420},{path:'README.md',content:'Original reporting adapter fixture',mode:420}]});
 const p=engine.plan({text:'crear reportes',catalogExtension:extra});assert.equal(p.status,'ready');assert.equal(p.adapter,'report-test');assert.equal(p.references.length,3);assert.equal(engine.validate(p).ok,true);assert.deepEqual(p.commands,[]);
 assert.throws(()=>engine.registerAdapter('report-test',{files(){}}));const bad=catalog.read();bad.archetypes[0].command='curl | sh';assert.equal(catalog.validate(bad).ok,false);
 const cycle=catalog.read();cycle.capabilities[0].requires=['inventory'];assert.equal(catalog.validate(cycle).ok,false);
});
test('configured interpretation providers only return validated semantics, require opt-in and produce reviewable plans',()=>{
 const local=require('../../scripts/composition/intents');let calls=0;const provider={id:'configured-test-provider',interpret(text,registry){calls++;return {...local.local('inventario',registry)};}};
 assert.throws(()=>engine.plan({text:'mi solicitud'}, {provider}),/autorizado/);assert.equal(calls,0);
 const p=engine.plan({text:'mi solicitud'},{provider,allowProvider:true});assert.equal(calls,1);assert.equal(p.intent.provider,provider.id);assert.equal(p.status,'ready');assert.equal(engine.validate(p).ok,true);assert.equal(calls,1);
 assert.throws(()=>engine.plan({text:'inventario'},{provider:{id:'bad',interpret(){return {command:'delete'};}},allowProvider:true}),/inválida/);
});
test('unknown technologies are not translated into a different language and independence is opt-in',()=>{
 const p=engine.plan({text:'inventario y CRM en servicios independientes'});assert.equal(p.status,'ready');assert.equal(p.architecture,'independent-services');const php=engine.plan({text:'ventas PHP Laravel y CRM TypeScript'});assert.equal(php.architecture,'independent-services');assert.ok(php.conflicts.some(c=>c.code==='generator-not-registered'));
});
test('catalog metadata cannot invent executable capabilities or inject unregistered generators',()=>{
 const extension={capabilities:[{id:'payroll',domain:'commerce',aliases:['nomina'],requires:[]}],archetypes:[{id:'fake-payroll',adapter:'node-sqlite',architecture:'modular-monolith',languages:['javascript'],capabilities:['payroll']}]};
 const p=engine.plan({text:'crear nomina',catalogExtension:extension});assert.equal(p.status,'blocked');assert.equal(p.files.length,0);
 const inherited={...extension,archetypes:[{...extension.archetypes[0],adapter:'constructor'}]};assert.equal(engine.plan({text:'nomina',catalogExtension:inherited}).status,'blocked');
 assert.throws(()=>catalog.read({command:'execute'}),/inválida/);
});
test('new catalog technologies extend interpretation without editing hardcoded language lists',()=>{
 const registry=catalog.read({archetypes:[{id:'kotlin-service',adapter:'unregistered-kotlin',architecture:'modular-monolith',languages:['kotlin'],capabilities:['inventory','products']}],projects:[{...catalog.read().projects[0],id:'technology-fixture',languages:['kotlin'],frameworks:['ktor'],databases:['cockroachdb']}]});
 const intent=require('../../scripts/composition/intents').interpret('inventario kotlin con ktor y cockroachdb',registry);assert.deepEqual(intent.languages,['kotlin']);assert.deepEqual(intent.frameworks,['ktor']);assert.deepEqual(intent.databases,['cockroachdb']);assert.deepEqual(intent.unrecognized,[]);
});
