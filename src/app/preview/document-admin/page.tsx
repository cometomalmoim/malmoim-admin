import { notFound } from 'next/navigation';
import { DocumentAdminPreview } from '@/components/document-admin/document-admin-preview';

export default function Page() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <DocumentAdminPreview />;
}
