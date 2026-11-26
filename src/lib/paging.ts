/** Page arithmetic for the contacts list (1-based pages). Kept pure so it can be unit-tested. */
export const CONTACTS_PAGE_SIZE = 100;
export const MAX_PAGE_SIZE = 200;

export function clampPageSize(size: number | undefined): number {
  const n = Math.floor(Number(size) || CONTACTS_PAGE_SIZE);
  return Math.min(MAX_PAGE_SIZE, Math.max(1, n));
}

/** Row range for a page, as the inclusive `from`/`to` offsets Supabase's `.range()` expects. */
export function pageRange(page: number | undefined, pageSize: number) {
  const p = Math.max(1, Math.floor(Number(page) || 1));
  const from = (p - 1) * pageSize;
  return { page: p, from, to: from + pageSize - 1 };
}

export function lastPage(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** "101–200 of 3,607" style label; "0 contacts" when empty. */
export function pageLabel(page: number, pageSize: number, total: number): string {
  if (total <= 0) return "0 of 0";
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  const f = (n: number) => n.toLocaleString("en-IN");
  return `${f(first)}–${f(last)} of ${f(total)}`;
}
