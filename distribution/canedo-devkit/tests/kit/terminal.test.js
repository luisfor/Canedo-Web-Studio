'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawnSync } = require('node:child_process');
const nlp = require('../../scripts/terminal/interpret'), terminal = require('../../scripts/terminal/service'), catalog = require('../../scripts/composition/catalog'), cli = require('../../scripts/devkit');
const memory = require('../../scripts/memory/store'), api = require('../../scripts/kit-first/service'), engine = require('../../scripts/composition/engine');
function temp(t) { const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'canedo-terminal-')); t.after(() => fs.rmSync(root, { recursive: true, force: true })); return root; }
test('Spanish POS selects existing modules, dependencies, preferred technology and modular architecture', () => {
  const r = nlp.interpret('Crear un POS con inventario compras ventas caja Node Docker', catalog.read());
  assert.ok(r.applications.includes('pos')); assert.ok(r.capabilities.includes('sales')); assert.ok(r.languages.includes('javascript')); assert.ok(r.infrastructure.includes('docker')); assert.deepEqual(r.unknown, []); assert.equal(r.architecture, 'modular-monolith');
});
test('omnichannel SaaS request plans executable local modules without activating providers', t => {
  const destination = path.join(temp(t), 'new'); const p = terminal.prepare('Quiero crear una plataforma SaaS para tiendas que tenga inventario, caja, ventas, CRM de WhatsApp, Facebook, Instagram, chatbot IA y suscripciones mensuales', { destination });
  assert.deepEqual(p.requirements.unknown, []); assert.equal(p.requirements.security.multiTenant, true); assert.ok(p.requirements.sectors.includes('retail')); assert.ok(!p.missing.includes('messenger')); assert.ok(!p.missing.includes('subscriptions')); assert.equal(p.status, 'ready'); assert.ok(p.core.composition.files.length); assert.ok(p.requirements.integrations.every(i=>i.activation==='disabled')); assert.ok(!fs.existsSync(destination));
});
test('sector, ambiguous channels, unknown functions and contradictory architectures produce questions', () => {
  for (const text of ['SaaS multiempresa para clínicas', 'CRM omnicanal', 'inventario y teletransportacion', 'inventario monolito y microservicios']) assert.ok(nlp.interpret(text, catalog.read()).questions.length, text);
});
test('budgets and exclusion of paid AI do not enable providers or fabricate a free provider', () => {
  const r = nlp.interpret('Crear CRM con chatbot sin IA paga presupuesto 100 USD al mes', catalog.read());
  assert.equal(r.budget.amount, 100); assert.equal(r.budget.currency, 'USD'); assert.equal(r.budget.period, 'monthly'); assert.equal(r.budget.paidAi, 'forbidden'); assert.ok(r.integrations.every(i => i.activation === 'disabled'));
});
test('negations are preserved and unsupported technology is not silently converted', t => {
  const root = temp(t), r = nlp.interpret('CRM sin WhatsApp', catalog.read()); assert.ok(!r.capabilities.includes('whatsapp')); assert.ok(r.excluded.includes('whatsapp'));
  const p = terminal.prepare('Crear inventario PHP Laravel', { destination: path.join(root, 'new') }); assert.equal(p.status, 'blocked'); assert.ok(p.core.blockers.length);
});
test('provider results are schema-validated before planning and validation never repeats a paid call', t => {
  const root = temp(t), destination = path.join(root, 'new'); let calls = 0;
  const provider = { id: 'semantic-fixture', interpret(text, registry) { calls++; return { ...nlp.local('inventario', registry), provider: 'semantic-fixture' }; } };
  assert.throws(() => terminal.prepare('inventario', { destination, provider }), /autorizado/); assert.equal(calls, 0);
  const p = terminal.prepare('inventario', { destination, provider, allowProvider: true }); assert.equal(p.status, 'ready'); assert.equal(calls, 1); assert.equal(terminal.validate(p, destination).ok, true); assert.equal(calls, 1);
  assert.throws(() => terminal.prepare('inventario', { destination, provider: { id: 'malicious', interpret() { return { command: 'arbitrary' }; } }, allowProvider: true }), /esquema/);
});
test('local vocabulary can be extended declaratively without accepting executable fields', () => {
  const vocabulary = { schemaVersion: 1, entries: [{ id: 'agriculture', facet: 'sector', aliases: ['agricultura'], capabilities: ['inventory'] }] };
  const r = nlp.interpret('Crear inventario para agricultura', catalog.read(), { vocabulary }); assert.ok(r.sectors.includes('agriculture')); assert.deepEqual(r.unknown, []);
  assert.throws(() => nlp.vocabulary({ ...vocabulary, command: 'run' }), /esquema/);
});
test('create prepares questions without an explicit destination and writes only a new authorized folder', t => {
  const root = temp(t); const p = cli.dispatch(cli.parse(['create', 'Crear un POS', '--json']), root); assert.equal(p.status, 'needs-clarification'); assert.ok(!fs.existsSync(path.join(root, 'devkit-project')));
  const destination = path.join(root, 'shop'), result = cli.dispatch(cli.parse(['create', 'Crear un POS con CRM chatbot', '--out', destination, '--json']), root); assert.equal(result.ok, true); assert.ok(fs.existsSync(path.join(destination, '.devkit/project.json'))); assert.equal(result.executedCommands, false); assert.ok(!fs.existsSync(path.join(destination, 'data')));
  const again = cli.dispatch(cli.parse(['create', 'Crear un POS', '--out', destination]), root); assert.equal(again.status, 'blocked');
});
test('inspect uses KIT-FIRST and enhance returns a guarded incremental plan preserving personalizations', t => {
  const root = temp(t), target = path.join(root, 'project'); engine.write(engine.plan({ text: 'inventario CRM' }), target); memory.adopt({ destination: target, evidence: api.discover({ destination: target }) }); fs.appendFileSync(path.join(target, 'README.md'), '\nCustom note');
  const result = cli.dispatch(cli.parse(['enhance', 'Agregar chatbot al proyecto actual', '--project', target]), root); assert.equal(result.status, 'ready'); assert.equal(result.core.kind, 'incremental-project-plan'); assert.ok(!fs.existsSync(path.join(target, 'modules/chatbot/module.json'))); assert.match(fs.readFileSync(path.join(target, 'README.md'), 'utf8'), /Custom note/);
  const inspected = cli.dispatch(cli.parse(['inspect', '--project', target]), root); assert.equal(inspected.kind, 'kit-first-evidence');
});
test('terminal rejects command injection flags and credential assignments, preserving legacy CLI', t => {
  assert.throws(() => cli.parse(['create', 'inventario', '--execute'])); assert.throws(() => cli.parse(['create', 'inventario', '--out', 'a', '--out', 'b'])); assert.throws(() => cli.parse(['enhance', 'chatbot', '--out', 'a']));
  const root = temp(t); assert.throws(() => terminal.prepare('inventario token=private-value', { destination: path.join(root, 'new') }));
  const executable = path.resolve(__dirname, '../../scripts/devkit.js'); const r = spawnSync(process.execPath, [executable, 'plan', 'Crear inventario', '--out', path.join(root, 'new'), '--json'], { encoding: 'utf8', env: { ...process.env, PATH: '' } }); assert.equal(r.status, 0, r.stderr); assert.equal(JSON.parse(r.stdout).ok, true);
});
test('reviewed terminal plan can be created from file, while enhancements unwrap safely without manual JSON editing', t => {
  const root = temp(t), target = path.join(root, 'new'), p = terminal.prepare('Crear inventario CRM', { destination: target }), planFile = path.join(root, 'plan.json'); fs.writeFileSync(planFile, JSON.stringify(p));
  const r = cli.dispatch(cli.parse(['create', '--file', planFile, '--out', target]), root); assert.equal(r.ok, true);
  const improvement = cli.dispatch(cli.parse(['enhance', 'Agregar chatbot', '--project', target]), root), improvementFile = path.join(root, 'enhance.json'); fs.writeFileSync(improvementFile, JSON.stringify(improvement));
  const legacyCli = path.resolve(__dirname, '../../scripts/kit.js');
  const validated = spawnSync(process.execPath, [legacyCli, 'memory', 'validate', '--project', target, '--file', improvementFile], { encoding: 'utf8' }); assert.equal(validated.status, 0, validated.stderr);
  const applied = spawnSync(process.execPath, [legacyCli, 'memory', 'apply', '--project', target, '--file', improvementFile, '--confirm', improvement.core.proposalId], { encoding: 'utf8' }); assert.equal(applied.status, 0, applied.stderr); assert.ok(memory.read(target).modules.some(m => m.id === 'chatbot'));
});
