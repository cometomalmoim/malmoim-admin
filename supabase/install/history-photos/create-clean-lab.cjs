// Explicit disposable lab provisioning only. Does not inspect credentials or touch old containers.
const fs=require('node:fs'),net=require('node:net'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync,spawn}=require('node:child_process');
(async()=>{const port=Number(process.argv[2]??59421);if(![59421,60421].includes(port))throw Error('unapproved ports');for(const p of Array.from({length:10},(_,i)=>port-1+i))await new Promise((r,j)=>{const s=net.createServer();s.once('error',()=>j(Error('port occupied')));s.listen(p,'127.0.0.1',()=>s.close(r));});
const docker=a=>execFileSync('docker',a,{encoding:'utf8',timeout:15000,stdio:['ignore','pipe','pipe']}),ids=docker(['ps','-aq']).trim().split(/\s+/).filter(Boolean),before=ids.length?JSON.parse(docker(['inspect',...ids])):[];
const root=fs.mkdtempSync('/private/tmp/malmoim-photo-package-'),project='malmoim-photo-package-'+crypto.randomBytes(4).toString('hex');fs.chmodSync(root,0o700);fs.mkdirSync(root+'/supabase');
const template=`project_id = "${project}"
[api]
enabled = true
port = ${port}
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000
[db]
port = ${port+1}
shadow_port = ${port-1}
major_version = 17
[db.pooler]
enabled = false
port = ${port+8}
[db.migrations]
enabled = false
[db.seed]
enabled = false
[realtime]
enabled = false
[studio]
enabled = false
port = ${port+2}
api_url = "http://127.0.0.1"
[local_smtp]
enabled = false
port = ${port+3}
smtp_port = ${port+4}
pop3_port = ${port+5}
[storage]
enabled = true
file_size_limit = "50MiB"
[auth]
enabled = true
site_url = "http://127.0.0.1:3004"
additional_redirect_urls = []
enable_signup = false
[edge_runtime]
enabled = false
inspector_port = ${port+7}
[analytics]
enabled = false
port = ${port+6}
[experimental]
stack = false
`;fs.writeFileSync(root+'/supabase/config.toml',template);
fs.writeFileSync(root+'/isolation-before.json',JSON.stringify(before.map(c=>({id:c.Id,name:c.Name,mounts:c.Mounts.map(m=>m.Name||m.Source),ports:c.NetworkSettings.Ports}))),{mode:0o600});
const cli=path.resolve('node_modules/.bin/supabase'),log=fs.openSync(root+'/startup.private.log','w',0o600);const child=spawn(cli,['start','--workdir',root,'--exclude','studio,realtime,edge-runtime,logflare,vector,supavisor,imgproxy,inbucket,postgres-meta'],{stdio:['ignore',log,log]});
const code=await new Promise(r=>child.once('exit',r));fs.closeSync(log);if(code!==0)throw Error('startup failed; private log retained');
const cs=JSON.parse(docker(['inspect','supabase_db_'+project,'supabase_kong_'+project,'supabase_storage_'+project]));if(!cs[0].NetworkSettings.Ports['5432/tcp'].some(p=>p.HostPort===String(port+1))||!cs[1].NetworkSettings.Ports['8000/tcp'].some(p=>p.HostPort===String(port)))throw Error('port mismatch');
const oldMounts=new Set(before.flatMap(c=>c.Mounts.map(m=>m.Name||m.Source)));if(cs.some(c=>before.some(b=>b.Id===c.Id)||c.Mounts.some(m=>oldMounts.has(m.Name||m.Source))))throw Error('isolation failed');
const now=JSON.parse(docker(['inspect',...ids]));if(now.some(c=>!before.some(b=>b.Id===c.Id&&JSON.stringify(b.Mounts)===JSON.stringify(c.Mounts)&&JSON.stringify(b.NetworkSettings.Ports)===JSON.stringify(c.NetworkSettings.Ports))))throw Error('existing topology changed');
const target={projectId:project,apiUrl:'http://127.0.0.1:'+port,dbHost:'127.0.0.1',dbPort:port+1,dbContainerId:cs[0].Id,apiContainerId:cs[1].Id,storageContainerId:cs[2].Id,volumes:cs.flatMap(c=>c.Mounts.map(m=>m.Name||m.Source))};fs.writeFileSync(root+'/target.json',JSON.stringify(target,null,2));console.log(JSON.stringify({root,project,api:port,db:port+1,isolated:true}));
})().catch(()=>{console.error('clean_lab_preparation_failed; no existing containers changed');process.exitCode=1;});
