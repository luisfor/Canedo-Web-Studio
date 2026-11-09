'use strict';
const https = require('node:https');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const { Transform } = require('node:stream');
const METADATA_URL = 'https://go.dev/dl/?mode=json&include=all';
function allowedUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.port || url.username || url.password || url.hash) throw new Error('Origen de descarga no permitido.');
  if (value === METADATA_URL) return url;
  const go = ['go.dev', 'dl.google.com'].includes(url.hostname) && !url.search && /^\/(?:dl|go)\/go\d+\.\d+\.\d+\.(?:darwin|linux|windows)-(?:amd64|arm64)\.(?:tar\.gz|zip)$/.test(url.pathname)
    && (url.hostname === 'go.dev' ? url.pathname.startsWith('/dl/') : url.pathname.startsWith('/go/'));
  const node = url.hostname === 'nodejs.org' && !url.search && (url.pathname === '/dist/index.json' || /^\/(?:dist|download\/release)\/v\d+\.\d+\.\d+\/(?:SHASUMS256\.txt|node-v\d+\.\d+\.\d+-(?:darwin|linux|win)-(?:x64|arm64)\.(?:tar\.gz|zip))$/.test(url.pathname));
  const terraform = url.hostname === 'releases.hashicorp.com' && !url.search && /^\/terraform\/\d+\.\d+\.\d+\/terraform_\d+\.\d+\.\d+_(?:(?:darwin|linux|windows)_(?:amd64|arm64)\.zip|SHA256SUMS)$/.test(url.pathname);
  if (!go && !node && !terraform) throw new Error('Origen de descarga no permitido.');
  return url;
}
function response(url, redirects = 0, method = 'GET') {
  allowedUrl(url);
  return new Promise((resolve, reject) => {
    const request = https.get(url, { method, rejectUnauthorized: true, minVersion: 'TLSv1.2', headers: { 'User-Agent': 'CanedoStudioKit/1.0' } }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        res.resume();
        if (redirects >= 3 || !res.headers.location) return reject(new Error('Redirección de descarga inválida.'));
        try { const next = new URL(res.headers.location, url).href; allowedUrl(next); resolve(response(next, redirects + 1, method)); } catch { reject(new Error('Redirección de descarga no permitida.')); }
      } else if (res.statusCode !== 200) { res.resume(); reject(new Error('La fuente oficial no devolvió HTTP 200.')); }
      else resolve(res);
    });
    request.setTimeout(15000, () => request.destroy(new Error('Tiempo de conexión agotado.')));
    request.on('error', () => reject(new Error('No se pudo acceder a la fuente oficial por HTTPS.')));
  });
}
async function readText(url, limit = 8 * 1024 * 1024) {
  const res = await response(url);
  const timer = setTimeout(() => res.destroy(new Error('Tiempo de consulta agotado.')), 30000);
  try {
    let size = 0; const chunks = [];
    for await (const chunk of res) { size += chunk.length; if (size > limit) throw new Error('Metadatos demasiado grandes.'); chunks.push(chunk); }
    return Buffer.concat(chunks).toString('utf8');
  } finally { clearTimeout(timer); res.destroy(); }
}
async function readJson(url) {
  const text = await readText(url);
  try { return JSON.parse(text); } catch { throw new Error('Metadatos oficiales inválidos.'); }
}
async function metadata() { return readJson(METADATA_URL); }
async function headSize(url) {
  const res = await response(url, 0, 'HEAD');
  try {
    const length = res.headers['content-length'];
    if (!/^\d+$/.test(length || '')) throw new Error('La fuente no declara un tamaño exacto.');
    const size = Number(length);
    if (!Number.isSafeInteger(size) || size < 1 || size > 300 * 1024 * 1024) throw new Error('Tamaño de archivo no admitido.');
    return size;
  } finally { res.resume(); res.destroy(); }
}
async function download(artifact, file) {
  const res = await response(artifact.url);
  const timer = setTimeout(() => res.destroy(new Error('Tiempo de descarga agotado.')), 300000);
  const hash = crypto.createHash('sha256'); let size = 0;
  const meter = new Transform({ transform(chunk, encoding, done) {
    size += chunk.length;
    if (size > artifact.size) return done(new Error('El archivo excede el tamaño aprobado.'));
    hash.update(chunk); done(null, chunk);
  } });
  try {
    await pipeline(res, meter, fs.createWriteStream(file, { flags: 'wx', mode: 0o600 }));
    if (size !== artifact.size || hash.digest('hex') !== artifact.sha256) throw new Error('Integridad SHA-256 o tamaño incorrectos.');
  } finally { clearTimeout(timer); res.destroy(); }
}
module.exports = { METADATA_URL, allowedUrl, metadata, readJson, readText, headSize, download };
