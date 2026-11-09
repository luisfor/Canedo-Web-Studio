'use strict';
const {createHmac,timingSafeEqual}=require('node:crypto');
const NAMES=['whatsapp','messenger','instagram','tiktok'];
function adapter(channel,config){
 if(!NAMES.includes(channel))throw Error('Unknown channel');
 if(config&&(channel==='tiktok'||config.authorizeWebhooks!==true||typeof config.appSecret!=='string'||config.appSecret.length<32||typeof config.verifyToken!=='string'||config.verifyToken.length<32||!Array.isArray(config.accounts)||config.accounts.some(a=>!a||! /^[A-Za-z0-9_-]{1,80}$/.test(a.tenantId)||! /^\d{1,100}$/.test(a.accountId))||new Set(config.accounts.map(a=>a.accountId)).size!==config.accounts.length))throw Error('Explicit compatible webhook configuration required');
 function status(){return {channel,inbound:config?'configured-unverified-live':'disabled',outbound:'disabled',liveVerified:false,reason:channel==='tiktok'?'Business Messaging access and specification not verified':'Provider permissions, application review and live delivery not verified'};}
 function authenticate(raw,signature){
  if(!config||typeof signature!=='string'||!/^sha256=[a-f0-9]{64}$/.test(signature))return false;
  const expected=createHmac('sha256',config.appSecret).update(raw).digest(),actual=Buffer.from(signature.slice(7),'hex');return timingSafeEqual(expected,actual);
 }
 function challenge(query){
  if(!config||query.get('hub.mode')!=='subscribe')return null;
  const given=Buffer.from(query.get('hub.verify_token')||''),expected=Buffer.from(config.verifyToken),value=query.get('hub.challenge');
  return expected.length===given.length&&timingSafeEqual(given,expected)&&typeof value==='string'&&/^\d{1,100}$/.test(value)?value:null;
 }
 function parse(raw,signature){
  if(!authenticate(raw,signature)){const e=Error('Invalid signature or disabled webhook');e.status=401;throw e;}
  let payload;try{payload=JSON.parse(raw.toString('utf8'));}catch{const e=Error('Invalid webhook JSON');e.status=400;throw e;}
  const result=[];
  for(const entry of payload.entry||[]){
   if(channel==='whatsapp')for(const change of entry.changes||[]){const value=change.value||{},account=config.accounts.find(a=>a.accountId===value.metadata?.phone_number_id);if(!account)continue;
    for(const m of value.messages||[])if(m.type==='text')result.push({account,event:{id:m.id,sender:m.from,text:m.text?.body,timestamp:Number(m.timestamp)*1000}});
   }else{const account=config.accounts.find(a=>a.accountId===String(entry.id));if(!account)continue;
    for(const m of entry.messaging||[])if(m.message?.text&&!m.message.is_echo&&String(m.recipient?.id)===account.accountId)result.push({account,event:{id:m.message.mid,sender:m.sender?.id,text:m.message.text,timestamp:m.timestamp}});
   }
  }
  return result;
 }
 return {status,challenge,parse,async send(){return {status:'disabled',liveVerified:false};}};
}
function channels(config={}){
 if(!config||typeof config!=='object'||Object.keys(config).some(k=>!NAMES.includes(k)))throw Error('Unknown channel configuration');
 const ports=Object.fromEntries(NAMES.map(name=>[name,adapter(name,config[name])]));
 return {ports,status:()=>Object.values(ports).map(p=>p.status())};
}
module.exports={adapter,channels};
