'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Ajv=require('ajv/dist/2020');
const provenance=require('../../schemas/vendor/compose-spec.provenance.json');
const file=path.resolve(__dirname,'../../schemas/vendor/compose-spec.json');
const bytes=fs.readFileSync(file);
if(crypto.createHash('sha256').update(bytes).digest('hex')!==provenance.vendoredSha256)throw new Error('El esquema Compose cambió; revisa su procedencia antes de validar.');
const validate=new Ajv({strict:false,allErrors:true}).compile(JSON.parse(bytes));
function validateCompose(document){const ok=validate(document);return {ok,scope:'upstream-compose-schema-only',sourceCommit:provenance.commit,errors:ok?[]:validate.errors.slice(0,20).map(e=>({path:e.instancePath,keyword:e.keyword,message:e.message})),dockerExecuted:false,note:'El esquema no verifica imágenes, permisos, secretos presentes, motor, builds o datos.'};}
module.exports={validateCompose};
