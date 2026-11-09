'use strict';
const io=require('./files');
function parse(args){
 const command=args.shift(),action=args.shift();const options={};
 const booleans=new Set(['json','server','allow-remote','acknowledge-removal','approve-data-loss','docker','require-all','require-docker']);
 const scalars=new Set(['file','out','stack','version','manager-version','name','project','backend','profile','action','context','confirm','template-version','stacks','request','architecture','catalog','agent']);
 while(args.length){const raw=args.shift();if(!raw.startsWith('--'))throw new Error('Argumento no admitido.');const key=raw.slice(2);
  if(booleans.has(key)){if(options[key]!==undefined)throw new Error('Opción duplicada.');options[key]=true;}
  else if(['service'].includes(key)){(options.services||=[]).push(args.shift());}
  else if(['image','publish'].includes(key)){const value=args.shift(),i=value?.indexOf('=');if(!value||i<1)throw new Error('Usa clave=valor.');const field=key==='image'?'images':'publish',name=value.slice(0,i);if(Object.hasOwn(options[field]||{},name))throw new Error('Valor duplicado.');(options[field]||={})[name]=value.slice(i+1);}
  else if(key==='dependency'){const value=args.shift(),m=value&&/^([^=]+)=(\d+\.\d+\.\d+)$/.exec(value);if(!m||Object.hasOwn(options.dependencies||{},m[1]))throw new Error('Dependencia inválida o duplicada.');(options.dependencies||={})[m[1]]=m[2];}
  else if(scalars.has(key)&&args.length){if(options[key]!==undefined)throw new Error('Opción duplicada.');options[key]=args.shift();}
  else throw new Error('Opción no admitida.');
 }
 const allowed={
  'packages:list':['catalog'],
  'packages:show':['name','catalog'],
  'packages:validate':['file'],
  'packages:combinations':[],
  'packages:combination':['name','docker'],
  'memory:adopt':['project'],
  'memory:status':['project'],
  'memory:enhance':['project','file','request'],
  'memory:validate':['project','file'],
  'memory:apply':['project','file','confirm'],
  'agent:discover':['project','agent'],
  'agent:inspect':['project'],
  'agent:plan':['project','file','request','name','architecture','docker','version'],
  'agent:validate':['project','file'],
  'agent:create':['out','file'],
  'composition:catalog':['file'],
  'composition:plan':['request','file','name','architecture','docker','version','catalog'],
  'composition:verify':[],
  'composition:acceptance':[],
  'composition:create':['file','out'],
  'composition:validate':['file'],
  'composition:check':['project'],
  'verify:runtime':['docker','server'],
  'verify:native':['stacks','require-all'],
  'verify:compose':['require-docker'],
  'docker:schema':['file'],
  'docker:doctor':['server','allow-remote'],
  'docker:plan':['name','services','backend','version','images','publish','template-version'],
  'docker:create':['file','out'],
  'docker:validate':['file'],
  'docker:commands':['project','action','context','services','acknowledge-removal','approve-data-loss','confirm'],
  'project:check':['project'],
  'environment:export':['project'],
  'environment:validate':['file'],
  'environment:restore':['file'],
  'environment:compare':['file','project'],
  'environment:update':['file','version','dependencies','images'],
  'environment:repair':['project','context'],
  'profiles:list':[],
  'profiles:plan':['profile','stack','version','manager-version','name','dependencies'],
  'profiles:create':['file','out'],
  'project:plan':['stack','version','manager-version','name','dependencies'],
  'project:create':['file','out'],
  'project:validate':['file']
 }[command+':'+action];
 if(!allowed||Object.keys(options).some(k=>k!=='json'&&!allowed.includes(k)))throw new Error('Comando u opciones no admitidos.');
 return {command,action,options};
}
async function dispatch({command,action,options:o}){
 if(command==='packages'){
  if(action==='combinations')return require('../commercial/combinations').list();
  if(action==='combination'){if(!o.name)throw Error('Se requiere --name.');return require('../commercial/combinations').plan(o.name,{docker:o.docker===true});}
  const registry=require('../commercial/catalog');if(action==='validate')return registry.validate(o.file?io.readJson(o.file):registry.read());const extension=o.catalog?io.readJson(o.catalog):undefined;
  if(action==='show'){if(!o.name)throw Error('Se requiere --name.');return registry.show(o.name,extension);}return registry.list(extension);
 }
 if(command==='memory'){
  if(!o.project)throw Error('Se requiere --project explícito.');const store=require('../memory/store'),api=require('../kit-first/service');
  if(action==='adopt')return store.adopt({destination:o.project,evidence:api.discover({destination:o.project})});
  if(action==='status')return store.status(o.project);
  if(!o.file)throw Error('Se requiere --file.');let value=io.readJson(o.file);const enhance=require('../memory/enhance');
  if(action!=='enhance'&&value.kind==='terminal-project-plan'){if(!require('../terminal/service').validate(value,o.project).ok||value.core?.kind!=='incremental-project-plan')throw Error('Plan de terminal incremental inválido.');value=value.core;}
  if(action==='enhance')return enhance.plan({destination:o.project,evidence:value,text:o.request});
  if(action==='validate')return enhance.validate(value,o.project);
  return enhance.apply(value,o.project,o.confirm);
 }
 if(command==='agent'){
  const api=require('../kit-first/service');
  if(action==='create'){if(!o.file||!o.out)throw Error('Se requiere --file y --out.');return api.create(io.readJson(o.file),o.out);}
  if(!o.project)throw Error('Se requiere --project explícito.');
  if(action==='discover')return api.discover({destination:o.project,agent:o.agent});
  if(action==='inspect')return api.inspect(o.project);
  if(!o.file)throw Error('Se requiere --file.');const value=io.readJson(o.file);
  if(action==='validate')return api.validate(value,o.project);
  return api.plan({evidence:value,destination:o.project,request:{text:o.request,...(o.name?{name:o.name}:{}),...(o.architecture?{architecture:o.architecture}:{}),...(o.version?{nodeVersion:o.version}:{}),docker:o.docker===true}});
 }
 if(command==='composition'){
  const engine=require('../composition/engine'),catalog=require('../composition/catalog');
  if(action==='verify')return require('../composition/verify').verify();
  if(action==='acceptance')return require('../composition/acceptance').verify();
  if(action==='catalog')return catalog.read(o.file?io.readJson(o.file):undefined);
  if(action==='plan'){if(o.file&&(o.request||o.name||o.architecture||o.docker||o.version||o.catalog))throw Error('--file no se combina con opciones de solicitud.');return engine.plan(o.file?io.readJson(o.file):{text:o.request,...(o.name?{name:o.name}:{}),...(o.architecture?{architecture:o.architecture}:{}),...(o.version?{nodeVersion:o.version}:{}),docker:o.docker===true,...(o.catalog?{catalogExtension:io.readJson(o.catalog)}:{})});}
  if(action==='check'){if(!o.project)throw Error('Se requiere --project.');return engine.check(o.project);}
  if(!o.file)throw Error('Se requiere --file.');const value=io.readJson(o.file);if(action==='validate')return engine.validate(value);if(!o.out)throw Error('Se requiere --out a una carpeta nueva.');return engine.write(value,o.out);
 }
 if(command==='verify'&&action==='compose')return require('./compose-check').compose({requireDocker:o['require-docker']});
 if(command==='verify'&&action==='native')return require('./native-check').native({...(o.stacks?{stacks:o.stacks.split(',')}:{}),requireAll:o['require-all']});
 if(command==='docker'&&action==='schema'){if(!o.file)throw new Error('Se requiere --file con JSON Compose o un plan Docker.');const value=io.readJson(o.file);return require('../docker/schema').validateCompose(value.kind==='docker-workspace-plan'?value.compose:value);}
 if(command==='verify')return require('./verify').verify({docker:o.docker,server:o.server});
 if(command==='environment'){const env=require('./environment');if(action==='export'){if(!o.project)throw new Error('Se requiere --project.');return env.exportManifest(o.project);}if(action==='repair'){if(!o.project)throw new Error('Se requiere --project.');const state=env.load(o.project);return state.record.kind==='managed-compose-record'?require('../docker/operations').plan(o.project,{action:'repair',context:o.context}):{...env.check(o.project),commands:require('./project').plan(state.record.request).commands.filter(c=>['--version','-version','version'].some(arg=>c.run.args.includes(arg))),notes:'Solo inspección y comandos manuales; no se reinstala ni repara automáticamente.'};}if(!o.file)throw new Error('Se requiere --file.');const value=io.readJson(o.file);if(action==='validate')return env.validateManifest(value);if(action==='restore')return env.restore(value);if(action==='update')return env.update(value,{...(o.version?{version:o.version}:{}),...(o.dependencies?{dependencies:o.dependencies}:{}),...(o.images?{images:o.images}:{})});if(!o.project)throw new Error('Se requiere --project.');return env.compare(value,o.project);}
 if(command==='project'&&action==='check'){if(!o.project)throw new Error('Se requiere --project.');return require('./environment').check(o.project);}
 if(command==='docker'&&action==='commands'){if(!o.project)throw new Error('Se requiere --project.');return require('../docker/operations').plan(o.project,{action:o.action,context:o.context,services:o.services,acknowledgeRemoval:o['acknowledge-removal'],approveDataLoss:o['approve-data-loss'],confirm:o.confirm});}
 if(command==='docker'){if(action==='doctor')return require('../docker/doctor').diagnoseDocker({server:o.server,allowRemote:o['allow-remote']});const gen=require('../docker/generate');if(action==='plan')return gen.plan({name:o.name||'devkit-app',services:o.services||[],backend:o.backend||null,version:o.version||null,images:o.images||{},publish:o.publish||{},...(o['template-version']?{templateVersion:o['template-version']}:{})});if(!o.file)throw new Error('Se requiere --file.');if(action==='validate')return gen.validate(io.readJson(o.file));if(!o.out)throw new Error('Se requiere --out.');return gen.write(io.readJson(o.file),o.out);}
 if(command==='profiles'&&action==='list')return require('./profiles').list();
 const project=require('./project');
 if(command==='profiles'&&action==='create'){if(!o.file||!o.out)throw new Error('Se requiere --file y --out.');return require('./profiles').write(io.readJson(o.file),o.out);}
 if(action==='plan'){const input={stack:o.stack,version:o.version,...(o['manager-version']?{managerVersion:o['manager-version']}:{}),...(o.name?{name:o.name}:{}),...(o.dependencies?{dependencies:o.dependencies}:{})};return command==='profiles'?require('./profiles').plan(o.profile,input):project.plan(input);}
 if(!o.file)throw new Error('Se requiere --file.');
 if(action==='validate')return project.validate(io.readJson(o.file));
 if(!o.out)throw new Error('Se requiere --out a una carpeta nueva.');
 return project.write(io.readJson(o.file),o.out);
}
async function main(args){try{const parsed=parse([...args]),result=await dispatch(parsed);console.log(JSON.stringify(result,null,2));if(result.ok===false)process.exitCode=1;}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={parse,dispatch,main};
