'use server';
import { createClient } from '@/lib/supabase/server';
import { getAdminAccess } from '@/lib/auth';
import { inquiryInput, inquiryReplyInput, inquiryToken } from '@/lib/inquiry-validation';
import { revalidatePath } from 'next/cache';

export type InquiryState = { code: string; token?: string };
export async function submitInquiry(_state: InquiryState, form: FormData): Promise<InquiryState> {
 const input = inquiryInput(form);
 if (!input) return { code: 'invalid' };
 try {
  const client = await createClient();
  const result = await client.rpc('submit_event_inquiry', { p_slug: input.slug, p_token: input.token, p_name: input.name, p_subject: input.subject, p_content: input.content, p_locale: input.locale, p_consent: true });
  if (result.error) return { code: 'error' };
  if (result.data === 'saved') { revalidatePath('/admin', 'layout'); return { code: 'saved', token: input.token }; }
  return { code: ['closed', 'rate_limited', 'invalid'].includes(result.data) ? result.data : 'error' };
 } catch { return { code: 'error' }; }
}
export type InquiryReceipt = { event_title: string; name: string; subject: string; content: string; locale: string; status: string; created_at: string; replies: { id: string; body: string; created_at: string }[] };
export async function readInquiry(token: string): Promise<{ code: string; item?: InquiryReceipt }> {
 if (!inquiryToken(token)) return { code: 'missing' };
 try {
  const client = await createClient();
  const result = await client.rpc('read_event_inquiry', { p_token: token });
  if (result.error) return { code: 'error' };
  return result.data ? { code: 'ready', item: result.data } : { code: 'missing' };
 } catch { return { code: 'error' }; }
}
export async function replyInquiry(_state: InquiryState, form: FormData): Promise<InquiryState> {
 if ((await getAdminAccess()).status !== 'admin') return { code: 'forbidden' };
 const input = inquiryReplyInput(form);
 if (!input) return { code: 'invalid' };
 try {
  const client = await createClient();
  const result = await client.rpc('reply_event_inquiry', { p_id: input.id, p_revision: input.revision, p_body: input.body });
  if (result.error) return { code: 'error' };
  if (result.data === 'saved') revalidatePath('/admin', 'layout');
  return { code: result.data ?? 'error' };
 } catch { return { code: 'error' }; }
}

// Count only; no inquiry content or receipt links cross this boundary.
export async function unansweredInquiryCount(): Promise<number | null> {
 if ((await getAdminAccess()).status !== 'admin') return null;
 try {
  const client = await createClient();
  const { count, error } = await client.from('event_inquiries').select('id', { count: 'exact', head: true }).eq('status', 'received');
  return error ? null : count;
 } catch { return null; }
}
