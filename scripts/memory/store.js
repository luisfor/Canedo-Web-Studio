'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const io = require('../workspace/files');
const { digest, canonical } = require('../planner/plan');
const check = new (require('ajv'))({ allErrors: true }).compile(require('../../schemas/project-memory.schema.json'));
const { sensitive } = require('../kit-first/inspect');

function permitted(relative) {
  return io.relative(relative) && !relative.split('/').some(part => ['.git', '.devkit', 'node_modules', 'secrets', 'credentials', 'data', 'uploads'].includes(part) || sensitive(part));
}
function seal(value) { const { manifestId, ...payload } = value; return { manifestId: digest(payload), ...payload }; }
function validate(value) {
  if (!check(value)) return false;
  const { manifestId, ...payload } = value;
  if (manifestId !== digest(payload)) return false;
  if (value.files.some(f => !permitted(f.path)) || new Set(value.files.map(f => f.path.toLowerCase())).size !== value.files.length) return false;
  if (value.contracts.some(c => !permitted(c.path)) || value.dependencies.some(d => !permitted(d.sourceFile))) return false;
  if (value.contracts.some(c => !value.files.some(f => f.path === c.path && f.digest === c.digest)) || value.legacyRecords.some(r => !['devkit.project.json', 'devkit.compose.json', 'devkit.composition.json'].includes(r.path))) return false;
  if (new Set(value.modules.map(m => m.id)).size !== value.modules.length || value.improvements.some(i => i.files.some(f => !permitted(f)))) return false;
  return !/(?:password|contrase[ñn]a|api[_ -]?key|token|secret)\\?"?\s*[:=]\s*(?:\\?")?[^\s",}]|https?:\/\/[^\s/]+:[^\s/]+@/i.test(JSON.stringify(value));
}
function metadata(root, relative) {
  const inspection = require('../kit-first/inspect').inspect(root);
  if (!inspection.complete) throw Error('Inspección incompleta: no se accede a memoria.');
  return metadataPath(root,relative);
}
function metadataPath(root,relative){
  require('../kit-first/inspect').checkRoot(root);
  const file = path.join(root, '.devkit', relative);
  let cursor = path.join(root, '.devkit');
  for (const part of ['.', ...relative.split('/')]) {
    if (part !== '.') cursor = path.join(cursor, part);
    if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) throw Error('Memoria enlazada no admitida.');
  }
  return file;
}
function read(root) {
  if(!require('../kit-first/inspect').inspect(root).complete)throw Error('Inspección incompleta: no se accede a memoria.');
  const base = io.readJson(metadataPath(root, 'project.json'));
  if (!validate(base) || base.revision !== 0) throw Error('Manifiesto base inválido.');
  const dir = metadataPath(root, 'revisions');
  const revisions = fs.existsSync(dir) ? fs.readdirSync(dir).sort().map(file => {
    if (!/^[a-f0-9]{64}\.json$/.test(file)) throw Error('Revisión desconocida.');
    const r = io.readJson(metadataPath(root, 'revisions/' + file));
    if (!r || Object.keys(r).sort().join(',') !== 'kind,parentId,revisionId,schemaVersion,state' || r.schemaVersion !== 1 || r.kind !== 'devkit-project-revision' || !validate(r.state)) throw Error('Revisión inválida.');
    const { revisionId, ...payload } = r;
    if (digest(payload) !== revisionId || file !== revisionId + '.json') throw Error('Revisión alterada.');
    return r;
  }) : [];
  let current = base; const consumed = new Set();
  while (true) {
    const next = revisions.filter(r => r.parentId === current.manifestId);
    if (next.length > 1) throw Error('Historial bifurcado; resolver sin sobrescribir.');
    if (!next.length) break;
    const r = next[0];
    if (r.state.projectId !== base.projectId || r.state.revision !== current.revision + 1 || consumed.has(r.revisionId)) throw Error('Linaje inválido.');
    consumed.add(r.revisionId); current = r.state;
  }
  if (consumed.size !== revisions.length) throw Error('Historial con revisiones huérfanas.');
  return current;
}
function legacy(root, inspection) {
  const result = [], owners = new Map();
  for (const relative of inspection.records.filter(f => !f.startsWith('.devkit/'))) {
    let valid = false;
    try {
      const r = io.readJson(path.join(root, relative));
      if (r.kind === 'managed-composition-record') {
        const { recordId, ...payload } = r;
        valid = Object.keys(r).sort().join(',') === 'files,kind,planId,recordId,schemaVersion,templateVersion' && r.schemaVersion === 1 && r.templateVersion === '1.0.0' && /^[a-f0-9]{64}$/.test(r.planId) && recordId === digest(payload) && Array.isArray(r.files) && r.files.every(f => Object.keys(f).sort().join(',') === 'digest,path' && /^[a-f0-9]{64}$/.test(f.digest) && io.relative(f.path) && (permitted(f.path) || f.path === 'secrets/README.md' || f.path === '.env.example'));
      } else valid = require('../workspace/environment').validateRecord(r);
      if (valid) for (const f of r.files) if (permitted(f.path)) owners.set(f.path, f.digest);
    } catch { valid = false; }
    result.push({ path: relative, status: valid ? 'validated-record' : 'unverified-record' });
  }
  return { records: result, owners };
}
function adopt({ evidence, destination }) {
  const api = require('../kit-first/service');
  const current = evidence?.discovery?.catalogs?.commercial?.status==='not-loaded-for-technical-planning'?api.requireTechnicalCurrent(evidence,destination):api.requireCurrent(evidence, destination);
  if(!current.inspection.complete)throw Error('Inspección incompleta: no se adopta memoria.');
  if (current.inspection.scenario === 'new') throw Error('Genera el proyecto antes de adoptar su memoria.');
  const previous = legacy(destination, current.inspection), files = current.inspection.files.filter(f => permitted(f.path) && !f.path.startsWith('devkit.')).map(f => ({ ...f, ownership: previous.owners.get(f.path) === f.digest ? 'kit-generated' : 'existing' }));
  const moduleFile = files.find(f => f.path === 'modules.json');
  const generatedModules = moduleFile?.ownership === 'kit-generated';
  const modules = current.inspection.signals.filter(s => s.category === 'capability').map(s => ({ id: s.id, version: generatedModules ? '1.0.0' : 'unknown', origin: generatedModules ? 'kit-generated-v1' : 'existing-declaration', status: generatedModules ? 'generated' : 'observed' }));
  let architecture = 'unknown';
  if (moduleFile) { const value = io.readJson(path.join(destination, moduleFile.path)); if (['modular-monolith', 'independent-services'].includes(value.architecture)) architecture = value.architecture; }
  const dependencies = [];
  for (const file of files.filter(f => /^(?:package|composer)\.json$/.test(f.path))) {
    const value = io.readJson(path.join(destination, file.path));
    for (const [id, version] of Object.entries({ ...value.devDependencies, ...value.dependencies, ...value.require })) {
      if (/^[A-Za-z0-9_@./-]{1,200}$/.test(id) && !/^(?:sk-|gh[pousr]_|eyJ)/.test(id)) dependencies.push({ id, version: typeof version === 'string' && /^(?:[~^<>=*| ]*\d[0-9A-Za-z.*+~^<>=| -]*|\*)$/.test(version) && version.length <= 100 ? version : 'unresolved-source', sourceFile: file.path });
    }
    if (file.path === 'package.json' && typeof value.engines?.node === 'string' && /^\d+\.\d+\.\d+$/.test(value.engines.node)) dependencies.push({ id: 'runtime-node', version: value.engines.node, sourceFile: file.path });
  }
  for (const [file, id] of [['.node-version', 'runtime-node'], ['.go-version', 'runtime-go'], ['.python-version', 'runtime-python'], ['.java-version', 'runtime-java']]) if (files.some(f => f.path === file)) {
    const version = fs.readFileSync(path.join(destination, file), 'utf8').trim();
    if (/^\d+\.\d+\.\d+$/.test(version)) dependencies.push({ id, version, sourceFile: file });
  }
  for(const file of files.filter(f=>/^(?:requirements\.txt|pyproject\.toml|go\.mod)$/.test(f.path))){
    const content=fs.readFileSync(path.join(destination,file.path),'utf8');let rows=[];
    if(file.path==='requirements.txt')rows=content.split(/\r?\n/).map(line=>/^\s*([A-Za-z][A-Za-z0-9_.-]*)\s*([<>=!~][^#\s]*)?\s*(?:#.*)?$/.exec(line)).filter(Boolean).map(m=>[m[1],m[2]||'unresolved-source']);
    else if(file.path==='pyproject.toml'){const block=/\bdependencies\s*=\s*\[([^]*?)\]/.exec(content)?.[1]||'';rows=[...block.matchAll(/["']([A-Za-z][A-Za-z0-9_.-]*)([<>=!~][^"']*)?["']/g)].map(m=>[m[1],m[2]||'unresolved-source']);}
    else rows=[...content.matchAll(/^\s*([A-Za-z0-9][A-Za-z0-9./_-]+)\s+v(\d[0-9A-Za-z.+-]*)\s*(?:\/\/.*)?$/gm)].map(m=>[m[1],m[2]]);
    for(const [id,version]of rows.slice(0,1000))dependencies.push({id,version:/^[0-9A-Za-z.*+~^<>=!| -]{1,100}$/.test(version)?version:'unresolved-source',sourceFile:file.path});
  }
  const state = seal({ schemaVersion: 1, kind: 'devkit-project', projectId: digest(crypto.randomUUID()), revision: 0,
    kit: { version: current.discovery.kit.version, fingerprint: current.discovery.kit.fingerprint }, architecture,
    languages: [...new Set(current.inspection.signals.filter(s => s.category === 'language').map(s => s.id))].sort(), frameworks: [...new Set(current.inspection.signals.filter(s => s.category === 'framework').map(s => s.id))].sort(), databases: [...new Set(current.inspection.signals.filter(s => s.category === 'database' && (current.inspection.signals.some(o => o.category === 'database' && o.evidence === 'modules.json') ? s.evidence === 'modules.json' : true)).map(s => s.id))].sort(),
    modules, contracts: files.filter(f => f.path.startsWith('contracts/')).map(({ path, digest }) => ({ path, digest })), dependencies,
    implemented: [], pending: modules.map(m => m.id), decisions: ['Conservar arquitectura y personalizaciones observadas; generación no equivale a pruebas aprobadas.'], improvements: [],
    verification: { status: 'not-run', limitations: ['Funciones generadas/observadas todavía no verificadas por esta memoria.'] }, files, legacyRecords: previous.records });
  if (!validate(state)) throw Error('Estado de proyecto fuera de esquema.');
  const result = io.writeNew({ files: [{ path: 'project.json', content: JSON.stringify(state, null, 2) + '\n' }, { path: '.gitignore', content: 'operations/\n.write-lock\n' }] }, path.join(destination, '.devkit'), () => ({ ok: validate(state) }));
  return { ...result, manifest: state };
}
function status(root) {
  const manifest = read(root), drift = io.checkFiles(root, manifest.files);
  const dir = metadata(root, 'operations'), pendingOperations = [];
  if (fs.existsSync(dir)) for (const id of fs.readdirSync(dir)) {
    if (!/^[a-f0-9]{64}$/.test(id)) throw Error('Operación no reconocida.');
    try { if (io.readJson(metadata(root, 'operations/' + id + '/result.json')).ok !== true) pendingOperations.push(id); } catch { pendingOperations.push(id); }
  }
  return { ok: drift.ok && !pendingOperations.length, manifest, drift: drift.changes, pendingOperations, verificationStatus: manifest.verification.status, commandsExecuted: false };
}
function append(root, before, next) {
  if (read(root).manifestId !== before.manifestId || !validate(next) || next.projectId !== before.projectId || next.revision !== before.revision + 1) throw Error('Memoria cambió o revisión inválida.');
  const payload = { schemaVersion: 1, kind: 'devkit-project-revision', parentId: before.manifestId, state: next };
  const value = { revisionId: digest(payload), ...payload }, dir = metadata(root, 'revisions');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { mode: 0o700 });
  fs.writeFileSync(path.join(dir, value.revisionId + '.json'), JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return value;
}
module.exports = { adopt, read, status, append, seal, validate, permitted, metadata };
