import {connection} from 'next/server';
import {photoRuntime} from '@/lib/history-activities/photo-runtime';
import {createPublicPhotoApi} from '@/lib/history-activities/photo-api';
// cacheComponents uses the default Node runtime; explicit runtime config is unsupported.
const handler=createPublicPhotoApi(()=>photoRuntime());
export async function GET(request:Request){await connection();return handler(request);}
