'use strict';
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const Ajv = require('ajv');
const { isSafeVersionProbe } = require('../doctor/environment');
const root = path.resolve(__dirname, '../..');
const manifestPath = path.join(root, 'catalog/tools/manifest.json');
const schema = require('../../schemas/tool-catalog.schema.json');
// Conditional required clauses refer to properties defined on their enclosing object.
const ajv = new Ajv({ allErrors: true, strict: true, strictRequired: false });
ajv.addFormat('public-https-source', {
  type: 'string', validate(value) {
    try {
      const u = new URL(value);
      return u.protocol === 'https:' && !u.username && !u.password && !u.search &&
        u.hostname.includes('.') && !net.isIP(u.hostname) && !u.hostname.endsWith('.local');
    } catch { return false; }
  }
});
ajv.addFormat('calendar-date', { type: 'string', validate: s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s });
const validateSchema = ajv.compile(schema);
function compare(a, b) {
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) { const delta = (x[i] || 0) - (y[i] || 0); if (delta) return Math.sign(delta); }
  return 0;
}
function rulePossible(rule) {
  if (rule.min && rule.maxExclusive && compare(rule.min, rule.maxExclusive) >= 0) return false;
  if (!rule.majors) return true;
  return rule.majors.some(major =>
    (!rule.maxExclusive || compare(`${major}.0.0`, rule.maxExclusive) < 0) &&
    (!rule.min || compare(`${major + 1}.0.0`, rule.min) > 0));
}
function readToolCatalog() {
  try {
    if (fs.statSync(manifestPath).size > 2 * 1024 * 1024) throw new Error();
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch { throw new Error('No se pudo leer un manifiesto JSON de herramientas válido (límite 2 MiB).'); }
}
function validateToolCatalog(data, legacy) {
  const errors = [];
  if (!validateSchema(data)) {
    // Never echo source values or raw JSON in diagnostics.
    return { ok: false, catalogVersion: null, tools: 0, diagnostics: 0,
      errors: validateSchema.errors.map(e => `schema ${e.instancePath || '/'}: ${e.message}`) };
  }
  const entries = new Map();
  for (const [index, tool] of data.tools.entries()) {
    if (entries.has(tool.id)) errors.push(`tools/${index}: identificador duplicado`);
    entries.set(tool.id, tool);
    if (tool.diagnostic && !isSafeVersionProbe(tool.diagnostic.command, tool.diagnostic.args)) errors.push(`tools/${index}: combinación de diagnóstico no segura`);
    if (tool.versionPolicy.state === 'declared') {
      if (!rulePossible(tool.versionPolicy.requirement)) errors.push(`tools/${index}: rango de versiones vacío`);
      if (tool.versionPolicy.reviewedAt > data.updatedAt) errors.push(`tools/${index}: revisión posterior a la versión del catálogo`);
      if (!tool.sources.some(s => s.url === tool.versionPolicy.evidence)) errors.push(`tools/${index}: evidencia sin fuente declarada`);
    }
  }
  for (const [index, tool] of data.tools.entries()) {
    const required = new Set(tool.dependencies.map(d => d.id));
    for (const field of ['dependencies', 'optionalDependencies']) {
      const seen = new Set();
      for (const edge of tool[field]) {
        if (!entries.has(edge.id)) errors.push(`tools/${index}/${field}: referencia inexistente`);
        if (edge.id === tool.id) errors.push(`tools/${index}/${field}: autorreferencia`);
        if (seen.has(edge.id)) errors.push(`tools/${index}/${field}: dependencia duplicada`);
        if (field === 'optionalDependencies' && required.has(edge.id)) errors.push(`tools/${index}: dependencia obligatoria y opcional a la vez`);
        seen.add(edge.id);
      }
    }
    for (const id of tool.conflicts) {
      if (!entries.has(id)) errors.push(`tools/${index}/conflicts: referencia inexistente`);
      if (id === tool.id) errors.push(`tools/${index}/conflicts: autorreferencia`);
    }
  }
  // Required edges must form a DAG. Optional alternatives may refer back to their runtime.
  const visiting = new Set(), done = new Set();
  function visit(id) {
    if (visiting.has(id)) { errors.push('dependencies: ciclo de dependencias obligatorias'); return; }
    if (done.has(id) || !entries.has(id)) return;
    visiting.add(id);
    for (const d of entries.get(id).dependencies) visit(d.id);
    visiting.delete(id); done.add(id);
  }
  for (const id of entries.keys()) visit(id);
  if (!errors.length) {
    for (const tool of data.tools) {
      const selection = new Set([tool.id]);
      function collect(id) { for (const edge of entries.get(id).dependencies) if (!selection.has(edge.id)) { selection.add(edge.id); collect(edge.id); } }
      collect(tool.id);
      if ([...selection].some(id => entries.get(id).conflicts.some(other => selection.has(other)))) errors.push(`tool ${tool.id}: dependencias obligatorias en conflicto`);
      let commonPlatforms = ['win32', 'darwin', 'linux'];
      for (const id of selection) if (entries.get(id).platforms) commonPlatforms = commonPlatforms.filter(p => entries.get(id).platforms.includes(p));
      if (!commonPlatforms.length) errors.push(`tool ${tool.id}: dependencias sin plataforma común`);
    }
  }
  if (legacy) {
    for (const [id, probe] of Object.entries(legacy.tools)) {
      const current = entries.get(id);
      if (!current || current.availability !== 'diagnostic') errors.push(`legacy/${id}: falta diagnóstico compatible`);
      else if (current.diagnostic.command !== probe.command || JSON.stringify(current.diagnostic.args) !== JSON.stringify(probe.args)) errors.push(`legacy/${id}: diagnóstico divergente`);
    }
    for (const profile of legacy.profiles) for (const id of profile.tools) if (!entries.has(id)) errors.push(`legacy/profile/${profile.id}: herramienta sin metadatos`);
  }
  return { ok: !errors.length, schemaVersion: data.schemaVersion, catalogVersion: data.catalogVersion,
    tools: data.tools.length, diagnostics: data.tools.filter(t => t.availability === 'diagnostic').length, errors };
}
function loadToolCatalog(legacy) {
  const data = readToolCatalog();
  const report = validateToolCatalog(data, legacy);
  if (!report.ok) throw new Error('Catálogo de herramientas inválido; consulta tools validate. No se ejecutará el diagnóstico.');
  return data;
}
function doctorCatalog(legacy, manifest) {
  const tools = Object.fromEntries(manifest.tools.filter(t => t.availability === 'diagnostic').map(t => [t.id, {
    ...t.diagnostic, ...(t.platforms ? { platforms: t.platforms } : {}),
    ...(t.versionPolicy.state === 'declared' ? { requirement: t.versionPolicy.requirement } : {})
  }]));
  return { ...legacy, tools };
}
function dependencyDetails(manifest, id) {
  const tools = new Map(manifest.tools.map(t => [t.id, t]));
  if (!tools.has(id)) throw new Error('Herramienta desconocida.');
  const found = new Set();
  function collect(current) {
    for (const edge of tools.get(current).dependencies) if (!found.has(edge.id)) { found.add(edge.id); collect(edge.id); }
  }
  collect(id);
  const tool = tools.get(id);
  return { catalogVersion: manifest.catalogVersion, scope: 'metadata-only', tool: id,
    directDependencies: tool.dependencies, requiredClosure: [...found].sort(),
    optionalDependencies: tool.optionalDependencies, conflicts: tool.conflicts,
    note: 'Relaciones declaradas; no es un plan de instalación ni selecciona alternativas automáticamente.' };
}
function selectTool(manifest, id) {
  const tool = manifest.tools.find(t => t.id === id);
  if (!tool) throw new Error('Herramienta desconocida.');
  return { catalogVersion: manifest.catalogVersion, ...tool };
}
function listTools(manifest, kind) {
  if (kind && !manifest.tools.some(t => t.kind === kind)) throw new Error('Categoría desconocida.');
  const tools = manifest.tools.filter(t => !kind || t.kind === kind).map(t => ({
    id: t.id, label: t.label, kind: t.kind, availability: t.availability,
    versionPolicy: t.versionPolicy.state, dependencies: t.dependencies.map(d => d.id)
  }));
  return { catalogVersion: manifest.catalogVersion, updatedAt: manifest.updatedAt, scope: manifest.scope, count: tools.length, tools };
}
module.exports = { readToolCatalog, validateToolCatalog, loadToolCatalog, doctorCatalog, dependencyDetails, selectTool, listTools };
