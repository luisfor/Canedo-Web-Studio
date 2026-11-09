'use strict';
const api=require('../kit-first/service'),view=require('./context'),{digest}=require('../planner/plan');
const project={type:'string',minLength:1,maxLength:4096},ref={type:'string',pattern:'^[a-f0-9]{64}$'},maxBytes={type:'integer',minimum:2048,maximum:65536},cursor={type:'integer',minimum:0};
function definition(name,description,properties,required){return {name,description,inputSchema:{type:'object',additionalProperties:false,properties:{project,...properties},required:['project',...required]},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}};}
const definitions=[
 definition('kit_context','Resumen técnico local; caché derivada en memoria, sin modelos ni generación.',{maxBytes,full:{type:'boolean'}},[]),
 definition('kit_catalog_page','Catálogo técnico paginado; no carga ejemplos comerciales.',{contextId:ref,cursor,limit:{type:'integer',minimum:1,maximum:100},filter:{type:'string',maxLength:100},maxBytes},['contextId']),
 definition('kit_evidence_chunk','Evidencia completa bajo demanda por fragmentos JSON verificables.',{contextId:ref,cursor,maxBytes},['contextId']),
 definition('kit_technical_plan','Plan universal local con referencia de contexto y KIT-FIRST fresco; devuelve resumen.',{contextId:ref,text:{type:'string',minLength:3,maxLength:4000},maxBytes},['contextId','text']),
 definition('kit_plan_chunk','Plan completo bajo demanda; no autoriza ejecución.',{planId:ref,cursor,maxBytes},['planId']),
 definition('kit_static_validate','Validación local fresca de JSON y sintaxis CJS; no ejecuta código del proyecto.',{maxBytes},[]),
 definition('kit_validation_chunk','Informe estático completo por fragmentos verificables.',{validationId:ref,cursor,maxBytes},['validationId']),
 definition('kit_memory_summary','Resumen de memoria vigente, sin reenviar historial completo.',{maxBytes},[]),
 definition('kit_memory_page','Decisiones y dependencias de memoria por páginas.',{collection:{enum:['decisions','dependencies','modules']},cursor,limit:{type:'integer',minimum:1,maximum:100},maxBytes},['collection']),
 definition('kit_efficiency','Contadores locales; no estima tokens de agentes externos.',{maxBytes},[])
];
function session({maxContextBytes=8192}={}){view.budget(maxContextBytes);const contexts=new Map(),plans=new Map(),reports=new Map();let calls=0,outputBytes=0;const model=require('./usage').ledger();
 const remember=(map,id,value)=>{if(map.size>=32)map.delete(map.keys().next().value);map.set(id,value);};
 const context=(id,target)=>{const c=contexts.get(id);if(!c||c.target!==target)throw Error('Descubre el contexto en esta conexión y ámbito.');return c;};
 function call(name,input){const args={...input,maxBytes:Math.min(input.maxBytes||maxContextBytes,maxContextBytes)};let result;const target=args.project;
  if(name==='kit_context'){const r=api.discoverEfficient({destination:target,cache:'memory',full:args.full===true});remember(contexts,r.evidence.evidenceId,{target,...r});result={...view.summary(r.evidence,{maxBytes:args.maxBytes}),contextId:r.evidence.evidenceId,work:r.metrics};}
  else if(name==='kit_catalog_page'){const c=context(args.contextId,target);api.requireTechnicalCurrent(c.evidence,target);result=view.page(c.evidence.discovery.catalogs.tools.tools.map(t=>({id:t.id,label:t.label,kind:t.kind,availability:t.availability,dependencies:t.dependencies.map(d=>d.id),policy:t.versionPolicy.state})),args);}
  else if(name==='kit_evidence_chunk'){const c=context(args.contextId,target);api.requireTechnicalCurrent(c.evidence,target);result=view.chunk(c.evidence,args);}
  else if(name==='kit_technical_plan'){const c=context(args.contextId,target),p=require('../terminal/technical').prepare(args.text,{destination:target,evidence:c.evidence,forced:true});remember(plans,p.planId,{target,plan:p});result={planId:p.planId,kind:p.kind,status:p.status,domains:p.requirements.domains,questions:p.questions,limitations:p.limitations,tools:p.resources.selected,fullPlanAvailable:true,executionAllowed:false};}
  else if(name==='kit_plan_chunk'){const p=plans.get(args.planId);if(!p||p.target!==target)throw Error('Plan no emitido en esta conexión.');if(!require('../terminal/technical').validate(p.plan,target).ok)throw Error('Plan desactualizado.');result=view.chunk(p.plan,args);}
  else if(name==='kit_static_validate'){const r=require('../workspace/static-validation').validate(target),id=digest(r);remember(reports,id,{target,report:r});result={...r,checks:r.checks.slice(0,10),pending:r.pending.slice(0,10),totalChecks:r.checks.length,totalPending:r.pending.length,validationId:id};}
  else if(name==='kit_validation_chunk'){const r=reports.get(args.validationId);if(!r||r.target!==target)throw Error('Informe no emitido en esta conexión.');if(api.inspect(target).inspectionId!==r.report.inspectionId)throw Error('Informe desactualizado.');result=view.chunk(r.report,args);}
  else if(name==='kit_memory_summary')result=require('../memory/checkpoint').summary(target);
  else if(name==='kit_memory_page')result=view.page(require('../memory/store').read(target)[args.collection],args);
  else if(name==='kit_efficiency')result={calls,outputBytes,models:model.snapshot(),contextEntries:contexts.size,planEntries:plans.size,maxResponseBytes:maxContextBytes,scope:'this-connection-only; budget-per-response',externalClientTokens:'unknown'};
  else throw Error('Herramienta progresiva desconocida.');
  view.bounded(result,args.maxBytes);calls++;outputBytes+=view.bytes(result);return result;
 }
 return {call};
}
module.exports={definitions,session};
