'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const cli = path.resolve(__dirname, '../../scripts/kit.js');
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 15000 });
test('catálogo declara skills y todos los perfiles solicitados', () => {
  const result = run('catalog', '--json'); assert.equal(result.status, 0);
  const catalog = JSON.parse(result.stdout);
  for (const id of ['react','vue','angular','java','dotnet','android','react-native','c','cpp','arduino','sql','sqlserver','sqlite','postgresql','mysql','oracle','python','terraform','pulumi','trading','crm']) assert.ok(catalog.profiles.some(p => p.id === id), id);
});
test('selección de perfil devuelve solamente su contrato', () => {
  const result = run('catalog', '--profile', 'vue', '--json');
  assert.equal(result.status, 0); const profile = JSON.parse(result.stdout);
  assert.equal(profile.id, 'vue'); assert.equal(profile.skill, 'desarrollo-frontend');
});
test('un perfil desconocido falla antes de ejecutar herramientas', () => {
  const result = run('doctor', '--profile', '../secretos', '--json');
  assert.equal(result.status, 1); assert.match(result.stderr, /Perfil desconocido/); assert.equal(result.stdout, '');
});
test('catálogo y referencias de las skills instaladas son coherentes', () => {
  const result = run('validate', '--json'); assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).errors, []);
});
test('SQL genérico no presupone un motor ni ejecuta una CLI', () => {
  const result = run('doctor', '--profile', 'sql', '--json', '--strict');
  assert.equal(result.status, 0); const report = JSON.parse(result.stdout); assert.deepEqual(report.checks, []); assert.deepEqual(report.profiles, ['sql']);
});
test('opción desconocida falla con mensaje', () => {
  const result = run('catalog', '--install-everything'); assert.equal(result.status, 1); assert.match(result.stderr, /Opción no válida/);
});
test('doctor informa CLIs ausentes y strict falla sin instalar nada', () => {
  const options = { encoding: 'utf8', timeout: 15000, env: { ...process.env, PATH: '/canedo-no-tools' } };
  const strict = spawnSync(process.execPath, [cli, 'doctor', '--profile', 'react', '--json', '--strict'], options);
  assert.equal(strict.status, 1); const report = JSON.parse(strict.stdout);
  assert.equal(report.ok, false); assert.ok(report.checks.every(c => c.status === 'missing'));
  const info = spawnSync(process.execPath, [cli, 'doctor', '--profile', 'react', '--json'], options);
  assert.equal(info.status, 0); assert.equal(JSON.parse(info.stdout).ok, false);
});
test('doctor admite herramientas concretas sin exigir un perfil nuevo', () => {
  const result = run('doctor', '--tool', 'node', '--json');
  assert.equal(result.status, 0); const report = JSON.parse(result.stdout);
  assert.equal(report.schemaVersion, 2); assert.deepEqual(report.checks.map(c => c.tool), ['node']);
  assert.equal(report.system.platform, process.platform); assert.equal(report.permissions.elevationRequested, false);
});
test('doctor rechaza mezclar perfil y herramienta o nombres arbitrarios', () => {
  assert.equal(run('doctor', '--tool', 'node', '--profile', 'react').status, 1);
  assert.equal(run('doctor', '--tool', 'node;echo bad').status, 1);
  assert.equal(run('catalog', '--tool', 'node').status, 1);
});
