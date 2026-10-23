import {AdminShell} from '@/components/admin/admin-shell';
import type {Metadata} from 'next';
import {Suspense} from 'react';
import {headers} from 'next/headers';
import {notFound,redirect} from 'next/navigation';
import {developmentAdminAccess} from '@/lib/history-activities/development-admin-access';
import {historyPhotoPageAccess} from '@/lib/history-activities/admin-page-access';
import {PhotoManagementPreview} from '../../photo-management-preview/preview';
import '../../(public)/history/history.css';
import '../../(public)/history/manage-preview/manage-preview.css';
export const metadata:Metadata={title:'관리자 활동 사진 관리',robots:{index:false,follow:false}};
async function ProtectedPhotos(){
 const access=await historyPhotoPageAccess(process.env.NODE_ENV,(await headers()).get('host'),developmentAdminAccess);
 if(access==='disabled')notFound();
 if(access==='anonymous')redirect('/login');
 if(access!=='admin')return <main className="login-page"><section className="login-card" data-photo-admin-blocked>
  <span className="eyebrow">활동 사진 관리 · 접근 제한</span><h1>관리자 접근 거부</h1>
  <p role="status">{access==='denied'?'이 계정은 관리자로 등록되어 있지 않습니다.':'독립 테스트 환경의 관리자 인증 연결을 확인하지 못했습니다. 실제 저장은 차단됩니다.'}</p>
  {access==='error'&&<p>이 페이지는 기존 getUser() 및 admin_users 확인이 필요합니다. 동일한 독립 Supabase 세션을 다시 검증하며 관리자 검사를 우회하지 않습니다.</p>}
 </section></main>;
 return <AdminShell current="history" title="히스토리 사진 관리"><section className="activity-manager history-page" id="public-main"><PhotoManagementPreview/></section></AdminShell>;
}
export default function Page(){return <Suspense fallback={<main className="login-page" role="status">관리자 권한 확인 중…</main>}><ProtectedPhotos/></Suspense>;}
