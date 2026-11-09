'use strict';
// No fetch, SDK, credentials or external side effects in the default adapters.
function adapters({allowExternalAdapters=false,whatsapp,chatbot}={}){
 if((whatsapp||chatbot)&&!allowExternalAdapters)throw Error('External adapters require explicit configuration and authorization');
 if(whatsapp&&typeof whatsapp.send!=='function'||chatbot&&typeof chatbot.reply!=='function')throw Error('Invalid adapter interface');
 function wrap(port,method){const enabled=port?.enabled===true;return {enabled,async [method](input){
  if(!enabled)return {status:'disabled',reason:'Configure an explicitly authorized adapter'};
  const timeoutMs=port.timeoutMs??5000;if(!Number.isInteger(timeoutMs)||timeoutMs<10||timeoutMs>30000)throw Error('Invalid adapter timeout');
  const controller=new AbortController();let timer;
  try{return await Promise.race([Promise.resolve().then(()=>port[method]({...input,signal:controller.signal})),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Adapter timeout'));},timeoutMs);})]);}finally{clearTimeout(timer);}
 }};}
 return {whatsapp:wrap(whatsapp,'send'),chatbot:wrap(chatbot,'reply')};
}
module.exports={adapters};
