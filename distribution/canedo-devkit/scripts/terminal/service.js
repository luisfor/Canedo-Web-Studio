'use strict';
const fs = require('node:fs'), path = require('node:path');
const api = require('../kit-first/service');
const { digest, canonical } = require('../planner/plan');
function prepare(text, { destination, action = 'plan', explicitDestination = true, provider, allowProvider = false, technicalOnly=false,resourceOptions={},diagnose=false,usageLedger } = {}) {
  if (!['plan', 'create', 'enhance'].includes(action)) throw Error('Operación terminal no admitida.');
  const technical=require('./technical');
  if(technicalOnly&&action!=='plan')throw Error('--technical solo prepara planes; no modifica proyectos.');
  if((technicalOnly||!provider&&technical.useTechnical(text))&&action==='plan')return technical.prepare(text,{destination,action,forced:technicalOnly,resourceOptions,diagnose});
  if(diagnose||Object.keys(resourceOptions).length)throw Error('Opciones de entorno solo disponibles en planificación técnica; usa plan --technical.');
  const interpreter=require('./interpret'),memory=require('../memory/store'),enhancement=require('../memory/enhance');
  const evidence = api.discover({ destination, agent: 'codex-cli-json' });
  const registry = evidence.discovery.catalogs.composition, requirements = interpreter.interpret(text, registry, { provider, allowProvider,usageLedger });
  const questions = [...requirements.questions], blockers = [], selected = new Set(requirements.capabilities);
  const visit = id => { for (const dependency of registry.capabilities.find(c => c.id === id)?.requires || []) if (!selected.has(dependency)) { selected.add(dependency); visit(dependency); } };
  for (const id of [...selected]) visit(id);
  const missing = [...selected].filter(id => !registry.capabilities.some(c => c.id === id)).sort();
  if (missing.length) blockers.push({ code: 'capability-not-available', modules: missing, detail: 'Requisito reconocido, todavía sin módulo registrado. No se omite ni se presenta como disponible.' });
  for (const id of requirements.excluded) if (selected.has(id)) blockers.push({ code: 'excluded-dependency', modules: [id] });
  if (!selected.size && !questions.length) questions.push({ id: 'goal', question: '¿Qué función debe implementar la aplicación?', options: ['Inventario y ventas', 'CRM', 'Otro módulo: definir alcance'] });
  const isNew = evidence.inspection.scenario === 'new';
  if (action === 'create' && !explicitDestination) questions.push({ id: 'destination', question: 'Indica --out con una carpeta nueva para generar el proyecto.', options: [] });
  if (action === 'create' && !isNew) blockers.push({ code: 'destination-exists', detail: 'El destino existe; utiliza un plan de mejora, sin regenerarlo.' });
  if (action === 'enhance' && isNew) blockers.push({ code: 'project-not-found', detail: 'Selecciona el proyecto existente mediante --project.' });
  if (!isNew && !fs.existsSync(path.join(destination, '.devkit/project.json'))) blockers.push({ code: 'adoption-required', detail: 'Revisa la inspección y adopta explícitamente la memoria mediante kit:memory adopt.' });
  let core = null;
  if (!questions.length && !blockers.length) {
    const aliases = [...selected].sort().map(id => registry.capabilities.find(c => c.id === id).aliases[0]);
    const technology = [...requirements.languages.map(l => l === 'csharp' ? '.NET' : l), ...requirements.frameworks, ...requirements.databases];
    const coreText = [...aliases, ...technology].join(', ');
    if (isNew) core = api.plan({ evidence, destination, request: { text: coreText, architecture: requirements.architecture, docker: requirements.infrastructure.includes('docker') } });
    else { memory.read(destination); core = enhancement.plan({ evidence, destination, text: coreText }); }
    if (!core.ok) blockers.push({ code: 'generation-blocked', detail: 'Consulta los conflictos del plan de composición/mejora.' });
  }
  const packages=evidence.discovery.catalogs.commercial.packages.map(p=>({id:p.id,status:p.status,matched:p.modules.filter(id=>selected.has(id)),missing:p.generatorSupport.missingModules})).filter(p=>p.matched.length).sort((a,b)=>b.matched.length-a.matched.length||a.id.localeCompare(b.id));
  const payload = { schemaVersion: 1, kind: 'terminal-project-plan', text, action, explicitDestination, requirements, questions, blockers, evidence, core, missing,packages,
    status: questions.length ? 'needs-clarification' : blockers.length ? 'blocked' : 'ready', executionAllowed: false };
  return { planId: digest(payload), ...payload, ok: payload.status === 'ready' };
}
function validate(value, destination) {
  if(value?.kind==='technical-project-plan')return require('./technical').validate(value,destination);
  try {
    if (value?.kind !== 'terminal-project-plan') throw Error('Plan de terminal no admitido.');
    const provider = value.requirements?.provider !== 'spanish-terminal-v1' ? { id: value.requirements?.provider, interpret: () => value.requirements } : undefined;
    const fresh = prepare(value.text, { destination, action: value.action, explicitDestination: value.explicitDestination, provider, allowProvider: !!provider });
    if (canonical(fresh) !== canonical(value) || !fresh.ok) throw Error('Plan de terminal bloqueado, modificado o desactualizado.');
    return { ok: true, executionAllowed: false };
  } catch (e) { return { ok: false, errors: [e.message], executionAllowed: false }; }
}
function create(value, destination) {
  if (!validate(value, destination).ok || !['create', 'plan'].includes(value.action) || value.evidence.inspection.scenario !== 'new' || value.core?.kind !== 'kit-first-agent-plan') throw Error('Plan de creación no válido.');
  return api.create(value.core, destination);
}
module.exports = { prepare, validate, create };
