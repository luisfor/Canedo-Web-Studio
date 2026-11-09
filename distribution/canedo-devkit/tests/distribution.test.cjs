'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
function files(dir=root){return fs.readdirSync(dir,{withFileTypes:true}).filter(e=>!['node_modules','.git','.devkit-cache','.devkit'].includes(e.name)).flatMap(e=>{const p=path.join(dir,e.name);assert.ok(!e.isSymbolicLink(),'No links allowed');return e.isDirectory()?files(p):[p];});}
test('distribution excludes private projects, installed dependencies and unnecessary artifacts',()=>{
 for(const file of files()){const rel=path.relative(root,file);assert.ok(!/(^|\/)(node_modules|automatismos|cazas|secretos|\.git|\.wrangler|\.devkit|\.devkit-cache|dist|bundled-test)(\/|$)/.test(rel),rel);assert.ok(!/\.(?:sqlite3?|db|log|bak|wasm|ttf|map|pem|key|tgz)$/.test(rel),rel);}
});
test('public Markdown references resolve within the distribution',()=>{
 for(const file of files().filter(p=>p.endsWith('.md'))){const text=fs.readFileSync(file,'utf8');for(const m of text.matchAll(/\]\(([^)\s]+)\)/g)){const link=m[1].split('#')[0];if(!link||/^[a-z]+:/i.test(link))continue;const target=path.resolve(path.dirname(file),link);assert.ok(target===root||target.startsWith(root+path.sep),file);assert.ok(fs.existsSync(target),path.relative(root,file)+' -> '+link);}}
});
test('lockfile contains the complete minimal runtime closure with licenses and integrity',()=>{
 const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'))),lock=JSON.parse(fs.readFileSync(path.join(root,'package-lock.json')));assert.equal(pkg.private,true);assert.equal(pkg.license,'ISC');assert.equal(lock.packages[''].license,'ISC');assert.deepEqual(Object.keys(pkg.dependencies),['ajv']);assert.deepEqual(lock.packages[''].dependencies,pkg.dependencies);assert.equal(Object.keys(lock.packages).length,6);
 for(const [name,item] of Object.entries(lock.packages)){if(!name)continue;assert.ok(item.integrity&&item.license&&item.resolved,name);assert.ok(!item.dev,name);for(const dependency of Object.keys(item.dependencies||{}))assert.ok(lock.packages['node_modules/'+dependency],dependency);}
});
test('vendored licenses remain present and Compose schema matches its pinned provenance',()=>{
 const vendor=path.join(root,'schemas/vendor'),p=JSON.parse(fs.readFileSync(path.join(vendor,'compose-spec.provenance.json')));assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(vendor,'compose-spec.json'))).digest('hex'),p.vendoredSha256);assert.ok(fs.readFileSync(path.join(vendor,'compose-spec.LICENSE'),'utf8').includes('Apache License'));assert.ok(fs.readFileSync(path.join(root,'.agents/skills/reverse-engineer-anything/LICENSE'),'utf8').includes('MIT License'));assert.ok(fs.readFileSync(path.join(root,'LICENSE'),'utf8').includes('Copyright (c) 2026 CanedoStudio')); 
});
test('agent examples use generic paths and keep generation disabled',()=>{
 for(const name of ['codex-config.example.toml','gemini-settings.example.json','stdio-server.example.json']){const s=fs.readFileSync(path.join(root,'examples/agents',name),'utf8');assert.ok(s.includes('/ruta/'));assert.ok(!s.includes('--allow-generate'));assert.ok(!s.includes('/'+'Users/'));}
});

test('security channel is documented without enabling external clients',()=>{const policy=fs.readFileSync(path.join(root,'SECURITY.md'),'utf8');assert.ok(policy.includes('contacto@canedostudio.com'));assert.ok(policy.includes('No se prometen tiempos'));assert.ok(policy.includes('No se ha comprobado'));});
test('clean install remains pending and provenance does not relicense third parties',()=>{const readme=fs.readFileSync(path.join(root,'README.md'),'utf8');assert.ok(readme.includes('PENDIENTE DE VERIFICACIÓN'));const notices=fs.readFileSync(path.join(root,'THIRD-PARTY-NOTICES.md'),'utf8');assert.ok(notices.includes('MIT')&&notices.includes('Apache-2.0')&&notices.includes('sin relicenciamiento'));});
