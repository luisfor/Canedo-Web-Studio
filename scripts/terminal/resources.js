'use strict';
// Bridge to existing catalogs/planners. No tool, dependency, version policy or
// installation recipe is defined here and no generated command is executed.
const planner=require('../planner/plan'),doctor=require('../doctor/environment');
const profileApi=require('../workspace/profiles'),project=require('../workspace/project');
const {render}=require('../commands/render');
const PROFILE={frontend:'frontend',web:'frontend',backend:'backend',mobile:'mobile',iot:'iot',ai:'ai',devops:'cloud',enterprise:'enterprise',custom:'minimal',database:'minimal'};
const LANGUAGES={javascript:'node',typescript:'node',csharp:'dotnet'};
function options(input={}) {
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['versions','manager','report','diagnosticMode'].includes(k)))throw Error('Opciones de recursos no admitidas.');
  if(input.versions!==undefined&&(!input.versions||typeof input.versions!=='object'||Array.isArray(input.versions)))throw Error('Versiones deben ser un mapa de herramientas.');
  if(input.diagnosticMode!==undefined&&!['not-run','provided-report','live-doctor'].includes(input.diagnosticMode))throw Error('Procedencia diagnóstica inválida.');
  if(input.report&&input.diagnosticMode==='not-run'||!input.report&&['provided-report','live-doctor'].includes(input.diagnosticMode))throw Error('Diagnóstico y procedencia no coinciden.');
  return {versions:input.versions||{},manager:input.manager||null,report:input.report||null,diagnosticMode:input.diagnosticMode||(input.report?'provided-report':'not-run')};
}
function selection(requirements,evidence,text) {
  const catalog=evidence.discovery.catalogs.tools,byId=new Map(catalog.tools.map(t=>[t.id,t])),selected=new Map();
  const add=(id,reason)=>{if(byId.has(id)&&!selected.has(id))selected.set(id,reason);};
  for(const item of requirements.technologies)if(item.cataloged)add(item.toolId,'explicit-request');
  // Resolve already-recognized platform/hardware requirements to existing IDs.
  if(requirements.targets.includes('android'))add('android-sdk','requested-target');
  if(requirements.targets.includes('ios'))add('xcode','requested-target');
  if(requirements.domains.includes('iot')&&/\besp32\b/i.test(text))add('esp-idf','requested-board-family');
  // A SQL client does not certify a database deployment. Existing service
  // records cause the lower planner to ask local/remote/container explicitly.
  for(const id of ['postgresql','mysql'])if(selected.has(id))add(id+'-server','database-deployment-decision');
  const profileIds=[...new Set(requirements.domains.map(d=>PROFILE[d]).filter(Boolean))];
  const profiles=profileApi.list().profiles.filter(p=>profileIds.includes(p.id));
  return {catalog,selected,profiles};
}
function passiveReport() {
  // No process invocation. Linux release data is parsed by the existing doctor;
  // macOS product version remains unknown without an explicit diagnostic.
  const context=doctor.createContext({spawn:()=>({status:1}),cwd:process.cwd()});
  return {schemaVersion:2,system:doctor.detectSystem(context),checks:[],packageManagers:[]};
}
function connect({requirements,evidence,text,input={}}) {
  const request=options(input),{catalog,selected,profiles}=selection(requirements,evidence,text);
  const legacy=require('../../config/kit-capabilities.json'),roots=[...selected.keys()].sort();
  // Validate choices through the existing planner even when no stack is chosen.
  if(!roots.length&&(Object.keys(request.versions).length||request.manager))throw Error('Selecciona herramientas conocidas antes de fijar versiones o gestor.');
  const report=request.report||passiveReport(),source=request.diagnosticMode==='live-doctor'?'live-doctor':'provided-report';
  const toolPlan=roots.length?planner.createPlan(catalog,legacy,report,{tools:roots,exclude:requirements.excluded,versions:request.versions,manager:request.manager},{source}):null;
  const observation=toolPlan?.observation||planner.normalizeObservation(report,catalog,[],source);
  const diagnosticTools=(toolPlan?.items||[]).filter(i=>catalog.tools.find(t=>t.id===i.tool).availability==='diagnostic').map(i=>i.tool);
  const run={executable:'node',args:['scripts/kit.js','doctor',...diagnosticTools.flatMap(id=>['--tool',id]),'--json'],stdinFrom:null};
  const runtimeIds=(toolPlan?.items||[]).map(i=>i.tool).filter(id=>project.STACKS.includes(id));
  const environments=[],environmentDecisions=[];
  for(const stack of runtimeIds){
    if(toolPlan.blockers.length){environmentDecisions.push({stack,code:'tool-plan-blocked',detail:'Resolver los conflictos del conjunto de herramientas antes de preparar configuración de entorno.'});continue;}
    const version=request.versions[stack],candidates=profiles.filter(p=>p.stacks.includes(stack));
    if(!version){environmentDecisions.push({stack,code:'runtime-version-required',detail:'Seleccionar una versión exacta; la instalada no se convierte automáticamente en versión del proyecto.'});continue;}
    try {
      if(candidates.length){const p=candidates[0];environments.push({stack,profile:p.id,scope:'runtime-config-only',plan:profileApi.plan(p.id,{stack,version})});}
      else environments.push({stack,profile:null,scope:'runtime-config-only',plan:project.plan({stack,version})});
    }catch{environmentDecisions.push({stack,code:'environment-policy-conflict',detail:'La versión solicitada no cumple las reglas del preparador; revisar el plan de herramientas.'});}
  }
  if(!runtimeIds.length)environmentDecisions.push({stack:null,code:'runtime-choice-required',detail:'Elegir un runtime compatible con los requisitos antes de preparar archivos; no se elige por popularidad.'});
  const recipes=evidence.discovery.catalogs.installationRecipes;
  const installation=(toolPlan?.items||[]).map(item=>{const recipe=recipes.recipes.find(r=>r.tool===item.tool);return {tool:item.tool,recipe:recipe?.id||null,methods:recipe?Object.keys(recipe.methods).concat(recipe.officialArchive?['official']:[]):[],status:recipe?'recipe-available':item.tool==='npm'?'bundled-with-node':'no-recipe',sources:item.sources};});
  const commandApi=require('../commands/plan');
  const manualCommands=toolPlan?commandApi.generate(toolPlan,{method:'auto'},catalog,legacy,recipes):null;
  if(manualCommands&&!commandApi.validateCommandPlan(manualCommands,catalog,legacy,recipes).ok)throw Error('La receta no produjo un plan de comandos válido.');
  const runtimeSelected=new Set(runtimeIds);
  return {
    request:{versions:request.versions,manager:request.manager},
    selected:[...selected].map(([id,reason])=>({id,reason})),toolPlan,
    diagnostics:{mode:request.diagnosticMode,observation,diagnosticTools,preview:diagnosticTools.length?{run,posix:render(run,'posix'),powershell:render(run,'powershell')}:null,environmentRechecked:false},
    profiles:profiles.map(p=>({...p,matchedStacks:p.stacks.filter(s=>runtimeSelected.has(s)),selection:'candidate-only'})),
    environmentPlans:environments,environmentDecisions,installation,manualCommands,
    reuseCandidates:evidence.inspection.signals.filter(s=>['language','framework','database','component'].includes(s.category)).map(s=>({...s,action:'preserve-and-verify',toolId:LANGUAGES[s.id]|| (catalog.tools.some(t=>t.id===s.id)?s.id:null)})),
    limitations:['No se instalan herramientas ni se ejecutan los comandos preparados.','Los perfiles son candidatos; sus herramientas/servicios sugeridos no se añaden automáticamente.','Los archivos de entorno fijan runtime; nombres/versiones de paquetes de frameworks y lockfiles requieren revisión separada.','El diagnóstico no certifica SDK completos, autenticación, servidores o compilación.','Los generadores comerciales no se consultan ni son requisito de este plan técnico.'],
    executionAllowed:false
  };
}
function diagnose({requirements,evidence,text},overrides={}) {
  const preview=connect({requirements,evidence,text});
  const ids=preview.diagnostics.diagnosticTools;
  const catalog=require('../tools/catalog').doctorCatalog({profiles:[]},evidence.discovery.catalogs.tools);
  // Keep runtime injection flags out of this explicit version-only subprocess.
  const env=diagnosticEnvironment(process.env);
  return doctor.diagnose(catalog,{tools:ids},{env,...overrides});
}
function diagnosticEnvironment(environment) {
  const allowed=new Set(['PATH','PATHEXT','SYSTEMROOT','WINDIR','HOME','TMPDIR','TEMP','TMP','PROGRAMFILES','PROCESSOR_ARCHITECTURE','PROCESSOR_ARCHITEW6432']);
  return Object.fromEntries(Object.entries(environment).filter(([key])=>allowed.has(key.toUpperCase())));
}
module.exports={connect,diagnose,options,diagnosticEnvironment};
