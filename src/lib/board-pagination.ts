export const BOARD_PAGE_SIZE = 10;
export function boardPage<T>(rows: T[], requested: number) {
  const totalPages = Math.max(1, Math.ceil(rows.length / BOARD_PAGE_SIZE));
  const page = Math.max(1, Math.min(totalPages, Number.isFinite(requested) ? Math.floor(requested) : 1));
  return { page, totalPages, rows: rows.slice((page - 1) * BOARD_PAGE_SIZE, page * BOARD_PAGE_SIZE) };
}
export function boardPageNumbers(page: number, totalPages: number): (number | '…')[] {
  const pages = Array.from(new Set([1, totalPages, page - 1, page, page + 1].filter(n => n >= 1 && n <= totalPages))).sort((a, b) => a - b);
  const result: (number | '…')[] = [];
  pages.forEach((n, i) => {
    const previous = pages[i - 1];
    if (i && n - previous === 2) result.push(previous + 1);
    else if (i && n - previous > 2) result.push('…');
    result.push(n);
  });
  return result;
}
