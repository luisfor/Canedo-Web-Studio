'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{randomBytes,createHmac}=require('node:crypto'),{adapter}=require('../../scripts/composition/business-runtime/channels.cjs');
for(const channel of ['whatsapp','messenger','instagram'])test(channel+': disabled by default; authorized signed text fixture maps only its configured account',()=>{
 const disabled=adapter(channel);assert.equal(disabled.status().inbound,'disabled');assert.equal(disabled.status().outbound,'disabled');assert.throws(()=>disabled.parse(Buffer.from('{}'),'sha256='+'0'.repeat(64)));
 const config={authorizeWebhooks:true,appSecret:randomBytes(32).toString('hex'),verifyToken:randomBytes(32).toString('hex'),accounts:[{tenantId:'tenant',accountId:'123'}]},port=adapter(channel,config),now=Date.now();
 const payload=channel==='whatsapp'?{entry:[{changes:[{value:{metadata:{phone_number_id:'123'},messages:[{id:'m1',from:'456',type:'text',timestamp:String(Math.floor(now/1000)),text:{body:'Hola'}}]}}]}]}:{entry:[{id:'123',messaging:[{sender:{id:'456'},recipient:{id:'123'},timestamp:now,message:{mid:'m1',text:'Hola'}},{sender:{id:'123'},recipient:{id:'456'},timestamp:now,message:{mid:'echo',text:'Echo',is_echo:true}}]}]};
 const raw=Buffer.from(JSON.stringify(payload)),signature='sha256='+createHmac('sha256',config.appSecret).update(raw).digest('hex'),events=port.parse(raw,signature);assert.equal(events.length,1);assert.equal(events[0].account.tenantId,'tenant');assert.equal(events[0].event.text,'Hola');assert.equal(events[0].event.sender,'456');assert.equal(port.status().liveVerified,false);
 assert.throws(()=>port.parse(Buffer.concat([raw,Buffer.from(' ')]),signature));const empty=Buffer.from(JSON.stringify({entry:[{id:'other',messaging:[]}]}));assert.deepEqual(port.parse(empty,'sha256='+createHmac('sha256',config.appSecret).update(empty).digest('hex')),[]);
 assert.equal(port.challenge(new URLSearchParams({'hub.mode':'subscribe','hub.verify_token':config.verifyToken,'hub.challenge':'123'})),'123');assert.equal(port.challenge(new URLSearchParams({'hub.mode':'subscribe','hub.verify_token':'wrong','hub.challenge':'123'})),null);
});
test('TikTok never invents approved API access or accepts an operational flag',async()=>{
 const port=adapter('tiktok');assert.equal(port.status().liveVerified,false);assert.equal((await port.send()).status,'disabled');assert.throws(()=>adapter('tiktok',{verified:true}));
});
