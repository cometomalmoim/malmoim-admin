export const BOARD_IMAGE_COUNT = 4;
export const BOARD_IMAGE_TOTAL = 4 * 1024 * 1024;
export function boardImageUrl(path: string) {
  return `/api/admin/board/images/${path}`;
}
export function retainedImages(form: FormData) {
  const paths = form.getAll('retained_images').map(String);
  if (paths.length > BOARD_IMAGE_COUNT || paths.some(p => !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(p))) throw new Error('첨부 이미지를 확인해주세요.');
  return [...new Set(paths)];
}
