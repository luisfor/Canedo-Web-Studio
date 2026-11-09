'use strict';
const fs=require('node:fs'),path=require('node:path');
const {canonical,digest}=require('../planner/plan');
const io=require('../workspace/files'),backends=require('./backends');
const DATABASES=['postgres','mariadb','mysql','mongo','redis'];
const PORTS={postgres:5432,mariadb:3306,mysql:3306,mongo:27017,redis:6379,backend:8080};
function image(value){
 if(typeof value!=='string'||value.length>300||!/^([a-z0-9][a-z0-9./_-]*)(:[a-zA-Z0-9_.-]+)?(@sha256:[a-f0-9]{64})?$/.test(value)||value.includes('..'))return false;
 if(value.includes('@sha256:'))return true;const tag=value.split(':')[1];return !!tag&&/^\d+\.\d+(?:\.\d+)?(?:[a-zA-Z0-9_.-]*)$/.test(tag);
}
function normalize(input){
 if(!input||Object.keys(input).some(k=>!['name','services','backend','version','images','publish','templateVersion'].includes(k)))throw new Error('Configuración Docker no admitida.');
 if(input.templateVersion&&!['1.0.0','1.1.0'].includes(input.templateVersion))throw new Error('Versión de plantilla Docker no admitida.');
 const name=input.name||'devkit-app';if(!/^[a-z][a-z0-9-]{0,40}$/.test(name))throw new Error('Nombre Compose inválido.');
 if(!Array.isArray(input.services)||new Set(input.services).size!==input.services.length||input.services.some(s=>!DATABASES.includes(s)))throw new Error('Servicios desconocidos o duplicados.');
 const backend=input.backend||null,version=input.version||null;if(backend&&(!backends.STACKS.includes(backend)||!/^\d+\.\d+\.\d+$/.test(version||'')))throw new Error('Backend o versión inválidos.');
 if(!input.services.length&&!backend)throw new Error('Selecciona al menos un servicio o backend.');
 const required=[...input.services,...(backend?['runtime']:[]),...(backend&&['go','java','dotnet'].includes(backend)?['builder']:[])];
 const images={};for(const id of Object.keys(input.images||{}).sort()){if(!required.includes(id)&&!(id==='backend'&&backend)||!image(input.images[id]))throw new Error('Imagen desconocida o sin versión/digest explícito.');images[id]=input.images[id];}
 for(const id of required)if(!images[id])throw new Error('Falta una imagen explícita: '+id);
 for(const id of input.services){const repo=images[id].split(/[:@]/)[0];if(![id,'docker.io/library/'+id].includes(repo))throw new Error('Las recetas de datos requieren la imagen oficial correspondiente: '+id);}
 if(input.services.includes('postgres')&&!/^\d+\.\d+/.test(images.postgres.split('@')[0].split(':')[1]||''))throw new Error('Postgres requiere etiqueta de versión además del digest para elegir el volumen correcto.');
 if(backend){images.backend=images.backend||name+'-backend:0.1.0';if(images.backend===images.runtime||images.backend===images.builder)throw new Error('La imagen de aplicación no puede reemplazar una imagen base.');}
 const publish={};const occupied=new Set();for(const service of Object.keys(input.publish||{}).sort()){
  const port=Number(input.publish[service]);if(![...input.services,...(backend?['backend']:[])].includes(service)||!Number.isInteger(port)||port<1024||port>65535||occupied.has(port))throw new Error('Puerto publicado inválido, privilegiado o duplicado.');occupied.add(port);publish[service]=port;
 }
 return {name,services:[...input.services].sort(),backend,version,images,publish,...(input.templateVersion==='1.1.0'?{templateVersion:'1.1.0'}:{})};
}
function plan(input){
 const request=normalize(input),{name,services:chosen,backend,version,images,publish}=request,services={},volumes={},secrets={},files=[];
 const add=(path,content)=>files.push({path,content}),secret=id=>{secrets[id]={file:'./secrets/'+id};return '/run/secrets/'+id;};
 for(const id of chosen){
  const s={image:images[id],pull_policy:'never',restart:'no',networks:['private'],security_opt:['no-new-privileges:true'],cap_drop:['NET_RAW'],mem_limit:'512m',cpus:1,pids_limit:256,logging:{driver:'json-file',options:{'max-size':'10m','max-file':'3'}}};
  const data=id+'_data';volumes[data]={};s.volumes=[data+':'+(id==='postgres'?(Number(images[id].split('@')[0].split(':')[1]?.split('.')[0])>=18?'/var/lib/postgresql':'/var/lib/postgresql/data'):id==='mongo'?'/data/db':id==='redis'?'/data':'/var/lib/mysql')];
  if(id==='postgres'){s.environment={POSTGRES_DB:'app',POSTGRES_USER:'app',POSTGRES_PASSWORD_FILE:secret('postgres_password')};s.secrets=['postgres_password'];s.healthcheck={test:['CMD','pg_isready','-U','app','-d','app']};}
  else if(id==='mysql'||id==='mariadb'){const prefix=id==='mysql'?'MYSQL':'MARIADB';s.environment={[prefix+'_DATABASE']:'app',[prefix+'_USER']:'app',[prefix+'_PASSWORD_FILE']:secret(id+'_password'),[prefix+'_ROOT_PASSWORD_FILE']:secret(id+'_root_password')};s.secrets=[id+'_password',id+'_root_password'];s.healthcheck={test:id==='mysql'?['CMD','mysqladmin','ping','-h','127.0.0.1']:['CMD','healthcheck.sh','--connect','--innodb_initialized']};}
  else if(id==='mongo'){volumes.mongo_config={};s.volumes.push('mongo_config:/data/configdb');s.environment={MONGO_INITDB_DATABASE:'app',MONGO_INITDB_ROOT_USERNAME:'admin',MONGO_INITDB_ROOT_PASSWORD_FILE:secret('mongo_root_password')};s.secrets=['mongo_root_password'];s.healthcheck={test:['CMD','mongosh','--quiet','--eval','quit(db.runCommand({ping:1}).ok ? 0 : 2)']};}
  else {secret('redis_acl');s.secrets=['redis_acl'];s.volumes.push('./redis.conf:/usr/local/etc/redis/redis.conf:ro');s.command=['redis-server','/usr/local/etc/redis/redis.conf'];s.healthcheck={test:['CMD','redis-cli','ping']};add('redis.conf','bind 0.0.0.0\nprotected-mode yes\nappendonly yes\naclfile /run/secrets/redis_acl\n');files[files.length-1].mode=0o644;}
  Object.assign(s.healthcheck,{interval:'10s',timeout:'5s',retries:12,start_period:'30s'});
  if(publish[id])s.ports=[`127.0.0.1:${publish[id]}:${PORTS[id]}`];services[id]=s;
 }
 if(backend){const generated=backends.files(backend,version,images,request.templateVersion||'1.0.0');files.push(...generated.files);
  const s={image:images.backend,build:{context:'.',dockerfile:'Dockerfile'},pull_policy:'never',restart:'no',init:true,user:'10001:10001',read_only:true,tmpfs:['/tmp:rw,noexec,nosuid,size=64m'],cap_drop:['ALL'],security_opt:['no-new-privileges:true'],networks:['private','app'],cpus:1,mem_limit:'512m',pids_limit:128,healthcheck:{test:generated.health,interval:'10s',timeout:'5s',retries:5,start_period:'20s'}};
  if(chosen.length)s.depends_on=Object.fromEntries(chosen.map(id=>[id,{condition:'service_healthy'}]));if(publish.backend)s.ports=[`127.0.0.1:${publish.backend}:8080`];services.backend=s;
 }
 const compose={name,services,networks:{private:{internal:true},...(backend?{app:{}}:{})},...(Object.keys(volumes).length?{volumes}:{}),...(Object.keys(secrets).length?{secrets}:{})};
 add('compose.yaml',JSON.stringify(compose,null,2)+'\n');
 add('.dockerignore','.git\n**/.git\n.env\n.env.*\n**/.env\n**/.env.*\n**/*.local.json\n**/*.pem\n**/*.key\n**/*.p12\n**/.npmrc\n**/NuGet.Config\nsecrets\n**/secrets\nnode_modules\n.venv\n__pycache__\ntarget\nobj\nbin\n');
 add('.gitignore','secrets/*\n!secrets/README.md\n.env\n.env.*\n*.local.json\n');
 add('secrets/README.md',`# Secretos locales — no incluidos\n\nCrea localmente los archivos requeridos: ${Object.keys(secrets).join(', ')||'ninguno'}. Usa valores fuertes y distintos, sin publicarlos ni copiarlos a imágenes. El kit no crea contraseñas ni inicia servicios. Compose monta archivos locales; no equivale a un almacén cifrado.\n\nSi se usa Redis, redis_acl debe incluir:\n\nuser default on nopass -@all +ping\nuser app on #HASH_SHA256_DE_TU_PASSWORD ~app:* &app:* +@read +@write +@connection +@transaction -@dangerous\n\nSustituye el hash por un SHA-256 real. El usuario default solo permite PING para healthcheck; usa el usuario app autenticado para datos. Revisa permisos de ACL para tu aplicación y que el UID de Redis pueda leer redis_acl en el montaje, sin hacerlo accesible a otros usuarios del host.\n`);
 add('README.md',`# ${name}\n\nConfiguración generada para revisión manual. No se han descargado imágenes, creado contenedores ni verificado las imágenes en un registro.\n\nPrimero crea los secretos locales indicados en secrets/README.md. Revisa imágenes/digests, requisitos de versión, arquitectura, recursos y cambios de datos. Luego usa los comandos del kit para validar y operar este proyecto. Los puertos no se publican salvo selección explícita y se vinculan solo a 127.0.0.1.\n\nEl backend de ejemplo solo implementa /health: no tiene autenticación, lógica de negocio ni conexión a las bases de datos. Healthcheck de base de datos no certifica credenciales, migraciones o persistencia. No es una entrega de producción.\n`);
 const warnings=['No se ejecutó Docker ni se verificó compatibilidad o existencia de imágenes.','Tags son mutables: fija digest para reproducción de imágenes.','Los datos de los volúmenes y los secretos requieren backup y gestión aparte.','Bases de datos conservan permisos de inicialización de la imagen; no se fuerza user arbitrario ni read_only a sus directorios de sistema.','Plantillas para contenedores Linux; Windows requiere un motor configurado para Linux.'];
 const payload={schemaVersion:1,kind:'docker-workspace-plan',templateVersion:request.templateVersion||'1.0.0',request,compose,files,warnings,executionAllowed:false};return {planId:digest(payload),...payload};
}
function validate(value){try{if(canonical(plan(value.request))!==canonical(value))throw Error();return {ok:true,executionAllowed:false};}catch{return {ok:false,errors:['Plan Docker inválido o modificado.']};}}
function write(value,destination){const result=io.writeNew(value,destination,validate),record={schemaVersion:1,kind:'managed-compose-record',request:value.request,templateVersion:value.templateVersion,files:value.files.map(f=>({path:f.path,digest:digest(f.content)}))};record.recordId=digest(record);fs.writeFileSync(path.join(destination,'devkit.compose.json'),JSON.stringify(record,null,2)+'\n',{flag:'wx',mode:0o600});return result;}
module.exports={DATABASES,PORTS,image,normalize,plan,validate,write};
