// Network features: contact-file parsing, duplicate rules, merges, follow-ups and referral drafts.
// Run with `npm test` (Node's built-in test runner; Node 22.18+ reads TypeScript directly).
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  detectFormat,
  guessMapping,
  mapRow,
  parseCsv,
  parseVcards,
  safeCell,
  vcardDate,
} from "../src/lib/contact-import.ts";
import { emailKey, phoneKey } from "../src/lib/contact-keys.ts";
import { groupDuplicates, mergedPatch, needsFollowUp } from "../src/lib/network-logic.ts";
import {
  buildReferralMessage,
  mailtoLink,
  waNumber,
  whatsappLink,
} from "../src/lib/referral-message.ts";
import type { Contact } from "../src/lib/contact-fields.ts";

test("phone numbers match however they are written", () => {
  assert.equal(phoneKey("+91 98765 43210"), "9876543210");
  assert.equal(phoneKey("098765-43210"), "9876543210");
  assert.equal(phoneKey("(987) 654-3210"), "9876543210");
  assert.equal(phoneKey("12"), "");
  assert.equal(emailKey(" Asha@Example.COM "), "asha@example.com");
  assert.equal(emailKey("not an email"), "");
});

const VCF = [
  "BEGIN:VCARD",
  "VERSION:3.0",
  "FN:Asha Rao",
  "N:Rao;Asha;;;",
  "TEL;TYPE=HOME:080 2222 3333",
  "TEL;TYPE=CELL:+91 98765 43210",
  "EMAIL;TYPE=INTERNET:asha@example.com",
  "BDAY:1988-04-09",
  "ADR;TYPE=HOME:;;12 MG Road;Bengaluru;KA;560001;India",
  "ORG:Acme Traders;Sales",
  "TITLE:Store manager",
  "NOTE:Met at the school\\, annual day",
  "PHOTO;ENCODING=b;TYPE=JPEG:/9j/4AAQSkZJRgABAQ",
  "END:VCARD",
  "BEGIN:VCARD",
  "VERSION:2.1",
  "N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Kumar;Ravi=20K;;;",
  "TEL;CELL:9988776655",
  "BDAY:--0517",
  "END:VCARD",
  "BEGIN:VCARD",
  "VERSION:4.0",
  "item1.EMAIL:no-name@example.com",
  "END:VCARD",
].join("\r\n");

test("vCards from phones give names, mobile first, birthday and city", () => {
  const { format, rows } = parseVcards(VCF);
  assert.equal(format, "vcard");
  assert.equal(rows.length, 2); // the card with neither a name nor a number is skipped
  const mapped = mapRow(rows[0], guessMapping(Object.keys(rows[0])));
  assert.equal(mapped.name, "Asha Rao");
  assert.equal(mapped.phone, "+91 98765 43210");
  assert.equal(mapped.email, "asha@example.com");
  assert.equal(mapped.date_of_birth, "1988-04-09");
  assert.equal(mapped.city, "Bengaluru");
  assert.equal(mapped.occupation, "Store manager");
  assert.equal(mapped.notes, "Met at the school, annual day");
  const second = mapRow(rows[1], guessMapping(Object.keys(rows[1])));
  assert.equal(second.name, "Ravi K Kumar"); // quoted-printable "=20" decoded, first + last joined
  assert.equal(second.phone, "9988776655");
  assert.equal(second.date_of_birth, undefined); // "--0517" has no year: not a date we can save
});

test("a file that isn't a vCard says so", () => {
  assert.throws(() => parseVcards("hello"), /no contacts/);
});

test("Google, Outlook and LinkedIn exports are recognised and map themselves", () => {
  const google = parseCsv(
    "Given Name,Family Name,Phone 1 - Value,Phone 2 - Value,E-mail 1 - Value,Birthday,Address 1 - City\n" +
      "Meera,Iyer,+91 90000 11111,080 1234 5678,meera@example.com,17/05/1990,Chennai\n",
  );
  assert.equal(google.format, "google");
  const m = mapRow(google.rows[0], guessMapping(google.headers));
  assert.deepEqual(
    [m.name, m.phone, m.email, m.city, vcardDate(m.date_of_birth)],
    ["Meera Iyer", "+91 90000 11111", "meera@example.com", "Chennai", "1990-05-17"],
  );

  assert.equal(
    detectFormat(["First Name", "Middle Name", "Last Name", "E-mail Address", "Mobile Phone"]),
    "outlook",
  );

  const linkedin = parseCsv(
    'Notes:\n"When exporting your connection data, you may notice..."\n\n' +
      "First Name,Last Name,URL,Email Address,Company,Position,Connected On\n" +
      "Dev,Shah,https://www.linkedin.com/in/devshah,,Globex,CFO,01 Nov 2026\n",
  );
  assert.equal(linkedin.format, "linkedin");
  const l = mapRow(linkedin.rows[0], guessMapping(linkedin.headers));
  assert.equal(l.name, "Dev Shah");
  assert.equal(l.occupation, "CFO");
});

test("only the first of several same-field columns is guessed", () => {
  const g = guessMapping(["Phone 1 - Value", "Home Phone", "Name"]);
  assert.equal(g["Phone 1 - Value"], "phone");
  assert.equal(g["Home Phone"], "__ignore");
});

test("exported cells never run as spreadsheet formulas, but phone numbers stay readable", () => {
  assert.equal(safeCell('=HYPERLINK("x")'), '\'=HYPERLINK("x")');
  assert.equal(safeCell("@SUM(A1)"), "'@SUM(A1)");
  assert.equal(safeCell("+91 98765 43210"), "+91 98765 43210");
  assert.equal(safeCell(["vip", "family"]), "vip, family");
});

function contact(p: Partial<Contact> & { id: string; name: string }): Contact {
  return {
    user_id: "u",
    phone: null,
    email: null,
    gender: null,
    age: null,
    date_of_birth: null,
    occupation: null,
    city: null,
    income: null,
    preferred_language: null,
    lead_source: null,
    tags: [],
    whatsapp_opt_in: false,
    sms_opt_in: false,
    email_opt_in: false,
    preferred_channel: "whatsapp",
    lead_score: 0,
    pipeline_stage: "new",
    last_contact_at: null,
    next_followup_at: null,
    notes: null,
    ai_summary: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    ...p,
  };
}

test("duplicates: same phone, same email, or same name in the same city; a name alone is not enough", () => {
  const groups = groupDuplicates([
    contact({ id: "a", name: "Asha Rao", phone: "+91 98765 43210" }),
    contact({ id: "b", name: "Asha R", phone: "9876543210", email: "asha@x.com" }),
    contact({ id: "c", name: "A. Rao", email: "ASHA@x.com" }), // joins through b's email
    contact({ id: "d", name: "Ravi Kumar", city: "Pune" }),
    contact({ id: "e", name: "ravi  kumar", city: "pune" }),
    contact({ id: "f", name: "Ravi Kumar", city: "Delhi" }),
    contact({ id: "g", name: "Ravi Kumar" }),
  ]);
  const ids = groups.map((g) =>
    g.contacts
      .map((c) => c.id)
      .sort()
      .join(""),
  );
  assert.deepEqual(ids, ["abc", "de"]);
  assert.deepEqual(groups[0].reasons, ["Same email", "Same phone"]);
});

test("a merge fills blanks, combines tags, joins notes and keeps the best score", () => {
  const keep = contact({
    id: "k",
    name: "Asha",
    phone: "1",
    tags: ["vip"],
    notes: "first",
    lead_score: 20,
  });
  const other = contact({
    id: "o",
    name: "Asha R",
    phone: "2",
    email: "a@x.com",
    city: "Pune",
    tags: ["vip", "family"],
    notes: "second",
    lead_score: 55,
  });
  const patch = mergedPatch(keep as never, [other as never]);
  assert.equal(patch.phone, undefined); // kept contact's own value wins
  assert.equal(patch.email, "a@x.com");
  assert.equal(patch.city, "Pune");
  assert.deepEqual(patch.tags, ["vip", "family"]);
  assert.equal(patch.notes, "first\n\n---\n\nsecond");
  assert.equal(patch.lead_score, 55);
});

test("a merge never makes a contact referred by one of the contacts being merged into it", () => {
  const keep = contact({ id: "k", name: "A" });
  const other = contact({ id: "o", name: "B", referred_by_contact_id: "k" });
  const third = contact({ id: "t", name: "C", referred_by_contact_id: "o" });
  assert.equal(
    mergedPatch(keep as never, [other as never, third as never]).referred_by_contact_id,
    "k",
  );
  // ("k" is then cleared by the server, since it is the kept contact itself.)
});

test("a standing ask needs a follow-up after 7 days, until answered or dismissed", () => {
  const now = Date.parse("2026-11-25T12:00:00Z");
  const ask = {
    status: "asked" as const,
    asked_at: "2026-11-17T12:00:00Z",
    reminder_dismissed_at: null,
  };
  assert.equal(needsFollowUp(ask, now), true);
  assert.equal(needsFollowUp({ ...ask, asked_at: "2026-11-20T12:00:00Z" }, now), false);
  assert.equal(needsFollowUp({ ...ask, status: "replied" as const }, now), false);
  assert.equal(
    needsFollowUp({ ...ask, reminder_dismissed_at: "2026-11-24T00:00:00Z" }, now),
    false,
  );
});

test("the referral draft uses only names on screen and links open the advisor's own apps", () => {
  const text = buildReferralMessage({ clientName: "Asha Rao", advisorName: "Kiran" });
  assert.match(text, /^Hi Asha,/);
  assert.match(text, /Kiran$/);
  assert.doesNotMatch(buildReferralMessage({ clientName: "", advisorName: "me@agency.com" }), /@/);
  assert.equal(waNumber("98765 43210"), "919876543210");
  assert.equal(waNumber("+44 7700 900123"), "447700900123");
  assert.equal(whatsappLink(null, "x"), null);
  assert.ok(whatsappLink("9876543210", "Hi & bye")!.endsWith("?text=Hi%20%26%20bye"));
  assert.equal(mailtoLink("bad", "x"), null);
});

test("Google exports: middle names kept, first of several numbers, Google's own labels dropped", () => {
  const g = parseCsv(
    "First Name,Middle Name,Last Name,Labels,Phone 1 - Label,Phone 1 - Value,E-mail 1 - Value\n" +
      "Ram,Kumar,Sharma,* myContacts ::: * starred ::: Family ::: Imported on 6/8/22,Mobile,+91 98765 43210 ::: 080 2222 3333,a@x.com ::: b@x.com\n" +
      "Sita,,,* myContacts,Mobile,9988776655,\n",
  );
  const map = guessMapping(g.headers);
  assert.equal(map["Middle Name"], "middle_name");
  assert.equal(map["Labels"], "tags");
  const a = mapRow(g.rows[0], map);
  assert.deepEqual(
    [a.name, a.phone, a.email, a.tags],
    ["Ram Kumar Sharma", "+91 98765 43210", "a@x.com", "Family"],
  );
  const b = mapRow(g.rows[1], map);
  assert.equal(b.name, "Sita");
  assert.equal(b.tags, undefined); // only Google's own labels: no tag at all
});
