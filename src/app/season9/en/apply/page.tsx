import type {Metadata} from 'next';
import {ApplicationPage} from '@/components/season9/application-page';
export const metadata:Metadata={title:'Season 9 application | MALMOIM',robots:{index:false,follow:false}};
export default function Page(){return <ApplicationPage initialLocale="en"/>;}
