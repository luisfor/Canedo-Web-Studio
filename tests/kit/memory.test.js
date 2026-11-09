'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawnSync } = require('node:child_process');
const store = require('../../scripts/memory/store'), enhance = require('../../scripts/memory/enhance'), api = require('../../scripts/kit-first/service'), engine = require('../../scripts/composition/engine');
const io = require('../../scripts/workspace/files');
function temp(t) { const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'canedo-memory-')); t.after(() => fs.rmSync(root, { recursive: true, force: true })); return root; }
function generated(t, text = 'inventario CRM') { const root = temp(t), target = path.join(root, 'project'); engine.write(engine.plan({ text }), target); store.adopt({ destination: target, evidence: api.discover({ destination: target }) }); return target; }
function proposal(target, text) { return enhance.plan({ destination: target, evidence: api.discover({ destination: target }), text }); }

test('unified manifest records generated vs implemented, ownership, provenance, contracts and versions without secrets', t => {
  const target = generated(t), state = store.read(target);
  assert.equal(store.validate(state), true); assert.equal(state.revision, 0); assert.equal(state.verification.status, 'not-run'); assert.deepEqual(state.implemented, []);
  assert.ok(state.modules.some(m => m.id === 'inventory' && m.origin === 'kit-generated-v1'));
  assert.ok(state.contracts.some(c => c.path === 'contracts/openapi.json')); assert.ok(state.files.some(f => f.ownership === 'kit-generated'));
  assert.ok(state.dependencies.some(d => d.id === 'runtime-node' && d.version === '24.22.2'));
  assert.ok(!JSON.stringify(state).includes(target)); assert.equal(store.status(target).ok, true);
  assert.throws(() => store.adopt({ destination: target, evidence: api.discover({ destination: target }) }), /existe/);
});
test('legacy environment and Docker records remain intact and readable', t => {
  const root = temp(t), project = require('../../scripts/workspace/project'), docker = require('../../scripts/docker/generate');
  const a = path.join(root, 'node'), b = path.join(root, 'docker'); project.write(project.plan({ stack: 'node', version: '24.22.2' }), a); docker.write(docker.plan({ services: ['redis'], images: { redis: 'redis:8.2.1' } }), b);
  for (const target of [a, b]) { const file = fs.readdirSync(target).find(f => /^devkit\./.test(f)); const original = fs.readFileSync(path.join(target, file), 'utf8'); store.adopt({ destination: target, evidence: api.discover({ destination: target }) }); assert.equal(store.read(target).legacyRecords[0].status, 'validated-record'); assert.equal(fs.readFileSync(path.join(target, file), 'utf8'), original); assert.equal(require('../../scripts/workspace/environment').check(target).ok, true); }
});
test('enhancement preserves customized documentation, data and legacy records; updates only pristine owned files', t => {
  const target = generated(t), base = fs.readFileSync(path.join(target, '.devkit/project.json'), 'utf8'), oldRecord = fs.readFileSync(path.join(target, 'devkit.composition.json'), 'utf8');
  fs.appendFileSync(path.join(target, 'ARCHITECTURE.md'), '\nDeveloper decision to keep.'); fs.mkdirSync(path.join(target, 'data')); fs.writeFileSync(path.join(target, 'data', 'customer.sqlite'), 'synthetic fixture');
  if (process.platform !== 'win32') fs.chmodSync(path.join(target, 'modules.json'), 0o640);
  const p = proposal(target, 'chatbot'); assert.equal(p.status, 'ready'); assert.ok(p.preserved.some(c => c.path === 'ARCHITECTURE.md')); assert.ok(p.changes.some(c => c.path === 'modules/chatbot/module.json'));
  const result = enhance.apply(p, target, p.proposalId); assert.equal(result.ok, true); assert.equal(result.commandsExecuted, false); assert.equal(result.migrationsExecuted, false);
  assert.match(fs.readFileSync(path.join(target, 'ARCHITECTURE.md'), 'utf8'), /Developer decision/); assert.equal(fs.readFileSync(path.join(target, 'data/customer.sqlite'), 'utf8'), 'synthetic fixture');
  assert.equal(fs.readFileSync(path.join(target, '.devkit/project.json'), 'utf8'), base); assert.equal(fs.readFileSync(path.join(target, 'devkit.composition.json'), 'utf8'), oldRecord);
  if (process.platform !== 'win32') assert.equal(fs.statSync(path.join(target, 'modules.json')).mode & 0o777, 0o640);
  const state = store.read(target); assert.equal(state.revision, 1); assert.ok(state.modules.some(m => m.id === 'chatbot')); assert.equal(state.verification.status, 'not-run'); assert.equal(store.status(target).ok, true);
});
test('custom application changes block replacement and survive the rejected operation', t => {
  const target = generated(t), file = path.join(target, 'src/crm.cjs'); fs.appendFileSync(file, '\n// custom behavior\n'); const content = fs.readFileSync(file, 'utf8');
  const p = proposal(target, 'chatbot'); assert.equal(p.status, 'blocked'); assert.ok(p.blockers.some(b => b.code === 'customization-conflict')); assert.throws(() => enhance.apply(p, target, p.proposalId)); assert.equal(fs.readFileSync(file, 'utf8'), content); assert.ok(!fs.existsSync(path.join(target, '.devkit/operations')));
});
test('late changes and altered proposals are rejected before writing', t => {
  const target = generated(t), p = proposal(target, 'chatbot'); const altered = structuredClone(p); altered.changes[0].content = '{}'; assert.equal(enhance.validate(altered, target).ok, false); assert.throws(() => enhance.apply(p, target, 'wrong-id'));
  fs.appendFileSync(path.join(target, 'README.md'), '\nLate personalization'); assert.equal(enhance.validate(p, target).ok, false); assert.throws(() => enhance.apply(p, target, p.proposalId)); assert.equal(store.read(target).revision, 0);
});
test('history validates parent links and rejects unknown secret fields even after recalculating a digest', t => {
  const target = generated(t), state = store.read(target); const modified = store.seal({ ...state, password: 'not-a-real-password' }); assert.equal(store.validate(modified), false);
  const p = proposal(target, 'chatbot'); enhance.apply(p, target, p.proposalId); const dir = path.join(target, '.devkit/revisions'), file = fs.readdirSync(dir)[0]; const record = io.readJson(path.join(dir, file)); record.parentId = '0'.repeat(64); fs.writeFileSync(path.join(dir, file), JSON.stringify(record)); assert.throws(() => store.read(target), /alterada/);
});
test('existing arbitrary frameworks are inspected and adopted without adding competing services', t => {
  const target = temp(t); fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify({ dependencies: { next: '15.0.0', 'better-auth': '1.0.0', privateDependency: 'sk-fake-fixture' }, privateValue: 'DO-NOT-EXPORT' }));
  store.adopt({ destination: target, evidence: api.discover({ destination: target }) }); const state = store.read(target); assert.ok(state.frameworks.includes('nextjs')); assert.ok(!JSON.stringify(state).includes('DO-NOT-EXPORT')); assert.ok(!JSON.stringify(state).includes('sk-fake-fixture')); const p = proposal(target, 'CRM'); assert.equal(p.status, 'blocked'); assert.ok(p.blockers.some(b => b.code === 'incremental-adapter-missing')); assert.deepEqual(p.changes, []);
});
test('requesting present features is a no-op and does not reset personalized files or create revisions', t => {
  const target = generated(t), p = proposal(target, 'inventario'); assert.equal(p.status, 'unchanged'); assert.deepEqual(enhance.apply(p, target, p.proposalId).changed, []); assert.equal(store.read(target).revision, 0); assert.ok(!fs.existsSync(path.join(target, '.devkit/operations')));
});
test('partial failure keeps backups, reports reconciliation and prevents another automatic attempt', t => {
  const target = generated(t), p = proposal(target, 'chatbot'); t.mock.method(fs, 'renameSync', () => { throw Error('Synthetic write failure'); }); assert.throws(() => enhance.apply(p, target, p.proposalId), /incompleta/);
  const status = store.status(target); assert.equal(status.ok, false); assert.deepEqual(status.pendingOperations, [p.proposalId]); assert.ok(fs.existsSync(path.join(target, '.devkit/operations', p.proposalId, 'before/modules.json'))); assert.equal(proposal(target, 'chatbot').status, 'blocked');
});
test('enhanced backend executes the complete store/CRM/chatbot HTTP flow without regenerating the project', t => {
  const target = generated(t), p = proposal(target, 'ventas caja whatsapp chatbot'); assert.equal(p.status, 'ready'); enhance.apply(p, target, p.proposalId);
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'tests/integration.test.cjs'], { cwd: target, env, encoding: 'utf8', timeout: 30000 }); assert.equal(run.status, 0, run.stdout + run.stderr); assert.match(run.stdout, /# pass 5/); assert.match(run.stdout, /# skipped 0/);
});
test('agent creation automatically records memory and CLI reads it without executing project code', t => {
  const root = temp(t), target = path.join(root, 'new'), evidence = api.discover({ destination: target }); const p = api.plan({ evidence, destination: target, request: { text: 'inventario' } }); const r = api.create(p, target); assert.ok(r.manifestId); assert.equal(store.status(target).ok, true);
  const cli = path.resolve(__dirname, '../../scripts/kit.js'), result = spawnSync(process.execPath, [cli, 'memory', 'status', '--project', target, '--json'], { encoding: 'utf8', env: { ...process.env, PATH: '' } }); assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).manifest.manifestId, r.manifestId);
});
test('enhancement never silently changes an existing language, framework, database or deployment boundary', t => {
  const target = generated(t); assert.deepEqual(store.read(target).databases, ['sqlite']);
  for (const request of ['chatbot PHP', 'chatbot MySQL', 'chatbot React', 'chatbot microservicios']) { const p = proposal(target, request); assert.equal(p.status, 'blocked', request); assert.deepEqual(p.changes, []); }
});
