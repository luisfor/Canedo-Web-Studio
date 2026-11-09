'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { canonical, digest, validatePlan } = require('../planner/plan');
const { diagnose } = require('../doctor/environment');
const { doctorCatalog } = require('../tools/catalog');
const { definitions, definitionForRecipe } = require('./archive-recipes');
const io = require('./filesystem');
const transport = require('./transport');
const MAX_AGE = 60 * 60 * 1000;
function eligible(definition, plan, manifest, capabilities) {
  if (!validatePlan(plan, manifest, capabilities).ok || plan.status === 'blocked') throw new Error('Plan D inválido o bloqueado. Regénéralo.');
  if (plan.request.manager !== null) throw new Error('Esta receta usa archivos oficiales; prepara el plan D sin --manager.');
  const item = plan.items.find(i => i.tool === definition.tool);
  if (!item || !['install','review-existing'].includes(item.intent) || !item.targetVersion || item.targetCompatibility.status === 'incompatible') throw new Error('Se requiere versión exacta y una instalación o revisión explícita de la herramienta.');
  if (definition.tool === 'node' && item.targetCompatibility.status !== 'compatible') throw new Error('La versión Node debe cumplir la política declarada.');
  if (definition.bundled.some(id => plan.request.exclude.includes(id))) throw new Error('No se puede excluir un componente incluido en el archivo oficial.');
  if (plan.items.some(i => i.tool !== definition.tool && !definition.bundled.includes(i.tool) && i.intent !== 'reuse')) throw new Error('El plan tiene otras instalaciones o decisiones pendientes; prepara un plan separado por receta.');
  return item;
}
function rebuildArtifact(definition, artifact, version, platform, architecture) {
  const descriptor = definition.descriptor(version, platform, architecture);
  const metadata = { checksums: `${artifact.sha256}  ${descriptor.filename}\n`, size: artifact.size };
  if (definition.tool === 'node') {
    const key = platform === 'win32' ? `win-${architecture}-zip` : platform === 'darwin' ? `osx-${architecture}-tar` : `linux-${architecture}`;
    metadata.index = [{ version: `v${version}`, lts: 'snapshot-to-revalidate', npm: artifact.bundledVersions?.npm, files: [key] }];
  }
  return definition.resolve(metadata, version, platform, architecture);
}
function buildPrepared(definition, plan, artifact, destination, createdAt, manifest, capabilities) {
  const item = eligible(definition, plan, manifest, capabilities);
  const { platform, architecture } = plan.observation.system;
  io.destinationPath(destination, platform);
  if (!Number.isSafeInteger(createdAt) || createdAt < 0) throw new Error('Fecha inválida.');
  if (canonical(rebuildArtifact(definition, artifact, item.targetVersion, platform, architecture)) !== canonical(artifact)) throw new Error('Artefacto fuera de la receta.');
  for (const id of definition.bundled) {
    if (plan.request.versions[id] && plan.request.versions[id] !== artifact.bundledVersions[id]) throw new Error('La versión solicitada del componente no coincide con la incluida en el archivo oficial.');
  }
  const warnings = [];
  if (item.targetCompatibility.status !== 'compatible') warnings.push('project-compatibility-not-assessed');
  if (item.current.status !== 'missing') warnings.push('existing-installation-kept');
  if (definition.bundled.length) warnings.push('bundled-components-included');
  const payload = { schemaVersion: 2, recipe: definition.id, tool: definition.tool, plan, artifact, destination, platform, architecture, version: item.targetVersion,
    createdAt, expiresAt: createdAt + MAX_AGE, warnings,
    scope: 'new-directory', executionAllowed: false, approval: 'required-at-apply', persistentConfiguration: false, elevationRequested: false,
    effects: ['download-verified-official-archive','extract-in-private-staging','verify-binary-and-bundled-versions','publish-new-directory','write-local-receipt','keep-existing-installations'] };
  return { installationId: digest(payload), ...payload };
}
function validatePrepared(prepared, manifest, capabilities, now = Date.now()) {
  try {
    const definition = definitionForRecipe(prepared.recipe);
    const rebuilt = buildPrepared(definition, prepared.plan, prepared.artifact, prepared.destination, prepared.createdAt, manifest, capabilities);
    if (canonical(rebuilt) !== canonical(prepared) || now < prepared.createdAt || now > prepared.expiresAt) throw new Error();
    return { ok: true, installationId: prepared.installationId, environmentRechecked: false, approval: 'required-at-apply' };
  } catch { return { ok: false, errors: ['Propuesta inválida, modificada, caducada o con receta desconocida. Regénérala.'], environmentRechecked: false }; }
}
function liveCheck(definition, plan, manifest, capabilities) {
  const report = diagnose({ ...doctorCatalog(capabilities, manifest), profiles: [] }, { tools: plan.items.map(i => i.tool) });
  if (report.system.platform !== plan.observation.system.platform || report.system.architecture !== plan.observation.system.architecture || report.system.architectureMismatch) throw new Error('Sistema o arquitectura diferente, o runtime bajo emulación. Regenera el plan.');
  for (const item of plan.items) {
    const check = report.checks.find(c => c.tool === item.tool);
    if (!check || check.status !== item.current.status || check.version !== item.current.version) throw new Error('Cambió el diagnóstico de una herramienta. Regenera el plan antes de instalar.');
    if (item.tool !== definition.tool && !definition.bundled.includes(item.tool) && check.compatibility.status !== 'compatible') throw new Error('La dependencia reutilizada ya no es compatible.');
  }
}
function checkArchiveListing(names, details, definition, version, platform, architecture) {
  const descriptor = definition.descriptor(version, platform, architecture), root = descriptor.root;
  const entries = names.trim().split(/\r?\n/), lines = details.trim().split(/\r?\n/);
  if (!entries.length || entries.length > 100000 || entries.length !== lines.length) throw new Error('Índice de archivo inválido.');
  const seen = new Map(), links = [];
  const allowedLinks = definition.links(platform);
  for (let n = 0; n < entries.length; n++) {
    const entry = entries[n], key = entry.replace(/\/$/, '');
    if (!entry || /[\\:\x00-\x1f\x7f]/.test(entry) || entry.startsWith('/') || entry.includes('//') || entry.split('/').some(p => p === '.' || p === '..') || seen.has(key)) throw new Error('Ruta insegura o duplicada en el archivo.');
    if (root && key !== root && !entry.startsWith(root + '/')) throw new Error('Ruta fuera de la raíz de la receta.');
    if (!root && ![definition.executable(platform),'LICENSE','LICENSE.txt','README.md'].includes(entry)) throw new Error('Archivo no permitido por la receta.');
    const relative = root ? (key === root ? '' : key.slice(root.length + 1)) : key;
    const type = lines[n][0];
    if (!/^[-dl][rwx-]{9}\s/.test(lines[n])) throw new Error('Enlace, permiso o tipo especial no admitido.');
    if (type === 'l') {
      const expected = allowedLinks[relative];
      if (!expected || !lines[n].endsWith(`${entry} -> ${expected}`)) throw new Error('Enlace simbólico no permitido por la receta.');
      links.push({ entry: key, target: path.posix.normalize(path.posix.join(path.posix.dirname(key), expected)) });
    }
    seen.set(key, type);
  }
  for (const link of links) {
    if (seen.get(link.target) !== '-' || [...seen.keys()].some(entry => entry.startsWith(link.entry + '/'))) throw new Error('Enlace sin destino regular o usado como directorio.');
  }
  const prefix = root ? root + '/' : '';
  if (seen.get(prefix + definition.executable(platform)) !== '-') throw new Error('No se encontró el ejecutable regular de la receta.');
  if (definition.tool === 'node' && seen.get(prefix + definition.npmCli(platform)) !== '-') throw new Error('El archivo Node no contiene npm verificable.');
}
function verifyTree(tree, definition, platform) {
  const links = definition.links(platform); let count = 0, bytes = 0;
  if (!fs.lstatSync(tree).isDirectory()) throw new Error('Raíz extraída inválida.');
  function walk(directory) {
    for (const name of fs.readdirSync(directory)) {
      if (++count > 100000) throw new Error('Demasiados archivos extraídos.');
      const file = path.join(directory, name), stat = fs.lstatSync(file), relative = path.relative(tree, file).split(path.sep).join('/');
      if (stat.isSymbolicLink()) {
        if (!links[relative] || fs.readlinkSync(file) !== links[relative]) throw new Error('Enlace extraído no permitido.');
        const target = fs.realpathSync(file);
        if (!target.startsWith(tree + path.sep) || !fs.lstatSync(target).isFile()) throw new Error('Enlace extraído fuera del árbol.');
      } else if (stat.isDirectory()) walk(file);
      else if (!stat.isFile() || stat.nlink > 1) throw new Error('Tipo extraído no admitido.');
      else { bytes += stat.size; if (bytes > 2 * 1024 * 1024 * 1024) throw new Error('Árbol extraído demasiado grande.'); }
    }
  }
  walk(tree);
}
async function prepare(definition, plan, destination, manifest, capabilities) {
  const item = eligible(definition, plan, manifest, capabilities);
  io.destinationPath(destination, process.platform); liveCheck(definition, plan, manifest, capabilities);
  io.checkDestination(destination);
  const descriptor = definition.descriptor(item.targetVersion, process.platform, process.arch);
  io.archiveExtractor(process.platform, descriptor.filename);
  const artifact = await definition.fetch(item.targetVersion, process.platform, process.arch);
  return buildPrepared(definition, plan, artifact, destination, Date.now(), manifest, capabilities);
}
async function apply(prepared, approval, manifest, capabilities, progress = () => {}) {
  if (!validatePrepared(prepared, manifest, capabilities).ok || approval !== prepared.installationId) throw new Error('Se requiere una propuesta vigente y --approve con su installationId completo.');
  const definition = definitionForRecipe(prepared.recipe);
  liveCheck(definition, prepared.plan, manifest, capabilities);
  const parent = io.checkDestination(prepared.destination), extractor = io.archiveExtractor(process.platform, prepared.artifact.filename);
  const current = await definition.fetch(prepared.version, process.platform, process.arch);
  if (canonical(current) !== canonical(prepared.artifact)) throw new Error('Cambió el origen, hash, tamaño o componente incluido. Prepara y aprueba otra propuesta.');
  const stage = fs.mkdtempSync(path.join(parent, '.canedo-install-'));
  let reserved = false, published = false;
  try {
    fs.chmodSync(stage, 0o700);
    const archive = path.join(stage, current.filename);
    progress(`Descargando ${definition.tool} y verificando SHA-256…`);
    await transport.download(current, archive);
    const hash = crypto.createHash('sha256');
    for await (const chunk of fs.createReadStream(archive)) hash.update(chunk);
    if (fs.statSync(archive).size !== current.size || hash.digest('hex') !== current.sha256) throw new Error('Integridad del archivo incorrecta.');
    const listing = io.inspectArchive(extractor, archive, stage);
    checkArchiveListing(listing.names, listing.details, definition, prepared.version, prepared.platform, prepared.architecture);
    const extraction = path.join(stage, 'content'); fs.mkdirSync(extraction, { mode: 0o700 });
    progress(`Extrayendo y verificando ${definition.tool}…`);
    io.extractArchive(extractor, archive, extraction, stage);
    const root = definition.descriptor(prepared.version, prepared.platform, prepared.architecture).root;
    const tree = root ? path.join(extraction, root) : extraction;
    verifyTree(tree, definition, prepared.platform);
    const executable = path.join(tree, definition.executable(prepared.platform));
    definition.verify(executable, tree, prepared, io.command, stage);
    io.checkDestination(prepared.destination);
    fs.mkdirSync(prepared.destination, { mode: 0o700 }); reserved = true;
    const installed = path.join(prepared.destination, definition.tool);
    fs.renameSync(tree, installed); published = true;
    const receipt = { schemaVersion: 2, installationId: prepared.installationId, recipe: definition.id, tool: definition.tool, version: prepared.version,
      platform: process.platform, architecture: process.arch, artifact: current, installedAt: new Date().toISOString(), ownership: 'kit-created-directory',
      verification: 'binary-and-bundled-versions-matched', compatibility: prepared.plan.items.find(i => i.tool === definition.tool).targetCompatibility,
      persistentConfiguration: false, existingInstallationsPreserved: true };
    fs.writeFileSync(path.join(prepared.destination, 'canedo-install.local.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    progress('Instalación verificada; herramientas anteriores y PATH conservados.');
    return { ok: true, installationId: prepared.installationId, destination: prepared.destination, executable: path.join(installed, definition.executable(prepared.platform)), receipt, pathConfigured: false };
  } catch (error) {
    if (reserved && !published) { try { fs.rmdirSync(prepared.destination); } catch { /* preserve unknown contents */ } }
    if (published) throw new Error('La herramienta se publicó, pero falló el registro. Se conservó la carpeta nueva para revisión; no repitas apply sobre ella.');
    throw error;
  } finally { fs.rmSync(stage, { recursive: true, force: true }); }
}
module.exports = { MAX_AGE, eligible, buildPrepared, validatePrepared, liveCheck, checkArchiveListing, verifyTree, prepare, apply, definitions };
