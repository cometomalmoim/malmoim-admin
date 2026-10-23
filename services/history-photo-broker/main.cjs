/* eslint-disable @typescript-eslint/no-require-imports -- Standalone photo broker CommonJS entry point. */
// Hosting-neutral TLS Node service. No automatic environment loading or default adapter.
const fs=require('node:fs'),path=require('node:path'),{startPhotoBroker}=require('./runtime.cjs');
const args=process.argv.slice(2),value=k=>{const i=args.indexOf(k);return i<0?undefined:args[i+1];};
let runtime,stopping=false;
(async()=>{
 const bundle=value('--bundle'),cert=value('--cert'),key=value('--key'),port=Number(value('--port')??8443),host=value('--host')??'127.0.0.1';
 if(!bundle||!cert||!key||!Number.isInteger(port)||port<0||port>65535||(fs.statSync(key).mode&0o077)!==0)throw Error();
 const modules={};for(const name of ['service-handler','broker-https','broker-oidc','verified-finalization','limited-storage','photo-policy','server-capabilities','server-db','server-receipts','receipt-generations','storage-token-issuer','broker-composition'])modules[name]=require(path.join(path.resolve(bundle),name+'.js'));
 // Adapter path is trusted operator code. configPath is never dependency/authentication proof.
 const adapter=value('--adapter');const ports=adapter?await require(path.resolve(adapter)).createPorts({modules,configPath:value('--config')}):undefined;
 try{runtime=await startPhotoBroker({modules,ports,tls:{key:fs.readFileSync(key),cert:fs.readFileSync(cert)},port,host});}
 catch{await ports?.close?.().catch(()=>{});throw Error();}
 if(process.send)process.send({event:'ready',port:runtime.port});else console.log('photo_broker_listening');
 const stop=()=>{if(stopping)return;stopping=true;const watchdog=setTimeout(()=>process.exit(1),10000);watchdog.unref();runtime.close().then(()=>{clearTimeout(watchdog);process.exitCode=0;},()=>{clearTimeout(watchdog);process.exitCode=1;});};
 process.on('SIGTERM',stop);process.on('SIGINT',stop);
})().catch(()=>{console.error('photo_broker_start_failed');process.exitCode=1;});
