'use strict';
const data=require('../../catalog/profiles/manifest.json');
const project=require('./project');
const {digest,canonical}=require('../planner/plan');
function validateCatalog(){const ids=new Set();for(const p of data.profiles){if(ids.has(p.id)||!p.stacks.length||p.stacks.some(s=>!project.STACKS.includes(s))||p.automaticDependencies!==false)throw new Error('Catálogo de perfiles inválido.');ids.add(p.id);}return {ok:true,count:data.profiles.length};}
function list(){validateCatalog();return {...data,note:'Sugerencias optativas: no se instalan SDK, frameworks o servicios por seleccionar un perfil.'};}
function plan(profile,input){validateCatalog();const selected=data.profiles.find(p=>p.id===profile);if(!selected||!selected.stacks.includes(input.stack))throw new Error('Perfil o stack no compatible con el perfil.');const projectPlan=project.plan(input);const payload={schemaVersion:1,kind:'profile-project-plan',profile,profileCatalogDigest:digest(data),projectPlan,suggestedTools:selected.suggestedTools,optionalServices:selected.optionalServices};return {planId:digest(payload),...payload};}
function validate(value){try{if(canonical(plan(value.profile,value.projectPlan.request))!==canonical(value))throw Error();return {ok:true};}catch{return {ok:false,errors:['Plan de perfil inválido o modificado.']};}}
function write(value,destination){if(!validate(value).ok)throw new Error('Plan de perfil inválido.');return project.write(value.projectPlan,destination);}
module.exports={list,plan,validate,write,validateCatalog};
