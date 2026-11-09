'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const installer = require('../../scripts/installers/go');
const transport = require('../../scripts/installers/transport');
const { createPlan, digest } = require('../../scripts/planner/plan');
const { readToolCatalog } = require('../../scripts/tools/catalog');
const capabilities = require('../../config/kit-capabilities.json');
const manifest = readToolCatalog();
const cli = path.resolve(__dirname, '../../scripts/kit.js');
const version = '1.27.3';
function plan(platform = process.platform, arch = process.arch, options = {}) {
  return createPlan(manifest, capabilities, { schemaVersion: 2, system: { platform, architecture: arch }, checks: [{ tool: 'go', status: 'missing', version: null }], packageManagers: [] }, { tools: ['go'], versions: { go: version }, ...options });
}
function index(platform = process.platform, architecture = process.arch, hash = 'a'.repeat(64), size = 100) {
  const targetOs = platform === 'win32' ? 'windows' : platform, arch = architecture === 'x64' ? 'amd64' : architecture;
  return [{ version: `go${version}`, stable: true, files: [{ filename: `go${version}.${targetOs}-${arch}.${platform === 'win32' ? 'zip' : 'tar.gz'}`, version: `go${version}`, os: targetOs, arch, kind: 'archive', sha256: hash, size }] }];
}
function prepared(platform = process.platform, arch = process.arch) {
  return installer.buildPrepared(plan(platform, arch), installer.resolveArtifact(index(platform, arch), version, platform, arch), platform === 'win32' ? 'C:\\Users\\Example\\go-kit' : '/example/go-kit', Date.now(), manifest, capabilities);
}
function temp(t) { const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'canedo-installer-test-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return dir; }
function run(...args) { return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 15000 }); }
test('recetas explícitas: solo Go y sin atribuir instaladores a las 80 entradas', () => {
  assert.equal(installer.recipes().recipes.length, 1);
  assert.equal(installer.recipes().recipes[0].tool, 'go');
  assert.equal(run('install','recipes','--json').status, 0);
});
for (const platform of ['win32','darwin','linux']) for (const arch of ['x64','arm64']) {
  test(`resolución de archivo y propuesta simulada ${platform}/${arch}`, () => {
    const result = prepared(platform, arch);
    assert.equal(result.artifact.url, `https://go.dev/dl/${result.artifact.filename}`);
    assert.equal(result.executionAllowed, false);
    assert.equal(result.elevationRequested, false);
    assert.equal(installer.validatePrepared(result, manifest, capabilities).ok, true);
  });
}
test('rechaza versiones ausentes, prerelease, metadatos ambiguos, tamaño y hashes inválidos', () => {
  const wrong = [[], [{ ...index()[0], stable: false }], [{ ...index()[0], files: [...index()[0].files, ...index()[0].files] }], index(process.platform, process.arch, 'bad'), index(process.platform, process.arch, 'a'.repeat(64), 0), index(process.platform, process.arch, 'a'.repeat(64), 400 * 1024 * 1024)];
  for (const data of wrong) assert.throws(() => installer.resolveArtifact(data, version, process.platform, process.arch));
  for (const value of ['latest','1.27.3;bad','1.27.3-rc1']) assert.throws(() => installer.resolveArtifact(index(), value, process.platform, process.arch));
});
test('HTTPS y redirecciones limitados a rutas oficiales, sin credenciales o parámetros', () => {
  for (const url of [transport.METADATA_URL, 'https://go.dev/dl/go1.27.3.linux-amd64.tar.gz','https://dl.google.com/go/go1.27.3.windows-arm64.zip']) assert.doesNotThrow(() => transport.allowedUrl(url));
  for (const url of ['http://go.dev/dl/go1.27.3.linux-amd64.tar.gz','https://evil.example/go1.27.3.linux-amd64.tar.gz','https://go.dev.evil.example/dl/go1.27.3.linux-amd64.tar.gz','https://token@go.dev/dl/go1.27.3.linux-amd64.tar.gz','https://go.dev/dl/go1.27.3.linux-amd64.tar.gz?token=private','https://go.dev/dl/../../private','https://dl.google.com/dl/go1.27.3.linux-amd64.tar.gz']) assert.throws(() => transport.allowedUrl(url));
});
test('no se omiten decisiones de otras herramientas ni se cambia un gestor elegido', () => {
  assert.throws(() => installer.buildPrepared(plan(process.platform,process.arch,{ manager: process.platform === 'win32' ? 'winget' : process.platform === 'darwin' ? 'homebrew' : 'apt' }), prepared().artifact, '/example/new', Date.now(),manifest,capabilities), /sin --manager/);
  const p = createPlan(manifest, capabilities, { schemaVersion:2, system:{platform:process.platform,architecture:process.arch}, checks:[{tool:'go',status:'missing',version:null}],packageManagers:[] }, {tools:['go','python'],versions:{go:version}});
  assert.throws(() => installer.buildPrepared(p,prepared().artifact,'/example/new',Date.now(),manifest,capabilities));
});
test('sin versión compatible exacta no se prepara instalación', () => {
  for (const versions of [{}, {go:'1.25.9'}]) assert.throws(() => installer.buildPrepared(plan(process.platform,process.arch,{versions}),prepared().artifact,'/example/new',Date.now(),manifest,capabilities));
});
test('propuestas alteradas, campos de ejecución y aprobaciones persistidas se rechazan', () => {
  const result = prepared();
  for (const patch of [{destination:'/other/path'},{executionAllowed:true},{approval:'approved'},{command:'curl bad | sh'},{artifact:{...result.artifact,url:'https://evil.example/file'}}]) {
    const changed = {...result,...patch};
    assert.equal(installer.validatePrepared(changed,manifest,capabilities).ok,false);
    const {installationId,...payload}=changed;changed.installationId=digest(payload);
    if (Object.hasOwn(patch,'executionAllowed') || Object.hasOwn(patch,'command') || Object.hasOwn(patch,'approval') || Object.hasOwn(patch,'artifact')) assert.equal(installer.validatePrepared(changed,manifest,capabilities).ok,false);
  }
});
test('caducidad de una hora y cambios del catálogo invalidan la propuesta', () => {
  const result=prepared();
  assert.equal(installer.validatePrepared(result,manifest,capabilities,result.expiresAt+1).ok,false);
  assert.equal(installer.validatePrepared(result,manifest,capabilities,result.createdAt-1).ok,false);
  const other=structuredClone(manifest);other.tools[0].label+=' modified';
  assert.equal(installer.validatePrepared(result,other,capabilities).ok,false);
});
test('destinos relativos, raíces, traversal y rutas Windows reservadas se rechazan', () => {
  for (const value of ['relative','/','/example/../new','/example\n/new']) assert.throws(() => installer.destinationPath(value,'linux'));
  for (const value of ['C:\\','C:\\Users\\CON','C:\\Users\\folder.','C:\\Users\\bad:stream','\\\\server\\share\\target']) assert.throws(() => installer.destinationPath(value,'win32'));
});
test('destino existente, enlaces y padres inexistentes no se sobrescriben', t => {
  const dir=temp(t), file=path.join(dir,'existing');fs.mkdirSync(file);
  assert.throws(()=>installer.checkDestination(file),/ya existe/);
  assert.throws(()=>installer.checkDestination(path.join(dir,'missing','new')));
  if(process.platform!=='win32') { const link=path.join(dir,'link');fs.symlinkSync(dir,link);assert.throws(()=>installer.checkDestination(path.join(link,'new')),/enlaces/); }
  assert.equal(installer.checkDestination(path.join(dir,'new')),dir);
});
test('archivo rechaza rutas externas, traversal, enlaces, duplicados y tipos especiales', () => {
  const validNames='go/\ngo/bin/\ngo/bin/go\n';const validTypes='drwxr-xr-x 0 root root 0 Jan 1 go/\ndrwxr-xr-x 0 root root 0 Jan 1 go/bin/\n-rwxr-xr-x 0 root root 10 Jan 1 go/bin/go\n';
  assert.doesNotThrow(()=>installer.checkArchiveListing(validNames,validTypes));
  for(const names of ['../file','/go/bin/go','go/../file','go/./file','go\\bin\\go','go/bin/go\ngo/bin/go','go//bin/go','other/file']) assert.throws(()=>installer.checkArchiveListing(names,validTypes));
  for(const types of [validTypes.replace('-rwx','lrwx'),validTypes.replace('-rwx','hrwx'),validTypes.replace('-rwx','prwx')]) assert.throws(()=>installer.checkArchiveListing(validNames,types));
});
test('árbol extraído rechaza symlinks y hardlinks', t => {
  if(process.platform==='win32') return t.skip('creación de links requiere permisos nativos Windows');
  const dir=temp(t), exe=path.join(dir,'go');fs.writeFileSync(exe,'fixture');fs.symlinkSync(exe,path.join(dir,'link'));
  assert.throws(()=>installer.verifyExtracted(dir,exe));fs.unlinkSync(path.join(dir,'link'));fs.linkSync(exe,path.join(dir,'hard'));assert.throws(()=>installer.verifyExtracted(dir,exe));
});
test('apply sin aprobación exacta no toca disco ni red', async t => {
  const dir=temp(t), result=prepared();result.destination=path.join(dir,'new');
  let calls=0;t.mock.method(transport,'metadata',async()=>{calls++;return index();});
  await assert.rejects(installer.apply(result,'',manifest,capabilities),/approve/);
  assert.equal(calls,0);assert.equal(fs.readdirSync(dir).length,0);
});
test('CLI exige argumentos específicos sin yes, sudo ni flags ambiguos', () => {
  for(const args of [['install'],['install','prepare'],['install','apply','--file','x'],['install','recipes','--yes'],['install','recipes','--tool','go'],['install','recipes','--strict'],['install','prepare','--plan','x','--destination','y','--destination','z'],['doctor','--approve','x'],['install','update']]) assert.equal(run(...args).status,1,args.join(' '));
});
test('CLI valida archivo sin diagnosticar ni conceder ejecución', t => {
  const dir=temp(t), file=path.join(dir,'installation.local.json');fs.writeFileSync(file,JSON.stringify(prepared()));
  const result=run('install','validate','--file',file,'--json');assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).environmentRechecked,false);
});
// Offline integration: tiny synthetic archive, generated locally, never a real Go distribution.
// Only the temporary test fixture is executed. The machine's tools/configuration are untouched.
async function fixture(t, mode) {
  if(process.platform==='win32') return t.skip('fixture POSIX; variantes Windows cubiertas con metadatos simulados');
  const dir=temp(t), source=path.join(dir,'source'), bin=path.join(source,'go','bin');fs.mkdirSync(bin,{recursive:true});
  const targetOs=process.platform, arch=process.arch==='x64'?'amd64':process.arch;
  fs.writeFileSync(path.join(bin,'go'),`#!/bin/sh\nprintf '%s\\n' 'go version go${version} ${targetOs}/${arch}'\n`,{mode:0o755});
  const archive=path.join(dir,'fixture.tar.gz');const packed=spawnSync('/usr/bin/tar',['-czf',archive,'-C',source,'go'],{encoding:'utf8'});assert.equal(packed.status,0,packed.stderr);
  const bytes=fs.readFileSync(archive), hash=crypto.createHash('sha256').update(bytes).digest('hex'), data=index(process.platform,process.arch,hash,bytes.length);
  t.mock.method(transport,'metadata',async()=>mode==='changed-metadata' ? index(process.platform,process.arch,'b'.repeat(64),bytes.length) : data);
  t.mock.method(transport,'download',async(a,file)=>{
    fs.writeFileSync(file,mode==='corrupt' ? 'corrupt' : bytes,{flag:'wx'});
    if(mode==='destination-race') { fs.mkdirSync(path.join(dir,'installation'));fs.writeFileSync(path.join(dir,'installation','user-file'),'preserve'); }
  });
  const envPath=process.env.PATH;process.env.PATH='';t.after(()=>{process.env.PATH=envPath;});
  const destination=path.join(dir,'installation');
  const proposal=installer.buildPrepared(plan(),installer.resolveArtifact(data,version,process.platform,process.arch),destination,Date.now(),manifest,capabilities);
  if(mode==='changed-metadata') { await assert.rejects(installer.apply(proposal,proposal.installationId,manifest,capabilities),/Cambió el origen/);assert.equal(fs.existsSync(destination),false); }
  else if(mode==='destination-race') {
    await assert.rejects(installer.apply(proposal,proposal.installationId,manifest,capabilities),/ya existe/);
    assert.equal(fs.readFileSync(path.join(destination,'user-file'),'utf8'),'preserve');
  }
  else if(mode==='receipt-failure') {
    const original=fs.writeFileSync;t.mock.method(fs,'writeFileSync',function(file,...args) {
      if(String(file).endsWith('canedo-install.local.json')) throw new Error('fixture disk failure');
      return original.call(fs,file,...args);
    });
    await assert.rejects(installer.apply(proposal,proposal.installationId,manifest,capabilities),/Go se publicó/);
    assert.ok(fs.existsSync(path.join(destination,'go','bin','go')));
  }
  else if(mode==='corrupt') { await assert.rejects(installer.apply(proposal,proposal.installationId,manifest,capabilities),/Integridad/);assert.equal(fs.existsSync(destination),false); }
  else {
    const result=await installer.apply(proposal,proposal.installationId,manifest,capabilities);
    assert.equal(result.ok,true);assert.equal(result.pathConfigured,false);assert.ok(fs.existsSync(result.executable));assert.equal(result.receipt.ownership,'kit-created-directory');
    assert.ok(fs.existsSync(path.join(destination,'canedo-install.local.json')));
    await assert.rejects(installer.apply(proposal,proposal.installationId,manifest,capabilities),/ya existe/);
  }
  assert.ok(!fs.readdirSync(dir).some(n=>n.startsWith('.canedo-install-')));
}
test('integración offline: instala solo fixture temporal, verifica y registra sin PATH',t=>fixture(t,'success'));
test('integración offline: SHA incorrecto se detiene y limpia staging sin publicar',t=>fixture(t,'corrupt'));
test('integración offline: cambios oficiales posteriores requieren nueva aprobación',t=>fixture(t,'changed-metadata'));
test('prepare consulta metadatos pero no descarga ni crea el destino', async t => {
  const dir=temp(t), destination=path.join(dir,'not-created');
  const saved=process.env.PATH;process.env.PATH='';t.after(()=>{process.env.PATH=saved;});
  let downloads=0;t.mock.method(transport,'metadata',async()=>index());t.mock.method(transport,'download',async()=>{downloads++;});
  const result=await installer.prepare(plan(),destination,manifest,capabilities);
  assert.equal(result.destination,destination);assert.equal(result.executionAllowed,false);assert.equal(downloads,0);assert.equal(fs.existsSync(destination),false);
});
test('aprobación equivocada sobre propuesta válida se rechaza antes de red', async t => {
  let calls=0;t.mock.method(transport,'metadata',async()=>{calls++;return index();});
  await assert.rejects(installer.apply(prepared(),'0'.repeat(64),manifest,capabilities),/approve/);assert.equal(calls,0);
});
test('Go preexistente se conserva y detiene prepare antes de consultar red', async t => {
  if(process.platform==='win32') return t.skip('fixture ejecutable POSIX');
  const dir=temp(t), bin=path.join(dir,'bin');fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin,'go'),`#!/bin/sh\nprintf '%s\\n' 'go version go${version} ${process.platform}/${process.arch==='x64'?'amd64':process.arch}'\n`,{mode:0o755});
  const saved=process.env.PATH;process.env.PATH=bin;t.after(()=>{process.env.PATH=saved;});
  let calls=0;t.mock.method(transport,'metadata',async()=>{calls++;return index();});
  await assert.rejects(installer.prepare(plan(),path.join(dir,'new'),manifest,capabilities),/Go ya existe/);assert.equal(calls,0);assert.ok(fs.existsSync(path.join(bin,'go')));
});
function mockHttps(t, replies) {
  const https=require('node:https'),{Readable}=require('node:stream'),{EventEmitter}=require('node:events');
  const urls=[];
  t.mock.method(https,'get',(url,options,callback)=>{
    assert.equal(options.rejectUnauthorized,true);assert.equal(options.minVersion,'TLSv1.2');
    urls.push(url);const request=new EventEmitter();request.setTimeout=()=>request;request.destroy=error=>request.emit('error',error);
    const reply=replies.shift();
    process.nextTick(()=>{
      if(!reply) return request.emit('error',new Error('offline fixture'));
      const res=Readable.from([Buffer.from(reply.body||'')]);res.statusCode=reply.status||200;res.headers=reply.headers||{};callback(res);
    });return request;
  });return urls;
}
test('transporte HTTPS sigue redirección oficial y valida tamaño/hash antes de aceptar',async t=>{
  const dir=temp(t),body=Buffer.from('fixture-offline'),sha256=crypto.createHash('sha256').update(body).digest('hex');
  const url='https://go.dev/dl/go1.27.3.darwin-arm64.tar.gz';
  const urls=mockHttps(t,[{status:302,headers:{location:'https://dl.google.com/go/go1.27.3.darwin-arm64.tar.gz'}},{body}]);
  const file=path.join(dir,'download');await transport.download({url,sha256,size:body.length},file);assert.equal(urls.length,2);assert.deepEqual(fs.readFileSync(file),body);
});
test('transporte bloquea redirección externa antes de solicitarla',async t=>{
  const urls=mockHttps(t,[{status:302,headers:{location:'https://evil.example/file'}}]);
  await assert.rejects(transport.metadata(),/no permitida/);assert.equal(urls.length,1);
});
test('transporte detiene bucle de redirecciones',async t=>{
  const urls=mockHttps(t,Array.from({length:5},()=>({status:302,headers:{location:transport.METADATA_URL}})));
  await assert.rejects(transport.metadata(),/Redirección/);assert.equal(urls.length,4);
});
test('transporte rechaza contenido sin integridad y metadatos inválidos',async t=>{
  const dir=temp(t);mockHttps(t,[{body:'wrong'},{body:'too-large'},{body:'not-json'},{status:404}]);
  const url='https://go.dev/dl/go1.27.3.darwin-arm64.tar.gz';
  await assert.rejects(transport.download({url,sha256:'a'.repeat(64),size:5},path.join(dir,'bad-hash')),/Integridad/);
  await assert.rejects(transport.download({url,sha256:'a'.repeat(64),size:1},path.join(dir,'bad-size')),/excede/);
  await assert.rejects(transport.metadata(),/inválidos/);await assert.rejects(transport.metadata(),/HTTP 200/);
});

test('integración offline: destino creado durante descarga se conserva',t=>fixture(t,'destination-race'));
test('integración offline: publicación sin recibo conserva carpeta y reporta fallo parcial',t=>fixture(t,'receipt-failure'));
