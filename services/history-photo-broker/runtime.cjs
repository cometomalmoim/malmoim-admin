// CommonJS service runtime; only standard Node modules. No default adapter or IO to backends.
exports.startPhotoBroker=async function({modules,ports,tls,host='127.0.0.1',port=0,shutdownMs=10000}){
 const https=await import('node:https');if(!modules?.['service-handler']||!Number.isInteger(shutdownMs)||shutdownMs<10||shutdownMs>10000)throw Error('Photo broker runtime unavailable');
 const handler=ports?.handleRequest?request=>ports.handleRequest(request):modules['service-handler'].createPhotoBrokerHandler(ports);
 let stopping=false,closing;
 const server=https.createServer({...tls,minVersion:'TLSv1.2'},async(req,res)=>{
  const abort=new AbortController();req.once('aborted',()=>abort.abort());res.once('close',()=>{if(!res.writableEnded)abort.abort();});
  try{
   if(stopping){res.writeHead(503);return res.end('{"code":"STOPPING"}');}
   if(!req.url?.startsWith('/')||req.url.startsWith('//')){res.writeHead(400);return res.end('{"code":"INVALID_REQUEST"}');}
   const chunks=[];let bytes=0;for await(const c of req){bytes+=c.length;if(bytes>16384){res.writeHead(413,{'content-type':'application/json','cache-control':'no-store'});return res.end('{"code":"BODY_TOO_LARGE"}');}chunks.push(c);}
   const request=new Request('https://broker.internal'+req.url,{method:req.method,headers:req.headers,signal:abort.signal,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});
   const response=await handler(request);if(abort.signal.aborted||res.destroyed)return;
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());
  }catch{if(res.destroyed)return;if(!res.headersSent)res.writeHead(503,{'content-type':'application/json','cache-control':'no-store'});res.end('{"code":"RESULT_UNCERTAIN"}');}
 });
 server.requestTimeout=15000;server.headersTimeout=10000;server.keepAliveTimeout=3000;server.maxHeadersCount=32;
 const close=()=>{
  if(!closing){stopping=true;closing=(async()=>{
   let timer;const drained=new Promise((resolve,reject)=>{server.close(error=>error?reject(error):resolve());server.closeIdleConnections?.();});
   // Invoke backend cleanup even if the listener has active requests or startup failed.
   const cleanup=Promise.resolve().then(()=>ports?.close?.());
   const result=Promise.allSettled([drained,cleanup]).then(items=>{if(items.some(i=>i.status==='rejected'))throw Error('Photo broker shutdown incomplete');});
   try{await Promise.race([result,new Promise((_,reject)=>{timer=setTimeout(()=>{server.closeAllConnections?.();reject(Error('Photo broker shutdown incomplete'));},shutdownMs);})]);}
   finally{if(timer)clearTimeout(timer);}
  })();}return closing;
 };
 try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});}
 catch{await close().catch(()=>{});throw Error('Photo broker start failed');}
 return {port:server.address().port,close};
};
