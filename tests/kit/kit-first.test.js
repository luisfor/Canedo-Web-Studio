'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const api = require('../../scripts/kit-first/service');
const engine = require('../../scripts/composition/engine');
const { digest } = require('../../scripts/planner/plan');
const cli = path.resolve(__dirname, '../../scripts/kit.js');

function temp(t) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'canedo-kit-first-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('discovery publishes version, full catalogs and policy without executing tools or project scripts', t => {
  const root = temp(t), target = path.join(root, 'new');
  const result = api.discover({ destination: target, agent: 'codex-cli-json' });
  assert.equal(result.discovery.catalogs.tools.tools.length, 80);
  assert.equal(result.discovery.catalogs.composition.capabilities.length, 25);
  assert.equal(result.discovery.kit.version, require('../../package.json').version);
  assert.equal(result.inspection.scenario, 'new');
  assert.equal(result.discovery.policy.executionAllowed, false);
  assert.ok(!fs.existsSync(target));
  assert.ok(!JSON.stringify(result).includes(root));
});

test('missing or malformed evidence blocks before calling a generator', t => {
  const root = temp(t); let calls = 0;
  t.mock.method(engine, 'plan', () => { calls++; throw Error('Should not run'); });
  assert.throws(() => api.plan({ destination: path.join(root, 'new'), request: { text: 'inventario' } }), /evidencia/i);
  assert.equal(calls, 0);
});

test('evidence is bound to kit/catalog contents and target, not just a caller-recalculated hash', t => {
  const root = temp(t), destination = path.join(root, 'new');
  const evidence = api.discover({ destination });
  const altered = structuredClone(evidence);
  altered.discovery.kit.version = '99.0.0';
  const { evidenceId, ...payload } = altered; altered.evidenceId = digest(payload);
  assert.throws(() => api.plan({ evidence: altered, destination, request: { text: 'inventario' } }), /desactualizada/);
  assert.throws(() => api.plan({ evidence, destination: path.join(root, 'another'), request: { text: 'inventario' } }), /desactualizada/);
});

test('existing authentication/API/persistence are reuse candidates, not inferred as verified functionality', t => {
  const root = temp(t);
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: { 'better-auth': '1.0.0', 'drizzle-orm': '1.0.0', next: '1.0.0' }, scripts: { prepare: 'throw if executed' } }));
  fs.writeFileSync(path.join(root, 'server.js'), "require('node:http').createServer(); // authenticate session\n");
  const evidence = api.discover({ destination: root });
  const p = api.plan({ evidence, destination: root, request: { text: 'inventario CRM' } });
  assert.equal(p.status, 'blocked');
  assert.equal(p.composition, null);
  assert.ok(p.reuse.reuseCandidates.some(c => c.id === 'authentication' && c.certainty === 'declared'));
  assert.ok(p.reuse.reuseCandidates.some(c => c.id === 'api' && c.certainty === 'inferred'));
  assert.equal(p.reuse.reuseCandidates.some(c => c.certainty === 'verified'), false);
  assert.throws(() => api.create(p, root), /KIT-FIRST/);
});

test('inspection excludes secrets and does not export package scripts, URLs or credentials', t => {
  const root = temp(t), secret = 'DO-NOT-EXPORT-PRIVATE-VALUE';
  fs.writeFileSync(path.join(root, '.env'), 'API_TOKEN=' + secret);
  fs.mkdirSync(path.join(root, 'secrets')); fs.writeFileSync(path.join(root, 'secrets', 'data.json'), JSON.stringify({ token: secret }));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { start: secret }, privateValue: secret }));
  const result = JSON.stringify(api.inspect(root));
  assert.ok(!result.includes(secret)); assert.ok(!result.includes('.env')); assert.ok(!result.includes('secrets/'));
});

test('target changes invalidate evidence, and existing generated modules are preserved', t => {
  const root = temp(t), project = path.join(root, 'shop');
  engine.write(engine.plan({ text: 'inventario CRM' }), project);
  const evidence = api.discover({ destination: project });
  assert.equal(evidence.inspection.scenario, 'previously-generated');
  assert.ok(evidence.inspection.signals.some(s => s.id === 'authentication'));
  const p = api.plan({ evidence, destination: project, request: { text: 'inventario CRM chatbot' } });
  assert.ok(p.reuse.existingCapabilities.some(c => c.id === 'inventory'));
  assert.deepEqual(p.reuse.missing, ['chatbot']);
  fs.appendFileSync(path.join(project, 'README.md'), '\nPersonalization\n');
  assert.equal(api.validate(p, project).ok, false);
  assert.throws(() => api.create(p, project));
  assert.match(fs.readFileSync(path.join(project, 'README.md'), 'utf8'), /Personalization/);
});

test('new target creation, alterations and unsafe links fail closed', t => {
  const root = temp(t), destination = path.join(root, 'new');
  const evidence = api.discover({ destination });
  const p = api.plan({ evidence, destination, request: { text: 'inventario' } });
  const altered = structuredClone(p); altered.composition.files[0].content = 'Changed';
  assert.equal(api.validate(altered, destination).ok, false);
  fs.mkdirSync(destination);
  assert.throws(() => api.create(p, destination));
  if (process.platform !== 'win32') {
    fs.symlinkSync(destination, path.join(root, 'link'));
    assert.throws(() => api.inspect(path.join(root, 'link')), /seguro/);
    fs.symlinkSync('/etc/hosts', path.join(destination, 'outside.txt'));
    const incomplete = api.discover({ destination });
    assert.equal(incomplete.inspection.complete, false);
    assert.throws(() => api.plan({ evidence: incomplete, destination, request: { text: 'inventario' } }), /incompleta/);
  }
});

test('schema rejects commands, credentials and undiscovered extensions in agent requests', t => {
  const root = temp(t), destination = path.join(root, 'new'), evidence = api.discover({ destination });
  for (const request of [{ text: 'inventario', command: 'run' }, { text: 'inventario token=private-value' }, { text: 'inventario', catalogExtension: { projects: [] } }]) assert.throws(() => api.plan({ evidence, destination, request }));
});

test('agent path completes discover→inspect→reuse→plan→validate→generate with the shared writer', t => {
  const root = temp(t), destination = path.join(root, 'shop'), evidence = api.discover({ destination, agent: 'codex-cli-json' });
  const p = api.plan({ evidence, destination, request: { text: 'inventario ventas caja CRM whatsapp chatbot', docker: true } });
  assert.equal(api.validate(p, destination).ok, true);
  const r = api.create(p, destination);
  assert.equal(r.ok, true); assert.equal(r.executedCommands, false);
  assert.deepEqual(r.completedSteps, ['discover', 'inspect', 'assess-reuse', 'plan', 'validate', 'generate']);
  assert.equal(engine.check(destination).ok, true);
  assert.ok(!fs.existsSync(path.join(destination, 'data')));
  assert.ok(!fs.existsSync(path.join(destination, 'node_modules')));
  assert.throws(() => api.create(p, destination));
});

test('CLI JSON enforces the same gate and does not need a toolchain in PATH', t => {
  const root = temp(t), target = path.join(root, 'new'), file = path.join(root, 'evidence.json');
  function run(args) { return spawnSync(process.execPath, [cli, 'agent', ...args, '--json'], { encoding: 'utf8', env: { ...process.env, PATH: '' } }); }
  const d = run(['discover', '--project', target, '--agent', 'codex-cli-json']);
  assert.equal(d.status, 0, d.stderr); fs.writeFileSync(file, d.stdout);
  const p = run(['plan', '--project', target, '--file', file, '--request', 'inventario']);
  assert.equal(p.status, 0, p.stderr);
  const planFile = path.join(root, 'plan.json'); fs.writeFileSync(planFile, p.stdout);
  assert.equal(run(['validate', '--project', target, '--file', planFile]).status, 0);
  assert.equal(run(['create', '--out', target, '--file', planFile]).status, 0);
  assert.equal(run(['create', '--out', path.join(root, 'other'), '--file', file]).status, 1);
});
test('common runtime manifests are detected without installing or evaluating their languages', t => {
  const root = temp(t);
  for (const [file, content] of [['go.mod', 'module example.com/test\ngo 1.26.0'], ['pyproject.toml', '[project]\nname="test"'], ['pom.xml', '<project/>'], ['App.csproj', '<Project/>'], ['Cargo.toml', '[package]\nname="test"']]) fs.writeFileSync(path.join(root, file), content);
  const observed = api.inspect(root).signals.filter(s => s.category === 'language').map(s => s.id).sort();
  assert.deepEqual(observed, ['csharp', 'go', 'java', 'python', 'rust']);
  fs.unlinkSync(path.join(root, 'pom.xml'));fs.writeFileSync(path.join(root, 'build.gradle.kts'), '// configuration, never executed');
  assert.ok(api.inspect(root).signals.some(s => s.id === 'java'));
});
test('invalid or oversized manifests cannot be presented as a complete inspection', t => {
  const root = temp(t); fs.writeFileSync(path.join(root, 'package.json'), '[]');
  assert.equal(api.inspect(root).complete, false);
  fs.writeFileSync(path.join(root, 'package.json'), '{}'); fs.writeFileSync(path.join(root, 'large.js'), 'x'.repeat(1024 * 1024 + 1));
  const evidence = api.discover({ destination: root }); assert.equal(evidence.inspection.complete, false);
  assert.throws(() => api.plan({ evidence, destination: root, request: { text: 'inventario' } }), /incompleta/);
});
