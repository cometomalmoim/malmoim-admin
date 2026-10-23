import type {PoolOptions,PhotoPool} from '../../src/lib/history-activities/server-db';
export function createPostgresPhotoDriver(contract:{PHOTO_WORKER_ROLE:string;COMMIT_SQL:string;ROLE_AUDIT_SQL:string},options?:{localReadOnly?:boolean;ca?:string}):{open(options:PoolOptions):Promise<PhotoPool>};
