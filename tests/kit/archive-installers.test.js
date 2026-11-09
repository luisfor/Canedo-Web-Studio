'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const engine = require('../../scripts/installers/archive-engine');
const registry = require('../../scripts/installers');
const { definitions, checksum } = require('../../scripts/installers/archive-recipes');
const transport = require('../../scripts/installers/transport');
const io = require('../../scripts/installers/filesystem');
const { createPlan, digest } = require('../../scripts/planner/plan');
const { readToolCatalog } = require('../../scripts/tools/catalog');
const capabilities = require('../../config/kit-capabilities.json');
const manifest = readToolCatalog();
const versions = { node: '24.22.2', terraform: '1.13.4', npm: '11.20.0' };
const cli = path.resolve(__dirname, '../../scripts/kit.js');
function plan(tool, platform = process.platform, architecture = process.arch, extra = {}) {
  const { checks = [{ tool, status: 'missing', version: null }], ...options } = extra;
  return createPlan(manifest, capabilities, { schemaVersion: 2, system: { platform, architecture }, checks, packageManagers: [] }, { tools: [tool], versions: { [tool]: versions[tool] }, ...options });
}
function metadata(tool, platform = process.platform, arch = process.arch, hash = 'a'.repeat(64), size = 100) {
  const def = definitions[tool], d = def.descriptor(versions[tool], platform, arch);
  const key = platform === 'win32' ? `win-${arch}-zip` : platform === 'darwin' ? `osx-${arch}-tar` : `linux-${arch}`;
  return { index: [{ version: `v${versions.node}`, lts: 'Krypton', npm: versions.npm, files: [key] }], checksums: `${hash}  ${d.filename}\n`, size };
}
function artifact(tool, platform = process.platform, arch = process.arch) { return definitions[tool].resolve(metadata(tool, platform, arch), versions[tool], platform, arch); }
function proposal(tool, platform = process.platform, arch = process.arch, extra = {}) {
  return engine.buildPrepared(definitions[tool], plan(tool, platform, arch, extra), artifact(tool, platform, arch), platform === 'win32' ? 'C:\\Users\\Example\\Tools\\new' : '/example/new', Date.now(), manifest, capabilities);
}
function temp(t) { const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'canedo-archive-test-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return dir; }
function run(...args) { return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 15000 }); }
for (const tool of ['node','terraform']) for (const platform of ['win32','darwin','linux']) for (const arch of ['x64','arm64']) {
  test(`receta ${tool}: resolución y propuesta simulada ${platform}/${arch}`, () => {
    const result = proposal(tool, platform, arch);
    assert.equal(result.schemaVersion, 2);assert.equal(result.executionAllowed, false);assert.equal(result.elevationRequested, false);
    assert.equal(engine.validatePrepared(result, manifest, capabilities).ok, true);
    assert.equal(result.artifact.filename, definitions[tool].descriptor(versions[tool],platform,arch).filename);
    if (tool === 'node') assert.equal(result.artifact.bundledVersions.npm, versions.npm);
    else assert.ok(result.warnings.includes('project-compatibility-not-assessed'));
  });
}
test('SHA-256 debe aparecer una sola vez para el archivo exacto', () => {
  assert.equal(checksum('a'.repeat(64)+' *file.zip\n','file.zip'),'a'.repeat(64));
  for (const data of ['', 'bad  file.zip','a'.repeat(64)+'  other.zip',('a'.repeat(64)+'  file.zip\n').repeat(2)]) assert.throws(() => checksum(data,'file.zip'));
});
test('Node exige LTS, npm exacto y archivo publicado para la arquitectura', () => {
  const valid = metadata('node');
  for (const patch of [{lts:false},{npm:'latest'},{files:[]},{version:'v99.0.0'}]) {
    const data = structuredClone(valid);Object.assign(data.index[0],patch);
    assert.throws(() => definitions.node.resolve(data,versions.node,process.platform,process.arch));
  }
  const duplicate = structuredClone(valid);duplicate.index.push(duplicate.index[0]);assert.throws(() => definitions.node.resolve(duplicate,versions.node,process.platform,process.arch));
});
test('versiones ambiguas, prerelease y tamaños no exactos se rechazan en ambas recetas', () => {
  for (const tool of ['node','terraform']) {
    for (const version of ['latest','24.22.2-rc.1','024.22.2','1.2.3;bad']) assert.throws(() => definitions[tool].descriptor(version,'linux','x64'));
    for (const size of [0,-1,NaN,2.5,400*1024*1024]) assert.throws(() => definitions[tool].resolve({...metadata(tool),size},versions[tool],process.platform,process.arch));
  }
});
test('las recetas no ignoran otras instalaciones ni cambian el gestor elegido', () => {
  const def = definitions.node;
  const p = plan('node',process.platform,process.arch,{tools:['node','python']});
  assert.throws(() => engine.buildPrepared(def,p,artifact('node'),'/example/new',Date.now(),manifest,capabilities),/otras instalaciones/);
  assert.throws(() => proposal('node',process.platform,process.arch,{manager:process.platform==='win32'?'winget':process.platform==='darwin'?'homebrew':'apt'}),/sin --manager/);
  assert.throws(() => proposal('node',process.platform,process.arch,{versions:{node:'25.2.1'}}));
});
test('Node acepta copia paralela revisable y conserva el diagnóstico anterior', () => {
  const result=proposal('node',process.platform,process.arch,{checks:[{tool:'node',status:'detected',version:'25.2.1'}]});
  assert.equal(result.plan.items[0].intent,'review-existing');assert.ok(result.warnings.includes('existing-installation-kept'));
  assert.equal(result.scope,'new-directory');assert.equal(result.persistentConfiguration,false);
});
test('npm no se puede excluir y su versión solicitada debe coincidir con el paquete', () => {
  assert.throws(()=>proposal('node',process.platform,process.arch,{exclude:['npm']}),/excluir/);
  assert.throws(()=>proposal('node',process.platform,process.arch,{tools:['node','npm'],versions:{node:versions.node,npm:'10.0.0'},checks:[{tool:'node',status:'missing',version:null},{tool:'npm',status:'missing',version:null}]}),/no coincide/);
  const result=proposal('node',process.platform,process.arch,{tools:['node','npm'],versions:{node:versions.node,npm:versions.npm},checks:[{tool:'node',status:'missing',version:null},{tool:'npm',status:'missing',version:null}]});
  assert.equal(engine.validatePrepared(result,manifest,capabilities).ok,true);
});
test('propuestas no aceptan comandos, aprobaciones persistidas, orígenes ni versiones alterados', () => {
  const result=proposal('node');
  for(const patch of [{command:'arbitrary'},{approval:'approved'},{executionAllowed:true},{recipe:'unknown'},{version:'99.0.0'},{artifact:{...result.artifact,url:'https://evil.example/file'}}]) {
    const changed={...result,...patch};const {installationId,...payload}=changed;changed.installationId=digest(payload);
    assert.equal(engine.validatePrepared(changed,manifest,capabilities).ok,false);
  }
  assert.equal(engine.validatePrepared(result,manifest,capabilities,result.expiresAt+1).ok,false);
  const other=structuredClone(manifest);other.tools[0].label+='changed';assert.equal(engine.validatePrepared(result,other,capabilities).ok,false);
});
test('registro conserva Go y cobertura informa 3 recetas, npm incluido y 76 pendientes', () => {
  assert.deepEqual(registry.recipes().recipes.map(r=>r.tool),['go','node','terraform']);
  const coverage=registry.coverage(manifest);assert.equal(coverage.total,80);assert.equal(coverage.recipeAvailable,3);assert.equal(coverage.bundledOnly,1);assert.equal(coverage.notImplemented,76);
  assert.equal(coverage.tools.find(t=>t.tool==='npm').status,'bundled-only');
  assert.equal(registry.validatePrepared({recipe:'arbitrary',command:'echo private'},manifest,capabilities).ok,false);
  assert.throws(()=>registry.apply({recipe:'arbitrary'},'x',manifest,capabilities),/no reconocida/);
});
test('CLI lista cobertura y rechaza opciones de instalación mezcladas', t=>{
  const result=run('install','coverage','--json');assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).notImplemented,76);
  for(const args of [['install','coverage','--approve','x'],['install','coverage','--file','x'],['install','recipes','--destination','x']]) assert.equal(run(...args).status,1);
  const dir=temp(t),file=path.join(dir,'proposal.local.json');fs.writeFileSync(file,JSON.stringify(proposal('terraform')));
  const validated=run('install','validate','--file',file,'--json');assert.equal(validated.status,0,validated.stderr);assert.equal(JSON.parse(validated.stdout).environmentRechecked,false);
});
function listing(tool, platform=process.platform, arch=process.arch) {
  const d=definitions[tool],root=d.descriptor(versions[tool],platform,arch).root;
  const prefix=root?root+'/':'';
  const files=[prefix+d.executable(platform)];
  if(tool==='node') files.push(prefix+d.npmCli(platform),prefix+'lib/node_modules/npm/bin/npx-cli.js');
  const names=files.join('\n')+'\n';const details=files.map(file=>`-rwxr-xr-x 0 root root 10 Jan 1 ${file}`).join('\n')+'\n';
  return {names,details,prefix};
}
test('índice Node admite solo enlaces npm/npx internos con destino regular', () => {
  const d=definitions.node,l=listing('node','linux','x64');
  const names=l.names+l.prefix+'bin/npm\n';const details=l.details+`lrwxrwxrwx 0 root root 10 Jan 1 ${l.prefix}bin/npm -> ../lib/node_modules/npm/bin/npm-cli.js\n`;
  assert.doesNotThrow(()=>engine.checkArchiveListing(names,details,d,versions.node,'linux','x64'));
  for(const changed of [details.replace(' -> ../lib',' -> ../../outside/lib'),details.replace('lrwx','hrwx')]) assert.throws(()=>engine.checkArchiveListing(names,changed,d,versions.node,'linux','x64'));
  assert.throws(()=>engine.checkArchiveListing(names+l.prefix+'bin/npm/evil\n',details+`-rwxr-xr-x 0 root root 1 Jan 1 ${l.prefix}bin/npm/evil\n`,d,versions.node,'linux','x64'));
  assert.throws(()=>engine.checkArchiveListing(names.replace(l.prefix+'lib/node_modules/npm/bin/npm-cli.js\n',''),details.split('\n').filter(line=>!line.endsWith(' '+l.prefix+'lib/node_modules/npm/bin/npm-cli.js')).join('\n'),d,versions.node,'linux','x64'));
});
test('índices rechazan traversal, ADS Windows, duplicados, enlaces y rutas externas', () => {
  for(const tool of ['node','terraform']) {
    const l=listing(tool),d=definitions[tool];
    for(const name of ['../private','/absolute','go/bin/go','name:stream',l.prefix+'../evil',l.prefix+'bin\\evil']) assert.throws(()=>engine.checkArchiveListing(name+'\n','-rwxr-xr-x 0 root root 1 Jan 1 '+name+'\n',d,versions[tool],process.platform,process.arch));
    assert.throws(()=>engine.checkArchiveListing(l.names+l.names,l.details+l.details,d,versions[tool],process.platform,process.arch));
    assert.throws(()=>engine.checkArchiveListing(l.names,l.details.replace('-rwx','lrwx'),d,versions[tool],process.platform,process.arch));
  }
});
test('entorno Windows usa separadores reales y no hereda tokens o flags del usuario', () => {
  const result=io.commandEnvironment('win32','C:\\Users\\Example\\stage');
  assert.equal(result.SystemRoot,'C:\\Windows');assert.equal(result.PATH,'C:\\Windows\\System32;C:\\Windows');
  assert.equal(result.npm_config_userconfig,'C:\\Users\\Example\\stage\\empty-npmrc');assert.equal(result.CHECKPOINT_DISABLE,'1');
  for(const key of ['TOKEN','NODE_OPTIONS','TF_CLI_ARGS','NODE_EXTRA_CA_CERTS']) assert.equal(Object.hasOwn(result,key),false);
});
test('orígenes nuevos limitan protocolos, hosts, credenciales y parámetros',()=>{
  for(const tool of ['node','terraform']) {const d=definitions[tool].descriptor(versions[tool],'linux','x64');for(const url of [d.url,...d.metadataUrls]) assert.doesNotThrow(()=>transport.allowedUrl(url));}
  for(const url of ['https://nodejs.org.evil.example/dist/index.json','https://nodejs.org/dist/latest/node.zip','https://user@nodejs.org/dist/index.json','https://releases.hashicorp.com/terraform/1.13.4/terraform_1.13.4_linux_amd64.zip?token=x','http://nodejs.org/dist/index.json']) assert.throws(()=>transport.allowedUrl(url));
});
// Integration fixtures are generated locally. No SDK or external executable is downloaded.
async function fixture(t, tool, mode='success') {
  if(process.platform==='win32') return t.skip('ejecutable de prueba POSIX; Windows cubierto por resolución simulada');
  const dir=temp(t), source=path.join(dir,'source');fs.mkdirSync(source);
  const def=definitions[tool],desc=def.descriptor(versions[tool],process.platform,process.arch);
  const tree=desc.root?path.join(source,desc.root):source;fs.mkdirSync(tree,{recursive:true});
  const executable=path.join(tree,def.executable(process.platform));fs.mkdirSync(path.dirname(executable),{recursive:true});
  if(tool==='node') {
    const npm=path.join(tree,def.npmCli(process.platform));fs.mkdirSync(path.dirname(npm),{recursive:true});fs.writeFileSync(npm,'fixture npm CLI');
    fs.writeFileSync(path.join(path.dirname(npm),'npx-cli.js'),'fixture npx CLI');
    fs.symlinkSync('../lib/node_modules/npm/bin/npm-cli.js',path.join(tree,'bin','npm'));fs.symlinkSync('../lib/node_modules/npm/bin/npx-cli.js',path.join(tree,'bin','npx'));
    fs.writeFileSync(executable,`#!/bin/sh\ncase "$1" in\n--version) printf '%s\\n' 'v${versions.node}';;\n--eval) printf '%s' '${process.platform}/${mode==='wrong-arch'?'wrong':process.arch}';;\n*) printf '%s\\n' '${mode==='wrong-npm'?'0.0.0':versions.npm}';;\nesac\n`,{mode:0o755});
  } else {
    const platform=`${process.platform}_${process.arch==='x64'?'amd64':process.arch}`;
    fs.writeFileSync(executable,`#!/bin/sh\nprintf '%s\\n' '{"terraform_version":"${mode==='wrong-version'?'0.0.0':versions.terraform}","platform":"${platform}"}'\n`,{mode:0o755});fs.writeFileSync(path.join(tree,'LICENSE.txt'),'fixture license');
  }
  const archive=path.join(dir,tool==='terraform'?'fixture.zip':'fixture.tar.gz');
  const args=desc.root?['-czf',archive,'-C',source,desc.root]:['-q',archive,...fs.readdirSync(source)];
  const packed=spawnSync(tool==='terraform'?'/usr/bin/zip':'/usr/bin/tar',args,{encoding:'utf8',cwd:source});assert.equal(packed.status,0,packed.stderr);
  const bytes=fs.readFileSync(archive),hash=crypto.createHash('sha256').update(bytes).digest('hex');
  const data=metadata(tool,process.platform,process.arch,hash,bytes.length);
  const resolved=def.resolve(data,versions[tool],process.platform,process.arch);
  t.mock.method(def,'fetch',async()=>mode==='changed-hash'?{...resolved,sha256:'b'.repeat(64)}:resolved);
  t.mock.method(transport,'download',async(a,file)=>{
    fs.writeFileSync(file,mode==='corrupt'?'corrupt':bytes,{flag:'wx'});
    if(mode==='destination-race') {fs.mkdirSync(path.join(dir,'installed'));fs.writeFileSync(path.join(dir,'installed','user-file'),'preserve');}
  });
  const saved=process.env.PATH;
  const oldBin=path.join(dir,'old-bin'), oldExecutable=path.join(oldBin,'node');
  if(mode==='existing-copy') {
    fs.mkdirSync(oldBin);fs.writeFileSync(oldExecutable,"#!/bin/sh\nprintf '%s\\n' 'v25.2.1'\n",{mode:0o755});
  }
  process.env.PATH=mode==='existing-copy'?oldBin:'';t.after(()=>{process.env.PATH=saved;});
  const original=mode==='existing-copy'?fs.readFileSync(oldExecutable,'utf8'):null;
  const destination=path.join(dir,'installed'), p=mode==='existing-copy'?plan(tool,process.platform,process.arch,{checks:[{tool:'node',status:'detected',version:'25.2.1'}]}):plan(tool);
  const prepared=engine.buildPrepared(def,p,resolved,destination,Date.now(),manifest,capabilities);
  const before=JSON.stringify(prepared);
  if(mode==='prepare-only') {
    const result=await registry.prepare(p,destination,manifest,capabilities);assert.equal(result.executionAllowed,false);assert.equal(fs.existsSync(destination),false);
  } else if(mode==='wrong-approval') {
    await assert.rejects(engine.apply(prepared,'bad-id',manifest,capabilities),/approve/);assert.equal(fs.existsSync(destination),false);
  } else if(mode==='changed-hash') {
    await assert.rejects(engine.apply(prepared,prepared.installationId,manifest,capabilities),/Cambió el origen/);assert.equal(fs.existsSync(destination),false);
  } else if(mode==='destination-race') {
    await assert.rejects(engine.apply(prepared,prepared.installationId,manifest,capabilities),/ya existe/);assert.equal(fs.readFileSync(path.join(destination,'user-file'),'utf8'),'preserve');
  } else if(mode==='receipt-failure') {
    const write=fs.writeFileSync;t.mock.method(fs,'writeFileSync',function(file,...args) {
      if(String(file).endsWith('canedo-install.local.json')) throw new Error('fixture receipt failure');
      return write.call(fs,file,...args);
    });
    await assert.rejects(engine.apply(prepared,prepared.installationId,manifest,capabilities),/se publicó/);
    assert.ok(fs.existsSync(path.join(destination,tool,def.executable(process.platform))));
  } else if(['corrupt','wrong-npm','wrong-version','wrong-arch'].includes(mode)) {
    await assert.rejects(engine.apply(prepared,prepared.installationId,manifest,capabilities),/Integridad|no coincide/);assert.equal(fs.existsSync(destination),false);
  } else {
    const result=await engine.apply(prepared,prepared.installationId,manifest,capabilities);
    assert.equal(result.ok,true);assert.equal(result.pathConfigured,false);assert.ok(fs.existsSync(result.executable));
    if(mode==='existing-copy') {assert.equal(fs.readFileSync(oldExecutable,'utf8'),original);assert.equal(process.env.PATH,oldBin);}
    const receipt=JSON.parse(fs.readFileSync(path.join(destination,'canedo-install.local.json'),'utf8'));assert.equal(receipt.tool,tool);assert.equal(receipt.existingInstallationsPreserved,true);
    if(tool==='node') assert.ok(fs.lstatSync(path.join(destination,'node','bin','npm')).isSymbolicLink());
    await assert.rejects(engine.apply(prepared,prepared.installationId,manifest,capabilities),/ya existe/);
  }
  assert.equal(JSON.stringify(prepared),before);assert.ok(!fs.readdirSync(dir).some(name=>name.startsWith('.canedo-install-')));
}
for(const tool of ['node','terraform']) for(const mode of ['success','prepare-only','corrupt','changed-hash','wrong-approval','destination-race']) test(`integración offline ${tool}: ${mode}`,t=>fixture(t,tool,mode));
test('Node con npm incorrecto no se publica',t=>fixture(t,'node','wrong-npm'));
test('Node con arquitectura incorrecta no se publica',t=>fixture(t,'node','wrong-arch'));
test('Terraform con versión incorrecta no se publica',t=>fixture(t,'terraform','wrong-version'));
test('fetch de recetas usa solo índice/hash/HEAD oficiales y no descarga archivos',async t=>{
  const calls=[];
  t.mock.method(transport,'readJson',async url=>{calls.push(['json',url]);return metadata('node').index;});
  t.mock.method(transport,'readText',async url=>{calls.push(['text',url]);return url.includes('nodejs.org')?metadata('node').checksums:metadata('terraform').checksums;});
  t.mock.method(transport,'headSize',async url=>{calls.push(['head',url]);return 100;});
  t.mock.method(transport,'download',async()=>assert.fail('prepare no debe descargar el archivo'));
  for(const tool of ['node','terraform']) {
    const result=await definitions[tool].fetch(versions[tool],process.platform,process.arch);
    assert.equal(result.sha256,'a'.repeat(64));assert.equal(result.size,100);
  }
  assert.equal(calls.filter(c=>c[0]==='head').length,2);for(const c of calls) assert.doesNotThrow(()=>transport.allowedUrl(c[1]));
});
test('HEAD mantiene método en redirección y exige Content-Length exacto',async t=>{
  const https=require('node:https'),{Readable}=require('node:stream'),{EventEmitter}=require('node:events');
  const methods=[],replies=[{status:302,headers:{location:'https://nodejs.org/download/release/v24.22.2/node-v24.22.2-linux-x64.tar.gz'}},{headers:{'content-length':'123'}},{headers:{}},{headers:{'content-length':'9999999999999'}}];
  t.mock.method(https,'get',(url,options,callback)=>{
    methods.push(options.method);const req=new EventEmitter();req.setTimeout=()=>req;
    process.nextTick(()=>{const reply=replies.shift(),res=Readable.from([]);res.statusCode=reply.status||200;res.headers=reply.headers;callback(res);});return req;
  });
  const url='https://nodejs.org/dist/v24.22.2/node-v24.22.2-linux-x64.tar.gz';
  assert.equal(await transport.headSize(url),123);assert.deepEqual(methods,['HEAD','HEAD']);
  await assert.rejects(transport.headSize(url),/tamaño exacto/);await assert.rejects(transport.headSize(url),/Tamaño/);
});
test('reporte externo no permite ejecutar sin volver a diagnosticar el equipo',async t=>{
  const result=proposal('node',process.platform,process.arch,{checks:[{tool:'node',status:'detected',version:'99.0.0'}]});
  let calls=0;t.mock.method(definitions.node,'fetch',async()=>{calls++;return result.artifact;});
  const dir=temp(t);result.destination=path.join(dir,'not-created');const {installationId,...payload}=result;result.installationId=digest(payload);
  await assert.rejects(engine.apply(result,result.installationId,manifest,capabilities),/diagnóstico|Sistema/);assert.equal(calls,0);assert.equal(fs.existsSync(result.destination),false);
});
test('CLI no acepta dos archivos distintos para una sola aprobación',()=>{
  assert.equal(run('install','apply','--file','one','--file','two','--approve','x').status,1);
});

test('Node se instala como copia paralela y conserva ejecutable anterior y PATH',t=>fixture(t,'node','existing-copy'));
test('publicación Terraform sin recibo informa estado parcial y conserva la herramienta',t=>fixture(t,'terraform','receipt-failure'));

test('adaptador ZIP Linux inspecciona y extrae un ZIP sintético real con unzip',t=>{
  if(process.platform==='win32') return t.skip('unzip POSIX');
  const dir=temp(t),source=path.join(dir,'source');fs.mkdirSync(source);fs.writeFileSync(path.join(source,'terraform'),'fixture');fs.chmodSync(path.join(source,'terraform'),0o755);fs.writeFileSync(path.join(source,'LICENSE.txt'),'fixture');
  const archive=path.join(dir,'fixture.zip');const packed=spawnSync('/usr/bin/zip',['-q',archive,'terraform','LICENSE.txt'],{cwd:source,encoding:'utf8'});assert.equal(packed.status,0,packed.stderr);
  const extractor=io.archiveExtractor('linux','terraform.zip');assert.equal(extractor.file,'/usr/bin/unzip');
  const listing=io.inspectArchive(extractor,archive,dir);engine.checkArchiveListing(listing.names,listing.details,definitions.terraform,versions.terraform,'linux','x64');
  const target=path.join(dir,'extracted');fs.mkdirSync(target);io.extractArchive(extractor,archive,target,dir);assert.equal(fs.readFileSync(path.join(target,'terraform'),'utf8'),'fixture');
});
