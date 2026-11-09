'use strict';
const fs = require('node:fs');
const path = require('node:path');
const Ajv = require('ajv');
const net = require('node:net');
const { digest } = require('../planner/plan');
const validateSchema = new Ajv({ allErrors: true, strict: true }).compile(require('../../schemas/install-recipes.schema.json'));
function readRecipes() {
  try {
    const file = path.resolve(__dirname,'../../catalog/install-recipes/manifest.json');
    if (fs.statSync(file).size > 1024*1024) throw new Error();
    return JSON.parse(fs.readFileSync(file,'utf8'));
  } catch { throw new Error('No se pudo leer el catálogo de recetas manuales.'); }
}
function validateRecipes(data, tools) {
  const errors = [];
  if (!validateSchema(data)) return { ok:false,errors:validateSchema.errors.map(e=>`schema ${e.instancePath || '/'}: ${e.message}`) };
  const ids=new Set(), toolIds=new Set(), available=new Set(tools.tools.map(t=>t.id));
  for (const method of Object.values(data.methods)) for (const value of [method.documentation,method.repository].filter(Boolean)) {
    try { const url=new URL(value); if(url.protocol!=='https:' || url.username || url.password || url.search || url.hash || url.port || !url.hostname.includes('.') || net.isIP(url.hostname) || url.hostname.endsWith('.local')) throw new Error(); }
    catch { errors.push('Fuente de receta inválida.'); }
  }
  for (const recipe of data.recipes) {
    if(ids.has(recipe.id)||toolIds.has(recipe.tool)||!available.has(recipe.tool)) errors.push('Receta duplicada o herramienta desconocida.');
    ids.add(recipe.id);toolIds.add(recipe.tool);
    for (const config of Object.values(recipe.methods)) {
      const value=config.package.replaceAll('{major}','1').replaceAll('{minor}','0');
      if(!/^[A-Za-z0-9][A-Za-z0-9@./-]*$/.test(value) || value.includes('..') || value.includes('//')) errors.push('Selector de paquete inválido.');
    }
  }
  return {ok:!errors.length,recipes:data.recipes.length,recipeSetVersion:data.recipeSetVersion,digest:digest(data),errors};
}
function loadRecipes(tools) { const data=readRecipes();if(!validateRecipes(data,tools).ok) throw new Error('Catálogo de recetas manuales inválido.');return data; }
function coverage(data, tools) {
  return { recipeSetVersion:data.recipeSetVersion,mode:'manual',methods:Object.keys(data.methods),total:tools.tools.length,recipeAvailable:data.recipes.length,bundledOnly:tools.tools.some(t=>t.id==='npm')?1:0,notImplemented:tools.tools.length-data.recipes.length-(tools.tools.some(t=>t.id==='npm')?1:0),
    tools:tools.tools.map(t=>{const r=data.recipes.find(r=>r.tool===t.id);return {tool:t.id,methods:r?Object.keys(r.methods).concat(r.officialArchive?['official']:[]):[],status:r?'command-recipe':t.id==='npm'?'bundled-with-node':'not-implemented'};}),
    note:'Mapas y comandos, no paquetes disponibles ni instalaciones verificadas. Official exige un snapshot validado para Go/Node/Terraform.' };
}
module.exports={readRecipes,validateRecipes,loadRecipes,coverage};
