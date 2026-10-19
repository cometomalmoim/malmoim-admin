import type { Metadata } from 'next';
import './inquiries.css';
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: 'no-referrer', title: '말모임 운영진 문의 · MALMOIM inquiries' };
export default function Layout({ children }: { children: React.ReactNode }) { return <main className="inquiry-site">{children}</main>; }
