'use strict';
const path=require('node:path');
const {canonical,digest,validatePlan}=require('../planner/plan');
const {render}=require('./render');
const policy=require('./policy');
const registry=require('./catalog');
const BREW_GUARD="const fs=require('node:fs');const d=JSON.parse(fs.readFileSync(0,'utf8'));const v=d.formulae?.[0]?.versions?.stable||d.casks?.[0]?.version;if(typeof v!=='string'||v.split(',')[0]!==process.argv[1]){console.error('La version ofrecida por Homebrew no coincide; no instales ni actualices.');process.exitCode=1;}";
const HASH_CHECK="const fs=require('node:fs'),crypto=require('node:crypto');(async()=>{const f=process.argv[1],s=fs.lstatSync(f);if(!s.isFile()||s.size!==Number(process.argv[3]))throw Error();const h=crypto.createHash('sha256');for await(const b of fs.createReadStream(f))h.update(b);if(h.digest('hex')!==process.argv[2])throw Error();})().catch(()=>{console.error('Integridad incorrecta: no extraigas ni ejecutes.');process.exitCode=1;});";
const SAFE_PIN=/^[0-9][A-Za-z0-9.+:~_-]{0,99}$/;
function normalize(options,plan) {
  policy.requireManual(options.mode);
  const method=options.method||'auto';
  if(!['auto','homebrew','winget','apt','dnf','official'].includes(method))throw new Error('Método desconocido.');
  const packageVersions={};
  for(const id of Object.keys(options.packageVersions||{}).sort()) {
    if(!plan.items.some(i=>i.tool===id)||!SAFE_PIN.test(options.packageVersions[id]))throw new Error('Versión de paquete inválida o de herramienta no seleccionada.');
    packageVersions[id]=options.packageVersions[id];
  }
  return {method,mode:'manual',packageVersions,repositoryReady:options.repositoryReady===true};
}
function chooseMethod(request,plan,data) {
  if(request.method!=='auto')return request.method;
  if(plan.request.manager&&Object.hasOwn(data.methods,plan.request.manager))return plan.request.manager;
  const platform=plan.observation.system.platform;
  if(platform==='win32')return 'winget';if(platform==='darwin')return 'homebrew';
  const distro=plan.observation.system.distribution?.id;
  if(['ubuntu','debian'].includes(distro))return 'apt';if(distro==='fedora')return 'dnf';
  return null;
}
function nativePackage(config,target) {
  const [major,minor]=String(target||'').split('.');
  if(config.package.includes('{')&&(!/^\d+$/.test(major||'')||!/^\d+$/.test(minor||'')))return null;
  return config.package.replaceAll('{major}',major).replaceAll('{minor}',minor);
}
function validateSnapshot(snapshot,tools,capabilities) {
  if(!snapshot)throw new Error('Official requiere --file con una propuesta de archivo oficial vigente, preparada anteriormente.');
  const adapter=snapshot.recipe==='go-official-archive-v1'?require('../installers/go'):require('../installers/archive-engine');
  if(!adapter.validatePrepared(snapshot,tools,capabilities).ok)throw new Error('Snapshot oficial inválido o caducado. Regenera install prepare.');
}
function generate(plan,options,tools,capabilities,data=registry.loadRecipes(tools),snapshot=null) {
  if(!registry.validateRecipes(data,tools).ok||!validatePlan(plan,tools,capabilities).ok)throw new Error('Plan D o recetas inválidos; no se generaron instrucciones.');
  const request=normalize(options,plan),method=chooseMethod(request,plan,data),platform=plan.observation.system.platform;
  if(plan.request.manager&&request.method!=='auto'&&plan.request.manager!==method)throw new Error('El método difiere del gestor elegido en el plan D; regenera el plan sin ese gestor o conserva su elección.');
  if(snapshot&&method!=='official')throw new Error('Un snapshot de archivo solo se usa con el método official.');
  const shell=platform==='win32'?'powershell':'posix';
  const blockers=plan.blockers.map(b=>({tool:b.tool,code:b.code,message:b.message})),decisions=[],steps=[],items=[];
  function issue(list,tool,code,message){list.push({tool,code,message});}
  function step(tool,stage,executable,args,notes='',stdinFrom=null){
    const previous=steps.filter(s=>s.tool===tool&&['guard','integrity','create-directory','download','extract','install'].includes(s.stage)).map(s=>s.id);
    const review=steps.filter(s=>s.tool===tool&&['inspect','preview'].includes(s.stage)).map(s=>s.id);
    const run={executable,args,stdinFrom};const id=`${tool}-${steps.filter(s=>s.tool===tool).length+1}`;
    steps.push({id,tool,stage,run,command:render(run,shell),requiresSuccessfulSteps:previous,requiresReviewedSteps:review,manualReviewRequired:true,changesSystem:['install','create-directory','download','extract'].includes(stage),notes});return id;
  }
  if(!method)issue(blockers,null,'method-required','No se puede elegir apt/dnf por su presencia sin identificar la distribución.');
  if(method&&!data.methods[method].platforms.includes(platform))issue(blockers,null,'method-platform-mismatch','El método no corresponde al sistema del plan.');
  if(['apt','dnf'].includes(method)&&!data.methods[method].distributions.includes(plan.observation.system.distribution?.id))issue(blockers,null,'distribution-unverified','La receta requiere una distribución identificada y soportada; no se infiere desde derivados.');
  if(!['x64','arm64'].includes(plan.observation.system.architecture))issue(blockers,null,'architecture-unverified','Arquitectura sin receta verificada.');
  if(method==='official') {
    validateSnapshot(snapshot,tools,capabilities);
    if(snapshot.plan.planId!==plan.planId)throw new Error('El snapshot no pertenece al plan D seleccionado.');
  }
  const globalBlocked=blockers.length>0;
  for(const item of plan.items) {
    const tool=tools.tools.find(t=>t.id===item.tool),recipe=data.recipes.find(r=>r.tool===item.tool),start=steps.length;
    const target=item.targetVersion,pin=request.packageVersions[item.tool]||null;
    const entry={tool:item.tool,recipe:recipe?.id||null,intent:item.intent,method,targetVersion:target,compatibility:item.targetCompatibility,package:null,packageVersion:pin,
      sources:tool.sources.map(s=>s.url).concat(method?[data.methods[method].documentation,data.methods[method].repository].filter(Boolean):[]),dependencies:item.dependencies,
      permissions:method==='official'?'write-new-directory':method==='apt'||method==='dnf'?'administrator':method==='winget'?'installer-dependent':recipe?.methods.homebrew?.kind==='cask'?'installer-dependent':'homebrew-prefix',
      space:{bytes:null,basis:'unknown-until-manager-preview'},risks:['review-native-dependencies-and-conflicts','recheck-environment-before-running','package-availability-not-queried'],verification:[],status:'needs-decisions'};
    items.push(entry);
    if(item.intent==='reuse') {entry.status='reuse';continue;}
    if(globalBlocked||item.intent==='blocked'){entry.status='blocked';continue;}
    if(item.tool==='npm'&&plan.items.some(i=>i.tool==='node')&&items.some(i=>i.tool==='node'&&i.status==='review-ready')){entry.status='bundled-with-node';entry.risks.push('npm-version-is-managed-by-node-distribution');continue;}
    if(!recipe){issue(decisions,item.tool,'recipe-not-implemented','No hay receta manual para esta herramienta; no se inventaron comandos.');continue;}
    if(method!=='official'&&item.current.status!=='missing') {
      issue(decisions,item.tool,'existing-tool-review','La herramienta existe o su estado es incierto. No se proponen reinstalaciones ni reemplazos con gestores del sistema.');continue;
    }
    if(method==='official') {
      if(!recipe.officialArchive||snapshot.tool&&snapshot.tool!==item.tool||!snapshot.tool&&item.tool!=='go'){issue(decisions,item.tool,'official-recipe-not-applicable','Snapshot no aplicable a esta herramienta.');continue;}
      const paths=platform==='win32'?path.win32:path.posix,destination=snapshot.destination,a=snapshot.artifact;
      entry.package=a.filename;entry.packageVersion=snapshot.version;entry.sources.push(a.url);entry.space={bytes:null,basis:'archive-size-is-not-installed-size'};entry.archiveBytes=a.size;
      entry.risks.push('no-automatic-rollback-for-manually-run-commands','review-archive-list-before-extraction','https-checksum-is-not-independent-signature');
      const archive=paths.join(destination,a.filename),isGo=item.tool==='go',isTerraform=item.tool==='terraform';
      const content=isTerraform?paths.join(destination,'terraform'):destination;
      step(item.tool,'create-directory','node',['-e',"require('node:fs').mkdirSync(process.argv[1],{mode:448});",destination],'Falla si el destino existe. No borra ni sobrescribe archivos.');
      step(item.tool,'download',platform==='win32'?'curl.exe':'curl',['--fail','--location','--proto','=https','--proto-redir','=https','--tlsv1.2','--output',archive,'--url',a.url],'Solo al ejecutarlo tú se descargará el archivo; comprueba también la fuente oficial.');
      step(item.tool,'integrity','node',['-e',HASH_CHECK,archive,a.sha256,String(a.size)],'Debe terminar correctamente antes de listar, extraer o ejecutar.');
      const unzip=platform==='linux'&&a.filename.endsWith('.zip');
      step(item.tool,'inspect',unzip?'/usr/bin/unzip':platform==='win32'?'C:\\Windows\\System32\\tar.exe':'/usr/bin/tar',unzip?['-Z','-1',archive]:['-tf',archive],'Revisión manual obligatoria: rutas internas, sin traversal ni enlaces externos.');
      if(isTerraform)step(item.tool,'create-directory','node',['-e',"require('node:fs').mkdirSync(process.argv[1],{mode:448});",content]);
      step(item.tool,'extract',unzip?'/usr/bin/unzip':platform==='win32'?'C:\\Windows\\System32\\tar.exe':'/usr/bin/tar',unzip?['-q',archive,'-d',content]:['-xf',archive,'-C',content],'Solo después de comprobar integridad y revisar el índice.');
      let root=isGo?paths.join(destination,'go'):isTerraform?content:paths.join(destination,a.filename.replace(/\.(tar\.gz|zip)$/,''));
      const executable=paths.join(root,isGo?'bin':isTerraform||platform==='win32'?'':'bin',item.tool+(platform==='win32'?'.exe':''));
      entry.verification.push(step(item.tool,'verify',executable,isGo?['version']:isTerraform?['version','-json']:['--version'],`Debe coincidir con ${target}; no se modifica PATH.`));
      if(item.tool==='node')entry.verification.push(step(item.tool,'verify',executable,[paths.join(root,platform==='win32'?'node_modules':'lib/node_modules','npm/bin/npm-cli.js'),'--version'],`npm esperado: ${a.bundledVersions.npm}.`));
      entry.status='review-ready';continue;
    }
    const config=recipe.methods[method];
    if(!config){issue(decisions,item.tool,'method-not-supported','Esta receta no tiene ese adaptador.');continue;}
    const pkg=nativePackage(config,target);entry.package=pkg;
    if(!target||!pkg){issue(decisions,item.tool,'exact-version-required','Selecciona versión objetivo exacta antes de generar instalación.');continue;}
    if(item.targetCompatibility.status!=='compatible')entry.risks.push('project-compatibility-not-assessed');
    const managerPresent=plan.observation.packageManagers.some(m=>m.id===method&&m.status==='detected');
    if(!managerPresent)issue(decisions,item.tool,'manager-not-observed','El gestor no fue detectado como disponible; compruébalo antes de ejecutar.');
    const desktop=item.tool==='docker'&&['homebrew','winget'].includes(method);
    if(desktop)entry.risks.push('desktop-version-differs-from-engine-and-cli','desktop-requirements-and-license-review');
    if(config.requiresRepository){entry.risks.push('official-repository-must-be-configured','repository-signatures-and-key-fingerprint-review');
      entry.sources.push(item.tool==='docker'?`https://docs.docker.com/engine/install/${method==='apt'?plan.observation.system.distribution.id:'fedora'}/`:item.tool==='terraform'?'https://developer.hashicorp.com/terraform/install':'https://learn.microsoft.com/en-us/dotnet/core/install/linux');
    }
    if(method==='homebrew') {
      step(item.tool,'inspect','brew',['list',config.kind==='cask'?'--cask':'--formula',pkg],'Si ya está instalado, detente; no se ofrece reinstall, upgrade ni link --overwrite.');
      step(item.tool,'inspect','brew',['info','--json=v2',config.kind==='cask'?'--cask':'--formula',pkg]);
    } else if(method==='winget')step(item.tool,'inspect','winget',['show','--id',pkg,'--exact','--source','winget','--versions']);
    else if(method==='apt'){step(item.tool,'inspect','apt-cache',['policy',pkg]);step(item.tool,'inspect','apt-cache',['madison',pkg]);step(item.tool,'inspect','dpkg-query',['-W',pkg],'Comprueba si el paquete ya está instalado.');}
    else {step(item.tool,'inspect','dnf',['--showduplicates','list',pkg]);step(item.tool,'inspect','rpm',['-q',pkg],'Comprueba si el paquete ya está instalado.');}
    if(config.requiresRepository&&!request.repositoryReady){issue(decisions,item.tool,'repository-review-required','Configura y revisa el repositorio oficial por separado; --repository-ready solo registra tu confirmación, no comprueba firmas ni fuentes.');continue;}
    const chosenVersion=pin||(desktop?null:target);
    if(!chosenVersion||['apt','dnf'].includes(method)&&!pin){issue(decisions,item.tool,'package-version-required','Indica --package-version herramienta=VERSION_DEL_PAQUETE; no equivale necesariamente a la versión del lenguaje o de la CLI.');continue;}
    if(!desktop&&pin&&!new RegExp('(^|:)'+target.replaceAll('.','\\.')+'($|[-+~.])').test(pin)) {issue(blockers,item.tool,'package-version-target-mismatch','La versión del paquete no contiene la versión objetivo; no se proponen sustituciones.');entry.status='blocked';continue;}
    const dependencies=item.tool==='docker'&&['apt','dnf'].includes(method)?['docker-ce-cli','containerd.io','docker-buildx-plugin','docker-compose-plugin']:[];
    entry.dependencies=[...new Set([...entry.dependencies,...dependencies])];
    if(method==='homebrew') {
      step(item.tool,'guard','node',['-e',BREW_GUARD,chosenVersion.split(',')[0]],'Compara la versión ofrecida antes de instalar; Homebrew no fija parches antiguos.',{executable:'brew',args:['info','--json=v2',config.kind==='cask'?'--cask':'--formula',pkg]});
      step(item.tool,'install','env',['HOMEBREW_NO_AUTO_UPDATE=1','HOMEBREW_NO_INSTALL_CLEANUP=1','HOMEBREW_NO_INSTALL_UPGRADE=1','HOMEBREW_NO_INSTALLED_DEPENDENTS_CHECK=1','brew','install',config.kind==='cask'?'--cask':'--formula',pkg],'Revisa dependencias, arquitectura y requisitos de la fórmula/cask. No se instala si la comprobación anterior falla.');
    } else if(method==='winget')step(item.tool,'install','winget',['install','--id',pkg,'--exact','--version',chosenVersion,'--source','winget','--architecture',plan.observation.system.architecture,'--no-upgrade','--disable-interactivity'],'No se aceptan acuerdos automáticamente ni se desactiva validación de hashes.');
    else {
      const packages=[method==='apt'?pkg+'='+chosenVersion:pkg+'-'+chosenVersion,...dependencies.map(d=>d==='docker-ce-cli'?(method==='apt'?d+'='+chosenVersion:d+'-'+chosenVersion):d)];
      if(method==='apt') {step(item.tool,'preview','apt-get',['--simulate','--no-remove','--no-upgrade','install',...packages],'Revisa espacio, dependencias y cambios; no equivale a autorización.');step(item.tool,'install','sudo',['apt-get','--no-remove','--no-upgrade','install',...packages],'Puede requerir privilegios. No se emite -y ni se eliminan paquetes.');}
      else {step(item.tool,'preview','dnf',['--assumeno','--setopt=install_weak_deps=False','install',...packages],'Vista previa; --assumeno puede terminar con salida no cero por cancelar.');step(item.tool,'install','sudo',['dnf','--setopt=install_weak_deps=False','install',...packages],'Revisa la transacción; no se emite --allowerasing, --nogpgcheck ni -y.');}
      entry.risks.push('native-package-version-mapping-and-transitive-dependencies-require-review','package-manager-may-start-installed-services');
    }
    if(item.tool==='docker') {
      entry.verification.push(step(item.tool,'verify','docker',['context','show'],'Revisa el contexto antes de consultar un motor: puede ser remoto.'));
      for(const args of [['--version'],['version','--format','{{.Server.Version}}'],['compose','version'],['buildx','version']])entry.verification.push(step(item.tool,'verify','docker',args,'Comprobaciones independientes: CLI, motor accesible, Compose y Buildx. No inician contenedores. El contexto puede apuntar a un motor remoto; revísalo primero.'));
      if(desktop)entry.verification.push(step(item.tool,'verify',platform==='win32'?'winget':'brew',platform==='win32'?['list','--id','Docker.DockerDesktop','--exact']:['list','--cask','docker-desktop'],'Desktop instalado no implica que el motor esté iniciado. No se inicia Desktop desde el kit.'));
    } else if(tool.diagnostic) {
      const command=item.tool==='python'&&method==='homebrew'?`python${target.split('.').slice(0,2).join('.')}`:tool.diagnostic.command;
      entry.verification.push(step(item.tool,'verify',command,tool.diagnostic.args,`Comprueba versión ${target} y origen del ejecutable; un keg-only puede requerir ruta explícita en fase F.`));
    }
    entry.status=managerPresent?'review-ready':'needs-decisions';
    if(steps.length===start)entry.status='needs-decisions';
  }
  // Never offer mutation commands if any hard blocker invalidates the combined request.
  const offered=steps.filter(s=>!s.changesSystem||!blockers.length&&items.find(i=>i.tool===s.tool)?.status==='review-ready');
  const ids=new Set(offered.map(s=>s.id));offered.forEach(s=>{s.requiresSuccessfulSteps=s.requiresSuccessfulSteps.filter(id=>ids.has(id));s.requiresReviewedSteps=s.requiresReviewedSteps.filter(id=>ids.has(id));});
  const status=blockers.length?'blocked':decisions.length?'needs-decisions':items.every(i=>i.status==='reuse')?'no-changes':'review-ready';
  const payload={schemaVersion:3,commandPlannerVersion:'1.0.0',mode:'manual',executionAllowed:false,approval:'not-requested',environmentRechecked:false,
    recipeSetVersion:data.recipeSetVersion,recipeDigest:digest(data),sourcePlan:plan,artifactSnapshot:snapshot,request,method,shell,items,steps:offered,blockers,decisions,status,ok:!blockers.length&&!decisions.length,
    instructions:'Son comandos para revisión, no se ejecutaron. Ejecuta por etapas y detente ante errores. Las consultas de paquetes ausentes y dnf --assumeno pueden salir con código no cero. Antes de cada cambio revisa precondiciones, origen, versión, dependencias, permisos y efectos. Ninguna huella concede autorización.'};
  return {commandPlanId:digest(payload),...payload};
}
function validateCommandPlan(value,tools,capabilities,data=registry.loadRecipes(tools)) {
  try {
    const validateSchema=require('./schema');
    if(!validateSchema(value))throw new Error();
    const rebuilt=generate(value.sourcePlan,value.request,tools,capabilities,data,value.artifactSnapshot);
    if(canonical(rebuilt)!==canonical(value))throw new Error();
    return {ok:true,commandPlanId:value.commandPlanId,executionAllowed:false,environmentRechecked:false};
  }catch{return {ok:false,errors:['Plan de comandos inválido, modificado, caducado o con recetas obsoletas. Regénéralo.'],executionAllowed:false,environmentRechecked:false};}
}
module.exports={generate,validateCommandPlan,normalize};
