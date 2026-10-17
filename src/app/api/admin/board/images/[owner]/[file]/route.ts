import { getAdminAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
export async function GET(_request: Request, { params }: { params: Promise<{owner: string; file: string}> }) {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  if ((await getAdminAccess()).status !== 'admin') return new Response(null, { status: 403, headers });
  const { owner, file } = await params;
  if (!/^[0-9a-f-]{36}$/.test(owner) || !/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(file)) return new Response(null, { status: 404, headers });
  try {
    const client = await createClient();
    const path = `${owner}/${file}`;
    const post = await client.from('internal_board_posts').select('id').contains('images', [path]).limit(1);
    if (post.error || !post.data?.length) return new Response(null, { status: 404, headers });
    const result = await client.storage.from('board-images').download(path);
    if (result.error) return new Response(null, { status: 404, headers });
    return new Response(result.data, { headers: { ...headers, 'Content-Type': file.endsWith('.jpg') ? 'image/jpeg' : file.endsWith('.png') ? 'image/png' : 'image/webp' } });
  } catch { return new Response(null, { status: 503, headers }); }
}
