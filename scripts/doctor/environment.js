'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// Only diagnostic invocations. No installation recipes or commands supplied by an assistant.
const VERSION_ARGUMENTS = new Set(['--version', '-version', 'version', '-V', '-?', '-v', '-3']);
const EXTRA_TOOLS = Object.freeze({
  git: { command: 'git', args: ['--version'] },
  go: { command: 'go', args: ['version'] }
});
const MANAGERS = [
  ['winget', 'winget', ['win32']], ['homebrew', 'brew', ['darwin', 'linux']],
  ['apt', 'apt', ['linux']], ['dnf', 'dnf', ['linux']],
  ['npm', 'npm'], ['pnpm', 'pnpm'], ['yarn', 'yarn'],
  ['pip', 'pip3', null, ['pip']], ['uv', 'uv'],
  ['cargo', 'cargo'], ['rustup', 'rustup'], ['maven', 'mvn'],
  ['gradle', 'gradle'], ['dotnet', 'dotnet'], ['dart', 'dart']
];

function createContext(overrides = {}) {
  return {
    platform: process.platform, arch: process.arch, machine: os.machine(),
    release: os.release(), runtimeVersion: process.versions.node,
    env: process.env, execPath: process.execPath, cwd: process.cwd(),
    stat: fs.statSync, access: fs.accessSync, read: fs.readFileSync,
    spawn: spawnSync, ...overrides
  };
}
function environmentValue(env, key, windows = false) {
  const name = windows ? Object.keys(env).find(k => k.toLowerCase() === key.toLowerCase()) : key;
  return name ? env[name] : undefined;
}
function exists(file, context, executable = false) {
  try {
    if (!context.stat(file).isFile()) return false;
    if (executable && context.platform !== 'win32') context.access(file, fs.constants.X_OK);
    return true;
  } catch { return false; }
}
function findExecutables(command, context) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.+_-]*$/.test(command)) return [];
  const windows = context.platform === 'win32';
  const paths = pathFor(context);
  const directories = String(environmentValue(context.env, 'PATH', windows) || '').split(windows ? ';' : ':');
  const windowsExtensions = ['.exe', '.com', '.cmd', '.bat'];
  const extensions = windows ? (windowsExtensions.includes(path.win32.extname(command).toLowerCase()) ? [''] : windowsExtensions) : [''];
  const matches = [];
  for (const entry of directories.slice(0, 256)) {
    const directory = entry.replace(/^"(.*)"$/, '$1');
    // Never search CWD/relative PATH entries: downloaded project files are not trusted CLIs.
    if (!paths.isAbsolute(directory)) continue;
    for (const extension of extensions) {
      const file = paths.join(directory, command + extension);
      if (exists(file, context, true) && !matches.some(m => windows ? m.toLowerCase() === file.toLowerCase() : m === file)) matches.push(file);
    }
  }
  return matches;
}
function pathFor(context) { return context.platform === 'win32' ? path.win32 : path.posix; }
function parseOsRelease(text) {
  const result = {};
  for (const line of String(text).slice(0, 16384).split(/\r?\n/)) {
    const match = /^(ID|ID_LIKE|VERSION_ID)=(.*)$/.exec(line);
    if (!match) continue;
    const value = match[2].replace(/^(["'])(.*)\1$/, '$2');
    if (/^[a-zA-Z0-9 ._-]{0,100}$/.test(value)) result[match[1]] = value;
  }
  return { id: result.ID || null, version: result.VERSION_ID || null, like: (result.ID_LIKE || '').split(' ').filter(Boolean) };
}
function detectSystem(context) {
  const names = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' };
  const normalizeArch = value => ({ x86_64: 'x64', amd64: 'x64', aarch64: 'arm64', arm64: 'arm64', x64: 'x64', i386: 'ia32', i686: 'ia32' }[String(value).toLowerCase()] || value);
  const result = {
    platform: context.platform, name: names[context.platform] || context.platform,
    release: /^[-.\w]+$/.test(context.release) ? context.release : null,
    architecture: context.arch, machineArchitecture: normalizeArch(context.machine),
    runtimeVersion: context.runtimeVersion, version: null, distribution: null,
    recognized: Boolean(names[context.platform]), compatibility: 'not-assessed'
  };
  if (context.platform === 'linux') {
    try { result.distribution = parseOsRelease(context.read('/etc/os-release', 'utf8')); } catch { /* distro unknown is explicit */ }
    result.version = result.distribution?.version || null;
  } else if (context.platform === 'win32') {
    result.version = result.release;
    // Build number also covers Server, so do not label every high build as Windows 11.
    result.windowsBuild = Number(String(result.release).split('.')[2]) || null;
    const native = environmentValue(context.env, 'PROCESSOR_ARCHITEW6432', true) || environmentValue(context.env, 'PROCESSOR_ARCHITECTURE', true);
    if (native && /^(AMD64|ARM64|x86)$/i.test(native)) result.machineArchitecture = normalizeArch(native);
  } else if (context.platform === 'darwin' && exists('/usr/bin/sw_vers', context, true)) {
    const probe = run('/usr/bin/sw_vers', ['-productVersion'], context);
    if (!probe.error && probe.status === 0 && /^\d+(\.\d+){1,2}$/.test(String(probe.stdout).trim())) result.version = probe.stdout.trim();
  }
  result.architectureMismatch = result.machineArchitecture !== result.architecture;
  return result;
}
function diagnosticEnv(context) {
  // Process-local only. Avoid implicit downloads, telemetry and package-manager self updates.
  return { ...context.env, GOTOOLCHAIN: 'local', GOTELEMETRY: 'off',
    COREPACK_ENABLE_NETWORK: '0', RUSTUP_AUTO_INSTALL: '0', RUSTUP_NO_UPDATE_CHECK: '1',
    HOMEBREW_NO_AUTO_UPDATE: '1', HOMEBREW_NO_ANALYTICS: '1',
    DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_SKIP_FIRST_TIME_EXPERIENCE: '1', DOTNET_NOLOGO: '1',
    npm_config_update_notifier: 'false', npm_config_audit: 'false', NO_COLOR: '1' };
}
function run(command, args, context) {
  try {
    return context.spawn(command, args, {
      encoding: 'utf8', timeout: 4000, maxBuffer: 8192,
      shell: false, windowsHide: true, env: diagnosticEnv(context), cwd: context.cwd
    });
  } catch (error) { return { error }; }
}
function parseVersion(id, output) {
  const text = String(output);
  const semver = '(\\d+\\.\\d+(?:\\.\\d+)?(?:-[\\w.-]+)?)';
  const exact = new RegExp('^\\s*v?' + semver + '\\s*$', 'm');
  const parsers = {
    node: new RegExp('^v' + semver + '\\s*$', 'm'),
    npm: exact, dotnet: exact, pulumi: exact,
    python: new RegExp('^Python\\s+' + semver + '\\s*$', 'm'),
    git: new RegExp('^git version\\s+' + semver, 'm'),
    go: /\bgo(\d+\.\d+(?:\.\d+)?(?:(?:rc|beta)\d+)?)(?=\s|$)/,
    java: /(?:version\s+"|openjdk\s+)(\d+(?:\.\d+){0,2}(?:-[\w.-]+)?)/,
    mysql: /Distrib\s+(\d+\.\d+(?:\.\d+)?)/
  };
  const parser = parsers[id] || /\bv?(\d+\.\d+(?:\.\d+)?(?:-[\w.-]+)?)\b/;
  const match = parser.exec(text) || (id === 'mysql' ? /\bVer\s+(\d+\.\d+(?:\.\d+)?)/.exec(text) : null);
  return match ? match[1] : null;
}

function compareVersions(left, right) {
  const a = left.split('.').map(Number), b = right.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff) return Math.sign(diff);
  }
  return 0;
}
function assessVersion(version, requirement) {
  if (!requirement || (typeof requirement === 'object' && !Array.isArray(requirement) && Object.keys(requirement).length === 0)) return { status: 'not-assessed', reason: 'no-version-rule' };
  if (typeof requirement !== 'object' || Array.isArray(requirement) || Object.keys(requirement).some(k => !['min', 'maxExclusive', 'majors'].includes(k)) ||
      ['min', 'maxExclusive'].some(k => requirement[k] !== undefined && !/^\d+(\.\d+){0,2}$/.test(requirement[k])) ||
      (requirement.majors !== undefined && (!Array.isArray(requirement.majors) || !requirement.majors.length || !requirement.majors.every(n => Number.isSafeInteger(n) && n >= 0)))) {
    return { status: 'unverifiable', reason: 'invalid-version-rule' };
  }
  if (!version) return { status: 'unverifiable', reason: 'version-unavailable' };
  if (!/^\d+(\.\d+){0,2}$/.test(version)) return { status: 'unverifiable', reason: 'non-stable-or-unknown-version' };
  const incompatible = (requirement.min && compareVersions(version, requirement.min) < 0) ||
    (requirement.maxExclusive && compareVersions(version, requirement.maxExclusive) >= 0) ||
    (requirement.majors && !requirement.majors.includes(Number(version.split('.')[0])));
  return { status: incompatible ? 'incompatible' : 'compatible', reason: incompatible ? 'outside-declared-range' : 'inside-declared-range' };
}
function isSafeVersionProbe(command, args) {
  if (!Array.isArray(args)) return false;
  if (args.length === 1 && args[0] === '--version') return true;
  const expected = { java: '-version', sqlplus: '-V', sqlcmd: '-?', go: 'version', terraform: 'version', pulumi: 'version', adb: 'version', 'arduino-cli': 'version' };
  return Object.hasOwn(expected, command) && args.length === 1 && args[0] === expected[command];
}
function probeTool(id, definition, context) {
  const base = { tool: id, command: definition.command, version: null, compatibility: { status: 'not-assessed', reason: 'not-verified' }, updateStatus: 'not-checked' };
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.+_-]*$/.test(definition.command) || !Array.isArray(definition.args) || !definition.args.length || !definition.args.every(a => VERSION_ARGUMENTS.has(a)) || !isSafeVersionProbe(definition.command, definition.args)) {
    return { ...base, status: 'error', reason: 'invalid-diagnostic-command' };
  }
  if (definition.platforms && !definition.platforms.includes(context.platform)) return { ...base, status: 'unsupported', reason: 'platform-not-declared' };
  const choices = [{ command: definition.command, args: definition.args }];
  if (id === 'python') {
    choices.push({ command: 'python', args: ['--version'] });
    if (context.platform === 'win32') choices.push({ command: 'py', args: ['-3', '--version'] });
  }
  let selected, candidates, aliasFound = false;
  for (const choice of choices) {
    candidates = findExecutables(choice.command, context);
    if (context.platform === 'win32') {
      aliasFound ||= candidates.some(file => /[\\/]WindowsApps[\\/]/i.test(file));
      candidates = candidates.filter(file => !/[\\/]WindowsApps[\\/]/i.test(file));
    }
    if (candidates.length) { selected = choice; break; }
  }
  if (!selected) return { ...base, status: aliasFound ? 'unverifiable' : 'missing', reason: aliasFound ? 'windows-app-alias' : 'not-found-on-absolute-path' };
  let executable = candidates[0], args = selected.args;
  base.command = selected.command;
  base.candidateCount = candidates.length;
  // Flutter may bootstrap its SDK cache even for --version. Presence alone is safer in phase B.
  if (id === 'flutter') return { ...base, status: 'unverifiable', reason: 'sdk-bootstrap-not-authorized' };
  if (context.platform === 'win32' && /[\\/]WindowsApps[\\/]/i.test(executable)) return { ...base, status: 'unverifiable', reason: 'windows-app-alias' };
  if (context.platform === 'win32' && /\.(cmd|bat)$/i.test(executable)) {
    // Official npm installation layout: use Node directly, never cmd.exe/shell interpolation.
    const npmCli = path.win32.join(path.win32.dirname(executable), 'node_modules', 'npm', 'bin', 'npm-cli.js');
    if (id !== 'npm' || !exists(npmCli, context)) return { ...base, status: 'unverifiable', reason: 'shell-wrapper-not-executed' };
    executable = context.execPath; args = [npmCli, ...args];
  }
  const result = run(executable, args, context);
  if (result.error || result.status !== 0) {
    const reason = result.error?.code === 'ETIMEDOUT' ? 'timeout' : result.error?.code === 'ENOBUFS' ? 'output-limit' : result.error?.code === 'EACCES' || result.error?.code === 'EPERM' ? 'permission-denied' : 'probe-failed';
    return { ...base, status: 'error', reason };
  }
  const version = parseVersion(id, String(result.stdout || '') + '\n' + String(result.stderr || ''));
  const compatibility = assessVersion(version, definition.requirement);
  const status = !version || compatibility.status === 'unverifiable' ? 'unverifiable' : compatibility.status === 'incompatible' ? 'incompatible' : 'detected';
  return { ...base, version, compatibility, status, reason: !version ? 'version-not-recognized' : compatibility.status === 'incompatible' ? 'outside-declared-range' : status === 'unverifiable' ? compatibility.reason : 'version-reported' };
}
function detectManagers(context, checks) {
  return MANAGERS.filter(([, , platforms]) => !platforms || platforms.includes(context.platform)).map(([id, command, , alternatives = []]) => {
    const verified = checks.find(c => c.tool === id && c.status !== 'missing');
    if (verified) return { id, command: verified.command, status: verified.status, version: verified.version, verification: 'version-probe' };
    for (const name of [command, ...alternatives]) if (findExecutables(name, context).length) return { id, command: name, status: 'detected', version: null, verification: 'presence-only' };
    return { id, command, status: 'missing', version: null, verification: 'presence-only' };
  });
}
function configurationPresence(context) {
  return ['JAVA_HOME', 'ANDROID_HOME', 'ANDROID_SDK_ROOT', 'GOROOT', 'GOPATH', 'DOTNET_ROOT', 'VIRTUAL_ENV', 'CONDA_PREFIX'].map(name => ({ name, configured: Boolean(environmentValue(context.env, name, context.platform === 'win32')) }));
}
function diagnose(catalog, options = {}, overrides = {}) {
  const context = createContext(overrides);
  const profiles = catalog.profiles.filter(p => !options.profile || p.id === options.profile);
  const definitions = { ...EXTRA_TOOLS, ...catalog.tools };
  const tools = options.tools?.length ? [...new Set(options.tools)] : [...new Set(profiles.flatMap(p => p.tools))];
  if (options.profile && !catalog.profiles.some(p => p.id === options.profile)) throw new Error('Perfil desconocido');
  if (tools.some(id => !Object.hasOwn(definitions, id))) throw new Error('Herramienta desconocida');
  const checks = tools.map(id => probeTool(id, definitions[id], context));
  const system = detectSystem(context);
  let projectWritable;
  try { context.access(context.cwd, fs.constants.W_OK); projectWritable = true; } catch { projectWritable = false; }
  return {
    schemaVersion: 2, profiles: options.tools?.length ? [] : profiles.map(p => p.id), checks,
    ok: system.recognized && checks.every(c => c.status === 'detected'),
    system, packageManagers: detectManagers(context, checks), configuration: configurationPresence(context),
    permissions: { projectWritable, elevationRequested: false },
    scope: 'Diagnóstico local de CLIs y gestores. No instala, actualiza, autentica ni prueba servidores, SDKs o hardware. Compatibilidad solo cuando hay reglas explícitas; versiones recientes no se consultan en red.'
  };
}
module.exports = { EXTRA_TOOLS, createContext, findExecutables, parseOsRelease, detectSystem, parseVersion, assessVersion, isSafeVersionProbe, probeTool, diagnose };
