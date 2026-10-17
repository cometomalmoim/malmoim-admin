export const PHOTO_LIMIT = 3 * 1024 * 1024;
export function photoExtension(bytes: Uint8Array, mime: string) {
  if (!bytes.length || bytes.length > PHOTO_LIMIT) throw new Error('사진은 3MB 이하로 선택해주세요.');
  if (mime === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpg';
  if (mime === 'image/png' && [137,80,78,71,13,10,26,10].every((b,i) => bytes[i] === b)) return 'png';
  if (mime === 'image/webp' && new TextDecoder().decode(bytes.slice(0,4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8,12)) === 'WEBP') return 'webp';
  throw new Error('JPG, PNG, WebP 이미지 파일을 선택해주세요.');
}
