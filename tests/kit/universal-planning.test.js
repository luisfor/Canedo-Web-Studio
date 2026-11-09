'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const terminal=require('../../scripts/terminal/service'),interpreter=require('../../scripts/terminal/interpret'),technical=require('../../scripts/terminal/technical'),cli=require('../../scripts/devkit');
const cases=[
 ['A','Crear una aplicación móvil para Android y iPhone','mobile',[],['android','ios']],
 ['B','Crear una aplicación web con React y PostgreSQL','web',['react','postgresql'],[]],
 ['C','Crear una API con Python y FastAPI','backend',['python','fastapi'],[]],
 ['D','Crear una aplicación de escritorio multiplataforma','desktop',[],[]],
 ['E','Crear un proyecto IoT con ESP32','iot',[],[]],
 ['F','Crear un videojuego con Unity','game',[],[]],
 ['G','Crear una plataforma SaaS empresarial','enterprise',[],[]],
 ['H','Continuar un proyecto existente sin sobrescribir personalizaciones','custom',[],[]]
];
function root(t){const dir=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'kit-universal-stage1-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
for(const [id,text,domain,ids,platforms]of cases)test(id+': technical acceptance produces useful steps without business modules or generation',t=>{
 const dir=root(t),destination=id==='H'?dir:path.join(dir,'new');
 if(id==='H'){fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({dependencies:{react:'18.0.0'}}));fs.writeFileSync(path.join(dir,'notes.md'),'Personalización preservada');}
 const before=id==='H'?fs.readFileSync(path.join(dir,'notes.md'),'utf8'):null;
 const p=terminal.prepare(text,{destination});assert.equal(p.kind,'technical-project-plan');assert.equal(p.ok,true);assert.ok(p.requirements.domains.includes(domain));assert.deepEqual(p.requirements.unknown,[]);
 for(const id of ids)assert.ok(p.requirements.technologies.some(t=>t.toolId===id));for(const platform of platforms)assert.ok(p.requirements.targets.includes(platform));
 assert.ok(p.steps.length>=5);assert.ok(p.steps.some(s=>s.id==='handoff'));assert.ok(p.steps.some(s=>s.id==='validate'));assert.equal(p.executionAllowed,false);assert.deepEqual(p.files,[]);assert.deepEqual(p.commands,[]);assert.equal(p.generation.available,false);assert.ok(!Object.hasOwn(p.requirements,'capabilities'));assert.ok(!p.questions.some(q=>/inventario|crm|pos|erp/i.test(q.question)));assert.equal(terminal.validate(p,destination).ok,true);
 if(id==='F'){assert.ok(p.requirements.technologies.some(t=>t.name==='unity'&&!t.cataloged));assert.ok(p.limitations.some(l=>l.code==='technology-not-cataloged'));assert.equal(p.status,'needs-decisions');}
 if(id==='E')assert.ok(p.limitations.some(l=>l.code==='board-not-verified'));
 if(id==='H'){assert.equal(p.architecture.preserveExisting,true);assert.ok(p.observed.some(s=>s.id==='react'));assert.equal(fs.readFileSync(path.join(dir,'notes.md'),'utf8'),before);}else assert.equal(fs.existsSync(destination),false);
});
test('other software domains, unknown requirements and architectural contradictions remain explicit',()=>{
 for(const [text,domain]of [['Crear frontend con Vue','frontend'],['Automatizar scripts Python','automation'],['Crear inteligencia artificial con Python','ai'],['Crear base de datos PostgreSQL','database'],['Crear infraestructura DevOps Terraform','devops'],['Crear un proyecto personalizado de astronomía','custom']]){const r=interpreter.technical(text);assert.ok(r.domains.includes(domain),text);}
 const r=interpreter.technical('Crear un proyecto personalizado de astronomía');assert.ok(r.unknown.includes('astronomia'));
 assert.equal(interpreter.technical('Crear API sin microservicios').architecture.independent,false);
 const both=interpreter.technical('Crear API monolito y microservicios');assert.equal(both.architecture.independent,true);assert.equal(both.architecture.modular,true);
 const excluded=interpreter.technical('Crear web React sin React');assert.ok(excluded.contradictions.includes('react'));
});
test('technical planning stays operational when commercial catalog and composition engine are disabled',t=>{
 t.mock.method(require('../../scripts/commercial/catalog'),'list',()=>assert.fail('commercial catalog must not load'));
 t.mock.method(require('../../scripts/composition/engine'),'plan',()=>assert.fail('no code generator should run'));
 t.mock.method(require('../../scripts/composition/catalog'),'read',()=>assert.fail('composition registry must not be required'));
 const destination=path.join(root(t),'new'),p=terminal.prepare(cases[1][1],{destination});assert.equal(p.ok,true);assert.equal(p.evidence.discovery.catalogs.commercial.status,'not-loaded-for-technical-planning');assert.equal(terminal.validate(p,destination).ok,true);
});
test('technical plans cannot bypass the existing writer, evidence binding or canonical validation',t=>{
 const dir=root(t),destination=path.join(dir,'new'),p=terminal.prepare(cases[2][1],{destination});
 const altered=structuredClone(p);altered.files=[{path:'server.js',content:'untrusted'}];assert.equal(terminal.validate(altered,destination).ok,false);
 assert.equal(terminal.validate(p,path.join(dir,'other')).ok,false);assert.throws(()=>terminal.create(p,destination),/no válido/);assert.equal(fs.existsSync(destination),false);
 const existing=terminal.prepare(cases[7][1],{destination:dir});fs.writeFileSync(path.join(dir,'notes.md'),'New customization');assert.equal(terminal.validate(existing,dir).ok,false);
});
test('incomplete inspection returns a useful read-only plan and never grants permission to modify',t=>{
 const dir=root(t);fs.writeFileSync(path.join(dir,'large.js'),'x'.repeat(1024*1024+1));const p=terminal.prepare(cases[7][1],{destination:dir});assert.equal(p.status,'needs-inspection');assert.equal(p.evidence.inspection.complete,false);assert.ok(p.limitations.some(l=>l.code==='inspection-incomplete'));assert.equal(p.executionAllowed,false);assert.equal(terminal.validate(p,dir).ok,true);assert.throws(()=>terminal.create(p,dir));
});
test('CLI plan exposes universal JSON, honors --project and keeps technical mode advisory',t=>{
 const dir=root(t),destination=path.join(dir,'new'),executable=path.resolve(__dirname,'../../scripts/devkit.js');
 const r=spawnSync(process.execPath,[executable,'plan',cases[0][1],'--out',destination,'--json'],{encoding:'utf8',env:{...process.env,PATH:''}});assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).kind,'technical-project-plan');assert.equal(fs.existsSync(destination),false);
 const existing=cli.dispatch(cli.parse(['plan',cases[7][1],'--project',dir,'--json']));assert.equal(existing.architecture.preserveExisting,true);
 const forced=cli.dispatch(cli.parse(['plan','Crear CRM','--out',destination,'--technical']));assert.equal(forced.kind,'technical-project-plan');assert.equal(forced.forced,true);
 assert.throws(()=>cli.parse(['create','Crear API','--technical']));assert.throws(()=>terminal.prepare('Crear API token=private',{destination}));
});
