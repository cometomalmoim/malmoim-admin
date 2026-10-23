import {connection} from 'next/server';
import {getAdminAccess} from '@/lib/auth';
import {photoRuntime} from '@/lib/history-activities/photo-runtime';
import {createPhotoApi} from '@/lib/history-activities/photo-api';
// cacheComponents uses the default Node runtime; explicit runtime config is unsupported.
const handler=createPhotoApi({access:getAdminAccess,runtime:()=>photoRuntime()});
export async function GET(request:Request){await connection();return handler(request);}
export async function POST(request:Request){await connection();return handler(request);}
