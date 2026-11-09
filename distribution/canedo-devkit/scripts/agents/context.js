'use strict';
const {digest}=require('../planner/plan');
function bytes(value){return Buffer.byteLength(JSON.stringify(value));}
function budget(value=8192){if(!Number.isSafeInteger(value)||value<2048||value>65536)throw Error('Presupuesto de salida: 2048–65536 bytes.');return value;}
function bounded(value,maxBytes){if(bytes(value)>budget(maxBytes))throw Error('La respuesta supera el presupuesto; solicita una página o un fragmento de evidencia. No se omiten controles.');return value;}
function page(rows,{cursor=0,limit=20,maxBytes=8192,filter}={}){
 budget(maxBytes);if(!Number.isSafeInteger(cursor)||cursor<0||!Number.isSafeInteger(limit)||limit<1||limit>100||filter!==undefined&&(typeof filter!=='string'||filter.length>100))throw Error('Paginación inválida.');
 const selected=filter?rows.filter(r=>JSON.stringify(r).toLowerCase().includes(filter.toLowerCase())):rows,items=[];let position=cursor;
 for(;position<selected.length&&items.length<limit;position++){const next={items:[...items,selected[position]],nextCursor:position+1,total:selected.length};if(bytes(next)>maxBytes-256)break;items.push(selected[position]);}
 if(!items.length&&position<selected.length)throw Error('Un elemento supera el presupuesto; usa fragmentos de evidencia.');
 return bounded({items,nextCursor:position<selected.length?position:null,total:selected.length},maxBytes);
}
function chunk(value,{cursor=0,maxBytes=8192}={}){
 budget(maxBytes);const encoded=JSON.stringify(value);if(!Number.isSafeInteger(cursor)||cursor<0||cursor>encoded.length)throw Error('Cursor inválido.');
 let end=Math.min(encoded.length,cursor+Math.floor((maxBytes-1024)/8));if(end<encoded.length&&/[\uD800-\uDBFF]/.test(encoded[end-1]))end--;
 return bounded({encoding:'json-utf16-offset',digest:digest(value),cursor,nextCursor:end<encoded.length?end:null,fragment:encoded.slice(cursor,end),totalCharacters:encoded.length},maxBytes);
}
function summary(evidence,{maxBytes=8192}={}){
 const i=evidence.inspection,groups={};for(const s of i.signals){if(!groups[s.category])groups[s.category]=new Set();groups[s.category].add(s.id);}
 return bounded({kind:'kit-context-summary',evidenceId:evidence.evidenceId,kit:evidence.discovery.kit,scenario:i.scenario,complete:i.complete,inspectionId:i.inspectionId,files:i.files.length,stack:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,[...v].slice(0,25)])),limitationCount:i.limitations.length,limitations:i.limitations.slice(0,10),fullEvidenceAvailable:true,generationAllowed:false,modelCalls:0,scope:'static-observations-not-functionality-certification'},maxBytes);
}
module.exports={bytes,budget,bounded,page,chunk,summary};
