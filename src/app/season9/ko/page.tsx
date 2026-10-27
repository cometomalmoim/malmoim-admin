import {SeasonLanding} from '@/components/season9/season-landing';
import {season9Metadata} from '@/lib/season9-landing';
export const metadata=season9Metadata('ko');
export default function Page(){return <SeasonLanding locale="ko"/>;}
