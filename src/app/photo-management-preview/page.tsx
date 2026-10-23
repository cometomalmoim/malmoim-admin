import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {PhotoManagementPreview} from './preview';
import '../(public)/history/history.css';
import '../(public)/history/manage-preview/manage-preview.css';
export const metadata:Metadata={title:'활동 사진 통합 테스트 · 운영 연결 없음',robots:{index:false,follow:false}};
export default function Page(){if(process.env.NODE_ENV!=='development')notFound();return <main className="activity-manager history-page" id="public-main"><PhotoManagementPreview/></main>;}
