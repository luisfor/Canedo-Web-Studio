'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{randomBytes,createHmac}=require('node:crypto');
const {createBusinessApp}=require('../src/business/app.cjs'),{migrateBusiness}=require('../src/business/migrate.cjs'),{channels}=require('../src/business/channels.cjs'),modules=require('../modules.json');
async function setup(t,options={}){
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'business-test-'));migrateBusiness(dataDir);
 const actors=[{tenantId:'a',actorId:'admin',role:'admin',platformAdmin:true,token:randomBytes(32).toString('hex')},{tenantId:'b',actorId:'admin',role:'admin',platformAdmin:true,token:randomBytes(32).toString('hex')},{tenantId:'a',actorId:'viewer',role:'viewer',token:randomBytes(32).toString('hex')}];
 const app=createBusinessApp({dataDir,actors,...options});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await app.close();fs.rmSync(dataDir,{recursive:true,force:true});});
 const origin='http://127.0.0.1:'+app.server.address().port;
 async function request(route,input,who=0,key='k'+randomBytes(8).toString('hex')){const actor=actors[who],r=await fetch(origin+route,{method:input?'POST':'GET',headers:{'content-type':'application/json','x-tenant-id':actor.tenantId,authorization:'Bearer '+actor.token,'idempotency-key':key},...(input?{body:JSON.stringify(input)}:{})});return {status:r.status,body:await r.json()};}
 if(modules.capabilities.includes('subscriptions'))for(const who of [0,1]){const plan={id:'test',name:'Local test',limits:{contacts:100,messages:100,conversations:100,aiCalls:100,seats:10}};assert.equal((await request('/saas/plans',plan,who)).status,200);assert.equal((await request('/saas/subscription',{planId:'test',status:'active',validUntil:Date.now()+86400000},who)).status,200);}
 return {app,request,origin,actors};
}
test('contacts, actor authorization, durable idempotency and tenant isolation',async t=>{
 const {request}=await setup(t),contact={id:'c',name:'Demo',phone:null,consent:true};
 assert.equal((await request('/crm/contacts',contact,0,'contact')).status,200);
 assert.equal((await request('/crm/contacts',contact,0,'contact')).status,200);
 assert.equal((await request('/crm/contacts',{...contact,name:'Changed'},0,'contact')).status,409);
 assert.equal((await request('/crm/contacts')).body.length,1);assert.deepEqual((await request('/crm/contacts',null,1)).body,[]);
 assert.equal((await request('/crm/contacts',{...contact,id:'x'},2)).status,403);
});
test('commerce sale commits stock/cash and dispatches CRM event without external network',{skip:!modules.capabilities.includes('sales')},async t=>{
 const {request,app}=await setup(t);
 assert.equal((await request('/crm/contacts',{id:'c',name:'Demo',phone:null,consent:true})).status,200);
 assert.equal((await request('/products',{id:'p',name:'Demo',priceCents:250,stock:5})).status,200);
 if(modules.capabilities.includes('purchases')){assert.equal((await request('/suppliers',{id:'supplier',name:'Proveedor demo'})).status,200);assert.equal((await request('/purchases',{productId:'p',supplierId:'supplier',quantity:2,totalCents:300})).status,200);}
 const sale={productId:'p',quantity:2,contactId:'c'};
 assert.equal((await request('/sales',sale,0,'sale')).body.totalCents,500);
 assert.equal((await request('/sales',sale,0,'sale')).status,200);
 assert.equal((await request('/products')).body[0].stock,modules.capabilities.includes('purchases')?5:3);assert.equal((await request('/cash')).body[0].amountCents,500);
 await app.flush();assert.equal((await request('/crm/messages')).body.length,1);
 assert.equal((await request('/sales',{...sale,contactId:'other'})).status,404);
});
test('CRM pipeline, appointments, handoff and chatbot simulated port are functional locally',{skip:!modules.capabilities.includes('omnichannel')},async t=>{
 let calls=0;const {request}=await setup(t,{authorizeChatbot:true,chatbotPort:{scope:'simulated',async reply(){calls++;return {text:'Local fixture'};}}});
 for(const [route,x]of [['/crm/contacts',{id:'c',name:'Demo',phone:null,consent:true}],['/crm/conversations',{id:'v',contactId:'c',channel:'internal'}],['/crm/stages',{id:'new',name:'Nuevo',position:0}],['/crm/leads',{id:'l',contactId:'c',stageId:'new',valueCents:100}],['/crm/tags',{id:'vip',name:'VIP'}],['/crm/tags/assign',{contactId:'c',tagId:'vip'}]])assert.equal((await request(route,x)).status,200,route);
 assert.equal((await request('/crm/segments')).body.length,1);
 assert.equal((await request('/crm/quick-replies',{id:'qr',title:'Saludo',text:'Hola'})).status,200);assert.equal((await request('/crm/quick-replies')).body.length,1);
 assert.equal((await request('/crm/knowledge',{id:'kb',title:'Horario',body:'Información local'})).status,200);assert.equal((await request('/crm/knowledge')).body.length,1);
 assert.equal((await request('/iam/roles',{actorId:'admin',role:'viewer'})).status,409);
 assert.equal((await request('/crm/leads/move',{leadId:'l',stageId:'foreign'},1)).status,404);
 if(modules.capabilities.includes('appointments')){
  const x={id:'appt',contactId:'c',resource:'room',startAt:2000000000,endAt:2000003600};
  assert.equal((await request('/agenda/appointments',x)).status,200);assert.equal((await request('/agenda/appointments',{...x,id:'overlap'})).status,409);
 }
 if(modules.capabilities.includes('chatbot')){
  const ask={conversationId:'v',text:'Hola'};assert.equal((await request('/crm/chatbot',ask,0,'bot')).body.scope,'simulated');assert.equal((await request('/crm/chatbot',ask,0,'bot')).status,200);assert.equal(calls,1);
  assert.equal((await request('/crm/assignment',{conversationId:'v',actorId:'admin',status:'open',handoff:true})).status,200);
  assert.equal((await request('/crm/chatbot',ask)).body.status,'human-handoff');assert.equal(calls,1);
 }
});
test('channel adapters default disabled; locally signed Meta inbound deduplicates and rejects spoofing',async t=>{
 assert.ok(channels().status().every(c=>c.outbound==='disabled'&&!c.liveVerified));
 assert.throws(()=>channels({tiktok:{authorizeWebhooks:true}}));
 if(!modules.capabilities.includes('messenger'))return;
 const secret=randomBytes(32).toString('hex'),config={authorizeWebhooks:true,appSecret:secret,verifyToken:randomBytes(32).toString('hex'),accounts:[{tenantId:'a',accountId:'123'}]};
 const {origin,request}=await setup(t,{channelConfig:{messenger:config}});
 await request('/crm/tags',{id:'rule-tag',name:'Interesado'});assert.equal((await request('/crm/automation/rules',{id:'rule',contains:'hola',tagId:'rule-tag'})).status,200);
 const payload={entry:[{id:'123',messaging:[{sender:{id:'999'},recipient:{id:'123'},timestamp:Date.now(),message:{mid:'provider-1',text:'Hola'}}]}]},raw=JSON.stringify(payload);
 async function post(signature){return fetch(origin+'/webhooks/messenger',{method:'POST',headers:{'x-hub-signature-256':signature},body:raw});}
 assert.equal((await post('sha256='+'0'.repeat(64))).status,401);
 const signature='sha256='+createHmac('sha256',secret).update(raw).digest('hex');assert.equal((await post(signature)).status,200);assert.equal((await post(signature)).status,200);
 assert.equal((await request('/crm/messages')).body.length,1);assert.equal((await request('/crm/contacts')).body[0].consent,false);assert.deepEqual((await request('/crm/messages',null,1)).body,[]);
 assert.equal((await request('/crm/segments')).body.length,1);
 const handshake=await fetch(origin+'/webhooks/messenger?hub.mode=subscribe&hub.verify_token='+config.verifyToken+'&hub.challenge=12345');assert.equal(await handshake.text(),'12345');
});
test('commercial combinations execute local orders, drafts and consent-based campaign audiences without providers',{skip:!modules.capabilities.some(c=>['ecommerce','payments','invoicing','marketing','content'].includes(c))},async t=>{
 const {request,app}=await setup(t);
 assert.equal((await request('/crm/contacts',{id:'c',name:'Demo',phone:null,consent:true})).status,200);
 if(modules.capabilities.includes('sales')){
  assert.equal((await request('/products',{id:'p',name:'Demo',priceCents:300,stock:3})).status,200);
  const route=modules.capabilities.includes('ecommerce')?'/shop/orders':'/sales';
  const sale=await request(route,{productId:'p',quantity:1,contactId:'c'},0,'order');assert.equal(sale.status,200);assert.equal(sale.body.totalCents,300);await app.flush();
  if(modules.capabilities.includes('ecommerce'))assert.equal((await request('/shop/catalog')).body[0].stock,2);
  for(const [cap,url,status]of [['payments','/billing/payment-intents','provider-disabled'],['invoicing','/billing/invoice-drafts','not-fiscal-draft']])if(modules.capabilities.includes(cap)){
   const x={id:cap,saleId:sale.body.id},r=await request(url,x);assert.equal(r.status,200);assert.equal(r.body.totalCents,300);assert.equal(r.body.status,status);assert.equal((await request(url,{...x,id:cap+'x'},1)).status,404);
  }
 }
 if(modules.capabilities.includes('marketing')){
  for(const [url,x]of [['/crm/tags',{id:'vip',name:'VIP'}],['/crm/tags/assign',{contactId:'c',tagId:'vip'}],['/marketing/campaigns',{id:'campaign',name:'Demo',tagId:'vip',body:'Mensaje manual'}]])assert.equal((await request(url,x)).status,200);
  assert.equal((await request('/marketing/audience',{campaignId:'campaign'})).body.length,1);
  await request('/crm/consent',{contactId:'c',consent:false});assert.equal((await request('/marketing/audience',{campaignId:'campaign'})).body.length,0);
 }
 if(modules.capabilities.includes('content'))assert.equal((await request('/content/drafts',{id:'draft',title:'Manual',body:'Contenido propio'})).body.status,'manual-draft');
});
