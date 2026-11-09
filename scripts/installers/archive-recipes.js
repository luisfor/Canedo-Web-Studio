'use strict';
const path = require('node:path');
const transport = require('./transport');
const EXACT = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;
function target(version, platform, architecture) {
  if (!EXACT.test(version) || !['darwin','linux','win32'].includes(platform) || !['x64','arm64'].includes(architecture)) throw new Error('Versión, sistema o arquitectura sin receta.');
}
function checksum(text, filename) {
  if (typeof text !== 'string') throw new Error('Lista de integridad inválida.');
  const matches = text.split(/\r?\n/).map(line => /^([a-f0-9]{64})\s+\*?([^\s]+)\s*$/.exec(line)).filter(m => m && m[2] === filename);
  if (matches.length !== 1) throw new Error('El archivo no tiene un SHA-256 único en la fuente oficial.');
  return matches[0][1];
}
function validSize(size) {
  if (!Number.isSafeInteger(size) || size < 1 || size > 300 * 1024 * 1024) throw new Error('Tamaño de archivo no admitido.');
  return size;
}
const definitions = {
  node: {
    id: 'node-official-archive-v1', tool: 'node', bundled: ['npm'],
    descriptor(version, platform, architecture) {
      target(version, platform, architecture);
      const root = `node-v${version}-${platform === 'win32' ? 'win' : platform}-${architecture}`;
      const filename = `${root}.${platform === 'win32' ? 'zip' : 'tar.gz'}`;
      const base = `https://nodejs.org/dist/v${version}/`;
      return { root, filename, url: base + filename, metadataUrls: ['https://nodejs.org/dist/index.json', base + 'SHASUMS256.txt'] };
    },
    resolve(metadata, version, platform, architecture) {
      const d = this.descriptor(version, platform, architecture);
      const releases = Array.isArray(metadata.index) && metadata.index.filter(r => r.version === `v${version}`);
      const release = releases && releases.length === 1 && releases[0];
      const fileKey = platform === 'win32' ? `win-${architecture}-zip` : platform === 'darwin' ? `osx-${architecture}-tar` : `linux-${architecture}`;
      if (!release || typeof release.lts !== 'string' || !release.lts.trim() || !EXACT.test(release.npm) || !Array.isArray(release.files) || !release.files.includes(fileKey)) throw new Error('Node debe ser una publicación LTS con archivo y npm identificados.');
      return { filename: d.filename, url: d.url, sha256: checksum(metadata.checksums, d.filename), size: validSize(metadata.size), metadataUrls: d.metadataUrls, bundledVersions: { npm: release.npm } };
    },
    async fetch(version, platform, architecture) {
      const d = this.descriptor(version, platform, architecture);
      const [index, checksums, size] = await Promise.all([transport.readJson(d.metadataUrls[0]), transport.readText(d.metadataUrls[1], 1024 * 1024), transport.headSize(d.url)]);
      return this.resolve({ index, checksums, size }, version, platform, architecture);
    },
    executable(platform) { return platform === 'win32' ? 'node.exe' : 'bin/node'; },
    npmCli(platform) { return platform === 'win32' ? 'node_modules/npm/bin/npm-cli.js' : 'lib/node_modules/npm/bin/npm-cli.js'; },
    links(platform) {
      return platform === 'win32' ? {} : { 'bin/npm': '../lib/node_modules/npm/bin/npm-cli.js', 'bin/npx': '../lib/node_modules/npm/bin/npx-cli.js', 'bin/corepack': '../lib/node_modules/corepack/dist/corepack.js' };
    },
    verify(executable, tree, prepared, command, cwd) {
      if (command(executable, ['--version'], cwd, 10000).trim() !== `v${prepared.version}`) throw new Error('La versión Node no coincide con la aprobada.');
      const runtime = command(executable, ['--eval', 'process.stdout.write(process.platform + "/" + process.arch)'], cwd, 10000).trim();
      if (runtime !== `${prepared.platform}/${prepared.architecture}`) throw new Error('La plataforma o arquitectura Node no coincide con la aprobada.');
      const npm = command(executable, [path.join(tree, this.npmCli(prepared.platform)), '--version'], cwd, 10000).trim();
      if (npm !== prepared.artifact.bundledVersions.npm) throw new Error('La versión npm no coincide con la publicación aprobada.');
    }
  },
  terraform: {
    id: 'terraform-official-archive-v1', tool: 'terraform', bundled: [],
    descriptor(version, platform, architecture) {
      target(version, platform, architecture);
      const filename = `terraform_${version}_${platform === 'win32' ? 'windows' : platform}_${architecture === 'x64' ? 'amd64' : 'arm64'}.zip`;
      const base = `https://releases.hashicorp.com/terraform/${version}/`;
      return { root: null, filename, url: base + filename, metadataUrls: [base + `terraform_${version}_SHA256SUMS`] };
    },
    resolve(metadata, version, platform, architecture) {
      const d = this.descriptor(version, platform, architecture);
      return { filename: d.filename, url: d.url, sha256: checksum(metadata.checksums, d.filename), size: validSize(metadata.size), metadataUrls: d.metadataUrls, bundledVersions: {} };
    },
    async fetch(version, platform, architecture) {
      const d = this.descriptor(version, platform, architecture);
      const [checksums, size] = await Promise.all([transport.readText(d.metadataUrls[0], 1024 * 1024), transport.headSize(d.url)]);
      return this.resolve({ checksums, size }, version, platform, architecture);
    },
    executable(platform) { return platform === 'win32' ? 'terraform.exe' : 'terraform'; },
    links() { return {}; },
    verify(executable, tree, prepared, command, cwd) {
      let output;
      try { output = JSON.parse(command(executable, ['version', '-json'], cwd, 10000)); } catch { throw new Error('No se pudo verificar la versión Terraform.'); }
      const platform = `${prepared.platform === 'win32' ? 'windows' : prepared.platform}_${prepared.architecture === 'x64' ? 'amd64' : 'arm64'}`;
      if (output.terraform_version !== prepared.version || output.platform !== platform) throw new Error('La versión o arquitectura Terraform no coincide con la aprobada.');
    }
  }
};
function definitionForRecipe(id) {
  const definition = Object.values(definitions).find(d => d.id === id);
  if (!definition) throw new Error('Receta no reconocida. No se ejecutó el contenido del archivo.');
  return definition;
}
module.exports = { definitions, definitionForRecipe, checksum };
