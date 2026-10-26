import Link from 'next/link';
import {Suspense} from 'react';
import {connection} from 'next/server';
import {getAdminAccess} from '@/lib/auth';
import {AdminShell} from '@/components/admin/admin-shell';
import {ReviewAccessManager} from './review-access-manager';
async function Content(){await connection();const access=await getAdminAccess();if(access.status!=='admin')return <main><h1>관리자 권한이 필요합니다</h1><Link href="/login">관리자 로그인</Link></main>;return <AdminShell email={access.email} current="history" title="히스토리 후기 작성 권한"><ReviewAccessManager/></AdminShell>;}
export default function Page(){return <Suspense fallback={<p role="status">관리자 권한 확인 중…</p>}><Content/></Suspense>;}
