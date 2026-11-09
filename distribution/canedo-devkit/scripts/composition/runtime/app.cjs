'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {timingSafeEqual}=require('node:crypto');
const {open,fail}=require('./db.cjs');
const {commerce}=require('./commerce.cjs'),{crm}=require('./crm.cjs'),{adapters}=require('./adapters.cjs'),{valid}=require('./validate.cjs');
const {crmPort}=require('./http-ports.cjs');
const contract=require('../contracts/openapi.json'),modules=require('../modules.json');
function equal(a,b){if(typeof a!=='string'||typeof b!=='string')return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
function credentials(tokens){if(!tokens||typeof tokens!=='object'||Array.isArray(tokens)||!Object.keys(tokens).length||Object.entries(tokens).some(([tenant,token])=>! /^[A-Za-z0-9_-]{1,80}$/.test(tenant)||typeof token!=='string'||token.length<32||token.length>500||/[\s\x00-\x1f\x7f]/.test(token)))throw Error('Configure tenant-scoped tokens (at least 32 non-whitespace characters)');if(new Set(Object.values(tokens)).size!==Object.keys(tokens).length)throw Error('Tenant tokens must be distinct');}
async function body(req){
 if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))fail(400,'Content-Type must be application/json');let size=0,parts=[];
 for await(const part of req){size+=part.length;if(size>32768)fail(413,'Request body too large');parts.push(part);}
 try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{fail(400,'Invalid JSON');}
}
function createApp({dataDir,tokens,serviceToken,role='app',crmUrl,portOptions={}}){
 credentials(tokens);if(!['app','commerce','crm'].includes(role))throw Error('Unknown service role');
 if(role!=='app'&&(typeof serviceToken!=='string'||serviceToken.length<32||serviceToken.length>500||/[\s\x00-\x1f\x7f]/.test(serviceToken)||Object.values(tokens).some(v=>equal(v,serviceToken))))throw Error('Independent services require a separate service token');
 if(role==='commerce'&&modules.domains.includes('communications')){const url=new URL(crmUrl);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Invalid explicitly configured CRM service URL');}
 const selected=role==='app'?modules.domains:role==='crm'?['communications']:['commerce'];const dbs={};
 try{for(const domain of selected){if(!modules.domains.includes(domain))continue;const file=path.join(dataDir,domain+'.sqlite');if(!fs.existsSync(file))throw Error('Run the reviewed migration command before starting');dbs[domain]=open(file);if(dbs[domain].prepare('SELECT MAX(version) AS version FROM schema_version').get()?.version!==1)throw Error('Unsupported database schema');}}catch(e){for(const db of Object.values(dbs))db.close();throw e;}
 const ports=adapters(portOptions),sales=dbs.commerce?commerce(dbs.commerce,{emitSales:modules.capabilities.includes('crm')}):null,inbox=dbs.communications?crm(dbs.communications,ports):null;
 const remoteCRM=role==='commerce'&&modules.capabilities.includes('crm')?crmPort({baseUrl:crmUrl,serviceToken}):null;
 const flush=()=>sales&&modules.capabilities.includes('crm')?sales.flush(async event=>{
  if(inbox)return inbox.receive(event);
  return remoteCRM.receive(event);
 }):Promise.resolve({delivered:0,failed:0});
 const server=http.createServer(async(req,res)=>{
  const send=(status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data));};
  try{
   const pathname=new URL(req.url,'http://localhost').pathname,method=req.method.toLowerCase(),op=contract.paths[pathname]?.[method];
   if(!op)fail(404,'Not found');if(pathname==='/health'){send(200,{status:'ok'});return;}
   let result;
   if(pathname==='/internal/events'){
    if(role!=='crm'||!inbox)fail(404,'Not found');if(!equal(req.headers.authorization,'Bearer '+serviceToken))fail(401,'Unauthorized');
    const event=await body(req);if(!valid(event,contract.components.schemas.Event,contract))fail(400,'Invalid event contract');if(!Object.hasOwn(tokens,event.tenantId))fail(403,'Tenant not authorized');result=inbox.receive(event);
   }else{
    const tenant=req.headers['x-tenant-id'];if(typeof tenant!=='string'||!Object.hasOwn(tokens,tenant)||!equal(req.headers.authorization,'Bearer '+tokens[tenant]))fail(401,'Unauthorized');
    const isCRM=pathname.startsWith('/crm/'),service=isCRM?inbox:sales;if(!service)fail(404,'Not found');
    const key=req.headers['idempotency-key'];if(method==='post'&&(typeof key!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(key)))fail(400,'Valid Idempotency-Key required');
    const input=method==='post'?await body(req):null;if(op.requestBody&&!valid(input,op.requestBody.content['application/json'].schema,contract))fail(400,'Invalid request contract');
    result=await service.handle(tenant,key,op.operationId,input);
   }
   if(!valid(result,op.responses['200'].content['application/json'].schema,contract))throw Error('Response violated contract');send(200,result);
  }catch(e){const constraint=String(e.code||'').includes('CONSTRAINT')||/constraint failed/i.test(e.message);send(e.status|| (constraint?409:500),{error:e.status?e.message:constraint?'Conflict with persisted data':'Internal error'});}
 });
 server.requestTimeout=10000;server.headersTimeout=10000;server.keepAliveTimeout=1000;server.maxRequestsPerSocket=100;
 let closed=false;
 return {server,flush,commerce:sales,crm:inbox,async close(){if(closed)return;closed=true;if(server.listening)await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));for(const db of Object.values(dbs))db.close();}};
}
module.exports={createApp};
