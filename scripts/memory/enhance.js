'use strict';
const fs = require('node:fs'), path = require('node:path');
const store = require('./store'), io = require('../workspace/files');
const { canonical, digest } = require('../planner/plan');
const api = require('../kit-first/service');

function hash(file) { if (fs.lstatSync(file).isSymbolicLink()) throw Error('No se admiten archivos enlazados.'); return digest(fs.readFileSync(file, 'utf8')); }
function safeParent(root, relative) {
  let current = root;
  for (const part of relative.split('/').slice(0, -1)) {
    current = path.join(current, part);
    if (fs.existsSync(current) && (!fs.lstatSync(current).isDirectory() || fs.lstatSync(current).isSymbolicLink())) throw Error('Padre de archivo no seguro.');
  }
}
function plan({ evidence, destination, text }) {
  api.requireCurrent(evidence, destination); api.validateRequest({ text });
  const before = store.read(destination), registry = evidence.discovery.catalogs.composition;
  const intent = require('../composition/intents').interpret(text, registry), blockers = [];
  if (intent.languages.some(l => !before.languages.includes(l)) || intent.frameworks.some(f => !before.frameworks.includes(f)) || intent.databases.some(d => !before.databases.includes(d))) blockers.push({ code: 'technology-change-requires-plan', detail: 'No se cambia lenguaje, framework o motor de datos mediante una ampliación de módulos.' });
  if (intent.independent && before.architecture !== 'independent-services' || intent.modular && before.architecture !== 'modular-monolith') blockers.push({ code: 'architecture-change-requires-plan', detail: 'La arquitectura existente se conserva; separar o consolidar servicios exige un plan específico.' });
  if (store.status(destination).pendingOperations.length) blockers.push({ code: 'pending-reconciliation', detail: 'Revisar la operación parcial antes de proponer otra mejora.' });
  if (intent.unrecognized.length) blockers.push({ code: 'unknown-requirement', detail: intent.unrecognized.join(', ') });
  if (intent.excluded.some(c => before.modules.some(m => m.id === c))) blockers.push({ code: 'removal-not-authorized', detail: 'Esta operación solo añade capacidades; no elimina módulos o datos.' });
  if (!intent.selected.length) blockers.push({ code: 'no-capabilities', detail: 'Indica las capacidades que quieres añadir.' });
  const supported = before.modules.length && before.modules.every(m => m.origin === 'kit-generated-v1') && before.languages.includes('javascript') && !before.frameworks.length;
  if (!supported) blockers.push({ code: 'incremental-adapter-missing', detail: 'Preservar arquitectura existente: se necesita un adaptador incremental revisado para este proyecto.' });
  const family = fs.existsSync(path.join(destination, 'modules.json')) ? io.readJson(path.join(destination, 'modules.json')).generator : null;
  if (family && family !== 'node-sqlite') blockers.push({ code: 'incremental-family-review-required', detail: 'Este reconciliador conserva exclusivamente la familia v1; no cambia autenticación ni esquema v2.' });
  const ids = [...new Set([...before.modules.map(m => m.id), ...intent.selected])].sort();
  const aliases = ids.map(id => registry.capabilities.find(c => c.id === id)?.aliases[0]);
  if (aliases.some(a => !a)) blockers.push({ code: 'module-not-registered', detail: 'Un módulo existente no figura en el catálogo descubierto.' });
  const changes = [], preserved = [];
  let target = null;
  if (!blockers.length && intent.selected.some(id => !before.modules.some(m => m.id === id))) {
    const pkg = io.readJson(path.join(destination, 'package.json'));
    // Initial reconciler is explicitly bounded to generated v1 compositions.
    // The store/schema are runtime-neutral; other reconcilers must be registered
    // and tested instead of silently migrating existing frameworks.
    target = require('../composition/engine').plan({ text: aliases.join(', '), name: pkg.name, nodeVersion: pkg.engines.node, architecture: before.architecture, docker: fs.existsSync(path.join(destination, 'compose.yaml')) });
    if (target.status !== 'ready') blockers.push(...target.conflicts);
    if (target.adapter && target.adapter !== 'node-sqlite') blockers.push({ code: 'generator-migration-requires-plan', detail: 'Cambiar de familia de generador exige revisar datos, contratos y autenticación; no se aplica como ampliación.' });
    for (const desired of target.files) {
      if (!store.permitted(desired.path)) continue;
      safeParent(destination, desired.path);
      const absolute = path.join(destination, desired.path), existing = fs.existsSync(absolute), expected = existing ? hash(absolute) : null;
      const known = before.files.find(f => f.path === desired.path);
      if (existing && expected === digest(desired.content)) { if (known && known.digest !== expected) preserved.push({ path: desired.path, reason: 'personalization-preserved' }); continue; }
      if (existing && (known?.ownership !== 'kit-generated' || known.digest !== expected)) {
        if (/^(?:README\.md|ARCHITECTURE\.md|PROVENANCE\.json)$/.test(desired.path)) { preserved.push({ path: desired.path, reason: 'personalization-preserved' }); continue; }
        blockers.push({ code: 'customization-conflict', detail: desired.path }); continue;
      }
      changes.push({ path: desired.path, operation: existing ? 'replace-owned' : 'create', expectedDigest: expected, mode: existing ? fs.statSync(absolute).mode & 0o777 : desired.mode || 0o644, content: desired.content });
    }
  }
  const payload = { schemaVersion: 1, kind: 'incremental-project-plan', evidence, beforeId: before.manifestId, text, modules: target?.capabilities || ids, changes, preserved, blockers, status: blockers.length ? 'blocked' : changes.length ? 'ready' : 'unchanged', executionAllowed: false, migrationsExecuted: false };
  return { proposalId: digest(payload), ...payload, ok: !blockers.length };
}
function validate(value, destination) {
  try {
    if (value?.kind !== 'incremental-project-plan') throw Error('Plan incremental no admitido.');
    const expected = plan({ evidence: value.evidence, destination, text: value.text });
    if (canonical(value) !== canonical(expected)) throw Error('Plan incremental alterado o desactualizado.');
    return { ok: ['ready', 'unchanged'].includes(value.status), errors: value.blockers, executionAllowed: false };
  } catch (e) { return { ok: false, errors: [e.message], executionAllowed: false }; }
}
function apply(value, destination, confirmation) {
  if (confirmation !== value?.proposalId) throw Error('Confirma el ID exacto del plan incremental revisado.');
  const checked = validate(value, destination); if (!checked.ok) throw Error('Plan incremental bloqueado: ' + JSON.stringify(checked.errors));
  if (value.status === 'unchanged') return { ok: true, changed: [], manifestId: value.beforeId, commandsExecuted: false, migrationsExecuted: false };
  const lock = store.metadata(destination, '.write-lock');
  const fd = fs.openSync(lock, 'wx', 0o600);
  let operation = null;
  try {
    if (!validate(value, destination).ok) throw Error('El proyecto cambió antes de reservar la operación.');
    const before = store.read(destination), backups = [];
    for (const c of value.changes) {
      if (!store.permitted(c.path)) throw Error('Ruta protegida.'); safeParent(destination, c.path);
      const absolute = path.join(destination, c.path);
      if (c.expectedDigest === null ? fs.existsSync(absolute) : !fs.existsSync(absolute) || hash(absolute) !== c.expectedDigest) throw Error('Conflicto antes de escribir.');
      if (c.expectedDigest !== null) backups.push({ path: 'before/' + c.path, content: fs.readFileSync(absolute, 'utf8') });
      backups.push({ path: 'after/' + c.path, content: c.content });
    }
    const operations = store.metadata(destination, 'operations');
    if (!fs.existsSync(operations)) fs.mkdirSync(operations, { mode: 0o700 });
    operation = path.join(operations, value.proposalId);
    io.writeNew({ files: [...backups, { path: 'plan.json', content: JSON.stringify({ proposalId: value.proposalId, beforeId: before.manifestId, changes: value.changes.map(({ path, operation, expectedDigest }) => ({ path, operation, expectedDigest })) }, null, 2) + '\n' }] }, operation, () => ({ ok: true }));
    for (const c of value.changes) {
      safeParent(destination, c.path);
      const absolute = path.join(destination, c.path); fs.mkdirSync(path.dirname(absolute), { recursive: true, mode: 0o700 });
      if (c.operation === 'create') fs.writeFileSync(absolute, c.content, { flag: 'wx', mode: c.mode });
      else {
        if (hash(absolute) !== c.expectedDigest) throw Error('Archivo personalizado durante la operación; conserva copias para revisión.');
        const temporary = absolute + '.devkit-' + value.proposalId;
        fs.writeFileSync(temporary, c.content, { flag: 'wx', mode: 0o600 }); fs.chmodSync(temporary, c.mode);
        if (hash(absolute) !== c.expectedDigest) throw Error('Archivo cambió; no se reemplaza.');
        fs.renameSync(temporary, absolute);
      }
    }
    const files = before.files.map(f => ({ ...f }));
    for (const c of value.changes) { const item = { path: c.path, digest: digest(c.content), ownership: 'kit-generated' }; const i = files.findIndex(f => f.path === c.path); if (i < 0) files.push(item); else files[i] = item; }
    // Preserve changes to documents rather than making old pristine hashes hide them.
    for (const p of value.preserved) { const item = files.find(f => f.path === p.path); if (item) { item.digest = hash(path.join(destination, p.path)); item.ownership = 'existing'; } }
    const next = store.seal({ ...before, revision: before.revision + 1,
      kit: { version: value.evidence.discovery.kit.version, fingerprint: value.evidence.discovery.kit.fingerprint },
      modules: value.modules.map(id => ({ id, version: '1.0.0', origin: 'kit-generated-v1', status: 'generated' })),
      files: files.sort((a, b) => a.path.localeCompare(b.path, 'en')), contracts: files.filter(f => f.path.startsWith('contracts/')).map(({ path, digest }) => ({ path, digest })),
      implemented: [], pending: value.modules,
      improvements: [...before.improvements, { id: value.proposalId, summary: 'Ampliación aditiva de capacidades; personalizaciones preservadas.', files: value.changes.map(c => c.path) }],
      verification: { status: 'not-run', limitations: ['Cambio aplicado; ejecutar pruebas y migraciones revisadas explícitamente.'] }
    });
    store.append(destination, before, next);
    fs.writeFileSync(path.join(operation, 'result.json'), JSON.stringify({ ok: true, manifestId: next.manifestId, testsExecuted: false, migrationsExecuted: false }), { flag: 'wx', mode: 0o600 });
    return { ok: true, manifestId: next.manifestId, revision: next.revision, changed: value.changes.map(c => c.path), preserved: value.preserved, commandsExecuted: false, migrationsExecuted: false };
  } catch {
    throw Error(operation ? 'Operación incompleta: conserva .devkit/operations para revisar copias y reconciliar; no se borraron datos ni se reintentó.' : 'No se pudo reservar la operación; no se aplicó el plan.');
  } finally {
    const inode = fs.fstatSync(fd).ino; fs.closeSync(fd);
    if (fs.existsSync(lock) && fs.lstatSync(lock).ino === inode && !fs.lstatSync(lock).isSymbolicLink()) fs.unlinkSync(lock);
  }
}
module.exports = { plan, validate, apply };
