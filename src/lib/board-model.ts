export const boardCategories = ['공지', '자유', '행사', '시스템'] as const;
export type BoardPost = { id: string; author_id: string; author_name: string; title: string; body: string; category: string; is_pinned: boolean; created_at: string; updated_at: string };
export type BoardComment = { id: string; post_id: string; author_id: string; author_name: string; body: string; created_at: string };
export type BoardData = { userId: string; posts: BoardPost[]; comments: BoardComment[] };
export function pinned(post: BoardPost) { return post.category === '공지' && post.is_pinned; }
export function filterPosts(posts: BoardPost[], search: string, category = '', onlyPinned = false) {
  const query = search.trim().normalize('NFKC').toLocaleLowerCase('ko');
  return posts.filter(p => (!category || p.category === category) && (!onlyPinned || pinned(p)) && [p.title, p.body, p.author_name].join(' ').normalize('NFKC').toLocaleLowerCase('ko').includes(query))
    .sort((a, b) => Number(pinned(b)) - Number(pinned(a)) || b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
}
export function boardInput(form: FormData) {
  const title = String(form.get('title') ?? '').trim();
  const body = String(form.get('body') ?? '').trim();
  const category = String(form.get('category') ?? '');
  if (!title || title.length > 200 || !body || body.length > 20000 || !boardCategories.some(c => c === category)) throw new Error('제목(200자 이내), 본문(20,000자 이내), 카테고리를 확인해주세요.');
  return { title, body, category, is_pinned: category === '공지' && form.get('is_pinned') === 'on' };
}
