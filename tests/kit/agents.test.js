'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { controller } = require('../../scripts/agents/controller'), { server } = require('../../scripts/agents/mcp-server');
const api = require('../../scripts/kit-first/service');
function temp(t) { const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'canedo-agents-')); t.after(() => fs.rmSync(root, { recursive: true, force: true })); return root; }
function initialize(s, version = '2025-11-25') { const r = s.receive({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: version, capabilities: {}, clientInfo: { name: 'wire-test-client', version: '1.0.0' } } }); s.receive({ jsonrpc: '2.0', method: 'notifications/initialized' }); return r; }
test('MCP lifecycle and negotiation precede tool operations; no hidden executor is advertised', t => {
  const root = temp(t), s = server({ root }); assert.equal(s.receive({ jsonrpc: '2.0', id: 0, method: 'tools/list' }).error.code, -32002); assert.equal(initialize(s).result.protocolVersion, '2025-11-25');
  const list = s.receive({ jsonrpc: '2.0', id: 2, method: 'tools/list' }).result.tools; assert.ok(list.some(t => t.name === 'kit_plan')); assert.ok(!list.some(t => t.name === 'kit_generate')); assert.ok(!list.some(t => /execute|install|deploy/.test(t.name)));
});
test('read-only scope rejects writes, arbitrary args, traversal and projects outside the authorized root', t => {
  const root = temp(t), c = controller({ root }), target = path.join(root, 'new');
  assert.throws(() => c.call('kit_generate', { project: target, plan: {}, confirmation: '0'.repeat(64) })); assert.throws(() => c.call('kit_discover', { project: target, command: 'run' }));
  assert.throws(() => c.call('kit_inspect', { project: path.dirname(root) }), /fuera/); assert.throws(() => c.call('kit_inspect', { project: root + '/../outside' }), /normalizado/); assert.ok(!fs.existsSync(target));
});
test('agent must discover and plan in this connection, not import a receipt from another client', t => {
  const root = temp(t), target = path.join(root, 'new'), c = controller({ root, allowGenerate: true }); const e = api.discover({ destination: target }); assert.throws(() => c.call('kit_plan', { project: target, evidence: e, request: { text: 'inventario' } }), /esta conexión/);
  const discovered = c.call('kit_discover', { project: target }); const p = c.call('kit_plan', { project: target, evidence: discovered, request: { text: 'inventario' } });
  assert.throws(() => c.call('kit_generate', { project: target, plan: p, confirmation: p.planId }), /kit_validate/);
  assert.equal(c.call('kit_validate', { project: target, plan: p }).ok, true); assert.throws(() => c.call('kit_generate', { project: target, plan: p, confirmation: '0'.repeat(64) }), /exacto/);
  const generated = c.call('kit_generate', { project: target, plan: p, confirmation: p.planId }); assert.equal(generated.ok, true); assert.equal(generated.executedCommands, false); assert.ok(fs.existsSync(path.join(target, '.devkit/project.json'))); assert.ok(!fs.existsSync(path.join(target, 'data')));
});
test('modules, transitive dependencies and stale plans use the shared catalogs and gate', t => {
  const root = temp(t), target = path.join(root, 'new'), c = controller({ root, allowGenerate: true }), e = c.call('kit_discover', { project: target });
  assert.equal(c.call('kit_modules', { project: target, evidence: e }).projects.length, 2); const dependencies = c.call('kit_dependencies', { project: target, evidence: e, kind: 'module', id: 'sales' }); assert.ok(dependencies.dependencies.some(d => d.id === 'products')); assert.equal(dependencies.installationExecuted, false);
  const p = c.call('kit_plan', { project: target, evidence: e, request: { text: 'inventario' } }); c.call('kit_validate', { project: target, plan: p }); fs.mkdirSync(target); assert.throws(() => c.call('kit_generate', { project: target, plan: p, confirmation: p.planId }));
});
test('notifications never invoke tools and older negotiated versions avoid unsupported result fields', t => {
  const root = temp(t), s = server({ root }); initialize(s, '2024-11-05');
  const target = path.join(root, 'new'); assert.equal(s.receive({ jsonrpc: '2.0', method: 'tools/call', params: { name: 'kit_discover', arguments: { project: target } } }), null);
  const list = s.receive({ jsonrpc: '2.0', id: 2, method: 'tools/list' }); assert.equal(list.result.tools[0].annotations, undefined);
  const call = s.receive({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'kit_discover', arguments: { project: target } } }); assert.equal(call.result.structuredContent, undefined); assert.equal(JSON.parse(call.result.content[0].text).kind, 'kit-first-evidence');
  assert.equal(s.receive({ jsonrpc: '2.0', id: 4, method: 'tools/list', params: null }).error.code, -32602);
});
test('real stdio client completes initialize/list/discover/plan/validate/generate with NDJSON only', async t => {
  const root = temp(t), executable = path.resolve(__dirname, '../../scripts/agents/mcp-server.js'), target = path.join(root, 'new');
  const child = spawn(process.execPath, [executable, '--root', root, '--allow-generate'], { stdio: ['pipe', 'pipe', 'pipe'] }); t.after(() => { if (child.exitCode === null) child.kill(); });
  let buffer = '', next = 0, stderr = ''; const pending = new Map(); child.stderr.on('data', c => { stderr += c; });
  child.stdout.setEncoding('utf8'); child.stdout.on('data', c => { buffer += c; let i; while ((i = buffer.indexOf('\n')) >= 0) { const line = buffer.slice(0, i); buffer = buffer.slice(i + 1); const response = JSON.parse(line), deferred = pending.get(response.id); if (deferred) { pending.delete(response.id); clearTimeout(deferred.timer); deferred.resolve(response); } } });
  child.on('error', e => { for (const p of pending.values()) { clearTimeout(p.timer); p.reject(e); } pending.clear(); });
  const request = (method, params) => new Promise((resolve, reject) => { const id = ++next, timer = setTimeout(() => reject(Error('MCP timeout: ' + stderr)), 10000); pending.set(id, { resolve, reject, timer }); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) }) + '\n'); });
  assert.equal((await request('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'local-conformance-fixture', version: '1.0.0' } })).result.protocolVersion, '2025-11-25'); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  assert.ok((await request('tools/list')).result.tools.some(t => t.name === 'kit_generate'));
  const call = async (name, args) => { const r = await request('tools/call', { name, arguments: args }); assert.equal(r.result.isError, false, JSON.stringify(r)); return r.result.structuredContent; };
  const e = await call('kit_discover', { project: target }), p = await call('kit_plan', { project: target, evidence: e, request: { text: 'inventario' } }); await call('kit_validate', { project: target, plan: p }); const result = await call('kit_generate', { project: target, plan: p, confirmation: p.planId }); assert.equal(result.ok, true); assert.equal(result.executedCommands, false); child.stdin.end(); await new Promise(resolve => child.once('close', resolve)); assert.equal(child.exitCode, 0); assert.equal(stderr, '');
});
test('server startup requires an existing safe operator scope and does not interpret malformed input as commands', t => {
  const root = temp(t), executable = path.resolve(__dirname, '../../scripts/agents/mcp-server.js'); const failed = spawnSync(process.execPath, [executable], { encoding: 'utf8' }); assert.equal(failed.status, 1);
  const r = spawnSync(process.execPath, [executable, '--root', root], { input: '{bad json}\n', encoding: 'utf8' }); assert.equal(r.status, 0); assert.equal(JSON.parse(r.stdout).error.code, -32700);
});
