/**
 * Optional bilingual album copy uses "Korean | English" for the title and
 * "Korean\nEnglish" for the description. Only split a complete, recognizable
 * pair; ordinary operator-written titles and multiline descriptions stay intact.
 * The original stored copy remains available in the existing admin editor.
 */
export function albumCopy(
  album: { title: string; description: string },
  locale?: 'ko' | 'en',
) {
  const original = { title: album.title, description: album.description };
  if (!locale) return original;
  const titles = album.title.split(' | ');
  const descriptions = album.description.split(/\r?\n/);
  if (
    titles.length !== 2 || descriptions.length !== 2 ||
    ![titles[0], descriptions[0]].every(value => /[가-힣]/.test(value)) ||
    ![titles[1], descriptions[1]].every(value => /[a-z]/i.test(value) && !/[가-힣]/.test(value)) ||
    [...titles, ...descriptions].some(value => !value.trim())
  ) return original;
  const index = locale === 'en' ? 1 : 0;
  return { title: titles[index].trim(), description: descriptions[index].trim() };
}
