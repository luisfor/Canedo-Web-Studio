'use strict';
const fs=require('node:fs'),path=require('node:path');
const {digest}=require('../planner/plan');
function readJson(file){try{if(!fs.statSync(file).isFile()||fs.statSync(file).size>1024*1024)throw Error();return JSON.parse(fs.readFileSync(file,'utf8'));}catch{throw new Error('JSON inválido o mayor de 1 MiB; no se muestra su contenido.');}}
function relative(file){return typeof file==='string'&&/^[A-Za-z0-9_.\-/]+$/.test(file)&&!file.startsWith('/')&&!file.split('/').some(s=>!s||s==='.'||s==='..');}
function parentForNew(destination){
 if(typeof destination!=='string'||!path.isAbsolute(destination)||destination!==path.normalize(destination)||/[\x00-\x1f\x7f]/.test(destination))throw new Error('Usa una ruta absoluta normalizada a una carpeta nueva.');
 let cursor=path.dirname(destination);while(true){const stat=fs.lstatSync(cursor);if(!stat.isDirectory()||stat.isSymbolicLink())throw new Error('El padre debe existir y no contener enlaces simbólicos.');const next=path.dirname(cursor);if(next===cursor)break;cursor=next;}
 try{fs.lstatSync(destination);throw new Error('El destino ya existe; no se sobrescribe.');}catch(e){if(e.code!=='ENOENT')throw e;}
 fs.accessSync(path.dirname(destination),fs.constants.W_OK);
}
function writeNew(plan,destination,validate){
 if(!validate(plan).ok)throw new Error('Plan inválido; no se escribió ningún archivo.');
 if(!Array.isArray(plan.files)||plan.files.some(f=>!relative(f.path)||typeof f.content!=='string')||new Set(plan.files.map(f=>f.path.toLowerCase())).size!==plan.files.length)throw new Error('Archivos de plan inválidos.');
 parentForNew(destination);fs.mkdirSync(destination,{mode:0o700});
 try{for(const file of plan.files){const target=path.join(destination,file.path);fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o700});fs.writeFileSync(target,file.content,{flag:'wx',mode:file.mode===0o644?0o644:0o600});}}
 catch{throw new Error('Escritura incompleta. Se conservó la carpeta nueva para revisar; no se borraron archivos ni se reintentó sobre ella.');}
 return {ok:true,destination,files:plan.files.map(f=>f.path),executedCommands:false};
}
function checkFiles(root,files){
 const base=fs.realpathSync(root),changes=[];
 for(const file of files){if(!relative(file.path))throw new Error('Ruta de archivo inválida.');
  let cursor=base,unsafe=false;for(const part of file.path.split('/')){cursor=path.join(cursor,part);try{if(fs.lstatSync(cursor).isSymbolicLink()){unsafe=true;break;}}catch{unsafe=true;break;}}
  if(unsafe){changes.push({file:file.path,status:'missing-or-link'});continue;}
  try{if(!fs.statSync(cursor).isFile()||fs.statSync(cursor).size>1024*1024)throw Error();if(digest(fs.readFileSync(cursor,'utf8'))!==file.digest)changes.push({file:file.path,status:'modified'});}catch{changes.push({file:file.path,status:'unreadable'});}
 }
 return {ok:changes.length===0,changes};
}
module.exports={readJson,relative,parentForNew,writeNew,checkFiles};
