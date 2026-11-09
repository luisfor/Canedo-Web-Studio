'use strict';
const path=require('node:path');
const {createContext,findExecutables}=require('../doctor/environment');
function endpointKind(value){
 if(typeof value!=='string'||/[\x00-\x1f\x7f]/.test(value)||value.trim()!==value)return 'unknown';
 if(value.startsWith('unix:///')||value.startsWith('npipe:////./pipe/'))return 'local';
 try{const u=new URL(value);if(u.username||u.password||u.search||u.hash)return 'remote';return ['localhost','127.0.0.1','[::1]'].includes(u.hostname)?'local':'remote';}catch{return 'unknown';}
}
function diagnoseDocker(options={},overrides={}){
 if(options.allowRemote&&!options.server)throw new Error('--allow-remote requiere --server.');
 const c=createContext(overrides),paths=c.platform==='win32'?path.win32:path.posix;
 const executable=findExecutables('docker',c).find(f=>c.platform!=='win32'||f.toLowerCase().endsWith('.exe'));
 function query(args){
  if(!executable)return {status:'missing',value:null};
  try{const r=c.spawn(executable,args,{cwd:c.cwd,env:{...c.env,DOCKER_CLI_HINTS:'false',NO_COLOR:'1'},shell:false,windowsHide:true,timeout:4000,maxBuffer:32768,encoding:'utf8'});
   if(r.error||r.status!==0)return {status:'error',value:null};return {status:'detected',value:String(r.stdout).trim()};
  }catch{return {status:'error',value:null};}
 }
 function version(args){const r=query(args),m=r.value&&/\bv?(\d+\.\d+(?:\.\d+)?(?:[-+][a-zA-Z0-9.-]+)?)/.exec(r.value);return {status:r.status==='detected'&&!m?'unverifiable':r.status,version:m?m[1]:null};}
 const cli=version(['--version']),compose=version(['compose','version','--short']),buildx=version(['buildx','version']);
 let desktop=false;
 const candidates=c.platform==='darwin'?['/Applications/Docker.app']:c.platform==='win32'?[paths.join(c.env.ProgramFiles||'C:/Program Files','Docker','Docker','Docker Desktop.exe')]:['/opt/docker-desktop/bin/docker-desktop'];
 for(const file of candidates){try{if(c.stat(file).isDirectory()||c.stat(file).isFile())desktop=true;}catch{}}
 let kind='unknown',contextStatus=executable?'unverifiable':'missing';
 if(executable){
  if(c.env.DOCKER_HOST&&!c.env.DOCKER_CONTEXT){kind=endpointKind(c.env.DOCKER_HOST);contextStatus=kind==='unknown'?'unverifiable':'detected';}
  else{const name=query(['context','show']);if(name.status==='detected'&&/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/.test(name.value)){
    const endpoint=query(['context','inspect',name.value,'--format','{{json .Endpoints.docker.Host}}']);
    try{kind=endpointKind(JSON.parse(endpoint.value));contextStatus=kind==='unknown'?'unverifiable':'detected';}catch{}
  }}
 }
 let server={status:executable?'not-checked':'missing',version:null,reason:options.server?'context-unverified':'explicit-server-probe-not-requested'};
 if(options.server&&executable){
  if(kind==='local'||kind==='remote'&&options.allowRemote){const result=version(['version','--format','{{json .Server.Version}}']);server={...result,reason:result.status==='detected'?'server-reachable':'server-unreachable-or-permission-denied'};}
  else server={status:'skipped',version:null,reason:kind==='remote'?'remote-context-requires-explicit-consent':'context-unverified'};
 }
 const daemon=findExecutables('dockerd',c).length>0;
 return {schemaVersion:1,kind:'docker-diagnostic',host:{platform:c.platform,architecture:c.arch},cli,engine:{binaryPresent:daemon,server},desktop:{status:desktop?'detected':'not-found',running:'not-checked',version:null},compose,buildx,context:{status:contextStatus,kind},
  ok:cli.status==='detected'&&compose.status==='detected'&&buildx.status==='detected'&&(!options.server||server.status==='detected'),
  limitations:['CLI, plugins y presencia de Desktop son independientes del servidor.','Servidor accesible no certifica ejecución de contenedores ni un builder.','No se muestran contexto, rutas, endpoints, valores de entorno ni stderr sin filtrar.'],mutationsPerformed:false};
}
module.exports={diagnoseDocker,endpointKind};
