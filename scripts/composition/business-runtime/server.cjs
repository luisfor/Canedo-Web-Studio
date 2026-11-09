'use strict';
const fs=require('node:fs');
const {createBusinessApp}=require('./app.cjs');
async function main(){
 if(!process.env.AUTH_ACTORS_FILE)throw Error('Configure AUTH_ACTORS_FILE privately');
 const actors=JSON.parse(fs.readFileSync(process.env.AUTH_ACTORS_FILE,'utf8'));
 const channelConfig=process.env.CHANNEL_CONFIG_FILE?JSON.parse(fs.readFileSync(process.env.CHANNEL_CONFIG_FILE,'utf8')):{};
 const app=createBusinessApp({dataDir:process.env.DATA_DIR||'./data',actors,channelConfig});
 const worker=setInterval(()=>app.flush().catch(()=>{}),1000);worker.unref();
 let closing=false;async function close(){if(closing)return;closing=true;clearInterval(worker);await app.close();}
 process.on('SIGTERM',close);process.on('SIGINT',close);
 app.server.listen(Number(process.env.PORT||8080),process.env.HOST||'127.0.0.1');
}
if(require.main===module)main().catch(()=>{console.error('Startup failed; review private configuration and migrations');process.exitCode=1;});
