'use strict';
const fs = require('node:fs'), path = require('node:path');
const io = require('../workspace/files'), { digest } = require('../planner/plan');
const check = new (require('ajv'))({ allErrors: true }).compile(require('../../schemas/commercial-catalog.schema.json'));
const root = path.resolve(__dirname, '../..');
function validate(value) {
  const errors = [];
  if (!check(value)) return { ok: false, errors: check.errors.map(e => e.instancePath + ' ' + e.message) };
  if (new Set(value.packages.map(p => p.id)).size !== value.packages.length) errors.push('Paquetes duplicados.');
  const tools = require('../tools/catalog').readToolCatalog().tools;
  const adapters = require('../composition/engine').describeAdapters();
  for (const p of value.packages) {
    if (p.dependencies.tools.some(id => !tools.some(t => t.id === id))) errors.push('Herramienta no registrada: ' + p.id);
    if (p.tests.some(file => !io.relative(file) || !file.startsWith('tests/') || !fs.existsSync(path.join(root, file)) || fs.lstatSync(path.join(root, file)).isSymbolicLink())) errors.push('Prueba no disponible: ' + p.id);
    if (p.status === 'partial' && (!p.implementedScope.length || !p.tests.length || !p.modules.some(id => adapters.some(a => a.capabilities.includes(id))))) errors.push('Alcance parcial sin implementación/pruebas: ' + p.id);
    if (p.status === 'available' || p.integrations.some(i => i.state === 'verified')) {
      try {
        if (!p.proof || !io.relative(p.proof.file) || !p.proof.file.startsWith('docs/reports/commercial/')) throw Error();
        const absolute = path.join(root, p.proof.file); if (fs.lstatSync(absolute).isSymbolicLink()) throw Error();
        const raw = fs.readFileSync(absolute, 'utf8'); if (digest(raw) !== p.proof.digest) throw Error();
        const evidence = JSON.parse(raw);
        if (evidence.kind !== 'commercial-package-acceptance' || evidence.packageId !== p.id || evidence.passed !== true || evidence.skipped !== 0 || !evidence.tests || evidence.failed !== 0 || p.acceptance.some(c => evidence.criteria?.[c.id] !== true)) throw Error();
        if (p.status === 'available' && (!p.tests.length || !adapters.some(a => p.modules.every(id => a.capabilities.includes(id))))) throw Error();
        if (p.integrations.some(i => i.state === 'verified' && !evidence.liveIntegrations?.includes(i.id))) throw Error();
        const request = evidence.request, expected = require('../composition/engine').plan(request);
        if (expected.status !== 'ready' || expected.planId !== evidence.planId) throw Error();
      } catch { errors.push('Disponibilidad sin evidencia suficiente y vigente: ' + p.id); }
    }
  }
  return { ok: !errors.length, errors, packages: value.packages.length };
}
function read(extension) {
  const value = io.readJson(path.join(root, 'catalog/commercial/registry.json'));
  if (extension) { if (!check(extension)) throw Error('Extensión comercial fuera de esquema.'); value.packages.push(...extension.packages); }
  const report = validate(value); if (!report.ok) throw Error(report.errors.join('; ')); return value;
}
function list(extension) {
  const value = read(extension), adapters = require('../composition/engine').describeAdapters();
  return { ...value, combinations:require('./combinations').list(),packages: value.packages.map(p => ({ ...p, generatorSupport: { supportedModules: p.modules.filter(id => adapters.some(a => a.capabilities.includes(id))), missingModules: p.modules.filter(id => !adapters.some(a => a.capabilities.includes(id))) } })), noProviderActivated: true };
}
function show(id, extension) { const p = list(extension).packages.find(p => p.id === id); if (!p) throw Error('Paquete no registrado.'); return p; }
module.exports = { read, validate, list, show };
