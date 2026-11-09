'use strict';
const http=require('node:http'),path=require('node:path'),{Readable}=require('node:stream');
const {open,fail,memo,transaction,canonical}=require('../db.cjs');
const {identity}=require('./auth.cjs'),{repository}=require('./repository.cjs'),{channels}=require('./channels.cjs'),{valid}=require('./validate.cjs');
const contract=require('../../contracts/openapi.json'),modules=require('../../modules.json');
function createBusinessApp({dataDir,actors,channelConfig={},chatbotPort=null,authorizeChatbot=false}){
 const db=open(path.join(dataDir,'communications.sqlite'));
 let auth,base;
 try{if(db.prepare('SELECT MAX(version) AS v FROM kit_extension_schema').get()?.v!==1)throw Error('Run reviewed business migration');auth=identity(actors,db);base=require('../app.cjs').createApp({dataDir,tokens:auth.internal});}catch(e){db.close();throw e;}
 let ports;try{ports=channels(channelConfig);}catch(e){db.close();base.close();throw e;}
 const policy=modules.capabilities.includes('subscriptions')?require('./saas.cjs').saas(db,auth):null,repo=repository(db,auth,ports,policy,(tenant,id)=>base.commerce?.handle(tenant,null,'listSales').find(s=>s.id===id)),legacy=base.server.listeners('request')[0];
 if(chatbotPort&&(!authorizeChatbot||typeof chatbotPort.reply!=='function')){db.close();base.close();throw Error('Explicit chatbot authorization required');}
 async function read(req){let size=0,parts=[];for await(const part of req){size+=part.length;if(size>32768)fail(413,'Request too large');parts.push(part);}return Buffer.concat(parts);}
 const server=http.createServer(async(req,res)=>{
  const send=(status,x)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(x));};
  try{
   const url=new URL(req.url,'http://localhost'),route=url.pathname,method=req.method;
   if(route==='/health'&&method==='GET')return send(200,{status:'ok'});
   if(route==='/'&&method==='GET'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'",'cache-control':'no-store'});return res.end(require('node:fs').readFileSync(path.join(__dirname,'inbox.html')));}
   if(route==='/inbox.js'&&method==='GET'){res.writeHead(200,{'content-type':'text/javascript','x-content-type-options':'nosniff','cache-control':'no-store'});return res.end(require('node:fs').readFileSync(path.join(__dirname,'inbox.js')));}
   if(route.startsWith('/webhooks/')){
    const channel=route.slice('/webhooks/'.length),port=ports.ports[channel];if(!port||!modules.capabilities.includes(channel))fail(404,'Channel not selected');
    if(method==='GET'){const challenge=port.challenge(url.searchParams);if(challenge===null)fail(403,'Webhook verification denied');res.writeHead(200,{'content-type':'text/plain','cache-control':'no-store'});return res.end(challenge);}
    if(method!=='POST')fail(405,'Method not allowed');
    const events=port.parse(await read(req),req.headers['x-hub-signature-256']);for(const e of events){if(!Object.hasOwn(auth.internal,e.account.tenantId))fail(403,'Webhook tenant not configured');repo.inbound(channel,e.account,e.event);}return send(200,{accepted:true});
   }
   if(url.search)fail(400,'Query parameters not supported');
   const op=contract.paths[route]?.[method.toLowerCase()];if(!op||route==='/internal/events')fail(404,'Not found');
   const principal=auth.authenticate(req.headers);if(!principal)fail(401,'Unauthorized');if(!auth.authorize(principal,method,route))fail(403,'Role not allowed');
   const key=req.headers['idempotency-key'];if(method==='POST'&&(typeof key!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(key)))fail(400,'Valid Idempotency-Key required');
   let raw=Buffer.alloc(0),input=null;
   if(method==='POST'){if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))fail(400,'JSON required');raw=await read(req);try{input=JSON.parse(raw.toString());}catch{fail(400,'Invalid JSON');}if(!valid(input,op.requestBody.content['application/json'].schema,contract))fail(400,'Invalid request contract');}
   if(!/^\/(?:crm|iam|agenda|saas|billing|marketing|content)\//.test(route)){
    const delegated=route==='/shop/catalog'?'/products':route==='/shop/orders'?'/sales':route;
    if(method==='POST'&&policy)policy.requireActive(principal.tenantId);
    if(delegated==='/sales'&&method==='POST')repo.exists('contact',principal.tenantId,input.contactId);
    const bridge=Readable.from(raw.length?[raw]:[]);bridge.url=delegated;bridge.method=method;bridge.headers={...req.headers,authorization:'Bearer '+auth.internal[principal.tenantId]};return await legacy(bridge,res);
   }
   let result;
   if(route.startsWith('/saas/'))result=policy?policy.handle(principal,method,route,key,input):fail(404,'SaaS not selected');
   else if(route==='/crm/chatbot'){
    const c=repo.exists('conversation',principal.tenantId,input.conversationId),contact=repo.exists('contact',principal.tenantId,c.contact_id);
    if(!contact.consent)fail(403,'Contact consent required');
    const payload=canonical(input),old=db.prepare('SELECT * FROM receipt WHERE tenant_id=? AND key=?').get(principal.tenantId,key);
    if(old){if(old.operation!==route||old.request!==payload)fail(409,'Idempotency conflict');result=JSON.parse(old.result);}
    else if(c.handoff||c.status!=='open')result=memo(db,principal.tenantId,key,route,input,()=>({status:'human-handoff'}));
    else if(!chatbotPort)result=memo(db,principal.tenantId,key,route,input,()=>({status:'disabled'}));
    else{
     memo(db,principal.tenantId,key,route,input,()=>{if(policy){policy.beforeWrite(principal,route);policy.afterWrite(principal,route,key);}return {status:'pending'};});
     try{const knowledge=db.prepare('SELECT title,body FROM knowledge WHERE tenant_id=? LIMIT 100').all(principal.tenantId);const controller=new AbortController();let timer;let answer;try{answer=await Promise.race([Promise.resolve().then(()=>chatbotPort.reply({...input,tenantId:principal.tenantId,knowledge,signal:controller.signal})),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Chatbot timeout'));},2000);})]);}finally{clearTimeout(timer);}if(!answer||typeof answer.text!=='string'||answer.text.length>4000)throw Error('Invalid chatbot response');result={status:'replied',text:answer.text,scope:chatbotPort.scope==='simulated'?'simulated':'configured-unverified-live'};}catch{result={status:'failed-manual-reconciliation'};}
     transaction(db,()=>{db.prepare('UPDATE receipt SET result=? WHERE tenant_id=? AND key=?').run(JSON.stringify(result),principal.tenantId,key);repo.audit(principal,route,c.id);});
    }
   }else result=repo.handle(principal,method,route,key,input);
   if(!valid(result,op.responses['200'].content['application/json'].schema,contract))throw Error('Response contract violation');send(200,result);
  }catch(e){const constraint=/constraint failed/i.test(e.message);send(e.status||(constraint?409:500),{error:e.status?e.message:constraint?'Conflict with persisted data':'Internal error'});}
 });
 server.requestTimeout=10000;server.headersTimeout=10000;server.keepAliveTimeout=1000;
 let closed=false;
 return {server,flush:base.flush,async close(){if(closed)return;closed=true;if(server.listening)await new Promise(resolve=>server.close(resolve));await base.close();db.close();}};
}
module.exports={createBusinessApp};
