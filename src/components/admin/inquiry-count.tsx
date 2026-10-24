"use client";
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { unansweredInquiryCount } from '@/app/actions/inquiries';

export function InquiryCount() {
 const pathname = usePathname();
 const [count, setCount] = useState<number | null>(null);
 useEffect(() => {
  let active = true;
  let loading = false;
  const update = async () => {
   if (loading || document.visibilityState === 'hidden') return;
   loading = true;
   try { const value = await unansweredInquiryCount(); if (active) setCount(value); }
   catch { if (active) setCount(null); }
   finally { loading = false; }
  };
  void update();
  const timer = window.setInterval(update, 60000);
  window.addEventListener('focus', update);
  window.addEventListener('inquiry-replied', update);
  return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', update); window.removeEventListener('inquiry-replied', update); };
 }, [pathname]);
 return count !== null && count > 0 ? <span className="ops-inquiry-count" aria-label={`미답변 ${count}건`} title={`미답변 문의 ${count}건`}>{count > 99 ? '99+' : count}</span> : null;
}
