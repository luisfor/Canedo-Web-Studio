'use strict';
const path=require('node:path');
const env=require('../workspace/environment');
const {render}=require('../commands/render'),{digest}=require('../planner/plan');
const ACTIONS=['validate','up','start','stop','status','inspect','logs','pull','build','repair','down','remove-volumes'];
function plan(root,input){
 if(!input||Object.keys(input).some(k=>!['action','context','services','acknowledgeRemoval','approveDataLoss','confirm'].includes(k))||!ACTIONS.includes(input.action)||!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/.test(input.context||''))throw new Error('Acción o contexto explícito inválidos.');
 const {base,record,drift}=env.load(root);if(record.kind!=='managed-compose-record')throw new Error('El proyecto no es Compose.');
 const action=input.action,name=record.request.name,allowed=[...record.request.services,...(record.request.backend?['backend']:[])],services=[...new Set(input.services||[])].sort();if(services.some(s=>!allowed.includes(s)))throw new Error('Servicio fuera del proyecto.');
 const destructive=['down','remove-volumes'].includes(action);
 if(destructive&&(!input.acknowledgeRemoval||input.confirm!==name))throw new Error('Eliminar contenedores/redes requiere --acknowledge-removal y --confirm con el nombre exacto del proyecto.');
 if(action==='remove-volumes'&&!input.approveDataLoss)throw new Error('Eliminar volúmenes requiere además --approve-data-loss.');
 if(destructive&&services.length)throw new Error('down elimina el proyecto completo; no admite selección parcial de servicios.');
 const readOnly=['validate','status','inspect','logs','repair'].includes(action);if(!drift.ok&&!readOnly)throw new Error('Los archivos generados cambiaron. Revisa o regenera un plan antes de proponer cambios sobre ellos.');
 const prefix=['--context',input.context,'compose','--project-name',name,'--project-directory',base,'--file',path.join(base,'compose.yaml')];
 const commands=[];const add=(args,notes)=>{const run={executable:'docker',args:[...prefix,...args],stdinFrom:null};commands.push({run,posix:render(run,'posix'),powershell:render(run,'powershell'),notes});};
 // The config command is quiet: never export resolved environment/secret values.
 if(['validate','up','repair'].includes(action))add(['config','--quiet'],'Valida estructura. Secretos locales deben existir; no muestra configuración expandida.');
 if(action==='up')add(['up','--detach','--pull','never','--no-build','--no-recreate',...services],'No descarga, no compila y no recrea contenedores existentes. El usuario ejecuta el comando manualmente.');
 else if(action==='start'||action==='stop')add([action,...services],action==='stop'?'Detiene sin eliminar contenedores ni datos.':'Solo inicia contenedores existentes.');
 else if(['status','inspect','repair'].includes(action))add(['ps','--all','--format','json',...services],'Estado por proyecto, sin docker inspect completo ni variables de entorno.');
 else if(action==='logs')add(['logs','--no-color','--tail','100',...services],'Los logs de la aplicación pueden contener datos privados: no se recolectan desde el kit.');
 else if(action==='pull')add(['pull','--ignore-buildable',...services],'Solo descarga cuando tú ejecutes explícitamente esta acción. No descarga el backend que se construye localmente.');
 else if(action==='build'){if(!record.request.backend)throw new Error('No hay backend local para construir.');if(services.some(s=>s!=='backend'))throw new Error('Solo backend admite build.');add(['build','backend'],'Puede descargar imágenes base/dependencias al ejecutarse manualmente; no publica imágenes.');}
 else if(destructive)add(['down',...(action==='remove-volumes'?['--volumes']:[])],'Operación destructiva sobre el nombre Compose confirmado. No incluye --rmi, prune o remove-orphans.');
 const payload={schemaVersion:1,kind:'docker-operation-plan',mode:'manual',executionAllowed:false,action,context:input.context,project:name,services,commands,
  changesRuntime:!readOnly,destructive,dataLossPossible:destructive,removesVolumes:action==='remove-volumes',drift:drift.changes,warnings:['down elimina también la capa escribible del contenedor; conservar volúmenes no protege datos que no estén en ellos.','Nombre y contexto delimitan recursos; el kit no acredita propiedad de contenedores existentes.','No se ejecutó Docker. Revisa contexto, cambios, backups y datos antes de ejecutar comandos.','up sin recreación preserva la configuración anterior; actualizaciones/migraciones necesitan un plan explícito aparte.']};return {planId:digest(payload),...payload};
}
module.exports={ACTIONS,plan};
