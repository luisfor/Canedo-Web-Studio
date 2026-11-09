'use strict';
const Ajv=require('ajv/dist/2020');
const object=properties=>({type:'object',additionalProperties:false,required:Object.keys(properties),properties});
const id={type:'string',minLength:1,maxLength:80,pattern:'^[A-Za-z0-9_-]+$'};
const text={type:'string',minLength:1,maxLength:200};
const integer={type:'integer',minimum:0,maximum:1000000000};
const schemas={
 ProductInput:object({id,name:text,priceCents:integer,stock:integer}),
 Product:object({id,name:text,priceCents:integer,stock:integer}),
 StockInput:object({productId:id,quantity:{...integer,minimum:1}}),
 SaleInput:object({productId:id,quantity:{...integer,minimum:1,maximum:1000000},contactId:id}),
 Sale:object({id,productId:id,quantity:{...integer,minimum:1},contactId:id,totalCents:{type:'integer',minimum:0,maximum:1000000000000000}}),
 SupplierInput:object({id,name:text}),
 PurchaseInput:object({productId:id,supplierId:id,quantity:{...integer,minimum:1},totalCents:integer}),
 ContactInput:object({id,name:text,phone:{type:'string',pattern:'^\\+[1-9][0-9]{7,14}$'},consent:{type:'boolean'}}),
 MessageInput:object({contactId:id,text:{type:'string',minLength:1,maxLength:4000}}),
 Event:object({id,version:{const:1},type:{const:'sale.confirmed.v1'},tenantId:id,sale:{$ref:'#/components/schemas/Sale'}}),
 Error:object({error:text}),
 Ack:object({accepted:{const:true}}),
 Health:object({status:{const:'ok'}})
};
const routes=[
 ['products','get','/products','listProducts',null,{type:'array',items:{$ref:'#/components/schemas/Product'}}],
 ['products','post','/products','createProduct','ProductInput',{$ref:'#/components/schemas/Product'}],
 ['inventory','post','/inventory/adjust','receiveStock','StockInput',{$ref:'#/components/schemas/Product'}],
 ['sales','post','/sales','createSale','SaleInput',{$ref:'#/components/schemas/Sale'}],
 ['sales','get','/sales','listSales',null,{type:'array',items:{$ref:'#/components/schemas/Sale'}}],
 ['cash','get','/cash','cashLedger',null,{type:'array',items:object({id,saleId:id,amountCents:{type:'integer',minimum:0}})}],
 ['suppliers','post','/suppliers','createSupplier','SupplierInput',{$ref:'#/components/schemas/SupplierInput'}],
 ['purchases','post','/purchases','receivePurchase','PurchaseInput',object({id})],
 ['crm','post','/crm/contacts','createContact','ContactInput',{$ref:'#/components/schemas/ContactInput'}],
 ['crm','get','/crm/contacts','listContacts',null,{type:'array',items:{$ref:'#/components/schemas/ContactInput'}}],
 ['crm','get','/crm/messages','listMessages',null,{type:'array',items:object({id,contactId:id,text:{type:'string'},channel:{type:'string'},status:{type:'string'}})}],
 ['whatsapp','post','/crm/whatsapp/messages','queueWhatsApp','MessageInput',object({id,status:{enum:['disabled','queued']}})],
 ['chatbot','post','/crm/chatbot','askChatbot','MessageInput',{type:'object',additionalProperties:false,required:['status'],properties:{status:{enum:['disabled','pending','replied','failed']},reason:text,text:{type:'string',maxLength:4000}}}]
];
function document(capabilities){
 const paths={'/health':{get:{operationId:'health',security:[],responses:{200:{description:'Healthy',content:{'application/json':{schema:{$ref:'#/components/schemas/Health'}}}}}}}};
 const tenant={name:'X-Tenant-Id',in:'header',required:true,schema:id};
 for(const [cap,method,url,operationId,input,output]of routes){if(!capabilities.includes(cap))continue;
  const parameters=[tenant];if(method==='post')parameters.push({name:'Idempotency-Key',in:'header',required:true,schema:id});
  const responses={200:{description:'Success',content:{'application/json':{schema:output}}}};
  for(const code of [400,401,403,404,409,413,500,503])responses[code]={description:'Request failed',content:{'application/json':{schema:{$ref:'#/components/schemas/Error'}}}};
  (paths[url]||={})[method]={operationId,tags:[cap],parameters,...(input?{requestBody:{required:true,content:{'application/json':{schema:{$ref:'#/components/schemas/'+input}}}}}:{}),responses};
 }
 if(capabilities.includes('sales')&&capabilities.includes('crm'))paths['/internal/events']={post:{operationId:'receiveSaleEvent',security:[{serviceToken:[]}],requestBody:{required:true,content:{'application/json':{schema:{$ref:'#/components/schemas/Event'}}}},responses:{200:{description:'Durably accepted',content:{'application/json':{schema:{$ref:'#/components/schemas/Ack'}}}},400:{description:'Invalid event'},401:{description:'Unauthorized'},409:{description:'Event ID conflict'}}}};
 return {openapi:'3.1.0',info:{title:'Composed business API',version:'1.0.0'},servers:[{url:'http://127.0.0.1:8080'}],security:[{tenantToken:[]}],paths,components:{securitySchemes:{tenantToken:{type:'http',scheme:'bearer'},serviceToken:{type:'http',scheme:'bearer'}},schemas}};
}
function resolve(doc,ref){if(!ref.startsWith('#/components/schemas/'))throw Error('Referencia no local.');const result=doc.components.schemas[ref.split('/').pop()];if(!result)throw Error('Referencia inexistente.');return result;}
function standalone(doc,schema){if(Array.isArray(schema))return schema.map(v=>standalone(doc,v));if(!schema||typeof schema!=='object')return schema;if(schema.$ref)return standalone(doc,resolve(doc,schema.$ref));return Object.fromEntries(Object.entries(schema).map(([k,v])=>[k,standalone(doc,v)]));}
// The OpenAPI structural schema covers the generated subset. AJV also compiles
// every body/response schema; semantic checks reject duplicate IDs/dangling refs.
function validate(doc){try{
 const check=new Ajv({strict:false,allErrors:true}).compile(require('../../schemas/composition-openapi.schema.json'));
 if(!check(doc))return {ok:false,errors:check.errors};
 const ids=new Set(),ajv=new Ajv({strict:false});
 for(const item of Object.values(doc.paths))for(const [method,op]of Object.entries(item)){
  if(!['get','post'].includes(method)||ids.has(op.operationId))throw Error('Operación duplicada o no admitida.');ids.add(op.operationId);
  for(const p of op.parameters||[])ajv.compile(standalone(doc,p.schema));
  if(op.requestBody)ajv.compile(standalone(doc,op.requestBody.content['application/json'].schema));
  for(const response of Object.values(op.responses))if(response.content)ajv.compile(standalone(doc,response.content['application/json'].schema));
 }
 for(const schema of Object.values(doc.components.schemas))ajv.compile(standalone(doc,schema));
 return {ok:true,scope:'generated-openapi-3.1-subset-and-all-payload-schemas'};
 }catch(e){return {ok:false,errors:[e.message]};}}
function interfaces(){return `// Original service boundary contracts. Money is integer minor units.\nexport interface Sale { id: string; productId: string; quantity: number; contactId: string; totalCents: number }\nexport interface SaleConfirmed { id: string; version: 1; type: 'sale.confirmed.v1'; tenantId: string; sale: Sale }\nexport interface CommercePort { createSale(tenantId: string, key: string, sale: Omit<Sale, 'id'|'totalCents'>): Promise<Sale> }\nexport interface CRMPort { receive(event: SaleConfirmed): Promise<{accepted:true}> }\nexport interface WhatsAppPort { send(input: {tenantId:string; contactId:string; text:string; idempotencyKey:string}): Promise<{status:string}> }\nexport interface ChatbotPort { reply(input: {tenantId:string; contactId:string; text:string}): Promise<{status:string; text?:string}> }\n`;}
module.exports={document,validate,standalone,interfaces,routes};
