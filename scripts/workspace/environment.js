'use strict';
const fs=require('node:fs'),path=require('node:path');
const {digest,canonical}=require('../planner/plan');
const io=require('./files'),project=require('./project'),docker=require('../docker/generate');
function expectedRecord(kind,request){
 const p=kind==='managed-project-record'?project.plan(request):kind==='managed-compose-record'?docker.plan(request):null;if(!p)throw new Error('Tipo de entorno desconocido.');
 const record={schemaVersion:1,kind,request:p.request,templateVersion:p.templateVersion,files:p.files.map(f=>({path:f.path,digest:digest(f.content)}))};record.recordId=digest(record);return record;
}
function validateRecord(record){try{if(canonical(expectedRecord(record.kind,record.request))!==canonical(record))throw Error();return true;}catch{return false;}}
function load(root){
 const base=fs.realpathSync(root);if(!fs.statSync(base).isDirectory())throw new Error('El proyecto no es un directorio.');
 const candidates=['devkit.project.json','devkit.compose.json'].filter(f=>fs.existsSync(path.join(base,f)));
 if(candidates.length!==1)throw new Error('Se requiere exactamente un registro de proyecto generado por el kit.');
 const file=path.join(base,candidates[0]);if(fs.lstatSync(file).isSymbolicLink())throw new Error('No se admiten registros enlazados.');
 const record=io.readJson(file);if(!validateRecord(record))throw new Error('Registro inválido o de otra versión de plantilla.');
 return {base,record,drift:io.checkFiles(base,record.files)};
}
function check(root){const {record,drift}=load(root);return {ok:drift.ok,kind:record.kind,templateVersion:record.templateVersion,drift:drift.changes,executionAllowed:false};}
function buildManifest(record,drift,host){
 if(!validateRecord(record)||!['darwin','win32','linux'].includes(host.platform)||!['x64','arm64'].includes(host.architecture))throw new Error('Registro o plataforma no exportable.');
 if(!drift||Object.keys(drift).sort().join(',')!=='changes,ok'||typeof drift.ok!=='boolean'||!Array.isArray(drift.changes)||drift.changes.some(c=>Object.keys(c).sort().join(',')!=='file,status'||!record.files.some(f=>f.path===c.file)||!['modified','missing-or-link','unreadable'].includes(c.status))||drift.ok!==(drift.changes.length===0))throw new Error('Estado de cambios inválido.');
 const refs=record.request.images?Object.values(record.request.images):[];
 const payload={schemaVersion:1,kind:'environment-manifest',record,sourceHost:{platform:host.platform,architecture:host.architecture},drift,
  reproducibility:{toolchainBinariesVerified:false,imageDigestsPinned:refs.length?refs.every(v=>v.includes('@sha256:')):null,lockfilesCaptured:false,dataOrSecretsCaptured:false},
  limitations:['Solo configuración inicial: no exporta código modificado, secretos, variables de entorno, imágenes ni datos de volúmenes.','No certifica SDK, lockfiles, arquitectura o imágenes disponibles.','Cambios de motores/versiones pueden requerir migraciones y backups antes de usar datos anteriores.']};
 return {manifestId:digest(payload),...payload};
}
function exportManifest(root){const {record,drift}=load(root);return buildManifest(record,drift,{platform:process.platform,architecture:process.arch});}
function validateManifest(value){try{if(canonical(buildManifest(value.record,value.drift,value.sourceHost))!==canonical(value))throw Error();return {ok:true};}catch{return {ok:false,errors:['Manifiesto inválido, modificado o incompatible con las plantillas actuales.']};}}
function restore(value){if(!validateManifest(value).ok)throw new Error('Manifiesto inválido.');return value.record.kind==='managed-project-record'?project.plan(value.record.request):docker.plan(value.record.request);}
function compare(value,root){if(!validateManifest(value).ok)throw new Error('Manifiesto inválido.');const current=load(root);return {ok:canonical(current.record.request)===canonical(value.record.request)&&current.record.kind===value.record.kind&&current.drift.ok,
 requestMatches:canonical(current.record.request)===canonical(value.record.request),kindMatches:current.record.kind===value.record.kind,drift:current.drift.changes,hostDifferences:{platform:value.sourceHost.platform!==process.platform,architecture:value.sourceHost.architecture!==process.arch},executionAllowed:false};}
function update(value,options){if(!validateManifest(value).ok)throw new Error('Manifiesto inválido.');
 if(value.record.kind==='managed-project-record'){if(options.images)throw new Error('Este proyecto no declara imágenes Docker.');return project.plan({...value.record.request,...(options.version?{version:options.version}:{}),dependencies:{...value.record.request.dependencies,...options.dependencies}});}
 if(options.version||options.dependencies)throw new Error('Para Docker actualiza referencias con --image.');return docker.plan({...value.record.request,images:{...value.record.request.images,...options.images}});
}
module.exports={expectedRecord,validateRecord,load,check,buildManifest,exportManifest,validateManifest,restore,compare,update};
