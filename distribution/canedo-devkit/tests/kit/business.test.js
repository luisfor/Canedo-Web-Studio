'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const engine=require('../../scripts/composition/engine');
const text='tienda inventario ventas caja CRM omnicanal whatsapp messenger instagram tiktok chatbot agenda recordatorios';
function temp(t){const root=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'kit-business-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;}
test('business composition preserves v1 default and validates extended contracts and Compose',()=>{
 assert.equal(engine.plan({text:'inventario CRM whatsapp chatbot'}).adapter,'node-sqlite');
 const p=engine.plan({text,docker:true});assert.equal(p.status,'ready',JSON.stringify(p.conflicts));assert.equal(p.adapter,'node-business-v2');assert.equal(engine.validate(p).ok,true);
 const modules=JSON.parse(p.files.find(f=>f.path==='modules.json').content);assert.equal(modules.generator,'node-business-v2');
 const doc=JSON.parse(p.files.find(f=>f.path==='contracts/openapi.json').content);for(const route of ['/crm/assignment','/agenda/appointments','/iam/roles','/crm/chatbot'])assert.ok(doc.paths[route]);assert.ok(!doc.paths['/internal/events']);
 assert.equal(engine.plan({text,architecture:'independent-services'}).status,'blocked');
});
test('generated business project executes actual SQLite, HTTP, role, pipeline, sale/outbox and signed-webhook tests',t=>{
 const out=path.join(temp(t),'app'),p=engine.plan({text});engine.write(p,out);
 const env={...process.env};delete env.NODE_TEST_CONTEXT;const run=spawnSync(process.execPath,['--test','--test-reporter=tap','tests/integration.test.cjs'],{cwd:out,env,encoding:'utf8',timeout:60000});assert.equal(run.status,0,run.stdout+run.stderr);assert.match(run.stdout,/# pass 4/);assert.match(run.stdout,/# skipped 1/);
 assert.ok(!fs.existsSync(path.join(out,'data')));assert.ok(!fs.existsSync(path.join(out,'node_modules')));
});
test('incremental v1 cannot silently migrate to new auth/schema and v2 refuses v1 data',t=>{
 const root=temp(t),out=path.join(root,'v1'),api=require('../../scripts/kit-first/service'),memory=require('../../scripts/memory/store'),enhance=require('../../scripts/memory/enhance');
 engine.write(engine.plan({text:'inventario CRM'}),out);memory.adopt({destination:out,evidence:api.discover({destination:out})});
 const p=enhance.plan({destination:out,evidence:api.discover({destination:out}),text:'omnicanal'});assert.equal(p.status,'blocked');assert.ok(p.blockers.some(b=>b.code==='generator-migration-requires-plan'));
 const v2=path.join(root,'v2');engine.write(engine.plan({text}),v2);
 const data=path.join(root,'old-data');require(path.join(out,'src/db.cjs')).migrate(data,['communications']);
 assert.throws(()=>require(path.join(v2,'src/business/migrate.cjs')).migrateBusiness(data),/reviewed migration/);
});
