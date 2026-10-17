import { notFound } from 'next/navigation';
import { PdfFieldEditor } from '@/components/pdf-fields/pdf-field-editor';

export default function Page() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <PdfFieldEditor />;
}
