#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'DISTRIBUTION-MANIFEST.json'),'utf8'));
const failures=[],expected=new Set();
for(const item of manifest.files){
 const relative=item.path,absolute=path.resolve(root,relative);expected.add(relative);
 if(!relative||path.isAbsolute(relative)||relative.split('/').some(p=>p==='..'||p==='.')||!absolute.startsWith(root+path.sep)){failures.push('invalid-manifest-path');continue;}
 let parent=absolute,unsafe=false;
 while(parent!==root){try{if(fs.lstatSync(parent).isSymbolicLink())unsafe=true;}catch{unsafe=true;}parent=path.dirname(parent);}
 if(unsafe){failures.push(relative+': missing-or-link');continue;}
 const hash=crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex');if(hash!==item.sha256)failures.push(relative+': digest-mismatch');
}
const ignored=new Set(['.git','node_modules','.devkit-cache','.devkit']);let ignoredLocalDirectories=0;
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name),relative=path.relative(root,p).split(path.sep).join('/');if(e.isSymbolicLink()){failures.push(relative+': link');continue;}if(e.isDirectory()){if(ignored.has(e.name)){ignoredLocalDirectories++;continue;}walk(p);}else if(relative!=='DISTRIBUTION-MANIFEST.json'&&!expected.has(relative))failures.push(relative+': unexpected-file');}}
walk(root);console.log(JSON.stringify({ok:failures.length===0,filesVerified:manifest.files.length,manifestSelfHashIncluded:false,scope:'local-integrity-not-authenticity-or-license-approval',ignoredLocalDirectories,failures},null,2));if(failures.length)process.exitCode=1;
