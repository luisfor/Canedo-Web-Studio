'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {createContext,findExecutables}=require('../doctor/environment');
const gen=require('../docker/generate'),schema=require('../docker/schema');
function compose(options={},overrides={}){
 const c=createContext(overrides),exe=findExecutables('docker',c).find(f=>c.platform!=='win32'||f.toLowerCase().endsWith('.exe'));
 function query(args,cwd){try{return c.spawn(exe,args,{cwd,env:{...c.env,DOCKER_CLI_HINTS:'false',NO_COLOR:'1'},encoding:'utf8',timeout:10000,maxBuffer:32768,shell:false,windowsHide:true});}catch{return {status:null,error:true};}}
 const version=exe?query(['compose','version','--short'],c.cwd):null;
 if(!version||version.error||version.status!==0)return {schemaVersion:1,kind:'native-compose-validation',ok:!options.requireDocker,status:'unavailable',reason:'existing-docker-compose-cli-required',checks:[],engineContacted:false,containersStarted:false,imagesPulled:false};
 const match=String(version.stdout).match(/\b(\d+\.\d+(?:\.\d+)?)/),checks=[];
 const root=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'canedo-compose-check-'));
 const refs={postgres:'postgres:17.6',mariadb:'mariadb:11.8.3',mysql:'mysql:8.4.6',mongo:'mongo:8.0.13',redis:'redis:8.2.1'};
 const backendRefs={node:{runtime:'node:24.22.2-alpine'},python:{runtime:'python:3.13.18-alpine'},go:{runtime:'alpine:3.22.1',builder:'golang:1.27.3-alpine'},java:{runtime:'eclipse-temurin:21.0.8_9-jre',builder:'eclipse-temurin:21.0.8_9-jdk'},dotnet:{runtime:'mcr.microsoft.com/dotnet/aspnet:10.0.0-alpine',builder:'mcr.microsoft.com/dotnet/sdk:10.0.100-alpine'}};
 const versions={node:'24.22.2',python:'3.13.18',go:'1.27.3',java:'21.0.8',dotnet:'10.0.100'};
 const cases=gen.DATABASES.map(id=>({id,request:{name:'check-'+id,services:[id],images:{[id]:refs[id]}}})).concat(Object.entries(backendRefs).map(([stack,images])=>({id:'backend-'+stack,request:{name:'check-'+stack,services:['postgres'],backend:stack,version:versions[stack],images:{postgres:refs.postgres,...images},...(['node','python','java'].includes(stack)?{templateVersion:'1.1.0'}:{})}})));
 try{for(const item of cases){
  const p=gen.plan(item.request),out=path.join(root,item.id);gen.write(p,out);
  for(const id of Object.keys(p.compose.secrets||{})){const value=id==='redis_acl'?'user default on nopass -@all +ping\nuser app on #'+crypto.randomBytes(32).toString('hex')+' ~app:* +@read +@write -@dangerous\n':crypto.randomBytes(32).toString('hex');fs.writeFileSync(path.join(out,'secrets',id),value,{flag:'wx',mode:0o600});}
  const r=query(['compose','--project-name',item.request.name,'--project-directory',out,'--file',path.join(out,'compose.yaml'),'config','--quiet'],out);
  checks.push({configuration:item.id,status:!r.error&&r.status===0?'passed':'failed',upstreamSchemaValid:schema.validateCompose(p.compose).ok});
 }}finally{fs.rmSync(root,{recursive:true,force:true});}
 return {schemaVersion:1,kind:'native-compose-validation',ok:checks.every(x=>x.status==='passed'&&x.upstreamSchemaValid),status:checks.every(x=>x.status==='passed')?'passed':'failed',host:{platform:process.platform,architecture:process.arch},composeVersion:match?match[1]:null,checks,temporaryFilesRemoved:true,composeCliExecuted:true,engineContacted:false,containersStarted:false,imagesPulled:false,
  limitations:['config --quiet valida los archivos; no certifica imágenes, builds, arranque o persistencia.','Las referencias son ejemplos; no se descargaron. Los secretos sintéticos de prueba se eliminaron.']};
}
module.exports={compose};
