'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{randomBytes}=require('node:crypto');
const {migrate}=require('../src/db.cjs'),{createApp}=require('../src/app.cjs'),{adapters}=require('../src/adapters.cjs'),{capabilities,domains}=require('../modules.json');
const {commercePort}=require('../src/http-ports.cjs');
const complete=['products','inventory','sales','cash','crm','whatsapp','chatbot'].every(c=>capabilities.includes(c));
async function fixture(t,{role='app',crmUrl,serviceToken,portOptions,dataDir}={}){
 const root=dataDir||fs.mkdtempSync(path.join(os.tmpdir(),'kit-composition-runtime-'));
 if(!dataDir)t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 migrate(root,role==='app'?domains:domains.filter(d=>d===(role==='crm'?'communications':'commerce')));
 const tokens={demo:randomBytes(32).toString('hex'),other:randomBytes(32).toString('hex')};
 const app=createApp({dataDir:root,tokens,role,crmUrl,serviceToken,portOptions});t.after(()=>app.close());
 await new Promise((resolve,reject)=>{app.server.once('error',reject);app.server.listen(0,'127.0.0.1',resolve);});
 const url='http://127.0.0.1:'+app.server.address().port;
 async function request(route,input,key='request',tenant='demo',token=tokens[tenant]){
  const response=await fetch(url+route,{method:input===undefined?'GET':'POST',headers:{authorization:'Bearer '+token,'x-tenant-id':tenant,'content-type':'application/json','idempotency-key':key},...(input===undefined?{}:{body:JSON.stringify(input)})});
  return {status:response.status,body:await response.json()};
 }
 return {app,request,url,root,tokens};
}
test('selected project starts only after explicit migration and credentials; health and authentication',async t=>{
 const f=await fixture(t),health=await fetch(f.url+'/health');assert.equal(health.status,200);
 const route=capabilities.includes('products')?'/products':'/crm/contacts';
 if(capabilities.includes('products')||capabilities.includes('crm')){assert.equal((await f.request(route,undefined,'x','demo','wrong')).status,401);assert.equal((await f.request(route,undefined,'x','other',f.tokens.demo)).status,401);}
 assert.equal((await fetch(f.url+'/missing')).status,404);
 assert.equal((await f.app.flush()).failed,0);
});
test('sale commits stock, cash and durable CRM activity; retries, rollback, tenant isolation and restart', {skip:!complete},async t=>{
 const f=await fixture(t);
 const contact={id:'customer-1',name:'Cliente de prueba',phone:'+573000000001',consent:true};
 assert.equal((await f.request('/crm/contacts',contact,'contact')).status,200);
 assert.equal((await f.request('/products',{id:'sku-1',name:'Producto de prueba',priceCents:1299,stock:10},'product')).status,200);
 const payload={productId:'sku-1',quantity:2,contactId:contact.id};
 const sale=await f.request('/sales',payload,'sale-1');assert.equal(sale.status,200);assert.equal(sale.body.totalCents,2598);
 assert.deepEqual((await f.request('/sales',payload,'sale-1')).body,sale.body);
 assert.equal((await f.request('/sales',{...payload,quantity:3},'sale-1')).status,409);
 assert.equal((await f.request('/sales',{...payload,quantity:99},'too-many')).status,409);
 assert.equal((await f.request('/sales',{...payload,quantity:-1},'negative')).status,400);
 assert.equal((await f.request('/products')).body[0].stock,8);
 const cash=(await f.request('/cash')).body;assert.equal(cash.length,1);assert.equal(cash[0].amountCents,2598);
 assert.deepEqual((await f.request('/products',undefined,'x','other')).body,[]);
 assert.equal((await f.request('/sales',payload,'cross','other')).status,404);
 const failed=await f.app.commerce.flush(async()=>{throw Error('CRM unavailable');});assert.equal(failed.failed,1);
 const recovered=await f.app.commerce.flush(event=>f.app.crm.receive(event),{now:Date.now()+10000});assert.equal(recovered.delivered,1);
 await f.app.flush();const messages=(await f.request('/crm/messages')).body;assert.equal(messages.length,1);assert.equal(messages[0].channel,'internal');assert.equal(messages[0].contactId,contact.id);
 assert.equal((await f.request('/crm/whatsapp/messages',{contactId:contact.id,text:'Mensaje de prueba'},'wa')).body.status,'disabled');
 assert.equal((await f.request('/crm/chatbot',{contactId:contact.id,text:'Hola'},'bot')).body.status,'disabled');
 assert.equal((await f.app.crm.reply({tenantId:'demo',contactId:contact.id,text:'Hola'})).status,'disabled');
 await f.app.close();const restarted=createApp({dataDir:f.root,tokens:f.tokens});t.after(()=>restarted.close());
 assert.equal(restarted.commerce.handle('demo',null,'listProducts',null)[0].stock,8);
 assert.equal(restarted.commerce.handle('demo',null,'cashLedger',null).length,1);
});
test('independent services exchange a valid authenticated event over real localhost HTTP', {skip:!complete},async t=>{
 const token=randomBytes(32).toString('hex'),receiver=await fixture(t,{role:'crm',serviceToken:token}),sender=await fixture(t,{role:'commerce',serviceToken:token,crmUrl:receiver.url});
 await sender.request('/products',{id:'p',name:'Product',priceCents:100,stock:3},'p');
 const port=commercePort({baseUrl:sender.url,tokens:sender.tokens});const sale=await port.createSale('demo','s',{productId:'p',quantity:1,contactId:'c'});assert.equal(sale.totalCents,100);assert.equal((await port.createSale('demo','s',{productId:'p',quantity:1,contactId:'c'})).id,sale.id);
 assert.equal((await sender.app.flush()).delivered,1);assert.equal((await receiver.request('/crm/messages')).body.length,1);
 assert.equal((await fetch(receiver.url+'/internal/events',{method:'POST',headers:{authorization:'Bearer wrong','content-type':'application/json'},body:'{}'})).status,401);
 assert.equal((await fetch(receiver.url+'/internal/events',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:'{}'})).status,400);
});
test('external adapters require explicit opt-in; no paid or WhatsApp provider is activated',()=>{
 assert.throws(()=>adapters({chatbot:{reply(){}}}),/explicit/);
 const ports=adapters();assert.equal(ports.chatbot.enabled,false);assert.equal(ports.whatsapp.enabled,false);
});
test('explicit test adapters integrate chatbot and consented WhatsApp without contacting any provider',{skip:!complete},async t=>{
 let replies=0,sends=0;const f=await fixture(t,{portOptions:{allowExternalAdapters:true,chatbot:{enabled:true,async reply(){replies++;return {status:'replied',text:'Respuesta de un adaptador de prueba'};}},whatsapp:{enabled:true,async send(){sends++;return {status:'sent'};}}}});
 const contact={id:'c',name:'Test',phone:'+573000000002',consent:true};await f.request('/crm/contacts',contact,'c');
 const input={contactId:'c',text:'Hola'};const first=await f.request('/crm/chatbot',input,'bot');assert.equal(first.status,200);assert.equal(first.body.status,'replied');assert.deepEqual((await f.request('/crm/chatbot',input,'bot')).body,first.body);assert.equal(replies,1);
 assert.equal((await f.request('/crm/whatsapp/messages',input,'wa')).body.status,'queued');assert.equal(sends,0);assert.equal((await f.app.crm.dispatchWhatsApp()).sent,1);assert.equal(sends,1);await f.app.crm.dispatchWhatsApp();assert.equal(sends,1);
 await f.request('/crm/contacts',{...contact,id:'no-consent',phone:'+573000000003',consent:false},'nc');assert.equal((await f.request('/crm/whatsapp/messages',{contactId:'no-consent',text:'No'},'no')).status,403);assert.equal((await f.request('/crm/chatbot',{contactId:'no-consent',text:'No'},'no-bot')).status,403);assert.equal(replies,1);
});
