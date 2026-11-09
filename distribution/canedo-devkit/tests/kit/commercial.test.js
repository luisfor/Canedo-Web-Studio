'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const registry=require('../../scripts/commercial/catalog');
test('commercial catalog contains the twenty requested packages with explicit states, scope and acceptance',()=>{
 const value=registry.list();assert.equal(value.packages.length,20);assert.equal(registry.validate(registry.read()).ok,true);for(const p of value.packages){assert.ok(p.status);assert.ok(p.acceptance.length);assert.ok(p.security.length);assert.ok(p.operationalRequirements.length);assert.ok(p.monetization.length);assert.ok(p.integrations.every(i=>i.state==='disabled'));}
 assert.equal(registry.show('inventory').status,'partial');assert.equal(registry.show('crm-omnichannel').status,'partial');assert.ok(registry.show('crm-omnichannel').generatorSupport.supportedModules.includes('messenger'));
});
test('availability, live integration and partial implementation claims require actual evidence and test files',()=>{
 const available=registry.read();available.packages[0].status='available';assert.equal(registry.validate(available).ok,false);
 const live=registry.read();live.packages[0].integrations[0].state='verified';assert.equal(registry.validate(live).ok,false);
 const partial=registry.read();partial.packages[0].tests=[];assert.equal(registry.validate(partial).ok,false);
 const missing=registry.read();missing.packages[0].tests=['../outside.js'];assert.equal(registry.validate(missing).ok,false);
});
test('new commercial records are data extensions without changing the core or enabling execution',()=>{
 const template=registry.read().packages.find(p=>p.status==='planned'),extension={schemaVersion:1,version:'1.0.0',packages:[{...template,id:'new-business',name:'Additional business package'}]};assert.equal(registry.list(extension).packages.length,21);assert.equal(registry.show('new-business',extension).status,'planned');assert.throws(()=>registry.read({...extension,command:'execute'}));assert.throws(()=>registry.show('unknown'));
});
