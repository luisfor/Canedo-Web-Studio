'use strict';
const fs = require('node:fs'), path = require('node:path');
const api = require('../kit-first/service'), { canonical } = require('../planner/plan');
const requestSchema = require('../../schemas/agent-request.schema.json');
const project = { type: 'string', minLength: 1, maxLength: 4096 };
const evidence = { type: 'object' }, plan = { type: 'object' };
function input(properties, required) { return { type: 'object', additionalProperties: false, properties, required }; }
function tool(name, description, schema, writes = false) { return { name, description, inputSchema: schema, annotations: { readOnlyHint: !writes, destructiveHint: false, idempotentHint: !writes, openWorldHint: false } }; }
const definitions = [
  tool('kit_discover', 'Consultar versión/catálogos e inspeccionar el destino antes de generar.', input({ project }, ['project'])),
  tool('kit_inspect', 'Inspección estática sin ejecutar el proyecto; no acredita funcionalidad probada.', input({ project }, ['project'])),
  tool('kit_modules', 'Consultar módulos/arquetipos y referencias del catálogo descubierto.', input({ project, evidence }, ['project', 'evidence'])),
  tool('kit_dependencies', 'Consultar dependencias declaradas sin instalarlas.', input({ project, evidence, id: { type: 'string', pattern: '^[a-z][a-z0-9-]{0,63}$' }, kind: { enum: ['module', 'tool'] } }, ['project', 'evidence', 'id', 'kind'])),
  tool('kit_plan', 'Preparar código mediante KIT-FIRST; requiere descubrimiento en esta conexión.', input({ project, evidence, request: requestSchema }, ['project', 'evidence', 'request'])),
  tool('kit_validate', 'Revalidar un plan emitido por esta conexión, sin ejecutar comandos.', input({ project, plan }, ['project', 'plan'])),
  tool('kit_enhance', 'Preparar una mejora incremental revisable, sin aplicarla.', input({ project, evidence, request: { type: 'string', minLength: 3, maxLength: 4000 } }, ['project', 'evidence', 'request'])),
  tool('kit_memory_status', 'Consultar manifiesto, pendientes y diferencias de archivos.', input({ project }, ['project'])),
  tool('kit_generate', 'Crear solo un destino nuevo desde un plan revisado. Requiere permiso de escritura del servidor e ID exacto.', input({ project, plan, confirmation: { type: 'string', pattern: '^[a-f0-9]{64}$' } }, ['project', 'plan', 'confirmation']), true)
];

function controller({ root, allowGenerate = false,maxContextBytes=8192 }) {
  if (typeof root !== 'string' || !path.isAbsolute(root) || path.normalize(root) !== root) throw Error('Se requiere --root absoluto normalizado.');
  let parent = root;
  while (true) { const stat = fs.lstatSync(parent); if (!stat.isDirectory() || stat.isSymbolicLink()) throw Error('La raíz debe existir sin enlaces.'); const next = path.dirname(parent); if (next === parent) break; parent = next; }
  const progressive=require('./progressive'),progressiveSession=progressive.session({maxContextBytes});
  const tools = [...definitions.filter(t => allowGenerate || t.name !== 'kit_generate'),...progressive.definitions];
  const ajv = new (require('ajv'))({ allErrors: true });
  const validators = new Map(tools.map(t => [t.name, ajv.compile(t.inputSchema)]));
  const discoveries = new Map(), plans = new Map(), validated = new Set();
  function scope(target) {
    if (typeof target !== 'string' || !path.isAbsolute(target) || path.normalize(target) !== target) throw Error('El proyecto debe ser absoluto y normalizado.');
    const relative = path.relative(root, target);
    if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw Error('Proyecto fuera de la raíz autorizada.');
    return target;
  }
  function remember(map, id, value) { if (map.size >= 128) { const oldest = map.keys().next().value; map.delete(oldest); if (map === plans) validated.delete(oldest); } map.set(id, value); }
  function requireDiscovery(e, target) {
    if (!e || discoveries.get(e.evidenceId) !== target) throw Error('Consulta kit_discover en esta conexión antes de planificar o generar.');
    return api.requireCurrent(e, target);
  }
  function requirePlan(p, target) {
    const issued = p && plans.get(p.planId);
    if (!issued || issued.target !== target || canonical(issued.plan) !== canonical(p)) throw Error('Plan no emitido por esta conexión.');
    requireDiscovery(p.evidence, target);
    return p;
  }
  function call(name, args) {
    const validator = validators.get(name);
    if (!validator || !validator(args)) throw Error('Herramienta o argumentos no admitidos.');
    const target = scope(args.project);
    if(progressive.definitions.some(t=>t.name===name))return progressiveSession.call(name,{...args,project:target});
    if (name === 'kit_discover') { const result = api.discover({ destination: target }); remember(discoveries, result.evidenceId, target); return result; }
    if (name === 'kit_inspect') return api.inspect(target);
    if (name === 'kit_memory_status') return require('../memory/store').status(target);
    if (name === 'kit_modules') return requireDiscovery(args.evidence, target).discovery.catalogs.composition;
    if (name === 'kit_dependencies') {
      const current = requireDiscovery(args.evidence, target), registry = args.kind === 'module' ? current.discovery.catalogs.composition.capabilities : current.discovery.catalogs.tools.tools;
      const seen = new Set(), result = [];
      function visit(id) { if (seen.has(id)) return; const item = registry.find(i => i.id === id); if (!item) throw Error('Dependencia no registrada.'); seen.add(id); const edges = args.kind === 'module' ? item.requires.map(id => ({ id, optional: false })) : item.dependencies; result.push({ id, dependencies: edges }); for (const edge of edges) visit(edge.id); }
      visit(args.id); return { kind: args.kind, dependencies: result, installationExecuted: false };
    }
    if (name === 'kit_plan') { requireDiscovery(args.evidence, target); const result = api.plan({ evidence: args.evidence, destination: target, request: args.request }); remember(plans, result.planId, { target, plan: result }); return result; }
    if (name === 'kit_enhance') { requireDiscovery(args.evidence, target); return require('../memory/enhance').plan({ evidence: args.evidence, destination: target, text: args.request }); }
    if (name === 'kit_validate') { requirePlan(args.plan, target); const result = api.validate(args.plan, target); if (result.ok) validated.add(args.plan.planId); return result; }
    if (name === 'kit_generate') { requirePlan(args.plan, target); if (!validated.has(args.plan.planId)) throw Error('Ejecuta kit_validate antes de generar.'); if (args.confirmation !== args.plan.planId) throw Error('Confirma el plan exacto revisado.'); return api.create(args.plan, target); }
    throw Error('Operación no admitida.');
  }
  return { tools, call };
}
module.exports = { controller };
