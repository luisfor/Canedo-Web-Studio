'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{spawnSync}=require('node:child_process');
const {digest}=require('../planner/plan'),inspector=require('../kit-first/inspect');
function validate(root,{syntax=false}={}){
 const inspection=inspector.inspect(root,{full:true}),checks=[],pending=[];let esModule=false;
 if(!inspection.complete)return {ok:false,status:'blocked',scope:'static-syntax-only',inspectionId:inspection.inspectionId,limitations:inspection.limitations,checks,pending,projectCodeExecuted:false};
 try{esModule=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).type==='module';}catch{}
 for(const file of inspection.files){
  const json=/\.json$/.test(file.path),js=/\.(?:[cm]?js)$/.test(file.path),python=/\.py$/.test(file.path);
  if(!json&&!js&&!python){if(/\.(?:tsx?|jsx|go|java|cs|rs|cpp|c|kt|swift|dart|sql)$/.test(file.path))pending.push({path:file.path,reason:'stack-validator-requires-reviewed-toolchain'});continue;}
  const absolute=path.join(root,file.path),fd=fs.openSync(absolute,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));let source;
  try{const s=fs.fstatSync(fd);if(!s.isFile()||s.size>1024*1024)throw Error('File changed');const buffer=Buffer.alloc(s.size+1),n=fs.readSync(fd,buffer,0,buffer.length,0),after=fs.fstatSync(fd);if(n!==s.size||after.size!==s.size||after.mtimeMs!==s.mtimeMs)throw Error('File changed');source=buffer.subarray(0,n).toString('utf8');}finally{fs.closeSync(fd);}
  if(digest(source)!==file.digest)throw Error('El código cambió; repite validación.');
  if(python&&!syntax){pending.push({path:file.path,reason:'python-ast-requires-explicit-syntax-option'});continue;}
  let ok=true,validator=json?'json-parse':python?'python-ast':'javascript-parse';
  try{
   if(json)JSON.parse(source);
   else if(python){const doctor=require('../doctor/environment'),context=doctor.createContext(),exe=doctor.findExecutables('python3',context)[0];if(!exe){pending.push({path:file.path,reason:'python-parser-not-found'});continue;}const r=spawnSync(exe,['-I','-B','-c','import ast,sys; ast.parse(sys.stdin.read())'],{input:source,encoding:'utf8',timeout:4000,maxBuffer:8192,env:{PATH:process.env.PATH||'',...(process.env.SystemRoot?{SystemRoot:process.env.SystemRoot}:{})}});ok=r.status===0;}
   else if(file.path.endsWith('.mjs')||esModule&&!file.path.endsWith('.cjs')){if(!syntax){pending.push({path:file.path,reason:'module-syntax-requires-explicit-syntax-option'});continue;}const r=spawnSync(process.execPath,['--input-type=module','--check'],{input:source,encoding:'utf8',timeout:4000,maxBuffer:8192,env:{PATH:path.dirname(process.execPath)}});ok=r.status===0;}
   else new vm.Script(source,{filename:'reviewed-source'});
  }catch{ok=false;}
  checks.push({path:file.path,validator,status:ok?'passed':'failed'});
 }
 const after=inspector.inspect(root,{full:true});if(after.inspectionId!==inspection.inspectionId)throw Error('El proyecto cambió durante la validación.');
 const failed=checks.filter(c=>c.status==='failed').length;
 return {ok:!failed,status:failed?'failed':pending.length?'partial':checks.length?'passed':'not-run',scope:'static-syntax-only',inspectionId:inspection.inspectionId,sourceDigest:digest(inspection.files),checks,pending,failed,passed:checks.length-failed,projectCodeExecuted:false,limitations:['Sintaxis/JSON únicamente: no certifica comportamiento, tipos, seguridad, builds, dependencias o integración.','No se ejecutan scripts del proyecto ni se instalan toolchains.']};
}
module.exports={validate};
