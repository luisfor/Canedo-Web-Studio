'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const engine=require('../../scripts/composition/engine'),combinations=require('../../scripts/commercial/combinations');
test('SaaS project validates contracts/Compose and executes quota, subscription and integrated CRM tests',t=>{
 const root=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'kit-saas-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const p=engine.plan({text:'saas multiempresa suscripciones cuotas tienda inventario ventas caja CRM omnicanal whatsapp messenger instagram chatbot agenda ecommerce pagos facturacion marketing contenido',docker:true});assert.equal(p.status,'ready',JSON.stringify(p.conflicts));assert.equal(engine.validate(p).ok,true);
 const out=path.join(root,'app');engine.write(p,out);const env={...process.env};delete env.NODE_TEST_CONTEXT;
 const result=spawnSync(process.execPath,['--test','--test-reporter=tap','tests/integration.test.cjs','tests/saas.test.cjs'],{cwd:out,env,encoding:'utf8',timeout:60000});assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/# pass 6/);assert.match(result.stdout,/# skipped 0/);assert.ok(!fs.existsSync(path.join(out,'data')));
});
test('A–I combinations use registered generators, preserve unsupported requirements and never enable providers',()=>{
 assert.equal(combinations.list().combinations.length,9);
 for(const c of combinations.list().combinations){const r=combinations.plan(c.id,{docker:true});assert.equal(r.plan.status,c.expected,c.id);assert.equal(r.executionAllowed,false);if(c.expected==='ready')assert.equal(engine.validate(r.plan).ok,true,c.id);else{assert.equal(r.plan.files.length,0);assert.ok(r.plan.conflicts.length);}}
 assert.throws(()=>combinations.list({schemaVersion:1,combinations:[{...combinations.list().combinations[0]}]}));assert.throws(()=>combinations.plan('unknown'));
});
