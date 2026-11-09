'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { destinationPath, checkDestination, tarExecutable, command, verifyExtracted } = require('./filesystem');
const { digest, canonical, validatePlan } = require('../planner/plan');
const transport = require('./transport');
const { diagnose } = require('../doctor/environment');
const { doctorCatalog } = require('../tools/catalog');
const RECIPE = 'go-official-archive-v1';
const MAX_AGE = 60 * 60 * 1000;
function resolveArtifact(index, version, platform, architecture) {
  if (!/^\d+\.\d+\.\d+$/.test(version) || !['darwin','linux','win32'].includes(platform) || !['x64','arm64'].includes(architecture)) throw new Error('Versión, sistema o arquitectura sin receta.');
  const targetOs = platform === 'win32' ? 'windows' : platform;
  const arch = architecture === 'x64' ? 'amd64' : 'arm64';
  const filename = `go${version}.${targetOs}-${arch}.${platform === 'win32' ? 'zip' : 'tar.gz'}`;
  const release = Array.isArray(index) && index.find(r => r.version === `go${version}` && r.stable === true);
  const matches = release && Array.isArray(release.files) && release.files.filter(f => f.filename === filename && f.os === targetOs && f.arch === arch && f.version === `go${version}` && f.kind === 'archive');
  if (!matches || matches.length !== 1 || !/^[a-f0-9]{64}$/.test(matches[0].sha256) || !Number.isSafeInteger(matches[0].size) || matches[0].size < 1 || matches[0].size > 300 * 1024 * 1024) throw new Error('No existe un archivo estable verificable para esa versión y arquitectura.');
  return { filename, url: `https://go.dev/dl/${filename}`, sha256: matches[0].sha256, size: matches[0].size, metadataUrl: transport.METADATA_URL };
}
function checkArchiveListing(names, details) {
  const entries = names.trim().split(/\r?\n/);
  if (!entries.length || entries.length > 100000) throw new Error('Índice de archivo inválido.');
  const seen = new Set();
  for (const entry of entries) {
    if (!/^go(?:\/|$)/.test(entry) || /[\\\x00-\x1f\x7f]/.test(entry) || entry.split('/').some(p => p === '..' || p === '.') || entry.includes('//') || seen.has(entry)) throw new Error('Ruta insegura o duplicada en el archivo.');
    seen.add(entry);
  }
  const types = details.trim().split(/\r?\n/);
  if (types.length !== entries.length || types.some(line => !/^[-d][rwx-]{9}\s/.test(line))) throw new Error('El archivo contiene enlaces o tipos no admitidos.');
  if (!seen.has('go/bin/go') && !seen.has('go/bin/go.exe')) throw new Error('El archivo no contiene Go.');
}
function eligible(plan, manifest, capabilities) {
  if (!validatePlan(plan, manifest, capabilities).ok || plan.status === 'blocked') throw new Error('Plan D inválido o bloqueado; vuelve a generarlo.');
  if (plan.request.manager !== null) throw new Error('Esta receta usa archivo oficial directo; regenera el plan D sin --manager.');
  const go = plan.items.find(i => i.tool === 'go');
  if (!go || go.intent !== 'install' || !go.targetVersion || go.targetCompatibility.status !== 'compatible' || plan.items.some(i => i.tool !== 'go' && i.intent !== 'reuse')) throw new Error('La receta requiere Go ausente, versión exacta compatible y ninguna otra instalación pendiente.');
  return go;
}
function buildPrepared(plan, artifact, destination, createdAt, manifest, capabilities) {
  const go = eligible(plan, manifest, capabilities);
  destinationPath(destination, plan.observation.system.platform);
  if (!Number.isSafeInteger(createdAt) || createdAt < 0) throw new Error('Fecha de propuesta inválida.');
  const payload = { schemaVersion: 1, recipe: RECIPE, plan, artifact, destination, createdAt, expiresAt: createdAt + MAX_AGE,
    platform: plan.observation.system.platform, architecture: plan.observation.system.architecture, version: go.targetVersion,
    scope: 'new-directory', approval: 'required-at-apply', executionAllowed: false,
    effects: ['download-verified-official-archive', 'extract-in-private-staging', 'verify-go-version', 'publish-new-directory', 'write-local-receipt'],
    persistentConfiguration: false, elevationRequested: false };
  return { installationId: digest(payload), ...payload };
}
function validatePrepared(prepared, manifest, capabilities, now = Date.now()) {
  try {
    if (!prepared || typeof prepared !== 'object') throw new Error();
    const go = eligible(prepared.plan, manifest, capabilities);
    const expectedArtifact = resolveArtifact([{ version: `go${go.targetVersion}`, stable: true, files: [{ ...prepared.artifact, version: `go${go.targetVersion}`, os: prepared.platform === 'win32' ? 'windows' : prepared.platform, arch: prepared.architecture === 'x64' ? 'amd64' : prepared.architecture, kind: 'archive' }] }], go.targetVersion, prepared.platform, prepared.architecture);
    const rebuilt = buildPrepared(prepared.plan, expectedArtifact, prepared.destination, prepared.createdAt, manifest, capabilities);
    if (canonical(rebuilt) !== canonical(prepared) || now < prepared.createdAt || now > prepared.expiresAt) throw new Error();
    return { ok: true, installationId: prepared.installationId, environmentRechecked: false, approval: 'required-at-apply' };
  } catch { return { ok: false, errors: ['Propuesta de instalación inválida, modificada, obsoleta o caducada. Regénérala.'], environmentRechecked: false }; }
}
function liveCheck(plan, manifest, capabilities) {
  const report = diagnose({ ...doctorCatalog(capabilities, manifest), profiles: [] }, { tools: plan.items.map(i => i.tool) });
  if (report.system.platform !== plan.observation.system.platform || report.system.architecture !== plan.observation.system.architecture || report.system.architectureMismatch) throw new Error('El sistema o arquitectura cambió, o se ejecuta bajo emulación. Regenera el plan con el runtime nativo.');
  if (report.checks.find(c => c.tool === 'go')?.status !== 'missing') throw new Error('Go ya existe o su estado es incierto; no se reemplazará.');
  for (const item of plan.items.filter(i => i.tool !== 'go')) {
    const check = report.checks.find(c => c.tool === item.tool);
    if (!check || check.status !== 'detected' || check.version !== item.current.version || check.compatibility.status !== 'compatible') throw new Error('Cambió una dependencia reutilizada. Regenera el plan.');
  }
}
async function prepare(plan, destination, manifest, capabilities) {
  const go = eligible(plan, manifest, capabilities);
  destinationPath(destination, process.platform);
  liveCheck(plan, manifest, capabilities); checkDestination(destination); tarExecutable(process.platform);
  const artifact = resolveArtifact(await transport.metadata(), go.targetVersion, process.platform, process.arch);
  return buildPrepared(plan, artifact, destination, Date.now(), manifest, capabilities);
}
async function apply(prepared, approval, manifest, capabilities, progress = () => {}) {
  if (!validatePrepared(prepared, manifest, capabilities).ok || approval !== prepared.installationId) throw new Error('Se requiere una propuesta vigente y --approve con su installationId completo.');
  liveCheck(prepared.plan, manifest, capabilities);
  const parent = checkDestination(prepared.destination), tar = tarExecutable(process.platform);
  const current = resolveArtifact(await transport.metadata(), prepared.version, process.platform, process.arch);
  if (canonical(current) !== canonical(prepared.artifact)) throw new Error('Cambió el origen, tamaño o hash oficial. Prepara y aprueba otra propuesta.');
  // All network/precondition checks precede writes; stage is private and on the destination filesystem.
  const stage = fs.mkdtempSync(path.join(parent, '.canedo-install-'));
  let reserved = false, published = false;
  try {
    fs.chmodSync(stage, 0o700);
    progress('Descargando archivo oficial y comprobando SHA-256…');
    const archive = path.join(stage, current.filename);
    await transport.download(current, archive);
    // Defense in depth: independently hash even if the transport changes in future.
    const crypto = require('node:crypto');
    const hash = crypto.createHash('sha256');
    for await (const chunk of fs.createReadStream(archive)) hash.update(chunk);
    if (fs.statSync(archive).size !== current.size || hash.digest('hex') !== current.sha256) throw new Error('Integridad del archivo incorrecta.');
    const names = command(tar, ['-tf', archive], stage);
    const details = command(tar, ['-tvf', archive], stage);
    checkArchiveListing(names, details);
    progress('Extrayendo en carpeta temporal y verificando versión…');
    command(tar, ['-xf', archive, '-C', stage], stage);
    const tree = path.join(stage, 'go'), executable = path.join(tree, 'bin', process.platform === 'win32' ? 'go.exe' : 'go');
    verifyExtracted(tree, executable);
    const output = command(executable, ['version'], stage, 10000).trim();
    const targetOs = process.platform === 'win32' ? 'windows' : process.platform, arch = process.arch === 'x64' ? 'amd64' : process.arch;
    if (output !== `go version go${prepared.version} ${targetOs}/${arch}`) throw new Error('La versión instalada no coincide con la aprobada.');
    // Reserve atomically: never rename over another directory created during the download.
    checkDestination(prepared.destination);
    fs.mkdirSync(prepared.destination, { mode: 0o700 }); reserved = true;
    const root = path.join(prepared.destination, 'go');
    fs.renameSync(tree, root); published = true;
    const receipt = { schemaVersion: 1, installationId: prepared.installationId, recipe: RECIPE, tool: 'go', version: prepared.version, platform: process.platform, architecture: process.arch,
      artifact: current, installedAt: new Date().toISOString(), ownership: 'kit-created-directory', verification: 'go-version-matched', persistentConfiguration: false };
    fs.writeFileSync(path.join(prepared.destination, 'canedo-install.local.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    progress('Instalación verificada. PATH permanece sin modificar.');
    return { ok: true, installationId: prepared.installationId, destination: prepared.destination, executable: path.join(root, 'bin', process.platform === 'win32' ? 'go.exe' : 'go'), receipt, pathConfigured: false };
  } catch (error) {
    if (reserved && !published) { try { fs.rmdirSync(prepared.destination); } catch { /* never remove unknown files */ } }
    if (published) throw new Error('Go se publicó, pero falló el registro local. Se conservó la carpeta nueva para revisión; no repitas apply sobre ella.');
    throw error;
  } finally { fs.rmSync(stage, { recursive: true, force: true }); }
}
function recipes() {
  return { schemaVersion: 1, recipes: [{ id: RECIPE, tool: 'go', provider: 'official-archive', platforms: ['win32','darwin','linux'], architectures: ['x64','arm64'], scope: 'new-directory', elevation: false, requires: ['exact-compatible-version','official-metadata','sha256','system-tar','fresh-diagnosis','explicit-approval'] }],
    note: 'Receta Go. Consulta install recipes para ver el registro completo; no instala gestores, bases de datos ni IDEs.' };
}
module.exports = { RECIPE, MAX_AGE, resolveArtifact, destinationPath, checkDestination, checkArchiveListing, verifyExtracted, buildPrepared, validatePrepared, liveCheck, prepare, apply, recipes };
