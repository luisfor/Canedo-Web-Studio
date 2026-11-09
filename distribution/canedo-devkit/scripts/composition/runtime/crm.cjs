'use strict';
const {randomUUID}=require('node:crypto');
const {memo,fail,transaction,canonical}=require('./db.cjs');
function crm(db,ports){
 function handle(tenant,key,operation,input){
  if(operation==='listContacts')return db.prepare('SELECT id,name,phone,consent FROM contact WHERE tenant_id=? ORDER BY id LIMIT 1000').all(tenant).map(x=>({...x,consent:!!x.consent}));
  if(operation==='listMessages')return db.prepare('SELECT id,contact_id AS contactId,text,channel,status FROM message WHERE tenant_id=? ORDER BY rowid LIMIT 1000').all(tenant);
  if(operation==='askChatbot')return ask(tenant,key,input);
  return memo(db,tenant,key,operation,input,()=>{
   if(operation==='createContact'){db.prepare('INSERT INTO contact VALUES(?,?,?,?,?)').run(tenant,input.id,input.name,input.phone,Number(input.consent));return input;}
   const contact=db.prepare('SELECT * FROM contact WHERE tenant_id=? AND id=?').get(tenant,input.contactId);if(!contact)fail(404,'Contact not found');
   if(operation==='queueWhatsApp'){
    if(!contact.consent)fail(403,'Explicit contact consent is required');
    const id=randomUUID(),status=ports.whatsapp.enabled===true?'queued':'disabled';
    db.prepare('INSERT INTO message VALUES(?,?,?,?,?,?)').run(tenant,id,input.contactId,input.text,'whatsapp',status);return {id,status};
   }
   fail(404,'Unknown CRM operation');
  });
 }
 async function ask(tenant,key,input){
  const contact=db.prepare('SELECT * FROM contact WHERE tenant_id=? AND id=?').get(tenant,input.contactId);if(!contact)fail(404,'Contact not found');
  const previous=db.prepare('SELECT * FROM receipt WHERE tenant_id=? AND key=?').get(tenant,key);
  if(previous){if(previous.operation!=='askChatbot'||previous.request!==canonical(input))fail(409,'Idempotency key reused with different request');return JSON.parse(previous.result);}
  if(ports.chatbot.enabled!==true)return memo(db,tenant,key,'askChatbot',input,()=>({status:'disabled',reason:'Configure an explicitly authorized chatbot adapter'}));
  if(!contact.consent)fail(403,'Explicit contact consent is required');
  memo(db,tenant,key,'askChatbot',input,()=>({status:'pending'}));let result;
  try{const reply=await ports.chatbot.reply({tenantId:tenant,...input,idempotencyKey:key,signal:AbortSignal.timeout(5000)});if(reply?.status!=='replied'||typeof reply.text!=='string'||reply.text.length>4000)throw Error('Invalid adapter result');result={status:'replied',text:reply.text};}
  catch{result={status:'failed',reason:'Adapter failed; reconcile before issuing a new request'};}
  db.prepare('UPDATE receipt SET result=? WHERE tenant_id=? AND key=?').run(JSON.stringify(result),tenant,key);return result;
 }
 function receive(event){return transaction(db,()=>{
  const payload=canonical(event),previous=db.prepare('SELECT payload FROM inbox WHERE tenant_id=? AND id=?').get(event.tenantId,event.id);
  if(previous){if(previous.payload!==payload)fail(409,'Event ID reused with different payload');return {accepted:true};}
  db.prepare('INSERT INTO inbox VALUES(?,?,?)').run(event.tenantId,event.id,payload);
  db.prepare('INSERT INTO message VALUES(?,?,?,?,?,?)').run(event.tenantId,event.id,event.sale.contactId,'Sale '+event.sale.id+' total '+event.sale.totalCents,'internal','recorded');
  return {accepted:true};
 });}
 async function dispatchWhatsApp(){
  if(ports.whatsapp.enabled!==true)return {status:'disabled',sent:0};let sent=0;
  for(const row of db.prepare("SELECT * FROM message WHERE channel='whatsapp' AND status='queued' ORDER BY rowid LIMIT 100").all()){
   const contact=db.prepare('SELECT consent FROM contact WHERE tenant_id=? AND id=?').get(row.tenant_id,row.contact_id);
   if(!contact?.consent)continue;
   const result=await ports.whatsapp.send({tenantId:row.tenant_id,contactId:row.contact_id,text:row.text,idempotencyKey:row.id});
   if(result?.status==='sent'){db.prepare("UPDATE message SET status='sent' WHERE tenant_id=? AND id=?").run(row.tenant_id,row.id);sent++;}
  }return {sent};
 }
 async function reply(input){const contact=db.prepare('SELECT id,consent FROM contact WHERE tenant_id=? AND id=?').get(input.tenantId,input.contactId);if(!contact)fail(404,'Contact not found');if(ports.chatbot.enabled!==true)return {status:'disabled',reason:'Configure an explicitly authorized chatbot adapter'};if(!contact.consent)fail(403,'Explicit contact consent is required');return ports.chatbot.reply(input);}
 return {handle,receive,dispatchWhatsApp,reply};
}
module.exports={crm};
