import 'server-only';
import {randomBytes,randomInt,createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {normalizeApplicantKey,denyAdminSession,type AdminSessionAdapter} from './esign-server-contracts.ts';
import type {ApplicantKey} from './signing-targets.ts';
export type SigningAuthRequest={id:string;key:ApplicantKey;status:string;expiresAt:string;generation:number;revision:number;phone:string};
/** Implement compare-and-submit atomically against latest request/binding. Never trust browser status. */
export interface SigningAuthRequests{
 current(id:string):Promise<SigningAuthRequest|undefined>;
 commitSubmission(id:string,expectedBinding:string,operationId:string,payloadHash:string,now:number):Promise<boolean>;
}
export interface SigningOtpProvider{send(target:string,code:string):Promise<void>}
export const developmentAuthPolicy=Object.freeze({otpMs:300000,sessionMs:600000,linkMs:604800000,maxAttempts:5,maxSends:3,cooldownMs:60000});
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const uuid=(s:string)=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const deny=()=>new Error('SIGNING_ACCESS_DENIED');
export function signingAuthBinding(r:SigningAuthRequest){return hash(JSON.stringify([r.id.toLowerCase(),normalizeApplicantKey(r.key),r.generation,r.revision,r.phone,r.expiresAt]));}
type Link={requestId:string;binding:string;expires:number;attempts:number;sends:number;lastSend:number;challenge?:{hash:string;nonce:string;expires:number};verified:boolean};
type Session={linkHash:string;expires:number;used:boolean};
/** Shared process-only store; never serialize to browser. Production needs a transactional persistent adapter. */
export class MemorySigningAuthStore{
 readonly links=new Map<string,Link>();readonly active=new Map<string,string>();readonly sessions=new Map<string,Session>();readonly secret=randomBytes(32);
 private queue:Promise<unknown>=Promise.resolve();
 transaction<T>(work:()=>Promise<T>):Promise<T>{const task=this.queue.then(work);this.queue=task.catch(()=>undefined);return task;}
}
export class SigningParticipantAuth{
 constructor(private readonly requests:SigningAuthRequests,private readonly otp:SigningOtpProvider,private readonly store:MemorySigningAuthStore,private readonly admin:AdminSessionAdapter=denyAdminSession,private readonly clock:()=>number=Date.now,private readonly allowTestReissue=false){}
 private run<T>(work:()=>Promise<T>){return this.store.transaction(async()=>{try{return await work();}catch(error){if(error instanceof Error&&['ACTIVE_LINK_EXISTS','REISSUE_POLICY_HOLD','DEVELOPMENT_AUTH_CAPACITY'].includes(error.message))throw error;throw deny();}});}
 private async current(id:string){
  if(!uuid(id))throw deny();const r=await this.requests.current(id);const now=this.clock();
  if(!r||r.id.toLowerCase()!==id.toLowerCase()||r.status!=='pending'||!Number.isFinite(Date.parse(r.expiresAt))||Date.parse(r.expiresAt)<=now||!Number.isSafeInteger(r.generation)||r.generation<1||!Number.isSafeInteger(r.revision)||r.revision<0||typeof r.phone!=='string'||!/^\+?[0-9]{8,15}$/.test(r.phone))throw deny();
  normalizeApplicantKey(r.key);return structuredClone(r);
 }
 private async link(token:string){
  if(typeof token!=='string'||!/^[0-9a-f]{64}$/.test(token))throw deny();const tokenHash=hash(token),link=this.store.links.get(tokenHash);
  if(!link||link.expires<=this.clock()||this.store.active.get(link.requestId)!==tokenHash)throw deny();
  const r=await this.current(link.requestId);if(signingAuthBinding(r)!==link.binding)throw deny();return{link,r,tokenHash};
 }
 private otpHash(linkHash:string,nonce:string,code:string){return createHmac('sha256',this.store.secret).update(JSON.stringify([linkHash,nonce,code])).digest('hex');}
 async issue(requestId:string,reissue=false){return this.run(async()=>{
  const actor=await this.admin.currentAdmin();if(!actor)throw deny();const r=await this.current(requestId),key=normalizeApplicantKey(r.key);
  if(!actor.eventIds.includes(key.event_id))throw deny();const id=r.id.toLowerCase();
  if(this.store.active.has(id)&&!reissue)throw new Error('ACTIVE_LINK_EXISTS');
  if(reissue&&(!this.allowTestReissue||process.env.NODE_ENV==='production'))throw new Error('REISSUE_POLICY_HOLD');
  if(this.store.links.size>=1000)throw new Error('DEVELOPMENT_AUTH_CAPACITY');
  const token=randomBytes(32).toString('hex'),tokenHash=hash(token),expires=Math.min(Date.parse(r.expiresAt),this.clock()+developmentAuthPolicy.linkMs);
  this.store.links.set(tokenHash,{requestId:id,binding:signingAuthBinding(r),expires,attempts:0,sends:0,lastSend:0,verified:false});this.store.active.set(id,tokenHash);
  return{path:`/sign/${token}`,expiresAt:new Date(expires).toISOString()};
 });}
 async sendOtp(token:string){return this.run(async()=>{
  const {link,r,tokenHash}=await this.link(token),p=developmentAuthPolicy,now=this.clock();
  if(link.verified||link.attempts>=p.maxAttempts||link.sends>=p.maxSends||(link.sends>0&&now-link.lastSend<p.cooldownMs))throw deny();
  // Reserve send count before provider await; ambiguous delivery never resets rate limits.
  link.sends++;link.lastSend=now;const code=String(randomInt(0,1000000)).padStart(6,'0'),nonce=randomBytes(16).toString('hex');
  link.challenge={hash:this.otpHash(tokenHash,nonce,code),nonce,expires:Math.min(link.expires,now+p.otpMs)};
  try{await this.otp.send(r.phone,code);}catch{link.challenge=undefined;throw deny();}
  await this.link(token);return{code:'CHALLENGE_SENT'};
 });}
 async verify(token:string,code:string){return this.run(async()=>{
  const {link,tokenHash}=await this.link(token),c=link.challenge;
  if(link.verified||!c||c.expires<=this.clock()||link.attempts>=developmentAuthPolicy.maxAttempts)throw deny();
  link.attempts++;
  if(typeof code!=='string'||!/^\d{6}$/.test(code)||!timingSafeEqual(Buffer.from(c.hash,'hex'),Buffer.from(this.otpHash(tokenHash,c.nonce,code),'hex')))throw deny();
  await this.link(token);const session=randomBytes(32).toString('hex');link.verified=true;link.challenge=undefined;
  this.store.sessions.set(hash(session),{linkHash:tokenHash,expires:Math.min(link.expires,this.clock()+developmentAuthPolicy.sessionMs),used:false});return{session};
 });}
 async submit(requestId:string,session:string,operationId:string,payloadHash:string){return this.run(async()=>{
  if(!uuid(requestId)||typeof session!=='string'||!/^[0-9a-f]{64}$/.test(session)||typeof operationId!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(operationId)||typeof payloadHash!=='string'||!/^[0-9a-f]{64}$/.test(payloadHash))throw deny();
  const s=this.store.sessions.get(hash(session)),l=s&&this.store.links.get(s.linkHash);
  if(!s||s.used||s.expires<=this.clock()||!l||l.requestId!==requestId.toLowerCase()||this.store.active.get(l.requestId)!==s.linkHash)throw deny();
  const r=await this.current(l.requestId);if(signingAuthBinding(r)!==l.binding)throw deny();
  s.used=true; // An ambiguous commit must be reconciled server-side, never blindly replayed.
  try{if(!await this.requests.commitSubmission(l.requestId,l.binding,operationId,payloadHash,this.clock()))throw deny();}catch{throw deny();}
  return{code:'SERVER_SUBMISSION_ACCEPTED'};
 });}
}
/** Test-only delivery sink. Never expose inbox through an API, browser state, or logs. */
export class FakeSigningOtpProvider implements SigningOtpProvider{
 readonly inbox:{target:string;code:string}[]=[];
 async send(target:string,code:string){this.inbox.push({target,code});}
}
