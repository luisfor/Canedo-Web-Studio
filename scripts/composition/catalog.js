'use strict';
const Ajv=require('ajv');
const schema=require('../../schemas/composition-catalog.schema.json');
const check=new Ajv({allErrors:true}).compile(schema);
const {canonical}=require('../planner/plan');
function validate(value){
 const errors=[];
 if(!check(value))return {ok:false,errors:check.errors.map(e=>e.instancePath+' '+e.message)};
 for(const group of ['capabilities','archetypes','projects'])if(new Set(value[group].map(x=>x.id)).size!==value[group].length)errors.push('IDs duplicados: '+group);
 const ids=new Set(value.capabilities.map(c=>c.id));
 for(const entry of [...value.capabilities,...value.archetypes,...value.projects])for(const id of entry.requires||entry.capabilities||[])if(!ids.has(id))errors.push('Capacidad desconocida: '+id);
 const visiting=new Set(),done=new Set();
 function visit(id){if(visiting.has(id))throw Error('Dependencias cíclicas: '+id);if(done.has(id))return;visiting.add(id);for(const dep of value.capabilities.find(c=>c.id===id)?.requires||[])visit(dep);visiting.delete(id);done.add(id);}
 try{for(const id of ids)visit(id);}catch(e){errors.push(e.message);}
 const aliases=new Map();for(const c of value.capabilities)for(const alias of c.aliases){const key=normalize(alias);if(!/^[a-z0-9 -]+$/.test(key)||!key.trim())errors.push('Alias inválido: '+c.id);if(aliases.has(key)&&aliases.get(key)!==c.id)errors.push('Alias ambiguo: '+key);aliases.set(key,c.id);}
 return {ok:!errors.length,errors};
}
const {normalize}=require('../tools/text');
function read(extra){const value=JSON.parse(canonical(require('../../catalog/composition/registry.json')));if(extra){if(typeof extra!=='object'||Array.isArray(extra)||Object.keys(extra).some(k=>!['schemaVersion','capabilities','archetypes','projects'].includes(k))||extra.schemaVersion!==undefined&&extra.schemaVersion!==1)throw Error('Extensión de catálogo inválida.');for(const group of ['capabilities','archetypes','projects']){if(extra[group]!==undefined&&!Array.isArray(extra[group]))throw Error('Extensión de catálogo inválida.');value[group].push(...(extra[group]||[]));}}const report=validate(value);if(!report.ok)throw Error(report.errors.join('; '));return value;}
module.exports={read,validate,normalize};
