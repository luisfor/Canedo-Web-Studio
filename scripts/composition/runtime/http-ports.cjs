'use strict';
const contract=require('../contracts/openapi.json'),{valid}=require('./validate.cjs');
function endpoint(baseUrl){const url=new URL(baseUrl);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Configure an explicit HTTP(S) service origin without credentials');return url;}
async function post(origin,route,headers,input,inputSchema,outputSchema){
 if(!valid(input,inputSchema,contract))throw Error('Outgoing service contract invalid');
 const response=await fetch(new URL(route,origin),{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(2000),redirect:'error'});
 if(!response.ok)throw Error('Remote service rejected request ('+response.status+')');const result=await response.json();if(!valid(result,outputSchema,contract))throw Error('Remote service response violated contract');return result;
}
// Remote implementations may use any language, but must implement the reviewed
// contract. Existing repository APIs are not assumed to be compatible.
function crmPort({baseUrl,serviceToken}){const origin=endpoint(baseUrl);return {receive(event){return post(origin,'/internal/events',{authorization:'Bearer '+serviceToken},event,contract.components.schemas.Event,contract.components.schemas.Ack);}};}
function commercePort({baseUrl,tokens}){const origin=endpoint(baseUrl);return {createSale(tenantId,key,input){
 if(!Object.hasOwn(tokens,tenantId)||!/^[A-Za-z0-9_-]{1,80}$/.test(tenantId)||!/^[A-Za-z0-9_-]{1,80}$/.test(key))throw Error('Missing scoped service credentials or idempotency key');
 return post(origin,'/sales',{authorization:'Bearer '+tokens[tenantId],'x-tenant-id':tenantId,'idempotency-key':key},input,contract.components.schemas.SaleInput,contract.components.schemas.Sale);
 }};}
module.exports={crmPort,commercePort};
