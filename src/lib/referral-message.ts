/**
 * The referral request an advisor sends a client themselves. It is a plain, editable draft that uses only what is on
 * screen (the client's name and the advisor's own name): no invented claims, no promised rewards. The links open the
 * advisor's own WhatsApp, SMS or email app with the text filled in; the advisor presses Send there. Nothing here sends.
 */

export function firstName(full: string | null | undefined): string {
  const word =
    String(full ?? "")
      .trim()
      .split(/\s+/)[0]
      ?.replace(/[,;:]+$/, "") ?? "";
  return word && word.length <= 40 ? word : "there";
}

/** The advisor's own name for the sign-off. An email address (or nothing) is never used as a name. */
export function signOffName(name: string | null | undefined): string {
  const clean = String(name ?? "").trim();
  return clean && !clean.includes("@") && clean.length <= 80 ? clean : "";
}

export function buildReferralMessage({
  clientName,
  advisorName,
}: {
  clientName: string | null | undefined;
  advisorName?: string | null;
}): string {
  const me = signOffName(advisorName);
  return [
    `Hi ${firstName(clientName)},`,
    "",
    "Thank you for trusting me with your insurance. If you know a friend, relative or colleague who is thinking about " +
      "life, health or motor cover, would you be open to introducing us? I'll make sure they get the same care you do.",
    "",
    "No pressure at all, and thank you either way.",
    "",
    me ? `Warm regards,\n${me}` : "Warm regards,",
  ].join("\n");
}

/** Digits for wa.me: a 10-digit Indian mobile gets the 91 country code; anything else is used as written. */
export function waNumber(phone: string | null | undefined): string {
  const digits = String(phone ?? "")
    .replace(/\D/g, "")
    .replace(/^0+/, "");
  if (digits.length === 10) return `91${digits}`;
  return digits.length >= 8 && digits.length <= 15 ? digits : "";
}

export function whatsappLink(phone: string | null | undefined, text: string): string | null {
  const n = waNumber(phone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null;
}

export function smsLink(phone: string | null | undefined, text: string): string | null {
  const p = String(phone ?? "").replace(/[^\d+]/g, "");
  return p.length >= 8 ? `sms:${p}?body=${encodeURIComponent(text)}` : null;
}

export function mailtoLink(email: string | null | undefined, text: string): string | null {
  const e = String(email ?? "").trim();
  if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(e)) return null;
  return `mailto:${encodeURIComponent(e)}?subject=${encodeURIComponent("A small request")}&body=${encodeURIComponent(text)}`;
}
