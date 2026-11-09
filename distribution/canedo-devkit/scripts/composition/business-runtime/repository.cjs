'use strict';
const {randomUUID,createHash}=require('node:crypto');
const {fail,memo,transaction,canonical}=require('../db.cjs');
function repository(db,auth,channels,policy=null,saleReader=null){
 const get=(sql,...args)=>db.prepare(sql).get(...args),all=(sql,...args)=>db.prepare(sql).all(...args),run=(sql,...args)=>db.prepare(sql).run(...args);
 const exists=(table,t,id)=>{const value=get(`SELECT * FROM ${table} WHERE tenant_id=? AND id=?`,t,id);if(!value)fail(404,'Object not found in tenant');return value;};
 function audit(p,action,object){run('INSERT INTO business_audit VALUES(?,?,?,?,?,?)',p.tenantId,randomUUID(),p.actorId,action,object||'',Date.now());}
 function handle(p,method,route,key,x){
  const t=p.tenantId,read=method==='GET';
  function operation(){
   if(!read&&policy)policy.beforeWrite(p,route);
   let result;
   if(route==='/crm/contacts'){
    if(read)return all('SELECT id,name,phone,consent FROM contact WHERE tenant_id=? LIMIT 1000',t).map(r=>({...r,consent:!!r.consent}));
    run('INSERT INTO contact VALUES(?,?,?,?,?)',t,x.id,x.name,x.phone,Number(x.consent));result=x;
   }else if(route==='/crm/consent'){exists('contact',t,x.contactId);run('UPDATE contact SET consent=? WHERE tenant_id=? AND id=?',Number(x.consent),t,x.contactId);result={updated:true};
   }else if(route==='/crm/conversations'){
    if(read)return all('SELECT id,contact_id AS contactId,channel,assigned_actor AS actorId,status,handoff,last_inbound_at AS lastInboundAt FROM conversation WHERE tenant_id=? ORDER BY created_at DESC LIMIT 1000',t);
    exists('contact',t,x.contactId);run('INSERT INTO conversation(tenant_id,id,contact_id,channel,created_at) VALUES(?,?,?,?,?)',t,x.id,x.contactId,x.channel,Date.now());result=x;
   }else if(route==='/crm/assignment'){
    exists('conversation',t,x.conversationId);if(!auth.members(t).some(a=>a.actorId===x.actorId))fail(404,'Agent not found in tenant');
    run('UPDATE conversation SET assigned_actor=?,status=?,handoff=? WHERE tenant_id=? AND id=?',x.actorId,x.status,Number(x.handoff),t,x.conversationId);result={updated:true};
   }else if(route==='/crm/messages'){
    if(read)return all('SELECT m.id,m.contact_id AS contactId,m.text,m.channel,m.status,d.conversation_id AS conversationId,d.direction FROM message m LEFT JOIN message_detail d ON m.tenant_id=d.tenant_id AND m.id=d.message_id WHERE m.tenant_id=? ORDER BY m.rowid DESC LIMIT 1000',t);
    const c=exists('conversation',t,x.conversationId),contact=exists('contact',t,c.contact_id);if(!contact.consent)fail(403,'Contact consent required');if(c.status!=='open')fail(409,'Conversation closed');
    const mid=randomUUID();run('INSERT INTO message VALUES(?,?,?,?,?,?)',t,mid,c.contact_id,x.text,c.channel,c.channel==='internal'?'recorded':'disabled');
    run('INSERT INTO message_detail VALUES(?,?,?,?,?,?,?)',t,mid,c.id,null,'outbound',p.actorId,Date.now());result={id:mid,status:c.channel==='internal'?'recorded':'disabled'};
   }else if(route==='/crm/stages'){
    if(read)return all('SELECT id,name,position FROM pipeline_stage WHERE tenant_id=? ORDER BY position LIMIT 1000',t);
    run('INSERT INTO pipeline_stage VALUES(?,?,?,?)',t,x.id,x.name,x.position);result=x;
   }else if(route==='/crm/leads'){
    if(read)return all('SELECT id,contact_id AS contactId,stage_id AS stageId,value_cents AS valueCents FROM lead WHERE tenant_id=? LIMIT 1000',t);
    exists('contact',t,x.contactId);exists('pipeline_stage',t,x.stageId);run('INSERT INTO lead VALUES(?,?,?,?,?)',t,x.id,x.contactId,x.stageId,x.valueCents);result=x;
   }else if(route==='/crm/leads/move'){exists('lead',t,x.leadId);exists('pipeline_stage',t,x.stageId);run('UPDATE lead SET stage_id=? WHERE tenant_id=? AND id=?',x.stageId,t,x.leadId);result={updated:true};
   }else if(route==='/crm/tags'){
    if(read)return all('SELECT id,name FROM tag WHERE tenant_id=? LIMIT 1000',t);
    run('INSERT INTO tag VALUES(?,?,?)',t,x.id,x.name);result=x;
   }else if(route==='/crm/tags/assign'){exists('contact',t,x.contactId);exists('tag',t,x.tagId);run('INSERT OR IGNORE INTO contact_tag VALUES(?,?,?)',t,x.contactId,x.tagId);result={assigned:true};
   }else if(route==='/crm/segments'){return all('SELECT c.id,c.name,t.tag_id AS tagId FROM contact c JOIN contact_tag t ON c.tenant_id=t.tenant_id AND c.id=t.contact_id WHERE c.tenant_id=? LIMIT 1000',t);
   }else if(route==='/crm/knowledge'){
    if(read)return all('SELECT id,title,body FROM knowledge WHERE tenant_id=? LIMIT 1000',t);
    run('INSERT INTO knowledge VALUES(?,?,?,?)',t,x.id,x.title,x.body);result=x;
   }else if(route==='/crm/quick-replies'){
    if(read)return all('SELECT id,title,text FROM quick_reply WHERE tenant_id=? LIMIT 1000',t);
    run('INSERT INTO quick_reply VALUES(?,?,?,?)',t,x.id,x.title,x.text);result=x;
   }else if(route==='/agenda/appointments'){
    if(read)return all('SELECT id,contact_id AS contactId,resource_id AS resource,start_at AS startAt,end_at AS endAt,status FROM appointment WHERE tenant_id=? LIMIT 1000',t);
    exists('contact',t,x.contactId);if(x.endAt<=x.startAt)fail(400,'Invalid appointment interval');
    if(get("SELECT id FROM appointment WHERE tenant_id=? AND resource_id=? AND status='scheduled' AND start_at<? AND end_at>?",t,x.resource,x.endAt,x.startAt))fail(409,'Resource already booked');
    run("INSERT INTO appointment VALUES(?,?,?,?,?,?,?)",t,x.id,x.contactId,x.resource,x.startAt,x.endAt,'scheduled');result=x;
   }else if(route==='/agenda/reminders'){
    if(read)return all("SELECT id,run_at AS runAt,status,payload FROM scheduled_job WHERE tenant_id=? AND kind='reminder' LIMIT 1000",t);
    exists('appointment',t,x.appointmentId);run('INSERT INTO scheduled_job VALUES(?,?,?,?,?,?)',t,x.id,'reminder',JSON.stringify({appointmentId:x.appointmentId}),x.runAt,'pending-manual');result={id:x.id,status:'pending-manual'};
   }else if(route==='/crm/automation/rules'){
    if(read)return all('SELECT id,contains_text AS contains,tag_id AS tagId,enabled FROM automation_rule WHERE tenant_id=? LIMIT 1000',t);
    exists('tag',t,x.tagId);run('INSERT INTO automation_rule VALUES(?,?,?,?,1)',t,x.id,x.contains.toLocaleLowerCase(),x.tagId);result=x;
   }else if(route==='/crm/reports'){
    return {contacts:get('SELECT count(*) AS n FROM contact WHERE tenant_id=?',t).n,conversations:get('SELECT count(*) AS n FROM conversation WHERE tenant_id=?',t).n,messages:get('SELECT count(*) AS n FROM message WHERE tenant_id=?',t).n,leads:get('SELECT count(*) AS n FROM lead WHERE tenant_id=?',t).n};
   }else if(route==='/iam/members'){return auth.members(t);
   }else if(route==='/iam/roles'){
    const member=auth.members(t).find(a=>a.actorId===x.actorId);if(!member)fail(404,'Member not found in tenant');
    if(member.role==='admin'&&x.role!=='admin'&&auth.members(t).filter(a=>a.role==='admin').length===1)fail(409,'Cannot remove last administrator');
    run('INSERT INTO member_role VALUES(?,?,?) ON CONFLICT(tenant_id,actor_id) DO UPDATE SET role=excluded.role',t,x.actorId,x.role);result={updated:true};
   }else if(route==='/crm/audit'){return all('SELECT actor_id AS actorId,action,object_id AS objectId,created_at AS createdAt FROM business_audit WHERE tenant_id=? ORDER BY rowid DESC LIMIT 1000',t);
   }else if(route==='/crm/channels'){return channels.status();
   }else if(['/billing/payment-intents','/billing/invoice-drafts'].includes(route)){
    const kind=route.includes('payment')?'payment-intent':'invoice-draft';
    if(read)return all('SELECT id,sale_id AS saleId,total_cents AS totalCents,status FROM commercial_draft WHERE tenant_id=? AND kind=? LIMIT 1000',t,kind);
    const sale=saleReader?.(t,x.saleId);if(!sale)fail(404,'Sale not found in tenant');
    result={id:x.id,saleId:sale.id,totalCents:sale.totalCents,status:kind==='payment-intent'?'provider-disabled':'not-fiscal-draft'};
    run('INSERT INTO commercial_draft VALUES(?,?,?,?,?,?)',t,x.id,kind,sale.id,sale.totalCents,result.status);
   }else if(route==='/marketing/campaigns'){
    if(read)return all('SELECT id,name,tag_id AS tagId,body,status FROM campaign WHERE tenant_id=? LIMIT 1000',t);
    exists('tag',t,x.tagId);run('INSERT INTO campaign VALUES(?,?,?,?,?,?)',t,x.id,x.name,x.tagId,x.body,'draft-no-delivery');result={id:x.id,status:'draft-no-delivery'};
   }else if(route==='/marketing/audience'){
    const campaign=exists('campaign',t,x.campaignId);return all('SELECT c.id,c.name FROM contact c JOIN contact_tag ct ON c.tenant_id=ct.tenant_id AND c.id=ct.contact_id WHERE c.tenant_id=? AND c.consent=1 AND ct.tag_id=? LIMIT 1000',t,campaign.tag_id);
   }else if(route==='/content/drafts'){
    if(read)return all('SELECT id,title,body,status FROM content_draft WHERE tenant_id=? LIMIT 1000',t);
    run('INSERT INTO content_draft VALUES(?,?,?,?,?)',t,x.id,x.title,x.body,'manual-draft');result={id:x.id,status:'manual-draft'};
   }else fail(404,'Route not implemented');
   audit(p,route,x.id||x.contactId||x.conversationId||'');if(policy)policy.afterWrite(p,route,key);return result;
  }
  return read?operation():memo(db,t,key,route,x,operation);
 }
 function inbound(channel,account,event){
  // Called only by the verified-signature boundary; never exposed as tenant-supplied JSON.
  const {tenantId:t}=account,system={tenantId:account.tenantId,actorId:'channel-webhook'};
  if(!event||typeof event.id!=='string'||event.id.length>200||typeof event.sender!=='string'||event.sender.length>200||typeof event.text!=='string'||!event.text.length||event.text.length>4000||!Number.isSafeInteger(event.timestamp)||event.timestamp<0||event.timestamp>Date.now()+300000)fail(400,'Invalid inbound event');
  return transaction(db,()=>{
   const hash=createHash('sha256').update(canonical(event)).digest('hex'),prior=get('SELECT payload_hash FROM channel_event WHERE tenant_id=? AND channel=? AND account_id=? AND event_id=?',t,channel,account.accountId,event.id);
   if(prior){if(prior.payload_hash!==hash)fail(409,'Conflicting event replay');return {accepted:true,duplicate:true};}
   let identity=get('SELECT contact_id FROM channel_identity WHERE tenant_id=? AND channel=? AND account_id=? AND external_id=?',t,channel,account.accountId,event.sender),cid=identity?.contact_id;
   if(!cid){if(policy)policy.beforeWrite(system,'/crm/contacts');cid=randomUUID();run('INSERT INTO contact VALUES(?,?,?,?,0)',t,cid,'Channel contact',null);run('INSERT INTO channel_identity VALUES(?,?,?,?,?)',t,cid,channel,account.accountId,event.sender);if(policy)policy.afterWrite(system,'/crm/contacts',channel+':'+account.accountId+':'+event.id);}
   let conv=get("SELECT id FROM conversation WHERE tenant_id=? AND contact_id=? AND channel=? AND account_id=? AND status='open'",t,cid,channel,account.accountId)?.id;
   if(!conv){if(policy)policy.beforeWrite(system,'/crm/conversations');conv=randomUUID();run('INSERT INTO conversation(tenant_id,id,contact_id,channel,account_id,created_at) VALUES(?,?,?,?,?,?)',t,conv,cid,channel,account.accountId,Date.now());if(policy)policy.afterWrite(system,'/crm/conversations',channel+':'+account.accountId+':'+event.id);}
   run('UPDATE conversation SET last_inbound_at=MAX(last_inbound_at,?) WHERE tenant_id=? AND id=?',event.timestamp,t,conv);
   if(policy)policy.beforeWrite(system,'/crm/messages');
   const mid=randomUUID();run('INSERT INTO message VALUES(?,?,?,?,?,?)',t,mid,cid,event.text,channel,'received');run('INSERT INTO message_detail VALUES(?,?,?,?,?,?,?)',t,mid,conv,event.id,'inbound',null,Date.now());
   for(const rule of all('SELECT contains_text,tag_id FROM automation_rule WHERE tenant_id=? AND enabled=1',t))if(event.text.toLocaleLowerCase().includes(rule.contains_text))run('INSERT OR IGNORE INTO contact_tag VALUES(?,?,?)',t,cid,rule.tag_id);
   run('INSERT INTO channel_event VALUES(?,?,?,?,?)',t,channel,account.accountId,event.id,hash);if(policy)policy.afterWrite(system,'/crm/messages',channel+':'+account.accountId+':'+event.id);return {accepted:true,duplicate:false};
  });
 }
 return {handle,inbound,exists,audit};
}
module.exports={repository};
