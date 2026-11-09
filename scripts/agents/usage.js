'use strict';
// No provider is installed or called here. Metrics are attributed explicitly.
function ledger(){const events=[];return {
 record({provider,operation='interpret',usage=null,estimate=null}){
  if(typeof provider!=='string'||!/^[a-z][a-z0-9-]{0,63}$/.test(provider)||!['interpret','validation','planning'].includes(operation))throw Error('Métrica sin procedencia válida.');
  const valid=u=>u&&Object.keys(u).sort().join(',')==='inputTokens,outputTokens'&&Object.values(u).every(n=>Number.isSafeInteger(n)&&n>=0);
  if(usage&&!valid(usage)||estimate&&(!valid(estimate.tokens)||typeof estimate.method!=='string'||! /^[a-z0-9-]{1,64}$/.test(estimate.method))||usage&&estimate)throw Error('Métricas inválidas o ambiguas.');
  const event={provider,operation,consumption:usage?'measured':estimate?'estimated':'unknown',...(usage?{tokens:usage,source:'provider-reported'}:estimate?{tokens:estimate.tokens,method:estimate.method}:{} )};if(events.length>=1000)throw Error('Límite de registro de métricas; exportar antes de continuar.');events.push(event);return event;
 },snapshot(){return {calls:events.length,events:structuredClone(events),measuredTokens:events.filter(e=>e.consumption==='measured').reduce((s,e)=>s+e.tokens.inputTokens+e.tokens.outputTokens,0),unknownCalls:events.filter(e=>e.consumption==='unknown').length,estimatedCalls:events.filter(e=>e.consumption==='estimated').length,savings:'not-asserted'};}
};}
module.exports={ledger};
