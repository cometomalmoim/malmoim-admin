/** Client-safe boundary. No credentials, Storage paths, completion evidence or file bodies. */
export const activityStorageAvailability = Object.freeze({
  mode: 'mock-only' as const,
  message: '아래 모의 기능은 메모리 전용입니다. 실제 저장은 위의 독립 테스트 영역에서만 수행합니다.',
});
export type StoredPhoto = {id:string;state:'pending'|'uncertain'|'final';deletePending:boolean};
export type StoredActivity = {
  source:'independent-storage';id:string;revision:number;coverId:string;order:string[];
  title:string;date:string;description:string;published:boolean;photos:StoredPhoto[];
};
type Versioned = {requestId:string;activityId:string;revision:number};
export type ActivityStorageCommand =
 | {operation:'create';requestId:string;title:string;date:string;description:string}
 | (Versioned & {operation:'reserve';files:{clientId:string;size:number;mime:string}[]})
 | (Versioned & {operation:'inspect'|'finalize'|'retry';photoId:string})
 | (Versioned & {operation:'layout';order:string[];coverId:string})
 | (Versioned & {operation:'visibility';published:boolean});
export type StorageResult =
 | {status:'disabled'|'denied'|'invalid'|'conflict'|'uncertain'}
 | {status:'recorded';activity:StoredActivity};
export type PublicActivityPhotos = {
 id:string;title:string;date:string;description:string;coverId:string;
 photos:{id:string;src:string;alt:string}[];
};
export interface ActivityStorageAdapter {
  /** Reserve returns server IDs only. A future broker separately delivers a scoped
   * temporary-upload permit; browser success must never finalize this record. */
  execute(context:unknown,command:ActivityStorageCommand):Promise<StorageResult>;
  /** Public DTOs must contain only published immutable final-image read URLs (<=60s).
   * No admin journal/temporary paths. A transport is intentionally not installed. */
  publicGallery():Promise<{status:'disabled'|'uncertain'}|{status:'recorded';activities:PublicActivityPhotos[]}>;
}
