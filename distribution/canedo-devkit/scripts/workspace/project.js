'use strict';
const {digest,canonical}=require('../planner/plan');
const io=require('./files');
const {render}=require('../commands/render');
const STACKS=['node','go','python','java','dotnet','rust'];
const {assessVersion}=require('../doctor/environment');
const toolRules=require('../../catalog/tools/manifest.json').tools;
const VERSION=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
function normalize(input){
 if(!input||typeof input!=='object'||Object.keys(input).some(k=>!['stack','version','managerVersion','dependencies','name'].includes(k)))throw new Error('Configuración de proyecto no admitida.');
 if(!STACKS.includes(input.stack)||!VERSION.test(input.version))throw new Error('Stack o versión exacta inválidos.');
 const rule=toolRules.find(t=>t.id===input.stack)?.versionPolicy;if(rule?.state==='declared'&&assessVersion(input.version,rule.requirement).status!=='compatible')throw new Error('La versión no cumple la política declarada del kit.');
 if(input.managerVersion&&!VERSION.test(input.managerVersion))throw new Error('Versión de gestor inválida.');
 const name=input.name||'app';if(!/^[a-z][a-z0-9-]{0,50}$/.test(name))throw new Error('Nombre de proyecto inválido.');
 if(input.dependencies&&(typeof input.dependencies!=='object'||Array.isArray(input.dependencies)))throw new Error('Dependencias deben ser un mapa de versiones.');
 const dependencies={};for(const id of Object.keys(input.dependencies||{}).sort()){
  const rule=input.stack==='node'?/^(?:@[a-z0-9_.-]+\/)?[a-z0-9][a-z0-9_.-]*$/i:input.stack==='go'?/^[a-z0-9][a-z0-9./_-]+$/i:input.stack==='java'?/^[a-z0-9_.-]+:[a-z0-9_.-]+$/i:/^[a-z0-9][a-z0-9_.-]*$/i;
  if(!rule.test(id)||id.includes('..')||!VERSION.test(input.dependencies[id]))throw new Error('Dependencia o versión exacta inválida.');dependencies[id]=input.dependencies[id];
 }
 return {stack:input.stack,version:input.version,managerVersion:input.managerVersion||null,name,dependencies};
}
function plan(input){
 const request=normalize(input),{stack,version,name,dependencies}=request,files=[];
 const add=(path,content)=>files.push({path,content});
 const commands=[],command=(executable,args,notes)=>commands.push({run:{executable,args,stdinFrom:null},posix:render({executable,args,stdinFrom:null},'posix'),powershell:render({executable:executable==='.venv/bin/python'?'.venv/Scripts/python.exe':executable,args,stdinFrom:null},'powershell'),notes});
 const major=version.split('.')[0];
 if(stack==='node'){
  add('.node-version',version+'\n');add('.nvmrc',version+'\n');
  const pkg={name,version:'0.1.0',private:true,engines:{node:version},dependencies};if(request.managerVersion)pkg.packageManager='npm@'+request.managerVersion;
  add('package.json',JSON.stringify(pkg,null,2)+'\n');command('node',['--version'],'Debe coincidir con la versión del proyecto antes de instalar dependencias.');command('npm',['install','--package-lock-only','--ignore-scripts'],'Genera lockfile, sin ejecutar scripts; revisar antes de npm ci.');command('npm',['ci','--ignore-scripts'],'Solo después de revisar el lockfile. No se usa -g.');
 }else if(stack==='python'){
  add('.python-version',version+'\n');add('requirements.txt',Object.entries(dependencies).map(([k,v])=>k+'=='+v).join('\n')+'\n');
  add('pyproject.toml',`[project]\nname = "${name}"\nversion = "0.1.0"\nrequires-python = "==${version}"\ndependencies = [${Object.entries(dependencies).map(([k,v])=>JSON.stringify(k+'=='+v)).join(', ')}]\n`);
  command('python3',['--version'],'Comprueba versión exacta.');command('python3',['-m','venv','.venv'],'Entorno exclusivo del proyecto.');command('.venv/bin/python',['-m','pip','install','-r','requirements.txt'],'En Windows usa .venv/Scripts/python.exe; no instala globalmente.');
 }else if(stack==='go'){
  add('.go-version',version+'\n');add('go.mod',`module example.com/${name}\n\ngo ${version}\n${Object.keys(dependencies).length?'\nrequire (\n'+Object.entries(dependencies).map(([k,v])=>'\t'+k+' v'+v).join('\n')+'\n)\n':''}`);
  command('go',['version'],'Establece GOTOOLCHAIN=local al ejecutar; no descargar toolchains automáticamente.');command('go',['mod','download'],'Tras revisión, genera/verifica go.sum. El kit no descarga módulos.');
 }else if(stack==='java'){
  add('.java-version',version+'\n');add('pom.xml',`<project xmlns="http://maven.apache.org/POM/4.0.0"><modelVersion>4.0.0</modelVersion><groupId>com.example</groupId><artifactId>${name}</artifactId><version>0.1.0</version><properties><maven.compiler.release>${major}</maven.compiler.release><project.build.sourceEncoding>UTF-8</project.build.sourceEncoding></properties><build><plugins><plugin><groupId>org.apache.maven.plugins</groupId><artifactId>maven-compiler-plugin</artifactId><version>3.13.0</version></plugin></plugins></build><dependencies>${Object.entries(dependencies).map(([k,v])=>{const[g,a]=k.split(':');return `<dependency><groupId>${g}</groupId><artifactId>${a}</artifactId><version>${v}</version></dependency>`;}).join('')}</dependencies></project>\n`);
  command('java',['-version'],'La selección del JDK requiere un gestor externo; no se cambia JAVA_HOME.');command('mvn',['verify'],'Maven puede descargar plugins/dependencias al ejecutarlo manualmente.');
 }else if(stack==='dotnet'){
  add('global.json',JSON.stringify({sdk:{version,rollForward:'disable',allowPrerelease:false}},null,2)+'\n');add('App.csproj',`<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net${major}.0</TargetFramework></PropertyGroup><ItemGroup>${Object.entries(dependencies).map(([k,v])=>`<PackageReference Include="${k}" Version="${v}" />`).join('')}</ItemGroup></Project>\n`);
  command('dotnet',['--version'],'global.json exige el SDK exacto.');command('dotnet',['restore','--use-lock-file'],'Genera packages.lock.json; revisar antes de restore --locked-mode.');
 }else{
  add('rust-toolchain.toml',`[toolchain]\nchannel = "${version}"\nprofile = "minimal"\n`);add('Cargo.toml',`[package]\nname = "${name}"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n${Object.entries(dependencies).map(([k,v])=>`"${k}" = "=${v}"`).join('\n')}\n`);add('src/lib.rs','pub fn ready() -> bool { true }\n');
  command('rustc',['--version'],'Rustup podría descargar el toolchain al ejecutarse; instalarlo requiere tu decisión.');command('cargo',['generate-lockfile'],'Genera Cargo.lock manualmente; no se inventa el lockfile.');
 }
 add('.gitignore','node_modules/\n.venv/\ntarget/\nbin/\nobj/\n.env\n.env.*\n*.local.json\nsecrets/\n');
 const warnings=['No se ejecutan gestores, builds, descargas ni cambios de PATH/JAVA_HOME.','Versiones declaradas no certifican compatibilidad o disponibilidad.','No se inventan lockfiles ni hashes; la reproducción completa requiere revisarlos.'];if(stack==='node'&&!request.managerVersion)warnings.push('La versión npm no está fijada.');
 const payload={schemaVersion:1,kind:'project-environment-plan',templateVersion:'1.0.0',request,files,commands,warnings,executionAllowed:false};
 return {planId:digest(payload),...payload};
}
function validate(value){try{if(canonical(plan(value.request))!==canonical(value))throw Error();return {ok:true,executionAllowed:false};}catch{return {ok:false,errors:['Plan de proyecto inválido o modificado.']};}}
function write(value,destination){const result=io.writeNew(value,destination,validate);const fs=require('node:fs'),path=require('node:path');
 const record={schemaVersion:1,kind:'managed-project-record',request:value.request,templateVersion:value.templateVersion,files:value.files.map(f=>({path:f.path,digest:digest(f.content)}))};record.recordId=digest(record);fs.writeFileSync(path.join(destination,'devkit.project.json'),JSON.stringify(record,null,2)+'\n',{flag:'wx',mode:0o600});return result;
}
module.exports={STACKS,normalize,plan,validate,write};
