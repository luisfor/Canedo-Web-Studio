'use strict';
// Technical intent and advisory steps extend the existing terminal. Tool records
// remain exclusively in catalog/tools; this is not an installer or generator.
const { normalize } = require('../tools/text');
const { canonical, digest } = require('../planner/plan');
const toolsApi = require('../tools/catalog');
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const expression = term => new RegExp('(^|[^a-z0-9])(' + escape(normalize(term)) + ')(?=$|[^a-z0-9])', 'g');
const domains = [
  ['frontend', ['frontend', 'front-end'], 'Definir componentes, navegación, accesibilidad y estados de carga/error.'],
  ['web', ['web', 'sitio web', 'pagina web'], 'Elegir SPA, SSR o contenido estático según navegación, SEO y operación.'],
  ['backend', ['backend', 'api', 'apis', 'servidor'], 'Definir límites, contratos HTTP/eventos, errores, autorización y pruebas de contrato.'],
  ['mobile', ['movil', 'moviles', 'android', 'iphone', 'ios','flutter','react native'], 'Decidir código compartido o aplicaciones nativas; revisar SDK, permisos, almacenamiento y firma por plataforma.'],
  ['desktop', ['escritorio', 'desktop','electron','tauri'], 'Definir sistemas de destino, integración nativa, empaquetado, actualizaciones y persistencia local.'],
  ['game', ['videojuego', 'videojuegos', 'juego', 'unity', 'godot', 'unreal'], 'Definir motor, plataformas, escena mínima, entrada, recursos y estrategia de pruebas del juego.'],
  ['iot', ['iot', 'esp32', 'embebido', 'embebidos', 'firmware', 'arduino'], 'Confirmar placa/revisión, toolchain, memoria, protocolos y pruebas separadas de simulación y hardware.'],
  ['automation', ['automatizacion', 'automatizar', 'scripts', 'script'], 'Definir disparadores, entradas/salidas, idempotencia, permisos, reintentos y efectos autorizados.'],
  ['ai', ['inteligencia artificial', 'aprendizaje automatico', 'modelo de ia', 'ia'], 'Definir tarea, datos, evaluación, privacidad y presupuesto; mantener proveedores externos deshabilitados.'],
  ['database', ['base de datos', 'bases de datos', 'sql'], 'Diseñar esquema, migraciones, consultas, permisos, respaldo y restauración sin iniciar servidores.'],
  ['devops', ['infraestructura', 'devops', 'ci/cd', 'contenedores', 'despliegue'], 'Definir entornos, secretos, CI/CD, observabilidad y revisión de planes antes de cualquier despliegue.'],
  ['enterprise', ['empresarial', 'empresariales', 'saas', 'multiempresa', 'multi-tenant'], 'Definir límites del negocio, identidad reutilizable, aislamiento, auditoría y requisitos no funcionales.'],
  ['custom', ['personalizado', 'personalizada', 'personalizados', 'personalizadas'], 'Precisar objetivos, usuarios, entradas/salidas y criterios verificables sin imponer un dominio.']
];
// Aliases refer to existing IDs; no versions, dependencies or support promises.
const aliases = { node:['node.js','nodejs'], dotnet:['.net','c#','csharp'], cpp:['c++'], postgresql:['postgres'], sqlserver:['sql server'], nextjs:['next.js'], springboot:['spring boot'], 'android-sdk':['android sdk'], 'esp-idf':['esp idf'] };
const unregisteredNames = ['unity','godot','unreal','electron','tauri','react native'];
const platforms = { android:['android'], ios:['ios','iphone'], windows:['windows'], macos:['macos','mac'], linux:['linux'] };
function matches(text, terms) { return terms.some(term => expression(term).test(text)); }
function interpret(text) {
  require('../kit-first/service').validateRequest({text});
  const catalog = toolsApi.readToolCatalog();
  if (!toolsApi.validateToolCatalog(catalog).ok) throw Error('Catálogo técnico inválido.');
  let remainder = normalize(text);
  const selected = new Set(), excluded = new Set(), mentions = [];
  const terms = catalog.tools.flatMap(tool => [...new Set([tool.id, tool.label, ...(aliases[tool.id] || [])])].map(term => ({term, tool}))).sort((a,b)=>b.term.length-a.term.length);
  for (const {term,tool} of terms) remainder = remainder.replace(expression(term), (match,prefix,word,offset) => {
    // Determine negation from the current clause, not a previous sentence.
    const clause = remainder.slice(0,offset).split(/[,;.]/).pop();
    if (/\b(?:sin|excluir)\s*$|\bno (?:usar|utilizar|incluir)\s*$/.test(clause)) excluded.add(tool.id);
    else { selected.add(tool.id); mentions.push({name:tool.label,toolId:tool.id,cataloged:true}); }
    return prefix+' '.repeat(word.length);
  });
  for (const name of unregisteredNames) if (!catalog.tools.some(t=>normalize(t.id)===name||normalize(t.label)===name)) remainder = remainder.replace(expression(name), (match,prefix,word) => { mentions.push({name,toolId:null,cataloged:false});return prefix+' '.repeat(word.length); });
  const kinds = domains.filter(([,terms])=>matches(normalize(text),terms)).map(([id])=>id);
  const inferred={react:'frontend',vue:'frontend',angular:'frontend',nextjs:'frontend',fastapi:'backend',django:'backend',flask:'backend',nestjs:'backend',express:'backend',terraform:'devops',pulumi:'devops',postgresql:'database',mysql:'database',sqlite:'database',oracle:'database',sqlserver:'database'};
  for(const id of selected)if(inferred[id]&&!kinds.includes(inferred[id]))kinds.push(inferred[id]);
  const targets = Object.entries(platforms).filter(([,terms])=>matches(normalize(text),terms)).map(([id])=>id);
  // Remove only recognized intent language. Unknown requirements remain visible.
  for (const term of [...domains.flatMap(([,terms])=>terms),...Object.values(platforms).flat(),'microservicios','servicios independientes','monolito modular','monolito','multiplataforma','aplicacion','aplicaciones','proyecto','proyectos','sistema','software','plataforma','continuar','existente','actual','personalizaciones','sobrescribir','sin sobrescribir','conservar','mantener','crear','quiero','necesito','desarrollar','una','un','el','la','los','las','de','del','con','para','y','en','sin','usar','no','utilizar','incluir','excluir'].sort((a,b)=>b.length-a.length)) remainder = remainder.replace(expression(term),' ');
  const continuation = /\b(?:continuar|existente|actual)\b/.test(normalize(text));
  const unknown = [...new Set(remainder.match(/[a-z0-9#+.-]+/g)||[])].filter(s=>s!=='.');
  const technologies = [...new Map(mentions.map(m=>[m.toolId||m.name,m])).values()].sort((a,b)=>a.name.localeCompare(b.name));
  const positive = normalize(text).replace(/\bsin\s+(?:microservicios|servicios independientes|monolito(?: modular)?)/g,' ');
  return {domains:kinds.length?kinds:['custom'],targets,technologies,excluded:[...excluded].sort(),contradictions:[...selected].filter(id=>excluded.has(id)).sort(),unknown,continuation,architecture:{independent:/\bmicroservicios\b|\bservicios independientes\b/.test(positive),modular:/\bmonolito(?: modular)?\b/.test(positive)}};
}
function useTechnical(text) {
  // Preserve explicit example workflows; general technical requests need no
  // module selection. A caller may force advisory planning with --technical.
  return !/\b(?:crm|pos|erp|inventarios?|ventas?|compras?|proveedores?|caja|whatsapp|messenger|instagram|tiktok|chatbot|facturacion|marketing|reservas|citas)\b/.test(normalize(text));
}
function prepare(text,{destination,action='plan',forced=false,resourceOptions={},diagnose=false,evidence:previousEvidence}={}) {
  if(action!=='plan'||typeof forced!=='boolean')throw Error('El plan técnico solo admite planificación consultiva.');
  const api = require('../kit-first/service'),evidence = previousEvidence?api.requireTechnicalCurrent(previousEvidence,destination):api.discover({destination,technicalOnly:true});
  const requirements = interpret(text),inspection = evidence.inspection;
  if(typeof diagnose!=='boolean')throw Error('Diagnóstico debe autorizarse explícitamente.');
  if(diagnose&&resourceOptions.report)throw Error('No mezcles --diagnose con un reporte guardado.');
  const bridge=require('./resources');
  if(diagnose)resourceOptions={...resourceOptions,report:bridge.diagnose({requirements,evidence,text}),diagnosticMode:'live-doctor'};
  const resources=bridge.connect({requirements,evidence,text,input:resourceOptions});
  const existing = inspection.scenario !== 'new', questions = [],limitations = [];
  if(requirements.continuation&&!existing)limitations.push({code:'existing-project-required',detail:'La solicitud pide continuar, pero el destino no existe. Indica --project con la carpeta existente para inspeccionar su stack y personalizaciones.'});
  if (requirements.unknown.length) questions.push({id:'requirements',question:'Precisar alcance y criterios para: '+requirements.unknown.join(', '),options:[]});
  if (requirements.domains.some(d=>['mobile','desktop','game','custom'].includes(d))) questions.push({id:'design-choice',question:'Confirma plataformas, enfoque de implementación y criterios de aceptación.',options:[]});
  if (!requirements.technologies.length) questions.push({id:'stack',question:existing?'Verificar el stack observado antes de decidir cambios.':'Elegir stack después de revisar requisitos y restricciones.',options:[]});
  if (requirements.contradictions.length) questions.push({id:'technology-conflict',question:'Se solicita y excluye: '+requirements.contradictions.join(', '),options:[]});
  if (requirements.architecture.independent&&requirements.architecture.modular) questions.push({id:'architecture',question:'Aclara monolito modular o servicios independientes.',options:[]});
  for (const tech of requirements.technologies.filter(t=>!t.cataloged)) limitations.push({code:'technology-not-cataloged',detail:tech.name+': sin registro ni preparación verificada. Evaluar documentación oficial y añadir un registro revisado; no sustituir la tecnología solicitada.'});
  if (requirements.domains.includes('iot')&&/\besp32\b/.test(normalize(text))) limitations.push({code:'board-not-verified',detail:'ESP32 es una familia de hardware; confirmar placa y toolchain. No se prueba compilación ni conexión física.'});
  if (!inspection.complete) limitations.push({code:'inspection-incomplete',detail:'La inspección tiene límites pendientes. Acotar/revisar las rutas señaladas antes de cualquier cambio; el plan no autoriza escrituras.'});
  if(resources.toolPlan?.blockers.length)limitations.push({code:'tool-plan-blocked',detail:'El plan de herramientas contiene conflictos de versión, plataforma o dependencias; revisarlos antes de preparar el entorno.'});
  if(resources.environmentDecisions.length||resources.toolPlan?.decisions.length)questions.push({id:'environment-decisions',question:'Revisar decisiones de herramientas, versión exacta, gestores y preparadores en resources.',options:[]});
  const observed = ['language','framework','database','component'].flatMap(category=>inspection.signals.filter(s=>s.category===category));
  const steps = [
    {id:'inspect',description:existing?'Revisar manifiestos, contratos, pruebas y personalizaciones existentes sin ejecutar su código.':'Definir alcance y revisar el destino nuevo sin crear archivos.'},
    {id:'reuse',description:'Reutilizar stack, autenticación, persistencia y recursos observados; verificar inferencias antes de modificarlos.'},
    ...requirements.domains.map(domain=>({id:'design-'+domain,description:domains.find(([id])=>id===domain)[2]})),
    {id:'prepare',description:'Tras decidir stack, preparar un plan revisable de entorno y versiones con las herramientas existentes del kit; no ejecutar instalaciones.'},
    {id:'handoff',description:'Entregar a la IA requisitos, decisiones, interfaces, restricciones y criterios de aceptación; aprobar cambios acotados.'},
    {id:'validate',description:'Elegir validaciones del stack, revisar comandos y solicitar autorización antes de ejecutar código no confiable; registrar resultados reales y repetir tras correcciones.'}
  ];
  const payload = {schemaVersion:1,kind:'technical-project-plan',text,action,forced,evidence,requirements,resources,
    status:!inspection.complete?'needs-inspection':questions.length||resources.toolPlan?.blockers.length||limitations.some(l=>l.code==='technology-not-cataloged')?'needs-decisions':'ready-for-review',
    questions,limitations,observed,architecture:{status:'proposed-for-review',preserveExisting:existing||requirements.continuation,approach:existing?'Conservar la arquitectura observada; revisar cambios incrementales antes de proponer sustituciones.':requirements.architecture.independent?'Evaluar las razones para límites independientes y sus contratos; no distribuir automáticamente.':'Definir límites modulares y contratos según el tipo de software; no imponer microservicios ni un runtime.'},
    steps,acceptance:['El plan conserva las tecnologías solicitadas y hace explícitas las decisiones pendientes.','No exige capacidades comerciales ni declara una herramienta instalada o integración verificada.','No sobrescribe archivos ni ejecuta instalaciones, código del proyecto, contenedores o servicios.'],
    generation:{available:false,reason:'Plan técnico independiente de generadores. Los ejemplos conservan sus comandos explícitos de composición.'},files:[],commands:[],executionAllowed:false,ok:true};
  return {planId:digest(payload),...payload};
}
function validate(value,destination) {
  try {
    if(value?.kind!=='technical-project-plan')throw Error('Tipo de plan técnico inválido.');
    const check=new(require('ajv'))({allErrors:true}).compile(require('../../schemas/technical-plan.schema.json'));
    if(!check(value))throw Error('Plan técnico fuera de esquema.');
    const mode=value.resources.diagnostics.mode;
    const expected=prepare(value.text,{destination,evidence:value.evidence,action:value.action,forced:value.forced,resourceOptions:{...value.resources.request,...(mode==='not-run'?{}:{report:value.resources.diagnostics.observation,diagnosticMode:mode})}});
    if(canonical(value)!==canonical(expected))throw Error('Plan técnico alterado o desactualizado.');
    return {ok:true,scope:'advisory-plan-only',executionAllowed:false};
  }catch(e){return {ok:false,errors:[e.message],executionAllowed:false};}
}
module.exports={interpret,useTechnical,prepare,validate};
