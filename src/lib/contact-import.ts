/**
 * Reading contact files exported from phones, Google Contacts, Outlook and LinkedIn into the plain table the import page
 * maps (headers + rows), plus the phone/email keys used to spot duplicates.
 *
 * - vCard (.vcf, from Android/iPhone/Google/Outlook/iCloud): versions 2.1, 3.0 and 4.0, folded lines, backslash escapes,
 *   grouped properties ("item1.TEL") and quoted-printable values. Photos and other binary values are skipped.
 * - CSV: Google Contacts, Outlook and LinkedIn Connections exports are recognised by their own headings so their columns
 *   map automatically (LinkedIn's export starts with a "Notes:" preamble, which is skipped).
 *
 * Nothing here is sent anywhere: files are read in the browser and only the rows the advisor confirms are saved.
 */
import Papa from "papaparse";
import type { ContactInput } from "./contact-fields.ts";

export const MAX_IMPORT_ROWS = 30_000;
/** Byte-order mark: stripped when reading, and written first on export so Excel opens the CSV as UTF-8. */
const BOM = String.fromCharCode(0xfeff);

export type SourceFormat = "vcard" | "google" | "outlook" | "linkedin" | "csv";

export const SOURCE_LABEL: Record<SourceFormat, string> = {
  vcard: "Phone contacts (vCard)",
  google: "Google Contacts",
  outlook: "Outlook",
  linkedin: "LinkedIn connections",
  csv: "CSV",
};

export type ParsedFile = {
  format: SourceFormat;
  headers: string[];
  rows: Record<string, string>[];
};

export class ImportFileError extends Error {}

export { phoneKey, emailKey, nameKey } from "./contact-keys.ts";

// ── vCard ────────────────────────────────────────────────────────────────────────────────────────────────

export const VCARD_HEADERS = [
  "Full name",
  "First name",
  "Last name",
  "Mobile",
  "Phone",
  "Email",
  "Birthday",
  "City",
  "Company",
  "Job title",
  "Note",
];

function unfold(text: string): string[] {
  const lines: string[] = [];
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const last = lines.length - 1;
    if (/^[ \t]/.test(raw) && lines.length) lines[last] += raw.slice(1);
    else if (lines.length && /=$/.test(lines[last]) && /QUOTED-PRINTABLE/i.test(lines[last])) {
      lines[last] = lines[last].slice(0, -1) + raw;
    } else lines.push(raw);
  }
  return lines;
}

function decodeQuotedPrintable(value: string): string {
  const bytes: number[] = [];
  const enc = new TextEncoder();
  for (let i = 0; i < value.length; i += 1) {
    if (value[i] === "=" && /^[0-9A-F]{2}$/i.test(value.slice(i + 1, i + 3))) {
      bytes.push(parseInt(value.slice(i + 1, i + 3), 16));
      i += 2;
    } else bytes.push(...enc.encode(value[i]));
  }
  return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
}

const unescapeValue = (v: string) =>
  v.replace(/\\([\\,;nN])/g, (_, c) => (c === "n" || c === "N" ? "\n" : c));

/** Split a structured value ("Family;Given;Middle") on unescaped semicolons. */
function parts(value: string): string[] {
  const out: string[] = [];
  let current = "";
  for (let i = 0; i < value.length; i += 1) {
    if (value[i] === "\\" && i + 1 < value.length) {
      current += value.slice(i, i + 2);
      i += 1;
    } else if (value[i] === ";") {
      out.push(current);
      current = "";
    } else current += value[i];
  }
  out.push(current);
  return out.map((p) => unescapeValue(p).trim());
}

function parseLine(line: string) {
  const colon = line.indexOf(":");
  if (colon < 0) return null;
  const [rawName, ...params] = line.slice(0, colon).split(";");
  const name = (rawName.split(".").pop() ?? "").toUpperCase();
  const paramText = params.join(";").toUpperCase();
  let value = line.slice(colon + 1);
  if (/ENCODING=QUOTED-PRINTABLE|(^|;)QUOTED-PRINTABLE/.test(paramText))
    value = decodeQuotedPrintable(value);
  return { name, params: paramText, value };
}

/** "1990-05-17", "19900517", "--0517" (no year) -> "1990-05-17" or "" when there is no full date. */
export function vcardDate(value: string): string {
  const v = value.trim();
  let m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(v);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "";
}

type Card = {
  fn: string;
  given: string;
  family: string;
  mobile: string;
  phone: string;
  email: string;
  bday: string;
  city: string;
  org: string;
  title: string;
  note: string;
};

export function parseVcards(text: string): ParsedFile {
  const rows: Record<string, string>[] = [];
  let card: Card | null = null;
  for (const line of unfold(text)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^BEGIN:VCARD$/i.test(trimmed)) {
      card = {
        fn: "",
        given: "",
        family: "",
        mobile: "",
        phone: "",
        email: "",
        bday: "",
        city: "",
        org: "",
        title: "",
        note: "",
      };
      continue;
    }
    if (/^END:VCARD$/i.test(trimmed)) {
      if (card && (card.fn || card.given || card.family || card.mobile || card.phone)) {
        rows.push({
          "Full name": card.fn,
          "First name": card.given,
          "Last name": card.family,
          Mobile: card.mobile,
          Phone: card.phone,
          Email: card.email,
          Birthday: card.bday,
          City: card.city,
          Company: card.org,
          "Job title": card.title,
          Note: card.note,
        });
        if (rows.length > MAX_IMPORT_ROWS) {
          throw new ImportFileError(
            "This import supports up to 30,000 contacts. Split the file and import each part.",
          );
        }
      }
      card = null;
      continue;
    }
    if (!card) continue;
    const prop = parseLine(line);
    if (!prop) continue;
    const { name, params, value } = prop;
    if (name === "FN" && !card.fn) card.fn = unescapeValue(value).trim();
    else if (name === "N" && !card.given && !card.family) {
      const [family = "", given = ""] = parts(value);
      card.family = family;
      card.given = given;
    } else if (name === "TEL") {
      const num = unescapeValue(value).trim().replace(/^tel:/i, "");
      if (/CELL|MOBILE|IPHONE/.test(params) && !card.mobile) card.mobile = num;
      else if (!card.phone) card.phone = num;
    } else if (name === "EMAIL" && !card.email)
      card.email = unescapeValue(value)
        .trim()
        .replace(/^mailto:/i, "");
    else if (name === "BDAY" && !card.bday) card.bday = vcardDate(value);
    else if (name === "ADR" && !card.city) card.city = parts(value)[3] ?? "";
    else if (name === "ORG" && !card.org) card.org = parts(value)[0] ?? "";
    else if (name === "TITLE" && !card.title) card.title = unescapeValue(value).trim();
    else if (name === "NOTE" && !card.note) card.note = unescapeValue(value).trim();
  }
  if (!rows.length) {
    throw new ImportFileError(
      "This vCard file has no contacts with a name or number. Export your contacts as .vcf again.",
    );
  }
  return { format: "vcard", headers: VCARD_HEADERS, rows };
}

// ── CSV ──────────────────────────────────────────────────────────────────────────────────────────────────

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export function detectFormat(headers: string[]): SourceFormat {
  const h = headers.map(norm);
  const has = (...names: string[]) => names.some((n) => h.includes(n));
  if (has("phone 1 - value", "e-mail 1 - value") && has("first name", "given name"))
    return "google";
  if (has("first name") && has("e-mail address", "mobile phone") && has("middle name"))
    return "outlook";
  if (has("first name") && has("last name") && has("connected on")) return "linkedin";
  return "csv";
}

/** LinkedIn's Connections.csv starts with a few "Notes:" lines before the real header. */
function skipPreamble(text: string): string {
  if (!/^\s*notes:/i.test(text)) return text;
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => /first name/i.test(l) && /last name/i.test(l));
  return start >= 0 ? lines.slice(start).join("\n") : text;
}

export function parseCsv(text: string): ParsedFile {
  const res = Papa.parse<Record<string, string>>(
    skipPreamble(text.startsWith(BOM) ? text.slice(1) : text),
    {
      header: true,
      skipEmptyLines: "greedy",
    },
  );
  const headers = (res.meta.fields ?? []).filter((f) => f && f.trim());
  if (!headers.length)
    throw new ImportFileError(
      "This file has no header row. The first row should name the columns.",
    );
  if (res.data.length > MAX_IMPORT_ROWS) {
    throw new ImportFileError(
      "This import supports up to 30,000 contacts. Split the file and import each part.",
    );
  }
  return { format: detectFormat(headers), headers, rows: res.data };
}

export async function readContactFile(file: File): Promise<ParsedFile> {
  if (file.size > 32 * 1024 * 1024)
    throw new ImportFileError("This file is larger than 32 MB. Split it and import each part.");
  const text = await file.text();
  if (/\.vcf$/i.test(file.name) || /^\s*BEGIN:VCARD/i.test(text)) return parseVcards(text);
  return parseCsv(text);
}

// ── column mapping ───────────────────────────────────────────────────────────────────────────────────────

/** Import-only fields that are combined into real ones (first + last -> name, mobile preferred over phone). */
export type ExtraField = "first_name" | "last_name" | "mobile";
export type FieldKey = keyof ContactInput | ExtraField | "__ignore";

export const EXTRA_FIELDS: { key: ExtraField; label: string }[] = [
  { key: "first_name", label: "First name (joined into Name)" },
  { key: "last_name", label: "Last name (joined into Name)" },
  { key: "mobile", label: "Mobile (used before Phone)" },
];

const ALIASES: Record<string, FieldKey> = {
  name: "name",
  "full name": "name",
  fullname: "name",
  "contact name": "name",
  "display name": "name",
  "first name": "first_name",
  "given name": "first_name",
  "last name": "last_name",
  "family name": "last_name",
  surname: "last_name",
  mobile: "mobile",
  "mobile phone": "mobile",
  "mobile number": "mobile",
  cell: "mobile",
  phone: "phone",
  "phone number": "phone",
  "phone 1 - value": "phone",
  "primary phone": "phone",
  "home phone": "phone",
  "business phone": "phone",
  email: "email",
  "email address": "email",
  "e-mail address": "email",
  "e-mail 1 - value": "email",
  gender: "gender",
  age: "age",
  dob: "date_of_birth",
  "date of birth": "date_of_birth",
  birthday: "date_of_birth",
  occupation: "occupation",
  job: "occupation",
  "job title": "occupation",
  position: "occupation",
  "organization title": "occupation",
  "organization 1 - title": "occupation",
  city: "city",
  "home city": "city",
  "business city": "city",
  "address 1 - city": "city",
  income: "income",
  language: "preferred_language",
  "preferred language": "preferred_language",
  "lead source": "lead_source",
  source: "lead_source",
  tags: "tags",
  labels: "tags",
  whatsapp: "whatsapp_opt_in",
  "whatsapp opt-in": "whatsapp_opt_in",
  "whatsapp opt in": "whatsapp_opt_in",
  sms: "sms_opt_in",
  "sms opt-in": "sms_opt_in",
  "email opt-in": "email_opt_in",
  "preferred channel": "preferred_channel",
  channel: "preferred_channel",
  "lead score": "lead_score",
  score: "lead_score",
  stage: "pipeline_stage",
  pipeline: "pipeline_stage",
  "pipeline stage": "pipeline_stage",
  notes: "notes",
  note: "notes",
};

export function guessField(header: string): FieldKey {
  return ALIASES[norm(header)] ?? "__ignore";
}

/** One guess per field: when two columns guess the same field (Google has several phones), only the first keeps it. */
export function guessMapping(headers: string[]): Record<string, FieldKey> {
  const used = new Set<FieldKey>();
  const out: Record<string, FieldKey> = {};
  for (const h of headers) {
    const g = guessField(h);
    out[h] = g !== "__ignore" && used.has(g) ? "__ignore" : g;
    if (g !== "__ignore") used.add(g);
  }
  return out;
}

export function hasNameMapping(mapping: Record<string, FieldKey>): boolean {
  const v = Object.values(mapping);
  return v.includes("name") || v.includes("first_name") || v.includes("last_name");
}

/** A raw row -> mapped values, with first+last joined into name and mobile preferred over phone. */
export function mapRow(
  raw: Record<string, string>,
  mapping: Record<string, FieldKey>,
): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const [h, v] of Object.entries(raw)) {
    const field = mapping[h];
    if (!field || field === "__ignore") continue;
    const value = (v ?? "").trim();
    if (value && !mapped[field]) mapped[field] = value;
  }
  if (!mapped.name) mapped.name = [mapped.first_name, mapped.last_name].filter(Boolean).join(" ");
  if (mapped.mobile) mapped.phone = mapped.mobile;
  delete mapped.first_name;
  delete mapped.last_name;
  delete mapped.mobile;
  return mapped;
}

// ── export ───────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A cell a spreadsheet would run as a formula ("=", "+", "-", "@", tab, CR) gets a leading apostrophe. A plain number
 * such as "+91 98765 43210" or "-120" is left alone (it can't run anything, and agents export phone numbers).
 */
export function safeCell(value: unknown): string {
  if (value == null) return "";
  const s = Array.isArray(value) ? value.join(", ") : String(value);
  if (/^[+-]?[\d\s().-]+$/.test(s)) return s;
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

export function toCsv(
  rows: Record<string, unknown>[],
  columns: { key: string; label: string }[],
): string {
  return Papa.unparse({
    fields: columns.map((c) => c.label),
    data: rows.map((r) => columns.map((c) => safeCell(r[c.key]))),
  });
}

export function downloadText(filename: string, text: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([BOM, text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
