'use strict';
const vm=require('node:vm');
const tools=require('../tools/catalog'),capabilities=require('../../config/kit-capabilities.json');
const recipes=require('../commands/catalog'),profiles=require('./profiles'),project=require('./project'),docker=require('../docker/generate');
function verify(options={}){
 if(options.server&&!options.docker)throw new Error('--server requiere --docker en verify.');
 const checks=[];const check=(name,run)=>{try{if(run()===false)throw Error();checks.push({name,status:'passed'});}catch{checks.push({name,status:'failed'});}};
 check('tool-catalog',()=>tools.validateToolCatalog(tools.readToolCatalog(),capabilities).ok);
 const manifest=tools.loadToolCatalog(capabilities);check('manual-recipes',()=>recipes.validateRecipes(recipes.readRecipes(),manifest).ok);check('profiles',()=>profiles.validateCatalog().ok);
 const versions={node:'24.22.2',python:'3.13.18',go:'1.27.3',java:'21.0.8',dotnet:'10.0.100',rust:'1.90.0'};
 for(const stack of project.STACKS)check('project-roundtrip-'+stack,()=>project.validate(project.plan({stack,version:versions[stack]})).ok);
 const images={postgres:'postgres:17.6',mariadb:'mariadb:11.8.3',mysql:'mysql:8.4.6',mongo:'mongo:8.0.13',redis:'redis:8.2.1'};
 const composeSchema=require('../docker/schema');
 for(const id of docker.DATABASES){check('compose-roundtrip-'+id,()=>docker.validate(docker.plan({services:[id],images:{[id]:images[id]}})).ok);check('compose-upstream-schema-'+id,()=>composeSchema.validateCompose(docker.plan({services:[id],images:{[id]:images[id]}}).compose).ok);}
 const backendImages={node:{runtime:'node:24.22.2-alpine'},python:{runtime:'python:3.13.18-alpine'},go:{runtime:'alpine:3.22.1',builder:'golang:1.27.3-alpine'},java:{runtime:'eclipse-temurin:21.0.8_9-jre',builder:'eclipse-temurin:21.0.8_9-jdk'},dotnet:{runtime:'mcr.microsoft.com/dotnet/aspnet:10.0.0-alpine',builder:'mcr.microsoft.com/dotnet/sdk:10.0.100-alpine'}};
 for(const [stack,refs] of Object.entries(backendImages))check('compose-upstream-schema-backend-'+stack,()=>composeSchema.validateCompose(docker.plan({services:['postgres'],backend:stack,version:versions[stack],images:{postgres:images.postgres,...refs}}).compose).ok);
 check('node-template-syntax',()=>{const p=docker.plan({services:[],backend:'node',version:versions.node,images:{runtime:'node:24.22.2-alpine'}});for(const f of p.files.filter(f=>f.path.endsWith('.js')))new vm.Script(f.content,{filename:f.path});return true;});
 const dockerReport=options.docker?require('../docker/doctor').diagnoseDocker({server:options.server}):null;
 return {schemaVersion:1,kind:'verification-report',ok:checks.every(c=>c.status==='passed')&&(!options.server||dockerReport?.ok===true),configurationChecksPassed:checks.every(c=>c.status==='passed'),dockerRequested:options.docker===true,serverProbeRequested:options.server===true,host:{platform:process.platform,architecture:process.arch,nodeVersion:process.versions.node},checks,docker:dockerReport,
  verificationScope:'Catálogos, generación/reconstrucción y sintaxis Node en el host actual. No instala SDK ni prueba contenedores, datos o builds de otros lenguajes.',
  externalPlatforms:['darwin','win32','linux'].filter(p=>p!==process.platform).map(platform=>({platform,status:'not-run-in-this-session'})),
  pending:['Docker Compose config/build/up reales si no hay motor autorizado.','Compilación y ejecución Go/Java/.NET con SDK e imágenes elegidos.','Matrix CI definida no equivale a jobs ejecutados.','verify native ejecuta pruebas HTTP adicionales únicamente cuando se solicita explícitamente.','Restauración de datos, migraciones, credenciales y backups de aplicaciones.'],mutationsPerformed:false};
}
module.exports={verify};
