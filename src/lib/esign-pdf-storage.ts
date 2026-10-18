import 'server-only';
import {createHash} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
import {pdfStructure} from './pdf-validation.ts';
import {normalizeApplicantKey,denyAdminSession,type AdminSessionAdapter} from './esign-server-contracts.ts';
import {OfflinePdfStore} from './esign-integration-fixtures.ts';
import type {ApplicantKey} from './signing-targets.ts';

export type CompletedPdfRequest={id:string;key:ApplicantKey;submissionId:string;status:string;completedAt:string|null;sha256:string;pageCount:number};
/** Trusted server records, never values accepted directly from browser JSON. */
export interface CompletedPdfReader{get(id:string):Promise<CompletedPdfRequest|undefined>}
/** Private, immutable, atomic create-if-absent transport; NOT a public URL provider. */
export interface PrivatePdfTransport{putIfAbsent(path:string,bytes:Uint8Array):Promise<void>;get(path:string):Promise<Uint8Array|undefined>}
export type ServerPdfReference={fileId:string;bucket:'esign-completed';path:string;requestId:string;submissionId:string;key:ApplicantKey;sha256:string;size:number;mime:'application/pdf'};
const digest=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
export class PdfStorageError extends Error{}
function identity(record:CompletedPdfRequest){
 const key=normalizeApplicantKey(record.key);
 const uuid=(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
 if(!uuid(record.id)||!uuid(record.submissionId)||record.status!=='completed'||!record.completedAt||!Number.isFinite(Date.parse(record.completedAt)))throw new PdfStorageError('SIGNED_PDF_REQUIRED');
 if(!/^[0-9a-f]{64}$/.test(record.sha256)||!Number.isSafeInteger(record.pageCount)||record.pageCount<1||record.pageCount>1000)throw new PdfStorageError('INVALID_PDF_METADATA');
 const requestId=record.id.toLowerCase(),submissionId=record.submissionId.toLowerCase();
 const fileId=digest(JSON.stringify([key.event_id,key.source,key.application_id,requestId,submissionId]));
 return {key,requestId,submissionId,fileId,path:`${key.event_id}/${key.source}/${key.application_id}/${requestId}/${submissionId}/${fileId}.pdf`};
}
export class EsignPdfStorage{
 constructor(privateRecords:CompletedPdfReader,privateTransport:PrivatePdfTransport,privateAuth:AdminSessionAdapter=denyAdminSession){this.records=privateRecords;this.transport=privateTransport;this.auth=privateAuth;}
 private records:CompletedPdfReader;private transport:PrivatePdfTransport;private auth:AdminSessionAdapter;
 private async record(id:string){if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new PdfStorageError('INVALID_REQUEST_ID');const row=await this.records.get(id);if(!row)throw new PdfStorageError('PDF_NOT_FOUND');if(typeof row.id!=='string'||row.id.toLowerCase()!==id.toLowerCase())throw new PdfStorageError('REQUEST_MISMATCH');return structuredClone(row);}
 private async validate(row:CompletedPdfRequest,bytes:Uint8Array){
  if(!(bytes instanceof Uint8Array)||bytes.length<5||bytes.length>20*1024*1024||new TextDecoder().decode(bytes.subarray(0,5))!=='%PDF-')throw new PdfStorageError('INVALID_PDF_SIZE_OR_FORMAT');
  if(digest(bytes)!==row.sha256)throw new PdfStorageError('PDF_HASH_MISMATCH');
  if(await pdfStructure(bytes))throw new PdfStorageError('INVALID_PDF_STRUCTURE');
  if((await PDFDocument.load(bytes,{updateMetadata:false})).getPageCount()!==row.pageCount)throw new PdfStorageError('PDF_PAGE_COUNT_MISMATCH');
 }
 /** Internal server use only; returned path must never be serialized to browser clients. */
 async save(requestId:string,input:Uint8Array):Promise<ServerPdfReference>{
  const bytes=input.slice(),row=await this.record(requestId),ref=identity(row);await this.validate(row,bytes);
  try{await this.transport.putIfAbsent(ref.path,bytes);}catch{
   // A lost upload response is not proof of failure. Verify the immutable object.
   const existing=await this.transport.get(ref.path);if(!existing)throw new PdfStorageError('PDF_UPLOAD_RETRY_REQUIRED');
   if(digest(existing)!==row.sha256)throw new PdfStorageError('PDF_STORAGE_KEY_CONFLICT');
  }
  const stored=await this.transport.get(ref.path);if(!stored)throw new PdfStorageError('PDF_STORAGE_NOT_CONFIRMED');await this.validate(row,stored);
  const latest=await this.record(requestId);if(JSON.stringify(identity(latest))!==JSON.stringify(ref)||latest.sha256!==row.sha256)throw new PdfStorageError('REQUEST_CHANGED');
  return {...ref,bucket:'esign-completed',sha256:row.sha256,size:stored.length,mime:'application/pdf'};
 }
 private async authorize(eventId:string){const actor=await this.auth.currentAdmin();if(!actor||!actor.eventIds.includes(eventId))throw new PdfStorageError('PDF_ACCESS_DENIED');}
 /** Server streams these bytes; client receives neither service key nor internal path. */
 async download(requestId:string){
  const initial=await this.auth.currentAdmin();if(!initial)throw new PdfStorageError('PDF_ACCESS_DENIED');
  const row=await this.record(requestId),ref=identity(row);await this.authorize(ref.key.event_id);
  const bytes=await this.transport.get(ref.path);if(!bytes)throw new PdfStorageError('PDF_NOT_FOUND');await this.validate(row,bytes);
  const latest=await this.record(requestId);if(JSON.stringify(identity(latest))!==JSON.stringify(ref)||latest.sha256!==row.sha256)throw new PdfStorageError('REQUEST_CHANGED');
  await this.authorize(ref.key.event_id); // Recheck after asynchronous Storage read/validation.
  return {bytes:bytes.slice(),filename:`esign-${ref.fileId}.pdf`,mime:'application/pdf' as const};
 }
}
/** Reuses the stage-15 fake store; no SDK, disk upload, or bucket creation. */
export class OfflinePrivatePdfTransport implements PrivatePdfTransport{
 readonly store=new OfflinePdfStore();loseResponses=0;unconfirmedWrites=false;
 async putIfAbsent(path:string,bytes:Uint8Array){if(this.unconfirmedWrites)return;await this.store.put(digest(path),bytes);if(this.loseResponses>0){this.loseResponses--;throw new Error('SIMULATED_RESPONSE_LOST');}}
 async get(path:string){return this.store.get(digest(path))?.bytes;}
}
