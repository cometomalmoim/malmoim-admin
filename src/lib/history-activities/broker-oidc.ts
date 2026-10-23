import 'server-only';
import {createPublicKey,verify,type JsonWebKey} from 'node:crypto';
export type OidcPolicy={issuer:string;audience:string;projectId:string;ownerId:string;subject:string;environment:'production'|'preview';maxAgeSeconds:number;maxLifetimeSeconds?:number};
export type JwksDocument={keys:(JsonWebKey&{kid?:string;alg?:string;use?:string;key_ops?:string[]})[]};
export type OidcDecision={status:'verified'}|{status:'missing'|'invalid'|'unavailable'};
/** Only trusted server-owned loader. Never derive discovery/JWKS URLs from JWT headers.
 * No JWT fields are logged or returned. Fresh key load on every verification means
 * removed keys are not accepted from an application cache. Rate limiting is a host duty. */
export function createBrokerOidcVerifier(policy:OidcPolicy,loadKeys:()=>Promise<JwksDocument>){
 const p=Object.freeze({...policy});
 const lifetime=p.maxLifetimeSeconds??p.maxAgeSeconds;
 return async function authenticate(authorization:string|null):Promise<OidcDecision>{
  if(!authorization)return {status:'missing'};
  if(!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(authorization)||authorization.length>16384)return {status:'invalid'};
  try{
   if(!p.issuer||!p.audience||!p.projectId||!p.ownerId||!p.subject||!['production','preview'].includes(p.environment)||!Number.isSafeInteger(p.maxAgeSeconds)||p.maxAgeSeconds<1||p.maxAgeSeconds>3600||!Number.isSafeInteger(lifetime)||lifetime<1||lifetime>7200)return {status:'invalid'};
   const [h,b,s]=authorization.slice(7).split('.');const header=JSON.parse(Buffer.from(h,'base64url').toString());
   if(header.alg!=='RS256'||header.typ!=='JWT'||typeof header.kid!=='string'||!header.kid||Object.keys(header).some(k=>!['alg','typ','kid'].includes(k)))return {status:'invalid'};
   let jwks:JwksDocument;try{jwks=await loadKeys();}catch{return {status:'unavailable'};}
   if(!Array.isArray(jwks.keys)||jwks.keys.length>32)return {status:'invalid'};
   const matches=jwks.keys.filter(k=>k.kid===header.kid);if(matches.length!==1)return {status:'invalid'};
   const key=matches[0];if(key.kty!=='RSA'||key.d||key.alg!=='RS256'||key.use!=='sig'||(key.key_ops&&!key.key_ops.includes('verify')))return {status:'invalid'};
   const publicKey=createPublicKey({key,format:'jwk'});if((publicKey.asymmetricKeyDetails?.modulusLength??0)<2048||!verify('RSA-SHA256',Buffer.from(h+'.'+b),publicKey,Buffer.from(s,'base64url')))return {status:'invalid'};
   const c=JSON.parse(Buffer.from(b,'base64url').toString()),now=Math.floor(Date.now()/1000);
   if(c.iss!==p.issuer||c.aud!==p.audience||c.project_id!==p.projectId||c.owner_id!==p.ownerId||c.sub!==p.subject||c.environment!==p.environment)return {status:'invalid'};
   if(![c.iat,c.exp].every(Number.isSafeInteger)||c.iat>now||c.exp<=now||c.exp<=c.iat||now-c.iat>p.maxAgeSeconds||c.exp-c.iat>lifetime||(c.nbf!==undefined&&(!Number.isSafeInteger(c.nbf)||c.nbf>now||c.nbf>c.exp)))return {status:'invalid'};
   return {status:'verified'};
  }catch{return {status:'invalid'};}
 };
}
/** Production loader accepts only explicitly pinned Vercel JWKS origin; no discovery
 * or request URL input, redirects, credentials, insecure TLS or local-test issuer. */
export function createVercelJwksLoader(url:string){
 const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='oidc.vercel.com'||u.port||u.username||u.password||u.search||u.hash||!/^\/(?:[A-Za-z0-9_-]+\/)?\.well-known\/jwks(?:\.json)?$/.test(u.pathname))throw Error('Unapproved JWKS target');
 return async():Promise<JwksDocument>=>{const r=await fetch(u,{redirect:'error',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(3000)});if(!r.ok)throw Error('JWKS unavailable');const text=await r.text();if(text.length>65536)throw Error('JWKS too large');return JSON.parse(text);};
}
