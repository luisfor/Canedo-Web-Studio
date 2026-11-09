'use strict';
const path=require('node:path'),api=require('../kit-first/service'),view=require('./context');
function parse(args){const action=args.shift(),options={};if(!['benchmark','context','catalog','evidence','cache-inspect','cache-clear','validate','checkpoint','memory-summary','memory-page'].includes(action))throw Error('Acción de eficiencia desconocida.');
 while(args.length){const key=args.shift();if(['--full','--syntax','--json'].includes(key)){if(options[key.slice(2)])throw Error('Opción duplicada.');options[key.slice(2)]=true;}else if(['--project','--cache','--max-bytes','--cursor','--limit','--filter','--context','--collection','--confirm'].includes(key)&&args.length){if(options[key.slice(2)]!==undefined||args[0].startsWith('--'))throw Error('Opción inválida.');options[key.slice(2)]=args.shift();}else throw Error('Opción no admitida.');}
 if(!options.project&&action!=='benchmark')throw Error('Indica --project explícito.');
 const allowed={benchmark:[],context:['cache','full','max-bytes'],catalog:['cursor','limit','filter','max-bytes','context'],evidence:['cursor','max-bytes','context'],'cache-inspect':[],'cache-clear':[],validate:['syntax','max-bytes','full'],checkpoint:['syntax','confirm','max-bytes'],'memory-summary':['max-bytes'],'memory-page':['collection','cursor','limit','max-bytes']}[action];
 if(Object.keys(options).some(k=>!['project','json'].includes(k)&&!allowed.includes(k)))throw Error('Opciones ajenas a la acción.');
 for(const key of ['max-bytes','cursor','limit'])if(options[key]!==undefined){if(!/^\d+$/.test(options[key]))throw Error('Número inválido.');options[key]=Number(options[key]);}view.budget(options['max-bytes']);return {action,options};
}
function dispatch({action,options:o}){if(action==='benchmark')return require('./benchmark').benchmark();const root=path.resolve(o.project),paging={maxBytes:o['max-bytes'],cursor:o.cursor,limit:o.limit,filter:o.filter};
 if(action==='cache-inspect')return require('../kit-first/cache').inspect(root);
 if(action==='cache-clear')return require('../kit-first/cache').clear(root);
 if(action==='memory-summary')return view.bounded(require('../memory/checkpoint').summary(root),o['max-bytes']);
 if(action==='memory-page'){if(!['decisions','dependencies','modules'].includes(o.collection))throw Error('Colección inválida.');return view.page(require('../memory/store').read(root)[o.collection],paging);}
 if(action==='validate'){const r=require('../workspace/static-validation').validate(root,{syntax:o.syntax});return o.full?r:view.bounded({...r,checks:r.checks.slice(0,10),pending:r.pending.slice(0,10),totalChecks:r.checks.length,totalPending:r.pending.length},o['max-bytes']);}
 if(action==='checkpoint'){if(o.confirm!==api.inspect(root).inspectionId)throw Error('Confirma el inspectionId actual para registrar metadata.');const r=require('../memory/checkpoint').checkpoint(root,{syntax:o.syntax});return view.bounded({ok:r.ok,manifestId:r.manifestId,revision:r.revision,scope:r.scope,sourceFilesModified:r.sourceFilesModified,validationStatus:r.validation.status,inspectionId:r.validation.inspectionId},o['max-bytes']);}
 const r=api.discoverEfficient({destination:root,cache:action==='context'?(o.cache||'memory'):'off',full:o.full});if(o.context&&o.context!==r.evidence.evidenceId)throw Error('Contexto desactualizado.');
 if(action==='context')return view.bounded({...view.summary(r.evidence,paging),contextId:r.evidence.evidenceId,work:r.metrics},o['max-bytes']);
 if(action==='evidence')return view.chunk(r.evidence,paging);
 return view.page(r.evidence.discovery.catalogs.tools.tools.map(t=>({id:t.id,label:t.label,kind:t.kind,availability:t.availability,dependencies:t.dependencies.map(d=>d.id)})),paging);
}
function main(args){try{const result=dispatch(parse([...args]));console.log(JSON.stringify(result,null,2));if(result.ok===false)process.exitCode=1;}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={parse,dispatch,main};
