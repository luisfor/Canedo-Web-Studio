'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{randomBytes}=require('node:crypto');
const {createBusinessApp}=require('../src/business/app.cjs'),{migrateBusiness}=require('../src/business/migrate.cjs');
test('SaaS provisions operator-only plans, enforces transactional quotas, UTC usage and tenant isolation',async t=>{
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'saas-test-'));migrateBusiness(dataDir);
 const actors=[{tenantId:'a',actorId:'operator',role:'admin',platformAdmin:true,token:randomBytes(32).toString('hex')},{tenantId:'a',actorId:'owner',role:'admin',token:randomBytes(32).toString('hex')},{tenantId:'b',actorId:'operator',role:'admin',platformAdmin:true,token:randomBytes(32).toString('hex')}];
 let app=createBusinessApp({dataDir,actors});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await app.close();fs.rmSync(dataDir,{recursive:true,force:true});});
 async function api(route,x,who=0,key=randomBytes(8).toString('hex')){const actor=actors[who],r=await fetch('http://127.0.0.1:'+app.server.address().port+route,{method:x?'POST':'GET',headers:{'content-type':'application/json','x-tenant-id':actor.tenantId,authorization:'Bearer '+actor.token,'idempotency-key':key},...(x?{body:JSON.stringify(x)}:{})});return {status:r.status,body:await r.json()};}
 const plan={id:'starter',name:'Inicial',limits:{contacts:2,messages:2,conversations:2,aiCalls:1,seats:2}},sub={planId:'starter',status:'active',validUntil:Date.now()+86400000},contact={id:'c',name:'Demo',phone:null,consent:true};
 assert.equal((await api('/crm/contacts',contact)).status,403);
 assert.equal((await api('/saas/plans',plan,1)).status,403);assert.equal((await api('/saas/plans',plan)).status,200);assert.equal((await api('/saas/subscription',sub)).status,200);
 assert.equal((await api('/saas/subscription',{...sub,planId:'starter'},2)).status,404);
 assert.equal((await api('/crm/contacts',contact,1,'c')).status,200);assert.equal((await api('/crm/contacts',contact,1,'c')).status,200);
 assert.equal((await api('/saas/usage')).body.metrics.contacts,1);
 const results=await Promise.all(['c2','c3'].map(id=>api('/crm/contacts',{...contact,id},1,id)));assert.deepEqual(results.map(r=>r.status).sort(),[200,429]);
 assert.equal((await api('/crm/contacts')).body.length,2);assert.equal((await api('/saas/usage')).body.metrics.contacts,2);assert.equal((await api('/saas/usage')).body.alerts.length,1);
 assert.equal((await api('/saas/usage',null,2)).body.metrics.contacts,0);assert.equal((await api('/saas/plans',plan)).status,409);
 assert.equal((await api('/saas/subscription',{...sub,status:'suspended'})).status,200);assert.equal((await api('/crm/contacts',{...contact,id:'c4'})).status,403);
 // Restart: entitlement, consumption and receipts survive; no implicit reset.
 await app.close();app=createBusinessApp({dataDir,actors});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));assert.equal((await api('/saas/usage')).body.metrics.contacts,2);assert.equal((await api('/saas/subscription')).body.status,'suspended');
});
