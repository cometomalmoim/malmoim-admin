import 'server-only';
import { getAdminAccess } from './auth';
import { createClient } from './supabase/server';
import type { BoardData } from './board-model';
export async function getBoard(): Promise<BoardData | null> {
  if ((await getAdminAccess()).status !== 'admin') return null;
  try {
    const client = await createClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return null;
    const [posts, comments] = await Promise.all([
      client.from('internal_board_posts').select('*').order('created_at', { ascending: false }),
      client.from('internal_board_comments').select('*').order('created_at'),
    ]);
    if (posts.error || comments.error) return null;
    return { userId: user.id, posts: posts.data, comments: comments.data };
  } catch { return null; }
}
