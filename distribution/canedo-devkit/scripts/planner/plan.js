'use strict';
const fs = require('node:fs');
const crypto = require('node:crypto');
const Ajv = require('ajv');
const { assessVersion } = require('../doctor/environment');
const { validateToolCatalog } = require('../tools/catalog');
const ajv = new Ajv({ allErrors: true, strict: true, strictRequired: false });
const validateReportSchema = ajv.compile(require('../../schemas/diagnostic-report.schema.json'));
const validatePlanSchema = ajv.compile(require('../../schemas/tool-plan.schema.json'));
const SYSTEM_PROVIDERS = { win32: ['winget'], darwin: ['homebrew'], linux: ['apt', 'dnf'] };
const PROJECT_PROVIDERS = { node: ['npm', 'pnpm', 'yarn'], python: ['uv', 'pip'], go: ['go-modules'], java: ['maven', 'gradle'], dotnet: ['dotnet'] };
const PROVIDERS = new Set([...Object.values(SYSTEM_PROVIDERS).flat(), ...Object.values(PROJECT_PROVIDERS).flat()]);
const ID = /^[a-z][a-z0-9-]{0,63}$/;
const EXACT_VERSION = /^\d+\.\d+\.\d+$/;
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
function digest(value) { return crypto.createHash('sha256').update(canonical(value)).digest('hex'); }
function readJson(file) {
  try {
    if (!fs.statSync(file).isFile() || fs.statSync(file).size > 1024 * 1024) throw new Error();
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch { throw new Error('No se pudo leer el archivo JSON (límite 1 MiB). No se ejecutó su contenido.'); }
}
function normalizeRequest(manifest, capabilities, options) {
  const available = new Set(manifest.tools.map(t => t.id));
  const tools = [...new Set(options.tools || [])].sort(), exclude = [...new Set(options.exclude || [])].sort();
  const profile = options.profile || null, manager = options.manager || null;
  if (profile && !capabilities.profiles.some(p => p.id === profile)) throw new Error('Perfil desconocido.');
  if (!tools.length && !profile) throw new Error('Selecciona --profile o al menos una --tool.');
  if ([...tools, ...exclude].some(id => !ID.test(id) || !available.has(id))) throw new Error('Herramienta o exclusión desconocida.');
  if (manager && !PROVIDERS.has(manager)) throw new Error('Gestor no reconocido por el planificador.');
  const versions = {};
  for (const id of Object.keys(options.versions || {}).sort()) {
    if (!available.has(id) || !EXACT_VERSION.test(options.versions[id])) throw new Error('La versión debe referirse a una herramienta conocida y tener formato X.Y.Z.');
    versions[id] = options.versions[id];
  }
  return { profile, tools, exclude, versions, manager };
}
function selectTools(manifest, capabilities, request) {
  const byId = new Map(manifest.tools.map(t => [t.id, t]));
  const roots = [...new Set([...(request.profile ? capabilities.profiles.find(p => p.id === request.profile).tools : []), ...request.tools])].sort();
  const ordered = [], visited = new Set();
  function visit(id) {
    if (visited.has(id)) return;
    visited.add(id);
    for (const edge of [...byId.get(id).dependencies].sort((a, b) => a.id.localeCompare(b.id))) visit(edge.id);
    ordered.push(id);
  }
  roots.forEach(visit);
  if (Object.keys(request.versions).some(id => !visited.has(id))) throw new Error('Se indicó una versión para una herramienta no seleccionada ni requerida.');
  return { roots, ordered, byId };
}
function normalizeObservation(report, manifest, selected, source) {
  if (!validateReportSchema(report)) throw new Error('Reporte de diagnóstico inválido. Se requiere la salida JSON del doctor (esquema 2).');
  if (!['live-doctor', 'provided-report'].includes(source)) throw new Error('Procedencia del diagnóstico inválida.');
  if (new Set(report.checks.map(c => c.tool)).size !== report.checks.length || new Set(report.packageManagers.map(m => m.id)).size !== report.packageManagers.length) throw new Error('El reporte de diagnóstico contiene identificadores duplicados.');
  const definitions = new Map(manifest.tools.map(t => [t.id, t]));
  const checks = selected.filter(id => definitions.get(id).availability === 'diagnostic').map(id => {
    const raw = report.checks.find(c => c.tool === id) || { status: 'unverifiable', version: null };
    const policy = definitions.get(id).versionPolicy;
    // Recompute using current catalog policy: report-provided compatibility is never authoritative.
    const compatibility = assessVersion(raw.version, policy.state === 'declared' ? policy.requirement : undefined);
    let status = raw.status;
    if (['detected', 'incompatible'].includes(status)) status = compatibility.status === 'incompatible' ? 'incompatible' : compatibility.status === 'unverifiable' ? 'unverifiable' : 'detected';
    return { tool: id, status, version: raw.version, compatibility };
  });
  return {
    schemaVersion: 2, source,
    system: { platform: report.system.platform, architecture: report.system.architecture,
      version: report.system.version || null, release: report.system.release || null,
      distribution: report.system.distribution ? { id: report.system.distribution.id || null, version: report.system.distribution.version || null, like: [...(report.system.distribution.like || [])].sort() } : null },
    checks: checks.sort((a, b) => a.tool.localeCompare(b.tool)),
    packageManagers: report.packageManagers.filter(m => PROVIDERS.has(m.id)).map(m => ({ id: m.id, status: m.status, version: m.version || null })).sort((a, b) => a.id.localeCompare(b.id))
  };
}
function providerCandidates(tool, observation) {
  if (tool.kind === 'database-service') return [];
  let ids = SYSTEM_PROVIDERS[observation.system.platform] || [];
  if (tool.kind === 'project-package') ids = [...new Set(tool.dependencies.flatMap(d => PROJECT_PROVIDERS[d.id] || []))];
  return ids.map(id => {
    const manager = observation.packageManagers.find(m => m.id === id);
    const go = id === 'go-modules' && observation.checks.find(c => c.tool === 'go');
    const status = go ? go.status : manager?.status;
    return { id, presence: status === 'detected' ? 'present' : status === 'missing' ? 'absent' : 'unknown', recipeVerified: false };
  });
}
function createPlan(manifest, capabilities, report, options, { source = 'provided-report' } = {}) {
  if (!validateToolCatalog(manifest, capabilities).ok) throw new Error('Catálogo inválido; no se puede generar un plan.');
  const request = normalizeRequest(manifest, capabilities, options);
  const { roots, ordered, byId } = selectTools(manifest, capabilities, request);
  const observation = normalizeObservation(report, manifest, ordered, source);
  const blockers = [], decisions = [];
  const issue = (list, code, tool, message) => { if (!list.some(i => i.code === code && i.tool === tool)) list.push({ code, tool, message }); };
  if (!Object.hasOwn(SYSTEM_PROVIDERS, observation.system.platform)) issue(blockers, 'unrecognized-platform', null, 'No existe una ruta de instalación definida para esta familia de sistema.');
  if (!['x64', 'arm64'].includes(observation.system.architecture)) issue(decisions, 'architecture-unverified', null, 'Debe verificarse la disponibilidad de artefactos para esta arquitectura.');
  if (!ordered.length) issue(decisions, 'profile-needs-tools', null, 'El perfil no define herramientas; selecciona primero el stack o motor.');
  for (const id of ordered) {
    const tool = byId.get(id);
    if (request.exclude.includes(id)) issue(blockers, 'required-tool-excluded', id, 'Se excluyó una herramienta solicitada o una dependencia obligatoria.');
    if (tool.platforms && !tool.platforms.includes(observation.system.platform)) issue(blockers, 'platform-restriction', id, 'La herramienta declara una restricción incompatible con este sistema.');
    for (const other of tool.conflicts) if (ordered.includes(other)) issue(blockers, 'selected-tools-conflict', id, 'Una herramienta seleccionada tiene un conflicto declarado dentro de la selección.');
  }
  const items = ordered.map(id => {
    const tool = byId.get(id), found = observation.checks.find(c => c.tool === id);
    const current = found ? { status: found.status, version: found.version, compatibility: found.compatibility } : { status: 'unverifiable', version: null, compatibility: { status: 'not-assessed', reason: 'no-diagnostic' } };
    const targetVersion = request.versions[id] || null;
    const targetCompatibility = targetVersion ? assessVersion(targetVersion, tool.versionPolicy.state === 'declared' ? tool.versionPolicy.requirement : undefined) : { status: 'not-assessed', reason: 'target-not-selected' };
    if (targetCompatibility.status === 'incompatible') issue(blockers, 'target-outside-policy', id, 'La versión solicitada está fuera de la política declarada del catálogo.');
    let intent;
    if (tool.kind === 'database-service') {
      intent = 'choose-deployment';
      issue(decisions, 'service-deployment', id, 'Decide si el servicio será local, remoto o en contenedor; no se presupone una instalación local.');
    } else if (current.status === 'missing') {
      intent = 'install';
    } else if (current.status === 'detected' && current.compatibility.status === 'compatible' && (!targetVersion || targetVersion === current.version)) {
      intent = 'reuse';
    } else if (['detected', 'incompatible'].includes(current.status)) {
      intent = 'review-existing';
      issue(decisions, 'existing-tool-review', id, 'La herramienta preexistente necesita revisión de versión o compatibilidad. No se reemplazará automáticamente.');
    } else {
      intent = 'inspect';
      issue(decisions, 'diagnostic-required', id, 'No hay un diagnóstico suficiente: no se puede asumir que la herramienta falte o funcione.');
    }
    if (blockers.some(b => b.tool === id)) intent = 'blocked';
    const candidates = providerCandidates(tool, observation);
    let selectedProvider = null;
    if (intent === 'install' || (intent === 'inspect' && tool.kind === 'project-package')) {
      if (!targetVersion) issue(decisions, 'exact-version-required', id, 'Selecciona una versión exacta y verifica que exista en una fuente autorizada.');
      if (targetCompatibility.status === 'not-assessed' && targetVersion) issue(decisions, 'target-compatibility-unverified', id, 'La versión elegida carece de una regla de compatibilidad evaluable para este proyecto.');
      if (request.manager) {
        const candidate = candidates.find(c => c.id === request.manager);
        if (!candidate) { issue(blockers, 'provider-not-applicable', id, 'El gestor solicitado no figura como candidato para esta herramienta y plataforma.'); intent = 'blocked'; }
        else {
          selectedProvider = candidate.id;
          if (candidate.presence !== 'present') issue(decisions, 'provider-not-verified', id, 'El gestor seleccionado no está verificado como disponible; no se instalará de oficio.');
        }
      } else issue(decisions, 'provider-choice', id, 'Selecciona y verifica el proveedor o gestor apropiado; los candidatos no son recetas aprobadas.');
    }
    if (intent !== 'reuse' && intent !== 'blocked') issue(decisions, 'execution-details-pending', id, 'Faltan receta, origen de artefacto, integridad, destino, permisos y efectos concretos. Requieren las fases de instalación posteriores.');
    return {
      tool: id, label: tool.label, kind: tool.kind, role: roots.includes(id) ? 'requested' : 'dependency',
      intent, current, targetVersion, targetCompatibility,
      ownership: current.status === 'missing' ? 'not-found' : 'pre-existing-or-unknown',
      scope: tool.kind === 'project-package' ? 'project' : tool.kind === 'database-service' ? 'undecided' : 'user-or-system-pending',
      selectedProvider, providerCandidates: candidates,
      dependencies: tool.dependencies.map(d => d.id).sort(),
      optionalDependencies: tool.optionalDependencies.map(d => d.id).sort(),
      sources: tool.sources.map(s => s.url), recipeStatus: 'not-implemented'
    };
  });
  const payload = {
    schemaVersion: 1, plannerVersion: '1.0.0', catalogVersion: manifest.catalogVersion,
    catalogDigest: digest(manifest), capabilitiesDigest: digest(capabilities),
    request, observation, items,
    blockers, decisions,
    status: blockers.length ? 'blocked' : decisions.length ? 'needs-decisions' : 'reviewable',
    ok: !blockers.length && !decisions.length,
    executionAllowed: false, approval: 'not-requested',
    scope: 'review-only',
    note: 'Este plan no es ejecutable ni una autorización. No incluye comandos de instalación. Se deberá revalidar el entorno, concretar los efectos y pedir aprobación antes de aplicar cambios.'
  };
  return { planId: digest(payload), ...payload };
}
function validatePlan(plan, manifest, capabilities) {
  const errors = [];
  if (!validatePlanSchema(plan)) return { ok: false, errors: validatePlanSchema.errors.map(e => `schema ${e.instancePath || '/'}: ${e.message}`), environmentRechecked: false };
  if (plan.catalogDigest !== digest(manifest) || plan.catalogVersion !== manifest.catalogVersion) errors.push('El catálogo cambió; regenera el plan.');
  if (plan.capabilitiesDigest !== digest(capabilities)) errors.push('Los perfiles del kit cambiaron; regenera el plan.');
  const { planId, ...payload } = plan;
  if (planId !== digest(payload)) errors.push('La huella no coincide con el contenido del plan.');
  if (!errors.length) {
    try {
      const rebuilt = createPlan(manifest, capabilities, plan.observation, plan.request, { source: plan.observation.source });
      if (canonical(rebuilt) !== canonical(plan)) errors.push('El plan no corresponde a las reglas actuales o contiene decisiones alteradas.');
    } catch { errors.push('No se pudo reconstruir el plan con los datos declarados.'); }
  }
  return { ok: !errors.length, planId, errors, environmentRechecked: false,
    note: 'La huella identifica contenido; no es firma, permiso ni prueba de autenticidad del diagnóstico.' };
}
module.exports = { PROVIDERS, canonical, digest, readJson, normalizeRequest, selectTools, normalizeObservation, createPlan, validatePlan };
