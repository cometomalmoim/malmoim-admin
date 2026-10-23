import type {ReceiptResolverPorts} from '../../src/lib/history-activities/server-receipts';
export const RECEIPT_LOOKUP_SQL:string;
export function createPostgresReceiptSource(options:{connectionString:string;localReadOnly?:boolean;ca?:string}):ReceiptResolverPorts['source']&{close():Promise<void>};
