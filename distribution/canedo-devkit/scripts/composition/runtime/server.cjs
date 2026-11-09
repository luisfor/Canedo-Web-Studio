'use strict';
const fs=require('node:fs'),path=require('node:path');
const {createApp}=require('./app.cjs');
async function main(){
 const tokens=JSON.parse(fs.readFileSync(process.env.AUTH_TOKENS_FILE||'secrets/tenant-tokens.json','utf8'));
 const serviceToken=process.env.SERVICE_TOKEN_FILE?fs.readFileSync(process.env.SERVICE_TOKEN_FILE,'utf8').trim():undefined;
 const app=createApp({dataDir:path.resolve(process.env.DATA_DIR||'data'),tokens,serviceToken,role:process.env.SERVICE_ROLE||'app',crmUrl:process.env.CRM_URL});
 const port=Number(process.env.PORT||8080);if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid PORT');
 let flushing=false;const timer=setInterval(async()=>{if(flushing)return;flushing=true;try{await app.flush();}catch{/* Durable outbox retained; no payloads or secrets in logs. */}finally{flushing=false;}},1000);timer.unref();
 app.server.listen(port,process.env.HOST||'127.0.0.1');
 let closing=false;async function close(){if(closing)return;closing=true;clearInterval(timer);try{await app.close();process.exitCode=0;}catch{process.exitCode=1;}}
 process.once('SIGTERM',close);process.once('SIGINT',close);
 app.server.on('error',async()=>{clearInterval(timer);await app.close();process.exitCode=1;});
}
if(require.main===module)main().catch(()=>{console.error('Startup failed: check credentials, migrations and service configuration.');process.exitCode=1;});
module.exports={main};
