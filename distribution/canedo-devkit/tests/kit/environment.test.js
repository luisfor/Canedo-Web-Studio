'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { findExecutables, parseOsRelease, detectSystem, parseVersion, assessVersion, probeTool, diagnose } = require('../../scripts/doctor/environment');

function fixture({ platform = 'linux', files = {}, env = {}, outputs = {}, arch = 'x64', release = '6.8.0', machine = 'x86_64' } = {}) {
  const calls = [];
  const key = value => platform === 'win32' ? value.toLowerCase() : value;
  const data = new Map(Object.entries(files).map(([name, value]) => [key(name), value]));
  const context = {
    platform, arch, release, machine, runtimeVersion: '24.1.0', cwd: platform === 'win32' ? 'C:\\work' : '/work',
    execPath: platform === 'win32' ? 'C:\\runtime\\node.exe' : '/runtime/node',
    env: platform === 'win32' ? { Path: 'C:\\tools', ...env } : { PATH: '/tools', ...env },
    stat(file) { if (!data.has(key(file))) throw Object.assign(new Error('not found'), { code: 'ENOENT' }); return { isFile: () => true }; },
    access() {},
    read(file) { if (!data.has(key(file))) throw new Error('not found'); return data.get(key(file)); },
    spawn(command, args, options) {
      calls.push({ command, args, options });
      return outputs[key(command)] || { status: 0, stdout: args[0]?.endsWith('npm-cli.js') ? '11.1.0' : 'v24.1.0', stderr: '' };
    }
  };
  return { context, calls };
}
const catalog = { profiles: [{ id: 'demo', tools: ['node'] }], tools: { node: { command: 'node', args: ['--version'] } } };

test('os-release se analiza como datos, sin ejecutar contenido', () => {
  const result = parseOsRelease('ID=ubuntu\nVERSION_ID="24.04"\nID_LIKE="debian"\nPRETTY_NAME="private"\nEVIL=$(touch /tmp/x)');
  assert.deepEqual(result, { id: 'ubuntu', version: '24.04', like: ['debian'] });
  assert.deepEqual(parseOsRelease('ID=$(evil)'), { id: null, version: null, like: [] });
});
test('Linux obtiene distribución y arquitectura', () => {
  const { context } = fixture({ files: { '/etc/os-release': 'ID=fedora\nVERSION_ID=43\nID_LIKE="rhel"' } });
  const system = detectSystem(context);
  assert.equal(system.name, 'Linux'); assert.equal(system.distribution.id, 'fedora'); assert.equal(system.version, '43'); assert.equal(system.architectureMismatch, false);
});
test('macOS separa versión de producto, kernel y arquitectura', () => {
  const { context } = fixture({ platform: 'darwin', arch: 'arm64', machine: 'arm64', release: '25.0.0', files: { '/usr/bin/sw_vers': '' }, outputs: { '/usr/bin/sw_vers': { status: 0, stdout: '26.0\n' } } });
  const result = detectSystem(context); assert.equal(result.name, 'macOS'); assert.equal(result.version, '26.0'); assert.equal(result.release, '25.0.0'); assert.equal(result.architecture, 'arm64');
});
test('Windows detecta PATH sin distinguir mayúsculas, espacios y arquitectura nativa', () => {
  const { context } = fixture({ platform: 'win32', arch: 'ia32', machine: 'i386', release: '10.0.22631', env: { pAtH: '"C:\\Program Files\\Node"', Path: undefined, PROCESSOR_ARCHITEW6432: 'AMD64' }, files: { 'C:\\Program Files\\Node\\node.exe': '' } });
  // A real Windows environment has one case-insensitive PATH entry.
  delete context.env.Path;
  assert.equal(findExecutables('node', context).length, 1);
  const result = detectSystem(context); assert.equal(result.windowsBuild, 22631); assert.equal(result.machineArchitecture, 'x64'); assert.equal(result.architectureMismatch, true);
});
test('no ejecuta archivos del proyecto mediante PATH relativo', () => {
  const { context, calls } = fixture({ env: { PATH: '.:relative:/tools' }, files: { './node': '', 'relative/node': '' } });
  assert.equal(probeTool('node', catalog.tools.node, context).status, 'missing'); assert.equal(calls.length, 0);
});
test('Windows npm.cmd usa Node y npm-cli.js, sin shell', () => {
  const { context, calls } = fixture({ platform: 'win32', env: { Path: 'C:\\Program Files\\Node' }, files: { 'C:\\Program Files\\Node\\npm.cmd': '', 'C:\\Program Files\\Node\\node_modules\\npm\\bin\\npm-cli.js': '' } });
  const result = probeTool('npm', { command: 'npm', args: ['--version'] }, context);
  assert.equal(result.status, 'detected'); assert.equal(calls[0].command, context.execPath);
  assert.deepEqual(calls[0].args, ['C:\\Program Files\\Node\\node_modules\\npm\\bin\\npm-cli.js', '--version']); assert.equal(calls[0].options.shell, false);
});
test('Windows no ejecuta wrappers desconocidos ni abre el shell', () => {
  const { context, calls } = fixture({ platform: 'win32', files: { 'C:\\tools\\pnpm.cmd': '' } });
  assert.equal(probeTool('pnpm', { command: 'pnpm', args: ['--version'] }, context).status, 'unverifiable'); assert.equal(calls.length, 0);
});
test('Windows Python evita alias de tienda y usa py -3', () => {
  const { context, calls } = fixture({ platform: 'win32', env: { Path: 'C:\\WindowsApps;C:\\tools' }, files: { 'C:\\WindowsApps\\python.exe': '', 'C:\\tools\\py.exe': '' }, outputs: { 'c:\\tools\\py.exe': { status: 0, stdout: 'Python 3.13.1' } } });
  const result = probeTool('python', { command: 'python3', args: ['--version'] }, context);
  assert.equal(result.version, '3.13.1'); assert.deepEqual(calls[0].args, ['-3', '--version']);
});
test('versiones en stderr y formato Go se reconocen', () => {
  assert.equal(parseVersion('go', 'go version go1.26.2 linux/amd64'), '1.26.2');
  assert.equal(parseVersion('java', 'openjdk version "21.0.5"'), '21.0.5');
  const { context } = fixture({ files: { '/tools/java': '' }, outputs: { '/tools/java': { status: 0, stderr: 'openjdk version "21.0.5"' } } });
  assert.equal(probeTool('java', { command: 'java', args: ['-version'] }, context).version, '21.0.5');
});
test('solo declara incompatibilidad cuando hay una regla explícita', () => {
  assert.equal(assessVersion('22.9.0').status, 'not-assessed');
  assert.equal(assessVersion('22.9.0', { min: '22.20.0' }).status, 'incompatible');
  assert.equal(assessVersion('24.0.0', { min: '22.20', maxExclusive: '25', majors: [22, 24] }).status, 'compatible');
  assert.equal(assessVersion('25.0', { maxExclusive: '25' }).status, 'incompatible');
  assert.equal(assessVersion('24.0', { min: 'latest' }).status, 'unverifiable');
  assert.equal(assessVersion('24.0', {}).status, 'not-assessed');
});
test('herramienta fuera del rango declarado no se marca detected', () => {
  const { context } = fixture({ files: { '/tools/node': '' }, outputs: { '/tools/node': { status: 0, stdout: 'v20.1.0' } } });
  assert.equal(probeTool('node', { ...catalog.tools.node, requirement: { min: '22.20' } }, context).status, 'incompatible');
});
test('timeout, permisos y salida excesiva son errores sanitizados', () => {
  for (const [code, reason] of [['ETIMEDOUT', 'timeout'], ['EPERM', 'permission-denied'], ['ENOBUFS', 'output-limit']]) {
    const { context } = fixture({ files: { '/tools/node': '' }, outputs: { '/tools/node': { error: { code, message: 'private secret' }, stdout: 'private token', stderr: '/synthetic/private' } } });
    const result = probeTool('node', catalog.tools.node, context);
    assert.equal(result.status, 'error'); assert.equal(result.reason, reason); assert.ok(!JSON.stringify(result).includes('private'));
  }
});
test('una salida no reconocida no prueba la versión', () => {
  const { context } = fixture({ files: { '/tools/node': '' }, outputs: { '/tools/node': { status: 0, stdout: 'unknown' } } });
  assert.equal(probeTool('node', catalog.tools.node, context).status, 'unverifiable');
});
test('Go usa toolchain local y no modifica variables del proceso', () => {
  const { context, calls } = fixture({ env: { GOTOOLCHAIN: 'auto', PRIVATE_TOKEN: 'secret' }, files: { '/tools/go': '' }, outputs: { '/tools/go': { status: 0, stdout: 'go version go1.26.2 linux/amd64' } } });
  probeTool('go', { command: 'go', args: ['version'] }, context);
  assert.equal(calls[0].options.env.GOTOOLCHAIN, 'local'); assert.equal(context.env.GOTOOLCHAIN, 'auto'); assert.equal(calls[0].options.timeout, 4000); assert.equal(calls[0].options.shell, false);
});
test('Flutter se detecta sin inicializar el SDK', () => {
  const { context, calls } = fixture({ files: { '/tools/flutter': '' } });
  const result = probeTool('flutter', { command: 'flutter', args: ['--version'] }, context);
  assert.equal(result.status, 'unverifiable'); assert.equal(result.reason, 'sdk-bootstrap-not-authorized'); assert.equal(calls.length, 0);
});
test('gestores son descubrimiento de presencia, no instalaciones ni ejecuciones extra', () => {
  const { context, calls } = fixture({ files: { '/tools/node': '', '/tools/apt': '', '/tools/uv': '', '/etc/os-release': 'ID=debian\nVERSION_ID=13' } });
  const report = diagnose(catalog, { profile: 'demo' }, context);
  assert.equal(calls.length, 1); assert.equal(report.packageManagers.find(m => m.id === 'apt').verification, 'presence-only'); assert.ok(!report.packageManagers.some(m => m.id === 'winget'));
});
test('no revela variables privadas ni valores de configuración', () => {
  const { context } = fixture({ env: { PRIVATE_TOKEN: 'private-token', JAVA_HOME: '/private/java' }, files: {} });
  const report = diagnose(catalog, { profile: 'demo' }, context), json = JSON.stringify(report);
  assert.ok(!json.includes('private-token')); assert.ok(!json.includes('/private/java')); assert.ok(!json.includes('PRIVATE_TOKEN'));
  assert.equal(report.configuration.find(c => c.name === 'JAVA_HOME').configured, true); assert.equal(report.permissions.elevationRequested, false);
});
test('rechaza comandos y argumentos arbitrarios antes de ejecutar', () => {
  const { context, calls } = fixture();
  assert.equal(probeTool('node', { command: 'node;evil', args: ['--version'] }, context).status, 'error');
  assert.equal(probeTool('node', { command: 'node', args: ['-e', 'evil()'] }, context).status, 'error');
  assert.throws(() => diagnose(catalog, { tools: ['../secretos'] }, context), /desconocida/); assert.equal(calls.length, 0);
});
test('sistema desconocido y reglas de plataforma no implican soporte', () => {
  const { context, calls } = fixture({ platform: 'freebsd' });
  assert.equal(diagnose(catalog, { tools: [] }, context).system.recognized, false);
  assert.equal(probeTool('node', { ...catalog.tools.node, platforms: ['win32'] }, context).status, 'unsupported'); assert.equal(calls.length, 0);
});
test('versiones preliminares no satisfacen silenciosamente un rango estable', () => {
  assert.equal(parseVersion('node', 'v26.0.0-rc.1'), '26.0.0-rc.1');
  assert.equal(parseVersion('go', 'go version go1.27rc4 linux/amd64'), '1.27rc4');
  assert.equal(assessVersion('26.0.0-rc.1', { min: '24' }).status, 'unverifiable');
  assert.equal(assessVersion('24', []).status, 'unverifiable');
});
test('macOS Intel se informa como x64 sin confundirlo con Apple Silicon', () => {
  const { context } = fixture({ platform: 'darwin', arch: 'x64', machine: 'x86_64' });
  const result = detectSystem(context); assert.equal(result.architecture, 'x64'); assert.equal(result.machineArchitecture, 'x64'); assert.equal(result.architectureMismatch, false);
});
test('Windows ignora el script POSIX sin extensión situado junto a npm.cmd', () => {
  const { context, calls } = fixture({ platform: 'win32', files: { 'C:\\tools\\npm': '#!/bin/sh', 'C:\\tools\\npm.cmd': '', 'C:\\tools\\node_modules\\npm\\bin\\npm-cli.js': '' } });
  const result = probeTool('npm', { command: 'npm', args: ['--version'] }, context);
  assert.equal(result.status, 'detected'); assert.equal(calls[0].command, context.execPath);
});
test('versiones conocidas no se extraen de números de error o avisos sueltos', () => {
  assert.equal(parseVersion('node', 'warning: connection to 127.0.0.1 failed'), null);
  assert.equal(parseVersion('python', 'permission warning 3.14.1'), null);
  assert.equal(parseVersion('npm', 'warning: version 3.2.1\n11.1.0'), '11.1.0');
});
test('MySQL y MariaDB conservan su versión de distribución cuando corresponde', () => {
  assert.equal(parseVersion('mysql', 'mysql  Ver 8.0.43 for macos14 on arm64 (Homebrew)'), '8.0.43');
  assert.equal(parseVersion('mysql', 'mysql  Ver 15.1 Distrib 10.11.6-MariaDB, for debian-linux-gnu'), '10.11.6');
  assert.equal(assessVersion(parseVersion('java', 'openjdk version "25.0.0-ea"'), { min: '21' }).status, 'unverifiable');
});
test('el diagnóstico no puede pasar un nombre de archivo como argumento de Python', () => {
  const { context, calls } = fixture({ files: { '/tools/python3': '' } });
  const result = probeTool('python', { command: 'python3', args: ['version'] }, context);
  assert.equal(result.status, 'error'); assert.equal(calls.length, 0);
});
