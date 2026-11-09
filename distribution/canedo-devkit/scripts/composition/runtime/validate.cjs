'use strict';
// Deliberately bounded JSON Schema interpreter for the generated contract subset.
// The kit separately compiles every schema with AJV before writing a project.
function valid(value,schema,document){
 if(schema.$ref)return valid(value,document.components.schemas[schema.$ref.split('/').pop()],document);
 if(Object.hasOwn(schema,'const')&&value!==schema.const)return false;
 if(schema.enum&&!schema.enum.includes(value))return false;
 if(schema.type==='object'){
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  if((schema.required||[]).some(k=>!Object.hasOwn(value,k)))return false;
  if(schema.additionalProperties===false&&Object.keys(value).some(k=>!Object.hasOwn(schema.properties,k)))return false;
  return Object.entries(schema.properties||{}).every(([k,s])=>!Object.hasOwn(value,k)||valid(value[k],s,document));
 }
 if(schema.type==='array')return Array.isArray(value)&&value.every(v=>valid(v,schema.items,document));
 if(schema.type==='integer'&&(!Number.isSafeInteger(value)||value<(schema.minimum??-Infinity)||value>(schema.maximum??Infinity)))return false;
 if(schema.type==='string'&&(typeof value!=='string'||value.length<(schema.minLength??0)||value.length>(schema.maxLength??Infinity)||schema.pattern&&!new RegExp(schema.pattern).test(value)))return false;
 if(schema.type==='boolean'&&typeof value!=='boolean')return false;
 return true;
}
module.exports={valid};
