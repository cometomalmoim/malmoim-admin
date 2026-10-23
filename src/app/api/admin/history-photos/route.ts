import {connection} from 'next/server';
import {getAdminAccess} from '@/lib/auth';
import {simplePhotosEnabled} from '@/lib/history-simple/policy';
import {createSimpleAdminApi} from '@/lib/history-simple/api';
import {albums,createAlbum,editAlbum,uploadPhoto,publishAlbum,deleteAlbum,deletePhoto} from '@/lib/history-simple/server';
const handler=createSimpleAdminApi({enabled:simplePhotosEnabled,access:getAdminAccess,ops:{list:()=>albums(true),create:createAlbum,edit:editAlbum,upload:uploadPhoto,publish:publishAlbum,deleteAlbum,deletePhoto}});
export async function GET(request:Request){await connection();return handler(request);}
export async function POST(request:Request){await connection();return handler(request);}
