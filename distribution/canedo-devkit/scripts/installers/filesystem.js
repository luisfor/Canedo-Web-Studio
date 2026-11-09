'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
function platformPaths(platform) { return platform === 'win32' ? path.win32 : path.posix; }
function destinationPath(destination, platform) {
  const paths = platformPaths(platform);
  if (typeof destination !== 'string' || destination.length > 1024 || /[\x00-\x1f\x7f]/.test(destination) || !paths.isAbsolute(destination) || destination !== paths.normalize(destination) || destination === paths.parse(destination).root) throw new Error('El destino debe ser una ruta absoluta normalizada a una carpeta nueva.');
  if (platform === 'win32' && (!/^[A-Za-z]:\\/.test(destination) || /[:*?"<>|]/.test(destination.slice(2)) || destination.split('\\').slice(1).some(p => !p || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)))) throw new Error('Destino Windows inválido o reservado.');
  return destination;
}
function checkDestination(destination) {
  const parent = path.dirname(destination);
  // Refuse symlink/reparse-like paths rather than redirecting user-approved writes.
  let cursor = parent;
  while (true) {
    const stat = fs.lstatSync(cursor);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('El padre del destino debe existir y no contener enlaces simbólicos.');
    const next = path.dirname(cursor); if (next === cursor) break; cursor = next;
  }
  try { fs.lstatSync(destination); throw new Error('El destino ya existe; no se sobrescribirá.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  fs.accessSync(parent, fs.constants.W_OK);
  return parent;
}
function tarExecutable(platform) {
  // Fixed system locations, never an executable downloaded with the project or from CWD/PATH.
  const file = platform === 'win32' ? path.win32.join('C:/Windows', 'System32', 'tar.exe') : '/usr/bin/tar';
  if (!fs.statSync(file).isFile()) throw new Error('No se encontró tar del sistema en la ubicación admitida.');
  fs.accessSync(file, platform === 'win32' ? fs.constants.R_OK : fs.constants.X_OK);
  return file;
}
function archiveExtractor(platform, filename) {
  if (!filename.endsWith('.zip') && !filename.endsWith('.tar.gz')) throw new Error('Formato de archivo sin extractor.');
  if (platform === 'linux' && filename.endsWith('.zip')) {
    const file = '/usr/bin/unzip';
    if (!fs.statSync(file).isFile()) throw new Error('Se requiere unzip del sistema para ZIP en Linux.');
    fs.accessSync(file, fs.constants.X_OK);
    return { file, kind: 'unzip' };
  }
  return { file: tarExecutable(platform), kind: 'tar' };
}
function inspectArchive(extractor, archive, cwd) {
  if (extractor.kind === 'unzip') {
    const names = command(extractor.file, ['-Z', '-1', archive], cwd);
    const verbose = command(extractor.file, ['-Z', '-l', archive], cwd);
    const details = verbose.split(/\r?\n/).filter(line => /^[^ ]{10}\s/.test(line)).join('\n');
    return { names, details };
  }
  return { names: command(extractor.file, ['-tf', archive], cwd), details: command(extractor.file, ['-tvf', archive], cwd) };
}
function extractArchive(extractor, archive, destination, cwd) {
  return extractor.kind === 'unzip' ? command(extractor.file, ['-q', archive, '-d', destination], cwd) : command(extractor.file, ['-xf', archive, '-C', destination], cwd);
}
function commandEnvironment(platform, cwd) {
  const paths = platformPaths(platform);
  const windowsRoot = path.win32.resolve('C:/Windows');
  return { PATH: platform === 'win32' ? paths.join(windowsRoot, 'System32') + ';' + windowsRoot : '/usr/bin:/bin',
    ...(platform === 'win32' ? { SystemRoot: windowsRoot, WINDIR: windowsRoot, TEMP: cwd, TMP: cwd } : { HOME: cwd, TMPDIR: cwd }),
    LANG: 'C', LC_ALL: 'C', CHECKPOINT_DISABLE: '1', TF_IN_AUTOMATION: '1', TF_CLI_CONFIG_FILE: paths.join(cwd, 'empty-terraform.rc'),
    npm_config_update_notifier: 'false', npm_config_audit: 'false', npm_config_fund: 'false', npm_config_userconfig: paths.join(cwd, 'empty-npmrc'), npm_config_globalconfig: paths.join(cwd, 'empty-global-npmrc'),
    TAR_OPTIONS: '', GOTOOLCHAIN: 'local', GOTELEMETRY: 'off', GOROOT: '', GOENV: 'off', GOFLAGS: '', GOWORK: 'off' };
}
function command(file, args, cwd, timeout = 120000) {
  const result = spawnSync(file, args, { cwd, shell: false, windowsHide: true, timeout, maxBuffer: 32 * 1024 * 1024, encoding: 'utf8', env: commandEnvironment(process.platform, cwd) });
  if (result.error || result.status !== 0) throw new Error('Falló una operación del instalador; no se ejecutarán pasos posteriores.');
  return result.stdout;
}
function verifyExtracted(tree, executable) {
  let count = 0;
  function walk(directory) {
    for (const name of fs.readdirSync(directory)) {
      if (++count > 100000) throw new Error('Demasiados archivos extraídos.');
      const file = path.join(directory, name), stat = fs.lstatSync(file);
      if (stat.isSymbolicLink() || (!stat.isDirectory() && (!stat.isFile() || stat.nlink > 1))) throw new Error('Tipo de archivo extraído no admitido.');
      if (stat.isDirectory()) walk(file);
    }
  }
  walk(tree);
  if (!fs.lstatSync(executable).isFile()) throw new Error('No se encontró el ejecutable extraído.');
}
module.exports = { destinationPath, checkDestination, tarExecutable, archiveExtractor, inspectArchive, extractArchive, command, commandEnvironment, verifyExtracted };
