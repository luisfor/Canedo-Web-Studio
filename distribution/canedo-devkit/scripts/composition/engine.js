'use strict';
const {canonical,digest}=require('../planner/plan'),io=require('../workspace/files');
const planner=require('./planner'),contracts=require('./contracts');
const adapters=new Map([['node-sqlite',require('./generate')],['python-inventory',require('./python')],['node-business-v2',require('./business')]]);
function registerAdapter(id,adapter){if(!/^[a-z][a-z0-9-]{0,63}$/.test(id)||adapters.has(id)||typeof adapter?.files!=='function'||['capabilities','domains','languages','frameworks','databases'].some(k=>!Array.isArray(adapter[k])||adapter[k].some(v=>typeof v!=='string'))||['commands','architectureDecision','validateArtifacts'].some(k=>adapter[k]!==undefined&&typeof adapter[k]!=='function'))throw Error('Registro de adaptador inválido o duplicado.');adapters.set(id,adapter);}
function describeAdapters(){return [...adapters].map(([id,a])=>({id,capabilities:[...a.capabilities],domains:[...a.domains],languages:[...a.languages],frameworks:[...a.frameworks],databases:[...a.databases],generation:'registered',runtimeAvailability:'not-probed'}));}
function plan(input,options={}){
 if(options.provider){if(!options.allowProvider)throw Error('Proveedor externo no autorizado.');const registry=require('./catalog').read(input.catalogExtension);const interpretation=require('./intents').interpret(input.text,registry,options);input={...input,interpretation};}
 const design=planner.design(input,{adapters:Object.fromEntries(adapters)}),files=design.status==='ready'?adapters.get(design.adapter).files(design):[];
 const commands=design.status==='ready'&&adapters.get(design.adapter).commands?adapters.get(design.adapter).commands(design):[];
 const payload={schemaVersion:1,kind:'composition-plan',templateVersion:'1.0.0',ok:design.status==='ready',...design,files,commands,executionAllowed:false,externalCodeImported:false};
 return {planId:digest(payload),...payload};
}
function validate(value){try{
 if(!value||canonical(value)!==canonical(plan(value.request)))throw Error('Plan modified or unsupported template.');
 if(value.status!=='ready')return {ok:false,errors:value.conflicts};
 const schemaCheck=new (require('ajv'))({allErrors:true}).compile(require('../../schemas/composition-plan.schema.json'));if(!schemaCheck(value))throw Error('Plan schema invalid.');
 const adapter=adapters.get(value.adapter);const contract=adapter.validateArtifacts?adapter.validateArtifacts(value):contracts.validate(JSON.parse(value.files.find(f=>f.path==='contracts/openapi.json').content));if(!contract.ok)return contract;
 const compose=value.files.find(f=>f.path==='compose.yaml');if(compose){const result=require('../docker/schema').validateCompose(JSON.parse(compose.content));if(!result.ok)return result;}
 if(value.files.some(f=>!io.relative(f.path))||new Set(value.files.map(f=>f.path.toLowerCase())).size!==value.files.length)throw Error('Unsafe file paths.');
 return {ok:true,artifactScope:contract.scope,...(value.files.some(f=>f.path==='contracts/openapi.json')?{contractScope:contract.scope}:{}),composeSchemaValidated:!!compose,executionAllowed:false,externalCodeImported:false};
 }catch(e){return {ok:false,errors:[e.message]};}}
function write(value,destination){const record={schemaVersion:1,kind:'managed-composition-record',templateVersion:value.templateVersion,planId:value.planId,files:value.files.map(f=>({path:f.path,digest:digest(f.content)}))};record.recordId=digest(record);
 // The shared writer validates the canonical original plan. Add the record only
 // after that validation, retaining its exclusive-create and path protections.
 const report=validate(value);if(!report.ok)throw Error('Invalid composition plan; no files written.');
 return io.writeNew({...value,files:[...value.files,{path:'devkit.composition.json',content:JSON.stringify(record,null,2)+'\n'}]},destination,()=>report);
}
function check(root){const path=require('node:path'),record=io.readJson(path.join(root,'devkit.composition.json'));const {recordId,...payload}=record;if(record.kind!=='managed-composition-record'||recordId!==digest(payload)||!Array.isArray(record.files))throw Error('Invalid composition record');return {...io.checkFiles(root,record.files),scope:'generated-files-integrity-only',executionAllowed:false};}
module.exports={plan,validate,write,check,registerAdapter,describeAdapters};
