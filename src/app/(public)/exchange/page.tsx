import {ParticipationPage} from '@/components/participation/participation-page';
import {publicMetadata} from '@/lib/public-metadata';
export const metadata=publicMetadata('ko','exchange');
export default function Page(){return <ParticipationPage kind="exchange" locale="ko"/>;}
