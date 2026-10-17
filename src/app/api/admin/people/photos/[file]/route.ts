import { getAdminAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
export async function GET(_request: Request, { params }: { params: Promise<{file: string}> }) {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  if ((await getAdminAccess()).status !== 'admin') return new Response(null, {status:403, headers});
  const { file } = await params;
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(file)) return new Response(null, {status:404, headers});
  try {
    const client = await createClient();
    const result = await client.storage.from('people-photos').download(file);
    if (result.error) return new Response(null, {status:404, headers});
    return new Response(result.data, { headers: {...headers, 'Content-Type': file.endsWith('.jpg') ? 'image/jpeg' : file.endsWith('.png') ? 'image/png' : 'image/webp', 'Content-Disposition': `inline; filename="${file}"`}});
  } catch { return new Response(null, {status:503, headers}); }
}
