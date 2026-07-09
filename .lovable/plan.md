
# InsureFlow — Solo Advisor CRM Foundation

Single-user CRM: email/password auth, Contacts module scoped to `auth.uid()`. No orgs, no teams.

## 1. Backend (Lovable Cloud)

**Enums**
- `preferred_channel`: whatsapp | sms | email
- `pipeline_stage`: new | contacted | qualified | proposal | won | lost

**Table `contacts`**
All fields from spec + `id uuid pk`, `user_id uuid references auth.users not null`, `created_at`, `updated_at`. Tags as `text[]`. Indexes on `user_id`, `pipeline_stage`, `next_followup_at`, `lead_score`.

**RLS**
Enabled. Four policies (select/insert/update/delete) all `USING/WITH CHECK (auth.uid() = user_id)`.

**GRANTs**
`SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated; ALL TO service_role`.

**Trigger**
`updated_at` auto-touch on update.

## 2. Auth

- `/auth` route — public, tabs for Sign in / Sign up (email+password). `emailRedirectTo: window.location.origin`.
- Managed `_authenticated/` layout (already provided by integration) gates the app.
- Root `onAuthStateChange` filtered to SIGNED_IN/SIGNED_OUT/USER_UPDATED → `router.invalidate()` + query invalidate.
- Sign-out in top bar with proper hygiene (cancel queries, clear cache, signOut, navigate replace to /auth).

## 3. App Shell

`_authenticated/route.tsx` renders sidebar layout:
- Sidebar: InsureFlow logo, "Contacts" nav item, user email + sign-out at bottom.
- `<Outlet />` for content.

Only one module for v1: Contacts.

## 4. Contacts List — `/_authenticated/contacts`

Data-dense shadcn `Table`:
- Columns: Name, Phone, Email, City, Stage (colored badge), Score (tabular nums), Next follow-up (relative), Tags (chips, truncated).
- Sticky header, compact row height (~40px), zebra off, hover highlight.
- Toolbar row:
  - Search input (debounced 250ms) — name/phone/email/city
  - Pipeline stage multi-select (shadcn popover + checkbox list)
  - Tag multi-select (built from distinct tags of user's contacts)
  - Sort dropdown: lead score ↓/↑, next follow-up ↑/↓ (defaults: score desc)
  - Right side: "Import CSV" button, "Add contact" primary button
- Row click → opens detail drawer.
- Empty state with CTA to add first contact or import.

## 5. Detail Drawer — shadcn `Sheet` (right side, ~520px)

Grouped sections:
- **Identity**: name, gender, age, DOB, occupation, city, income, preferred language
- **Contact & channels**: phone, email, opt-ins (whatsapp/sms/email switches), preferred_channel
- **Lead**: lead source, tags (tag input), lead_score (number), pipeline_stage
- **Follow-up**: last_contact_at, next_followup_at (date-time pickers)
- **Notes**: multi-line textarea

Inline edit pattern: each field is a small inline-editable component (click to edit → save on blur/Enter, revert on Esc). Optimistic update via TanStack Query mutation; toast on error. Delete button in drawer footer with confirmation.

## 6. Add Contact — Dialog

`react-hook-form` + `zod`. Required: name and (phone OR email). All other fields optional. Sensible defaults (stage=new, lead_score=0, opt-ins=false, preferred_channel=whatsapp).

## 7. CSV Import — `/_authenticated/contacts/import`

Wizard (single page, stepped state):
1. **Upload**: drop CSV, parse client-side with `papaparse`.
2. **Map columns**: for each CSV header, a `Select` picking a contact field (or Ignore). Auto-guess by normalized header match. Show first 3 preview rows.
3. **Review**: for each row, validate & check duplicates:
   - Duplicate = phone or email matches an existing contact of this user.
   - Show table with badges: `Ready`, `Duplicate (phone)`, `Duplicate (email)`, `Invalid`. Per-row checkbox to include/skip. Stats bar: N ready, N duplicates, N invalid.
4. **Import**: server fn `bulkCreateContacts` inserts selected rows (chunked 200). Progress toast + summary.

Duplicate check uses a server fn returning existing phones+emails in a single query.

## 8. Server Functions (`src/lib/contacts.functions.ts`)

All `.middleware([requireSupabaseAuth])`:
- `listContacts({ search?, stages?, tags?, sort? })` — server-side filter/sort
- `getContact({ id })`
- `createContact(data)`
- `updateContact({ id, patch })`
- `deleteContact({ id })`
- `getDistinctTags()` — for filter dropdown
- `getDuplicateKeys()` — returns `{ phones: string[], emails: string[] }` for import
- `bulkCreateContacts({ rows })` — inserts, returns per-row result

Client wires via `queryOptions` + `useSuspenseQuery` for reads, `useMutation` invalidating `["contacts"]` (and `["tags"]` when tags change).

## 9. Design System

Clean, professional, data-dense advisor tool. Light theme only (no dark toggle).

`src/styles.css` semantic tokens:
- Primary: deep teal `oklch(0.52 0.11 200)`
- Background: near-white `oklch(0.99 0.003 240)`
- Foreground: slate `oklch(0.20 0.02 250)`
- Muted, border, accent tuned for density
- Stage badge tokens: `--stage-new` (slate), `--stage-contacted` (blue), `--stage-qualified` (violet), `--stage-proposal` (amber), `--stage-won` (green), `--stage-lost` (red) — each with matching fg
- Tabular numerals for scores/dates
- Inter font (via `<link>` in root head)

Custom shadcn variants where needed (`Badge` variant per stage, compact `Table` classes).

## 10. Head Metadata

Root: title "InsureFlow — Insurance CRM for advisors", matching description, og/twitter. Contacts route sets its own title.

## Out of scope for v1
Policies, tasks, campaigns, communications sending, reporting, mobile-optimized layouts (desktop-first).

Building this now.
