'use strict';
const { canonical, digest } = require('../planner/plan');
const discovery = require('./discovery');
const inspector = require('./inspect');
const Ajv = require('ajv');
const schema = require('../../schemas/kit-first.schema.json');
const checkEvidence = new Ajv({ allErrors: true }).compile(schema);
const checkRequest = new Ajv({ allErrors: true }).compile(require('../../schemas/agent-request.schema.json'));
function validateRequest(request) {
  if (!checkRequest(request)) throw Error('Solicitud de agente inválida. Las extensiones/proveedores requieren descubrimiento explícito; usa las capacidades publicadas por esta interfaz.');
  if (/(?:password|contrase[ñn]a|api[_ -]?key|token|secret)\s*[:=]\s*\S|https?:\/\/[^\s/]+:[^\s/]+@/i.test(request.text)) throw Error('No incluyas credenciales en solicitudes o manifiestos.');
  return request;
}

function discover({ destination, agent = 'generic-cli-json', technicalOnly=false }) {
 return discoverEfficient({destination,agent,technicalOnly,cache:'off',full:true}).evidence;
}
function discoverEfficient({destination,agent='generic-cli-json',technicalOnly=true,cache='memory',full=false}){
  if (!['codex-cli-json', 'generic-cli-json'].includes(agent)) throw Error('Interfaz de agente no soportada.');
  const discovered=discovery.discover({technicalOnly});
  const scan=inspector.analyze(destination,{cache,full});
  const payload = { schemaVersion: 1, kind: 'kit-first-evidence', agent, discovery: discovered, inspection: scan.inspection };
  const value = { evidenceId: digest(payload), ...payload };
  if (!checkEvidence(value)) throw Error('Evidencia KIT-FIRST fuera de esquema.');
  if (Buffer.byteLength(JSON.stringify(value)) > 900 * 1024) throw Error('Inspección demasiado grande para este transporte; acota el proyecto.');
  return {evidence:value,metrics:scan.metrics};
}

function requireCurrent(evidence, destination) {
  if (!checkEvidence(evidence)) throw Error('Se requiere evidencia KIT-FIRST válida: consulta el kit e inspecciona el destino.');
  const current = discover({ destination, agent: evidence.agent });
  if (canonical(current) !== canonical(evidence)) throw Error('Evidencia KIT-FIRST desactualizada o de otro destino; repite descubrimiento e inspección.');
  if (!current.inspection.complete) throw Error('Inspección incompleta; resuelve sus límites antes de generar.');
  return current;
}
function requireTechnicalCurrent(evidence,destination) {
  if(!checkEvidence(evidence))throw Error('Se requiere evidencia KIT-FIRST técnica válida.');
  const current=discover({destination,agent:evidence.agent,technicalOnly:true});
  if(canonical(current)!==canonical(evidence))throw Error('Evidencia técnica desactualizada o de otro destino.');
  // Read-only planning can describe incomplete inspection, never authorize writes.
  return current;
}

function assessReuse(evidence, request) {
  const registry = evidence.discovery.catalogs.composition;
  const intent = require('../composition/intents').interpret(request.text, registry);
  const wanted = new Set(intent.selected);
  const seen = new Set();
  function include(id) {
    if (seen.has(id)) return;
    seen.add(id);
    for (const dependency of registry.capabilities.find(c => c.id === id)?.requires || []) include(dependency);
  }
  for (const id of wanted) include(id);
  const candidates = evidence.inspection.signals.filter(s => s.category === 'component' || s.category === 'capability');
  const existingCapabilities = candidates.filter(s => s.category === 'capability' && seen.has(s.id));
  return {
    requested: [...seen].sort(),
    existingCapabilities,
    reuseCandidates: candidates,
    missing: [...seen].filter(id => !existingCapabilities.some(s => s.id === id)).sort(),
    decisions: candidates.map(s => ({ id: s.id, evidence: s.evidence, action: s.certainty === 'inferred' ? 'verify-before-reuse' : 'preserve-and-verify' })),
    note: 'Una declaración o inferencia no acredita implementación ni pruebas. No se sustituye autenticación, persistencia o API existente.'
  };
}

function plan({ evidence, destination, request }) {
  const current = requireCurrent(evidence, destination);
  validateRequest(request);
  const reuse = assessReuse(current, request);
  // Gate precedes the generator call, including generation of source in memory.
  const newProject = current.inspection.scenario === 'new';
  const composition = newProject ? require('../composition/engine').plan(request) : null;
  const blockers = newProject ? (composition.conflicts || []) : [{ code: 'incremental-plan-required', detail: 'Preservar el proyecto existente. La escritura incremental requiere el manifiesto y la etapa de continuidad.' }];
  const payload = {
    schemaVersion: 1, kind: 'kit-first-agent-plan', evidence: current, request, reuse,
    status: newProject && composition.status === 'ready' ? 'ready' : 'blocked',
    blockers, composition, executionAllowed: false,
    completedSteps: ['discover', 'inspect', 'assess-reuse', 'plan']
  };
  return { planId: digest(payload), ...payload, ok: payload.status === 'ready' };
}

function validate(value, destination) {
  try {
    if (!value || value.kind !== 'kit-first-agent-plan') throw Error('Plan de agente no admitido.');
    const rebuilt = plan({ evidence: value.evidence, destination, request: value.request });
    if (canonical(rebuilt) !== canonical(value)) throw Error('Plan de agente alterado.');
    if (value.status !== 'ready') return { ok: false, errors: value.blockers, executionAllowed: false };
    const result = require('../composition/engine').validate(value.composition);
    if (!result.ok) return result;
    return { ok: true, policy: 'kit-first-v1', completedSteps: [...value.completedSteps, 'validate'], executionAllowed: false };
  } catch (error) { return { ok: false, errors: [error.message], executionAllowed: false }; }
}

function create(value, destination) {
  const result = validate(value, destination);
  if (!result.ok) throw Error('KIT-FIRST bloqueó la generación: ' + JSON.stringify(result.errors));
  // Recheck immediately before the existing exclusive writer reserves the path.
  requireCurrent(value.evidence, destination);
  const written = require('../composition/engine').write(value.composition, destination);
  const memory = require('../memory/store').adopt({ evidence: discover({ destination, agent: value.evidence.agent }), destination });
  return { ...written, files: [...written.files, '.devkit/project.json', '.devkit/.gitignore'], manifestId: memory.manifest.manifestId, policy: 'kit-first-v1', evidenceId: value.evidence.evidenceId, completedSteps: [...result.completedSteps, 'generate'] };
}

module.exports = { discover,discoverEfficient, inspect: inspector.inspect, plan, validate, create, requireCurrent,requireTechnicalCurrent, validateRequest };
