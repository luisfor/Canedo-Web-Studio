'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawnSync } = require('node:child_process');
const engine = require('../../scripts/composition/engine'), registry = require('../../scripts/composition/catalog'), api = require('../../scripts/kit-first/service'), memory = require('../../scripts/memory/store');
function temp(t) { const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'canedo-polyglot-')); t.after(() => fs.rmSync(root, { recursive: true, force: true })); return root; }
test('Python inventory is selected without a Node runtime dependency or forced migration', () => {
  const p = engine.plan({ text: 'Crear inventario Python', runtimeVersions: { python: '3.14.4' }, nodeVersion: '25.2.1' }); assert.equal(p.status, 'ready'); assert.equal(p.adapter, 'python-inventory'); assert.equal(engine.validate(p).ok, true); assert.ok(p.files.some(f => f.path === '.python-version')); assert.ok(!p.files.some(f => f.path === 'package.json')); assert.ok(p.commands.every(c => c.run.executable === 'python3'));
  const blocked = engine.plan({ text: 'CRM Python' }); assert.equal(blocked.status, 'blocked'); assert.equal(blocked.files.length, 0);
});
test('SQLite and JSON-file providers generate valid contracts, real code and safe Compose using shared policies', t => {
  const root = temp(t);
  for (const provider of ['sqlite', 'json-file']) { const p = engine.plan({ text: 'inventario Python ' + provider, docker: true }), out = path.join(root, provider); assert.equal(engine.validate(p).ok, true); engine.write(p, out); const modules = JSON.parse(fs.readFileSync(path.join(out, 'modules.json'), 'utf8')); assert.equal(modules.persistence.provider, provider); const compose = JSON.parse(fs.readFileSync(path.join(out, 'compose.yaml'), 'utf8')); assert.equal(require('../../scripts/docker/schema').validateCompose(compose).ok, true); assert.ok(!compose.services.inventory.ports); assert.equal(compose.services.inventory.pull_policy, 'never'); assert.equal(compose.services.inventory.read_only, true); assert.ok(!fs.existsSync(path.join(out, 'data'))); }
});
test('generated Python application runs native SQLite/JSON transactions, isolation, idempotency, persistence and HTTP', t => {
  const root = temp(t), out = path.join(root, 'inventory'); engine.write(engine.plan({ text: 'inventario Python json-file' }), out);
  const available = spawnSync('python3', ['--version'], { encoding: 'utf8' });
  if (available.error?.code === 'ENOENT') { t.skip('Python absent: native checks not executed; no installation attempted.'); return; }
  assert.equal(available.status, 0, available.stderr); const result = spawnSync('python3', ['-m', 'unittest', 'discover', '-s', 'tests', '-v'], { cwd: out, encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }, timeout: 30000 }); assert.equal(result.status, 0, result.stdout + result.stderr); assert.match(result.stderr, /Ran 4 tests/); assert.match(result.stderr, /OK/); assert.ok(!fs.existsSync(path.join(out, 'data')));
});
test('agent discovery exposes registered generators and memory retains the chosen Python provider/version', t => {
  const root = temp(t), out = path.join(root, 'inventory'), evidence = api.discover({ destination: out }); assert.ok(evidence.discovery.catalogs.generators.some(a => a.id === 'python-inventory'));
  const p = api.plan({ evidence, destination: out, request: { text: 'inventario Python json-file', runtimeVersions: { python: '3.14.4' } } }); api.create(p, out); const state = memory.read(out); assert.ok(state.languages.includes('python')); assert.deepEqual(state.databases, ['json-file']); assert.ok(state.dependencies.some(d => d.id === 'runtime-python' && d.version === '3.14.4'));
});
test('trusted non-HTTP generators can validate their own artifacts without inventing OpenAPI', t => {
  const root = temp(t), extension = { capabilities: [{ id: 'cli-demo', domain: 'automation', aliases: ['comando demo'], requires: [] }], archetypes: [{ id: 'cli-demo', adapter: 'cli-demo-fixture', architecture: 'modular-monolith', languages: ['javascript'], capabilities: ['cli-demo'] }] };
  engine.registerAdapter('cli-demo-fixture', { capabilities: ['cli-demo'], domains: ['automation'], languages: ['javascript'], frameworks: [], databases: [], files: () => [{ path: 'cli.cjs', content: "process.stdout.write('ready\\n');\n", mode: 420 }], validateArtifacts: value => ({ ok: value.files.some(f => f.path === 'cli.cjs'), scope: 'fixture-cli-source' }) });
  const p = engine.plan({ text: 'comando demo', catalogExtension: extension }), out = path.join(root, 'cli'); assert.equal(engine.validate(p).ok, true); engine.write(p, out); const result = spawnSync(process.execPath, [path.join(out, 'cli.cjs')], { encoding: 'utf8' }); assert.equal(result.status, 0); assert.equal(result.stdout.trim(), 'ready'); assert.ok(!fs.existsSync(path.join(out, 'contracts')));
});
