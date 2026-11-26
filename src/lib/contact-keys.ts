/** Keys used to spot the same person twice (import checks and the duplicates page). No dependencies: server-safe. */

/** Digits only, compared on the last 10 so "+91 98765 43210", "098765-43210" and "9876543210" are the same number. */
export function phoneKey(value: string | null | undefined): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length < 6) return "";
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function emailKey(value: string | null | undefined): string {
  const v = String(value ?? "")
    .trim()
    .toLowerCase();
  return v.includes("@") ? v : "";
}

export function nameKey(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
