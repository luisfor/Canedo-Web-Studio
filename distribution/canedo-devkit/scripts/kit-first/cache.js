'use strict';
const fs=require('node:fs'),path=require('node:path');
const {digest}=require('../planner/plan');
const MEMORY=new Map(),NAME='.devkit-cache',MAX=4*1024*1024;
function directory(root,create=false){
 require('./inspect').checkRoot(root);let dir=path.join(root,NAME);
 for(const part of [dir,path.join(dir,'v1')]){if(fs.existsSync(part)){const s=fs.lstatSync(part);if(!s.isDirectory()||s.isSymbolicLink())throw Error('Caché enlazada o inválida.');}else if(create)fs.mkdirSync(part,{mode:0o700});}
 return path.join(dir,'v1');
}
function read(file){const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));try{const s=fs.fstatSync(fd);if(!s.isFile()||s.size>MAX)throw Error('Caché fuera de límite.');const buffer=Buffer.alloc(s.size+1),n=fs.readSync(fd,buffer,0,buffer.length,0),after=fs.fstatSync(fd);if(n!==s.size||after.size!==s.size||after.mtimeMs!==s.mtimeMs)throw Error('Caché cambió durante lectura.');return JSON.parse(buffer.subarray(0,n).toString('utf8'));}finally{fs.closeSync(fd);}}
function valid(value,key){return value&&Object.keys(value).sort().join(',')==='key,kind,value'&&value.kind==='devkit-analysis-cache-v1'&&value.key===key&&Object.keys(value.value||{}).sort().join(',')==='limitations,record,signals'&&Array.isArray(value.value?.signals)&&value.value.signals.length<500&&value.value.signals.every(s=>Object.keys(s).sort().join(',')==='category,certainty,id'&&['language','framework','database','component'].includes(s.category)&&/^[a-z][a-z0-9-]{0,63}$/.test(s.id)&&['declared','observed-file','inferred'].includes(s.certainty))&&Array.isArray(value.value.limitations)&&value.value.limitations.every(s=>s==='invalid-manifest')&&typeof value.value.record==='boolean';}
function open(root,mode='off'){
 if(!['off','memory','disk'].includes(mode))throw Error('Usa caché off, memory o disk.');
 const prefix=digest(root)+':';
 return {
  get(key){if(mode==='off')return null;const id=prefix+key;let item=MEMORY.get(id);if(!item&&mode==='disk'){try{item=read(path.join(directory(root),key+'.json'));}catch{return null;}}return valid(item,key)?structuredClone(item.value):null;},
  put(key,value){if(mode==='off')return;const item={kind:'devkit-analysis-cache-v1',key,value};if(!valid(item,key))return;if(MEMORY.size>=10000)MEMORY.delete(MEMORY.keys().next().value);MEMORY.set(prefix+key,item);
   if(mode==='disk'){const dir=directory(root,true),file=path.join(dir,key+'.json');if(fs.existsSync(file)&&!valid(read(file),key))throw Error('Archivo de caché ajeno; no se sobrescribe.');const temporary=path.join(dir,'.tmp-'+require('node:crypto').randomUUID());fs.writeFileSync(temporary,JSON.stringify(item),{flag:'wx',mode:0o600});fs.renameSync(temporary,file);}
  }
 };
}
function inspect(root){const dir=directory(root);if(!fs.existsSync(dir))return {kind:'cache-inventory',entries:0,bytes:0,storesSourceContent:false};let bytes=0,count=0;for(const name of fs.readdirSync(dir)){if(!/^[a-f0-9]{64}\.json$/.test(name))throw Error('Entrada ajena a la caché; revisar manualmente.');const file=path.join(dir,name),value=read(file);if(!valid(value,name.slice(0,-5)))throw Error('Entrada de caché inválida.');bytes+=fs.statSync(file).size;count++;}return {kind:'cache-inventory',entries:count,bytes,storesSourceContent:false};}
function clear(root){const inventory=inspect(root),dir=directory(root);if(fs.existsSync(dir))for(const name of fs.readdirSync(dir))fs.unlinkSync(path.join(dir,name));const prefix=digest(root)+':';for(const key of MEMORY.keys())if(key.startsWith(prefix))MEMORY.delete(key);return {ok:true,removedEntries:inventory.entries,scope:'derived-cache-only',sourceFilesDeleted:false};}
module.exports={open,inspect,clear};
