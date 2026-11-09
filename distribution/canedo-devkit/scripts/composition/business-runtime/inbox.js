'use strict';
let session=null;
const el=id=>document.getElementById(id);
async function api(route,input){if(!session)throw Error('Identifícate primero');const r=await fetch(route,{method:input?'POST':'GET',headers:{'Content-Type':'application/json','X-Tenant-Id':session.tenant,Authorization:'Bearer '+session.token,...(input?{'Idempotency-Key':crypto.randomUUID()}:{})},...(input?{body:JSON.stringify(input)}:{})});const value=await r.json();if(!r.ok)throw Error(value.error);return value;}
function show(id,rows){el(id).replaceChildren(...rows.map(r=>{const li=document.createElement('li');li.textContent=JSON.stringify(r);return li;}));}
async function refresh(){show('conversations',await api('/crm/conversations'));show('messages',await api('/crm/messages'));el('status').textContent='Datos locales consultados';}
el('login').onsubmit=async e=>{e.preventDefault();session={tenant:el('tenant').value,token:el('token').value};el('token').value='';try{await refresh();}catch(e){el('status').textContent=e.message;}};
el('logout').onclick=()=>{session=null;show('conversations',[]);show('messages',[]);el('status').textContent='Sesión local cerrada';};
el('reply').onsubmit=async e=>{e.preventDefault();try{const result=await api('/crm/messages',{conversationId:el('conversation').value,text:el('text').value});await refresh();el('status').textContent='Estado: '+result.status;}catch(e){el('status').textContent=e.message;}};
