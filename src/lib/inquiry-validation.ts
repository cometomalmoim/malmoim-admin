export const inquiryToken = (value: string) => /^[a-f0-9]{64}$/.test(value);
export const inquiryUuid = (value: string) => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
export function inquiryInput(data: FormData) {
 const slug = String(data.get('event') ?? '');
 const token = String(data.get('token') ?? '');
 const name = String(data.get('name') ?? '').trim();
 const subject = String(data.get('subject') ?? '').trim();
 const content = String(data.get('content') ?? '').trim();
 const locale = data.get('locale') === 'en' ? 'en' : 'ko';
 if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(slug) || !inquiryToken(token) || !name || name.length > 60 || !subject || subject.length > 120 || !content || content.length > 3000 || data.get('consent') !== 'on' || String(data.get('website') ?? '')) return null;
 return { slug, token, name, subject, content, locale };
}
export function inquiryReplyInput(data: FormData) {
 const id = String(data.get('id') ?? '');
 const revision = Number(data.get('revision'));
 const body = String(data.get('body') ?? '').trim();
 if (!inquiryUuid(id) || !Number.isSafeInteger(revision) || revision < 0 || !body || body.length > 3000) return null;
 return { id, revision, body };
}
export function inquiryReceiptUrl(token: string) {
 return inquiryToken(token) ? `https://malmoim.com/inquiries/receipt#token=${token}` : '';
}
