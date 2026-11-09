'use strict';
const fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
function open(file){const db=new DatabaseSync(file);db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;');return db;}
function migrate(dataDir,domains=['commerce','communications']){
 fs.mkdirSync(dataDir,{recursive:true,mode:0o700});
 for(const domain of domains){const db=open(path.join(dataDir,domain+'.sqlite'));try{db.exec('BEGIN IMMEDIATE');db.exec(fs.readFileSync(path.join(__dirname,'migrations',domain==='commerce'?'commerce.sql':'crm.sql'),'utf8'));db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}finally{db.close();}}
}
function fail(status,message){const e=Error(message);e.status=status;throw e;}
function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';return JSON.stringify(value);}
function transaction(db,fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}
function memo(db,tenant,key,operation,input,fn){return transaction(db,()=>{
 const request=canonical(input),previous=db.prepare('SELECT * FROM receipt WHERE tenant_id=? AND key=?').get(tenant,key);
 if(previous){if(previous.operation!==operation||previous.request!==request)fail(409,'Idempotency key reused with different request');return JSON.parse(previous.result);}
 const result=fn();db.prepare('INSERT INTO receipt VALUES(?,?,?,?,?)').run(tenant,key,operation,request,JSON.stringify(result));return result;
});}
module.exports={open,migrate,fail,memo,transaction,canonical};
