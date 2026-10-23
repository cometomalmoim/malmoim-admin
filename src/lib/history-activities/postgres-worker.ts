import 'server-only';
import {createServerReceiptResolver,type ReceiptResolverPorts} from './server-receipts';
import {createPostgresPhotoDriver} from '../../../services/history-photo-broker/postgres-driver.cjs';
import {createPhotoWorkerConnection,PHOTO_WORKER_ROLE,COMMIT_SQL,ROLE_AUDIT_SQL,type WorkerAdapters} from './server-db';
/** Explicit broker composition only. No environment reads, routes or default activation.
 * Caller must supply reviewed workload/admin authorization, real receipt resolver,
 * restricted credentials and lifecycle handling; none are created by this factory. */
export function createNodePostgresWorker(adapters?:Omit<WorkerAdapters,'driver'|'receipts'>&{receipts?:WorkerAdapters['receipts']},receiptPorts?:ReceiptResolverPorts){
 if(!adapters||!adapters.receipts&&!receiptPorts)return createPhotoWorkerConnection();
 return createPhotoWorkerConnection({...adapters,receipts:receiptPorts?createServerReceiptResolver(receiptPorts):adapters.receipts!,driver:createPostgresPhotoDriver({PHOTO_WORKER_ROLE,COMMIT_SQL,ROLE_AUDIT_SQL})});
}
