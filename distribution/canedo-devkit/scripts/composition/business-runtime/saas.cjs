'use strict';
const {memo,fail}=require('../db.cjs');
const METRICS=['contacts','messages','conversations','aiCalls'];
function saas(db,auth){
 const get=(sql,...a)=>db.prepare(sql).get(...a),all=(sql,...a)=>db.prepare(sql).all(...a),run=(sql,...a)=>db.prepare(sql).run(...a);
 const period=()=>new Date().toISOString().slice(0,7);
 function entitlement(t){const sub=get('SELECT s.plan_id AS planId,s.status,s.valid_until AS validUntil,p.limits FROM subscription s JOIN saas_plan p ON s.tenant_id=p.tenant_id AND s.plan_id=p.id WHERE s.tenant_id=?',t);if(!sub)return null;return {...sub,limits:JSON.parse(sub.limits)};}
 function requireActive(t){const s=entitlement(t);if(!s||!['active','trialing'].includes(s.status)||s.validUntil<=Date.now())fail(403,'Subscription inactive or expired');if(auth.members(t).length>s.limits.seats)fail(403,'Configured members exceed seat entitlement');return s;}
 function used(t,metric,p=period()){return get('SELECT COALESCE(SUM(quantity),0) AS n FROM usage_event WHERE tenant_id=? AND metric=? AND period=?',t,metric,p).n;}
 const metric=route=>({'/crm/contacts':'contacts','/crm/conversations':'conversations','/crm/messages':'messages','/crm/chatbot':'aiCalls'})[route];
 function beforeWrite(p,route){const s=requireActive(p.tenantId),m=metric(route);if(m&&used(p.tenantId,m)>=s.limits[m])fail(429,'Project plan quota exceeded');}
 function afterWrite(p,route,key){const m=metric(route);if(!m)return;run('INSERT INTO usage_event VALUES(?,?,?,?,1)',p.tenantId,route+':'+key,m,period());const n=used(p.tenantId,m),limit=entitlement(p.tenantId).limits[m];if(n>=Math.ceil(limit*0.8))run('INSERT OR IGNORE INTO usage_alert VALUES(?,?,?,80)',p.tenantId,m,period());}
 function handle(p,method,route,key,x){
  const t=p.tenantId;
  if(method==='GET'){
   if(route==='/saas/plans')return all('SELECT id,name,limits FROM saas_plan WHERE tenant_id=? LIMIT 1000',t).map(p=>({...p,limits:JSON.parse(p.limits)}));
   if(route==='/saas/subscription')return entitlement(t)||{status:'not-configured'};
   if(route==='/saas/usage')return {period:period(),metrics:Object.fromEntries(METRICS.map(m=>[m,used(t,m)])),alerts:all('SELECT metric,period,threshold FROM usage_alert WHERE tenant_id=? AND period=?',t,period())};
  }
  if(!p.platformAdmin)fail(403,'Platform operator authorization required');
  return memo(db,t,key,route,x,()=>{
   if(route==='/saas/plans'){
    if(get('SELECT tenant_id FROM subscription WHERE tenant_id=? AND plan_id=?',t,x.id))fail(409,'Subscribed plan is immutable; create a new plan');
    run('INSERT INTO saas_plan VALUES(?,?,?,?)',t,x.id,x.name,JSON.stringify(x.limits));
   }else if(route==='/saas/subscription'){
    const plan=get('SELECT limits FROM saas_plan WHERE tenant_id=? AND id=?',t,x.planId);if(!plan)fail(404,'Plan not found in tenant');const limits=JSON.parse(plan.limits);
    if(auth.members(t).length>limits.seats)fail(409,'Configured members exceed plan seats');
    if(METRICS.some(m=>used(t,m)>limits[m]))fail(409,'Consumption exceeds proposed plan');
    run('INSERT INTO subscription VALUES(?,?,?,?) ON CONFLICT(tenant_id) DO UPDATE SET plan_id=excluded.plan_id,status=excluded.status,valid_until=excluded.valid_until',t,x.planId,x.status,x.validUntil);
   }else fail(404,'Unknown SaaS operation');
   run('INSERT INTO business_audit VALUES(?,?,?,?,?,?)',t,require('node:crypto').randomUUID(),p.actorId,route,x.id||x.planId,Date.now());return {updated:true};
  });
 }
 return {beforeWrite,afterWrite,handle,entitlement,requireActive};
}
module.exports={saas};
