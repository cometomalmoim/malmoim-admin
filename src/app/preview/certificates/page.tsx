import {notFound} from 'next/navigation';
import {CertificateView} from '@/components/admin/certificate-view';
export default function Page(){if(process.env.NODE_ENV!=='development')notFound();return <CertificateView preview/>;}
