'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process'),engine=require('../../scripts/composition/engine');
const cli=path.resolve(__dirname,'../../scripts/kit.js');
const text='Crear una tienda con productos inventario ventas caja CRM de WhatsApp y chatbot de IA';
const childEnv={...process.env};delete childEnv.NODE_TEST_CONTEXT;
function temp(t){const root=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'kit-composition-integration-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;}
test('CLI plan → validate → create → check generates the complete example and never executes commands',t=>{
 const root=temp(t),output=path.join(root,'shop'),file=path.join(root,'plan.json');
 const result=spawnSync(process.execPath,[cli,'composition','plan','--request',text,'--docker','--json'],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);const p=JSON.parse(result.stdout);assert.equal(p.status,'ready');assert.equal(p.executionAllowed,false);fs.writeFileSync(file,result.stdout);
 for(const args of [['composition','validate','--file',file],['composition','create','--file',file,'--out',output],['composition','check','--project',output]]){const r=spawnSync(process.execPath,[cli,...args,'--json'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).ok,true);}
 assert.ok(!fs.existsSync(path.join(output,'data')));assert.ok(!fs.existsSync(path.join(output,'secrets/tenant-tokens.json')));assert.ok(!fs.existsSync(path.join(output,'node_modules')));
 const again=spawnSync(process.execPath,[cli,'composition','create','--file',file,'--out',output],{encoding:'utf8'});assert.equal(again.status,1);assert.match(again.stderr,/existe/);
});
test('all generated JavaScript passes syntax checks and generated tests exercise real SQLite and HTTP',t=>{
 const root=temp(t),out=path.join(root,'complete'),p=engine.plan({text,docker:true});engine.write(p,out);
 for(const file of p.files.filter(f=>f.path.endsWith('.cjs'))){const r=spawnSync(process.execPath,['--check',path.join(out,file.path)],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);}
 const run=spawnSync(process.execPath,['--test','--test-reporter=tap','tests/integration.test.cjs'],{cwd:out,env:childEnv,encoding:'utf8',timeout:30000});assert.equal(run.status,0,run.stdout+run.stderr);assert.match(run.stdout,/(?:pass 5|tests 5)/);assert.doesNotMatch(run.stdout,/skipped [1-9]/);
});
test('independent-services plan generates runnable authenticated commerce/CRM contracts and manual-only Compose',t=>{
 const root=temp(t),out=path.join(root,'services'),p=engine.plan({text,docker:true,architecture:'independent-services'});engine.write(p,out);assert.equal(engine.validate(p).ok,true);
 const compose=JSON.parse(fs.readFileSync(path.join(out,'compose.yaml'),'utf8'));assert.deepEqual(Object.keys(compose.services),['commerce','crm']);assert.equal(compose.services.commerce.environment.CRM_URL,'http://crm:8080');assert.ok(compose.secrets.service_token);assert.ok(!compose.services.crm.ports);
 const run=spawnSync(process.execPath,['--test','--test-reporter=tap','tests/integration.test.cjs'],{cwd:out,env:childEnv,encoding:'utf8',timeout:30000});assert.equal(run.status,0,run.stdout+run.stderr);assert.match(run.stdout,/# pass 5/);
});
test('isolated inventory and CRM generators remain runnable without selecting the other domain',t=>{
 const root=temp(t);for(const [name,request]of [['stock','inventario'],['crm','CRM']]){const p=engine.plan({text:request}),out=path.join(root,name);engine.write(p,out);const run=spawnSync(process.execPath,['--test','--test-reporter=tap','tests/integration.test.cjs'],{cwd:out,env:childEnv,encoding:'utf8',timeout:30000});assert.equal(run.status,0,run.stdout+run.stderr);assert.match(run.stdout,/# pass 2/);assert.equal(p.domains.length,1);}
});
test('purchases persist stock and supplier relations and rollback invalid purchases atomically',async t=>{
 const root=temp(t),out=path.join(root,'shop');engine.write(engine.plan({text:'compras proveedores inventario'}),out);
 const {migrate,open}=require(path.join(out,'src/db.cjs')),{commerce}=require(path.join(out,'src/commerce.cjs'));const data=path.join(root,'db');migrate(data,['commerce']);const db=open(path.join(data,'commerce.sqlite'));t.after(()=>db.close());const c=commerce(db,{emitSales:false}),tenant='t';
 c.handle(tenant,'p','createProduct',{id:'p',name:'Product',priceCents:10,stock:0});c.handle(tenant,'s','createSupplier',{id:'s',name:'Supplier'});
 const input={productId:'p',supplierId:'s',quantity:5,totalCents:30};const purchase=c.handle(tenant,'buy','receivePurchase',input);assert.deepEqual(c.handle(tenant,'buy','receivePurchase',input),purchase);assert.equal(c.handle(tenant,null,'listProducts')[0].stock,5);
 assert.throws(()=>c.handle(tenant,'bad','receivePurchase',{...input,supplierId:'missing'}),/Supplier/);assert.equal(c.handle(tenant,null,'listProducts')[0].stock,5);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM purchase').get().n,1);
});
test('outbox retry exhaustion preserves records; inbox duplicates never duplicate CRM activity',async t=>{
 const root=temp(t),out=path.join(root,'shop');engine.write(engine.plan({text}),out);const {migrate,open}=require(path.join(out,'src/db.cjs')),{commerce}=require(path.join(out,'src/commerce.cjs')),{crm}=require(path.join(out,'src/crm.cjs')),{adapters}=require(path.join(out,'src/adapters.cjs'));
 const data=path.join(root,'db');migrate(data);const salesDB=open(path.join(data,'commerce.sqlite')),crmDB=open(path.join(data,'communications.sqlite'));t.after(()=>{salesDB.close();crmDB.close();});const c=commerce(salesDB),r=crm(crmDB,adapters());
 c.handle('t','p','createProduct',{id:'p',name:'Product',priceCents:50,stock:1});c.handle('t','s','createSale',{productId:'p',quantity:1,contactId:'c'});let attempts=0;
 for(let i=0;i<6;i++)await c.flush(async()=>{attempts++;throw Error('unavailable');},{now:Date.now()+i*100000});assert.equal(attempts,5);const stored=salesDB.prepare('SELECT * FROM outbox').get();assert.equal(stored.delivered,0);assert.equal(stored.attempts,5);
 const event=JSON.parse(stored.payload);assert.equal(r.receive(event).accepted,true);assert.equal(r.receive(event).accepted,true);assert.equal(r.handle('t',null,'listMessages').length,1);assert.throws(()=>r.receive({...event,sale:{...event.sale,totalCents:999}}),/Event ID/);
});
test('disabled injected providers never execute; enabled providers have bounded local timeouts',async t=>{
 const root=temp(t),out=path.join(root,'shop');engine.write(engine.plan({text}),out);const {adapters}=require(path.join(out,'src/adapters.cjs'));let calls=0;
 const disabled=adapters({allowExternalAdapters:true,chatbot:{enabled:false,async reply(){calls++;return {status:'replied',text:'Should not run'};}}});assert.equal((await disabled.chatbot.reply({})).status,'disabled');assert.equal(calls,0);
 const hung=adapters({allowExternalAdapters:true,chatbot:{enabled:true,timeoutMs:20,reply(){return new Promise(()=>{});}}});await assert.rejects(hung.chatbot.reply({}),/timeout/);
});
